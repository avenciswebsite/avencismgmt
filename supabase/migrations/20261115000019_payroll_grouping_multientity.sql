-- ==============================================================================
-- MIGRATION 19: Multi-Entity Payroll Grouping, Processing Responsibility & Tenant Isolation
-- File: supabase/migrations/20261115000019_payroll_grouping_multientity.sql
-- Milestone: 2.4E.1 Correct Payroll Grouping Architecture
-- Status: PROPOSED FOR REVIEW — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ==============================================================================
--
-- Architectural Objectives:
-- 1. Eliminate single-entity bottleneck (unq_client_period).
-- 2. Support multiple legal entities per client organization.
-- 3. Support independent payroll runs for Avencis-managed vs. Client-managed entities.
-- 4. Enable independent approvals, review workflows, and terminal locking per legal entity.
-- 5. Guarantee complete tenant and legal-entity isolation in line items and payslips.
-- 6. Preserve all existing historical payroll records without data loss.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Preserve & Backfill Existing Records
-- ------------------------------------------------------------------------------

-- 1.1 Ensure every existing payroll_runs record has a valid legal_entity_id
-- If legal_entity_id is NULL on any legacy row, assign the client's primary legal entity
UPDATE public.payroll_runs pr
SET legal_entity_id = (
    SELECT le.id
    FROM public.client_legal_entities le
    WHERE le.client_id = pr.client_id
    ORDER BY le.is_primary DESC, le.created_at ASC
    LIMIT 1
)
WHERE pr.legal_entity_id IS NULL;

-- 1.2 Enforce NOT NULL on legal_entity_id
ALTER TABLE public.payroll_runs
ALTER COLUMN legal_entity_id SET NOT NULL;

-- 1.3 Add payroll_responsibility column to payroll_runs
ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS payroll_responsibility VARCHAR(20) NOT NULL DEFAULT 'SELF_MANAGED'
CHECK (payroll_responsibility IN ('SELF_MANAGED', 'AVENCIS_MANAGED', 'HYBRID'));

-- 1.4 Backfill payroll_responsibility from client_legal_entities
UPDATE public.payroll_runs pr
SET payroll_responsibility = COALESCE(le.payroll_responsibility, 'SELF_MANAGED')
FROM public.client_legal_entities le
WHERE pr.legal_entity_id = le.id;

-- ------------------------------------------------------------------------------
-- 2. Uniqueness Constraint Refactoring (Multi-Entity Grouping)
-- ------------------------------------------------------------------------------

-- 2.1 Drop legacy single-entity unique constraint
ALTER TABLE public.payroll_runs
DROP CONSTRAINT IF EXISTS unq_client_period;

-- 2.2 Create authoritative composite multi-entity unique constraint
-- Allows separate concurrent monthly runs for each legal entity under the same client
ALTER TABLE public.payroll_runs
ADD CONSTRAINT unq_client_legal_entity_period
UNIQUE (client_id, legal_entity_id, period_month, period_year);

-- 2.3 Create indexing for legal entity and processing responsibility queries
CREATE INDEX IF NOT EXISTS idx_payroll_runs_legal_entity_period
ON public.payroll_runs(legal_entity_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_responsibility
ON public.payroll_runs(client_id, payroll_responsibility);

-- ------------------------------------------------------------------------------
-- 3. Update Transactional RPC: public.generate_payroll_run
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_payroll_run(
    p_client_id UUID,
    p_period_month INT,
    p_period_year INT,
    p_legal_entity_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_auth_uid UUID;
    v_caller_role TEXT;
    v_caller_client_id UUID;
    v_caller_name TEXT;
    v_caller_email TEXT;
    
    v_client RECORD;
    v_legal_entity RECORD;
    v_policy RECORD;
    v_target_legal_entity_id UUID;
    v_start_date DATE;
    v_end_date DATE;
    v_days_in_month INT;
    v_pending_corrections INT;
    
    v_run_id VARCHAR(150);
    v_total_employees INT := 0;
    v_total_gross NUMERIC(14,2) := 0;
    v_total_deductions NUMERIC(14,2) := 0;
    v_total_net NUMERIC(14,2) := 0;
    
    v_emp RECORD;
    v_sal RECORD;
    v_loc RECORD;
    v_pt_amount NUMERIC(6,2);
    
    v_paid_days NUMERIC(4,1);
    v_unpaid_days NUMERIC(4,1);
    v_effective_divisor NUMERIC(4,1);
    v_proration_ratio NUMERIC(6,4);
    
    v_payable_base NUMERIC(12,2);
    v_payable_basic NUMERIC(12,2);
    v_payable_hra NUMERIC(12,2);
    v_payable_conveyance NUMERIC(12,2);
    v_payable_special NUMERIC(12,2);
    v_unpaid_deduction NUMERIC(12,2);
    v_gross_earned NUMERIC(12,2);
    
    v_pf_wage NUMERIC(12,2);
    v_pf_deduction NUMERIC(12,2);
    v_pf_employer NUMERIC(12,2);
    v_esic_deduction NUMERIC(12,2);
    v_esic_employer NUMERIC(12,2);
    v_tds_deduction NUMERIC(12,2);
    v_item_total_deductions NUMERIC(12,2);
    v_net_salary NUMERIC(12,2);
    
    v_item_id VARCHAR(150);
BEGIN
    -- 1. Security Check: Authenticated Caller
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Valid Supabase auth session is required.';
    END IF;

    -- 2. Derive Caller Identity & RBAC Entitlements
    SELECT role, client_id, full_name, email
    INTO v_caller_role, v_caller_client_id, v_caller_name, v_caller_email
    FROM public.user_profiles
    WHERE id = v_auth_uid;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: User profile not found.';
    END IF;

    IF v_caller_role NOT IN ('super_admin', 'client_admin', 'payroll_admin') THEN
        RAISE EXCEPTION 'FORBIDDEN: Role % lacks payroll processing authority.', v_caller_role;
    END IF;

    IF v_caller_role <> 'super_admin' AND v_caller_client_id <> p_client_id THEN
        RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Cannot process payroll for another client tenant.';
    END IF;

    -- 3. Verify Client & Policy Readiness
    SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
    IF v_client.id IS NULL THEN
        RAISE EXCEPTION 'CLIENT_NOT_FOUND: Client % does not exist.', p_client_id;
    END IF;

    SELECT * INTO v_policy FROM public.client_policies WHERE client_id = p_client_id;
    IF v_policy.id IS NULL OR NOT v_policy.is_configured THEN
        RAISE EXCEPTION 'POLICY_NOT_CONFIGURED: Mandatory policy configuration missing for %.', v_client.name;
    END IF;

    -- 4. Resolve Target Legal Entity
    IF p_legal_entity_id IS NOT NULL THEN
        v_target_legal_entity_id := p_legal_entity_id;
    ELSE
        SELECT id INTO v_target_legal_entity_id
        FROM public.client_legal_entities
        WHERE client_id = p_client_id AND is_primary = TRUE
        LIMIT 1;
        
        IF v_target_legal_entity_id IS NULL THEN
            SELECT id INTO v_target_legal_entity_id
            FROM public.client_legal_entities
            WHERE client_id = p_client_id
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_target_legal_entity_id IS NULL THEN
        RAISE EXCEPTION 'LEGAL_ENTITY_REQUIRED: No legal entity registered for client %.', p_client_id;
    END IF;

    SELECT * INTO v_legal_entity
    FROM public.client_legal_entities
    WHERE id = v_target_legal_entity_id AND client_id = p_client_id;

    IF v_legal_entity.id IS NULL THEN
        RAISE EXCEPTION 'LEGAL_ENTITY_NOT_FOUND: Legal entity % does not belong to client %.', v_target_legal_entity_id, p_client_id;
    END IF;

    -- 5. Compute Period Date Boundaries
    v_start_date := MAKE_DATE(p_period_year, p_period_month, 1);
    v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;
    v_days_in_month := EXTRACT(DAY FROM v_end_date)::INT;

    -- 6. ATTENDANCE FINALIZATION GATE (Scoped to Target Legal Entity)
    -- Prevents calculation if unresolved attendance regularisations exist for this entity's employees
    SELECT COUNT(*) INTO v_pending_corrections
    FROM public.attendance_corrections ac
    JOIN public.employees e ON ac.employee_id = e.id
    WHERE ac.client_id = p_client_id
      AND e.legal_entity_id = v_target_legal_entity_id
      AND ac.status = 'PENDING'
      AND ac.attendance_date BETWEEN v_start_date AND v_end_date;

    IF v_pending_corrections > 0 THEN
        RAISE EXCEPTION 'ATTENDANCE_NOT_FINALIZED: Cannot process payroll. % pending attendance regularisation request(s) remain unresolved for legal entity "%" in period %/%',
            v_pending_corrections, v_legal_entity.legal_name, p_period_month, p_period_year;
    END IF;

    -- 7. Composite Run ID Incorporating Legal Entity
    v_run_id := 'payrun-' || p_client_id::text || '-' || v_target_legal_entity_id::text || '-' || p_period_month::text || '-' || p_period_year::text;

    -- Check if existing run is locked
    IF EXISTS (SELECT 1 FROM public.payroll_runs WHERE id = v_run_id AND status = 'locked') THEN
        RAISE EXCEPTION 'PAYROLL_LOCKED: Payroll run % for legal entity "%" is finalized and locked. Reprocessing is prohibited.', 
            v_run_id, v_legal_entity.legal_name;
    END IF;

    -- 8. Upsert Payroll Run Header (Initial status: under_review)
    INSERT INTO public.payroll_runs (
        id,
        client_id,
        legal_entity_id,
        payroll_responsibility,
        period_month,
        period_year,
        total_employees,
        total_gross,
        total_deductions,
        total_net,
        status,
        processed_at,
        policy_snapshot
    ) VALUES (
        v_run_id,
        p_client_id,
        v_target_legal_entity_id,
        v_legal_entity.payroll_responsibility,
        p_period_month,
        p_period_year,
        0, 0, 0, 0,
        'under_review',
        NOW(),
        to_jsonb(v_policy)
    )
    ON CONFLICT (client_id, legal_entity_id, period_month, period_year) DO UPDATE SET
        payroll_responsibility = EXCLUDED.payroll_responsibility,
        status = 'under_review',
        processed_at = NOW(),
        policy_snapshot = EXCLUDED.policy_snapshot;

    -- 9. Loop through active employees belonging strictly to this legal entity
    FOR v_emp IN
        SELECT e.* 
        FROM public.employees e
        WHERE e.client_id = p_client_id
          AND e.legal_entity_id = v_target_legal_entity_id
          AND e.status = 'ACTIVE'
          AND e.joining_date <= v_end_date
        ORDER BY e.employee_code ASC
    LOOP
        -- 9.1 Resolve active salary structure by effective date
        SELECT * INTO v_sal
        FROM public.employee_salary_structures
        WHERE employee_id = v_emp.id
          AND is_active = TRUE
          AND effective_from <= v_end_date
          AND (effective_to IS NULL OR effective_to >= v_start_date)
        ORDER BY effective_from DESC
        LIMIT 1;

        IF v_sal.id IS NULL THEN
            CONTINUE;
        END IF;

        -- 9.2 Ingest Attendance Muster from daily_attendance_records (9-Status Taxonomy)
        SELECT 
            COALESCE(SUM(CASE 
                WHEN status IN ('PRESENT', 'ON_DUTY', 'WEEKLY_OFF', 'HOLIDAY', 'PAID_LEAVE', 'LATE') THEN 1.0
                WHEN status = 'HALF_DAY' THEN 0.5
                ELSE 0.0
            END), 0.0),
            COALESCE(SUM(CASE 
                WHEN status IN ('UNPAID_LEAVE', 'ABSENT') THEN 1.0
                WHEN status = 'HALF_DAY' THEN 0.5
                ELSE 0.0
            END), 0.0)
        INTO v_paid_days, v_unpaid_days
        FROM public.daily_attendance_records
        WHERE employee_id = v_emp.id
          AND attendance_date BETWEEN v_start_date AND v_end_date;

        -- Fallback if no daily muster records exist yet: assume full calendar month worked
        IF (v_paid_days + v_unpaid_days) = 0 THEN
            v_paid_days := v_days_in_month;
            v_unpaid_days := 0.0;
        END IF;

        -- 9.3 Mid-Month Joining Proration Cap
        IF v_emp.joining_date > v_start_date THEN
            v_paid_days := LEAST(v_paid_days, (v_days_in_month - EXTRACT(DAY FROM v_emp.joining_date)::INT + 1)::NUMERIC);
        END IF;

        -- 9.4 Resolve Policy Divisor
        IF v_policy.salary_divisor = '26' THEN
            v_effective_divisor := 26.0;
        ELSIF v_policy.salary_divisor = '30' THEN
            v_effective_divisor := 30.0;
        ELSE
            v_effective_divisor := v_days_in_month::NUMERIC;
        END IF;

        v_proration_ratio := LEAST(1.0, v_paid_days / v_effective_divisor);

        -- 9.5 Compute Prorated Earnings Components
        v_payable_base := ROUND((v_sal.fixed_monthly_base / v_effective_divisor) * v_paid_days, 2);
        v_payable_basic := ROUND(v_sal.fixed_monthly_base * 0.50 * v_proration_ratio, 2);
        v_payable_hra := ROUND(v_sal.hra * v_proration_ratio, 2);
        v_payable_conveyance := ROUND(v_sal.conveyance * v_proration_ratio, 2);
        v_payable_special := GREATEST(0.0, v_payable_base - (v_payable_basic + v_payable_hra + v_payable_conveyance));
        
        v_unpaid_deduction := GREATEST(0.0, v_sal.fixed_monthly_base - v_payable_base);
        v_gross_earned := v_payable_basic + v_payable_hra + v_payable_conveyance + v_payable_special + v_sal.variable_incentives;

        -- 9.6 Compute Statutory Deductions
        -- EPF Employee (12%)
        IF v_policy.pf_enabled THEN
            IF v_policy.pf_uncapped_basic THEN
                v_pf_wage := v_payable_basic;
            ELSE
                v_pf_wage := LEAST(v_payable_basic, 15000.00);
            END IF;
            v_pf_deduction := ROUND(v_pf_wage * (v_policy.pf_employee_percent / 100.0), 2);
            v_pf_employer := ROUND(v_pf_wage * (v_policy.pf_employer_percent / 100.0), 2);
        ELSE
            v_pf_deduction := 0;
            v_pf_employer := 0;
        END IF;

        -- ESIC Employee (0.75%)
        IF v_policy.esic_enabled AND v_gross_earned <= 21000.00 THEN
            v_esic_deduction := ROUND(v_gross_earned * (v_policy.esic_employee_percent / 100.0), 2);
            v_esic_employer := ROUND(v_gross_earned * (v_policy.esic_employer_percent / 100.0), 2);
        ELSE
            v_esic_deduction := 0;
            v_esic_employer := 0;
        END IF;

        -- Professional Tax (PT)
        IF v_policy.pt_enabled THEN
            SELECT state INTO v_loc FROM public.work_locations WHERE id = v_emp.work_location_id;
            SELECT 
                CASE 
                    WHEN p_period_month = 2 AND february_tax_amount IS NOT NULL THEN february_tax_amount
                    ELSE tax_amount 
                END INTO v_pt_amount
            FROM public.statutory_pt_slabs
            WHERE state = COALESCE(v_loc.state, 'Maharashtra')
              AND is_active = TRUE
              AND v_gross_earned >= monthly_gross_min
              AND (monthly_gross_max IS NULL OR v_gross_earned <= monthly_gross_max)
            LIMIT 1;

            v_pt_amount := COALESCE(v_pt_amount, 200.00);
        ELSE
            v_pt_amount := 0;
        END IF;

        -- TDS Withholding (Standardised from salary structure)
        IF v_policy.tds_enabled THEN
            v_tds_deduction := COALESCE(v_sal.tds_withholding_amount, 0);
        ELSE
            v_tds_deduction := 0;
        END IF;

        -- Totals
        v_item_total_deductions := v_pf_deduction + v_esic_deduction + v_pt_amount + v_tds_deduction;
        v_net_salary := GREATEST(0.00, v_gross_earned - v_item_total_deductions);

        -- 9.7 Upsert payroll_item
        v_item_id := 'pitem-' || v_emp.id::text || '-' || p_period_month::text || '-' || p_period_year::text;

        INSERT INTO public.payroll_items (
            id,
            run_id,
            client_id,
            employee_id,
            fixed_salary,
            incentives,
            other_allowances,
            calendar_days,
            paid_days,
            unpaid_days,
            gross_earned,
            unpaid_deduction,
            pf_deduction,
            esic_deduction,
            pt_deduction,
            tds_deduction,
            total_deductions,
            net_salary,
            basic_pay,
            hra,
            conveyance,
            special_allowance,
            overtime_pay,
            pf_employer,
            esic_employer
        ) VALUES (
            v_item_id,
            v_run_id,
            p_client_id,
            v_emp.id,
            v_sal.fixed_monthly_base,
            v_sal.variable_incentives,
            (v_sal.conveyance + v_sal.special_allowances),
            v_days_in_month,
            v_paid_days,
            v_unpaid_days,
            v_gross_earned,
            v_unpaid_deduction,
            v_pf_deduction,
            v_esic_deduction,
            v_pt_amount,
            v_tds_deduction,
            v_item_total_deductions,
            v_net_salary,
            v_payable_basic,
            v_payable_hra,
            v_payable_conveyance,
            v_payable_special,
            0.00,
            v_pf_employer,
            v_esic_employer
        )
        ON CONFLICT (run_id, employee_id) DO UPDATE SET
            fixed_salary = EXCLUDED.fixed_salary,
            incentives = EXCLUDED.incentives,
            other_allowances = EXCLUDED.other_allowances,
            calendar_days = EXCLUDED.calendar_days,
            paid_days = EXCLUDED.paid_days,
            unpaid_days = EXCLUDED.unpaid_days,
            gross_earned = EXCLUDED.gross_earned,
            unpaid_deduction = EXCLUDED.unpaid_deduction,
            pf_deduction = EXCLUDED.pf_deduction,
            esic_deduction = EXCLUDED.esic_deduction,
            pt_deduction = EXCLUDED.pt_deduction,
            tds_deduction = EXCLUDED.tds_deduction,
            total_deductions = EXCLUDED.total_deductions,
            net_salary = EXCLUDED.net_salary,
            basic_pay = EXCLUDED.basic_pay,
            hra = EXCLUDED.hra,
            conveyance = EXCLUDED.conveyance,
            special_allowance = EXCLUDED.special_allowance,
            pf_employer = EXCLUDED.pf_employer,
            esic_employer = EXCLUDED.esic_employer;

        -- Accumulate batch totals
        v_total_employees := v_total_employees + 1;
        v_total_gross := v_total_gross + v_gross_earned;
        v_total_deductions := v_total_deductions + v_item_total_deductions;
        v_total_net := v_total_net + v_net_salary;
    END LOOP;

    -- 10. Update Run Batch Totals
    UPDATE public.payroll_runs
    SET total_employees = v_total_employees,
        total_gross = v_total_gross,
        total_deductions = v_total_deductions,
        total_net = v_total_net
    WHERE id = v_run_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'run_id', v_run_id,
        'legal_entity_id', v_target_legal_entity_id,
        'legal_entity_name', v_legal_entity.legal_name,
        'payroll_responsibility', v_legal_entity.payroll_responsibility,
        'status', 'under_review',
        'total_employees', v_total_employees,
        'total_gross', v_total_gross,
        'total_deductions', v_total_deductions,
        'total_net', v_total_net
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Security Hardening & Grants
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.generate_payroll_run(UUID, INT, INT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_payroll_run(UUID, INT, INT, UUID) TO authenticated, service_role;

COMMENT ON CONSTRAINT unq_client_legal_entity_period ON public.payroll_runs IS
'Enforces one authoritative payroll run per legal entity, client organization, month, and year.';
