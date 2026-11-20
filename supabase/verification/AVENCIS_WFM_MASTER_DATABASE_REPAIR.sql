-- ==============================================================================
-- AVENCIS WORKFORCE MANAGEMENT (WFM) — MASTER DATABASE REPAIR SCRIPT
-- Target: Supabase Cloud SQL Editor (Manual Review & Selective Execution)
-- File: supabase/verification/AVENCIS_WFM_MASTER_DATABASE_REPAIR.sql
-- Milestone: 2.4D.2 Pre-Deployment & Execution History Remediation
-- Status: STAGED FOR REVIEW — DO NOT EXECUTE AUTOMATICALLY
-- ==============================================================================
-- Purpose:
--   Performs surgical, non-destructive cleanup and idempotency alignment for
--   environments where Migrations 11 through 17 were executed sequentially.
--
-- Safety Guarantees:
--   1. 100% Data Preservation: Zero rows dropped or truncated from any table.
--   2. Zero Schema Resets: No tables dropped or recreated.
--   3. Redundancy Elimination: Safely drops the redundant duplicate index
--      idx_daily_attendance_leave created by superseded Migration 14,
--      retaining idx_daily_attendance_leave_req from Migration 17.
--   4. Definitive Re-assertion: Re-asserts Migration 15 (Cross-Year RPC),
--      Migration 16 (Hardened RLS with Anti-Self-Approval), and Migration 17
--      (9-status taxonomy & punch-protecting muster trigger).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PRECONDITION CHECK: Verify Database Core Readiness
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests') THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: Table public.leave_requests is missing. Run foundational migrations first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_balances') THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: Table public.leave_balances is missing. Run foundational migrations first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_attendance_records') THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: Table public.daily_attendance_records is missing.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- REPAIR 1: Eliminate Redundant Duplicate Index
-- ------------------------------------------------------------------------------
-- Justification: Migration 14 created 'idx_daily_attendance_leave' and Migration 17
-- created 'idx_daily_attendance_leave_req' on the identical column (leave_request_id).
-- Dropping the legacy index eliminates duplicate write I/O and storage overhead.
-- Safety: Completely non-destructive. Index idx_daily_attendance_leave_req remains active.
DROP INDEX IF EXISTS public.idx_daily_attendance_leave;

-- Guarantee active index from Migration 17 exists:
CREATE INDEX IF NOT EXISTS idx_daily_attendance_leave_req 
ON public.daily_attendance_records(leave_request_id);

-- ------------------------------------------------------------------------------
-- REPAIR 2: Ensure Comprehensive 9-Status Attendance Taxonomy
-- ------------------------------------------------------------------------------
-- Justification: Guarantees status constraint contains all 9 enterprise statuses
-- including LATE and ON_DUTY, without dropping any active records.
ALTER TABLE public.daily_attendance_records
DROP CONSTRAINT IF EXISTS daily_attendance_records_status_check;

ALTER TABLE public.daily_attendance_records
ADD CONSTRAINT daily_attendance_records_status_check
CHECK (status IN (
    'PRESENT',
    'ABSENT',
    'HALF_DAY',
    'LATE',
    'ON_DUTY',
    'PAID_LEAVE',
    'UNPAID_LEAVE',
    'WEEKLY_OFF',
    'HOLIDAY'
));

-- ------------------------------------------------------------------------------
-- REPAIR 3: Guarantee Balance Ledger Arithmetic Identity & COMP_OFF Support
-- ------------------------------------------------------------------------------
ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_leave_type_check
CHECK (leave_type IN ('PL', 'CL', 'SL', 'COMP_OFF'));

ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_leave_type_check
CHECK (leave_type IN ('PL', 'CL', 'SL', 'LWP', 'COMP_OFF'));

ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS chk_leave_balance_identity;

ALTER TABLE public.leave_balances
ADD CONSTRAINT chk_leave_balance_identity
CHECK (closing = (opening + credited - used));

-- ------------------------------------------------------------------------------
-- REPAIR 4: Re-assert Authoritative Cross-Year RPC (Migration 15)
-- ------------------------------------------------------------------------------
-- Justification: Guarantees review_leave_request_atomic incorporates Migration 15's
-- calendar-aware cross-year partitioning, deterministic row locking, and corrected
-- audit_logs schema insertion, replacing any remnants of Migration 12.
CREATE OR REPLACE FUNCTION public.review_leave_request_atomic(
    p_request_id UUID,
    p_decision VARCHAR(30),
    p_manager_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_auth_id UUID;
    v_reviewer RECORD;
    v_applicant_loc_id UUID;
    v_manager_loc_id UUID;
    v_req RECORD;
    v_weekly_offs TEXT[];
    v_year_rec RECORD;
    v_bal RECORD;
    v_audit_id VARCHAR(100);
    v_deductions JSONB := '[]'::jsonb;
    v_total_calculated NUMERIC(4,1) := 0;
BEGIN
    -- 1. Derive Authenticated Caller Identity
    v_caller_auth_id := auth.uid();
    IF v_caller_auth_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Operation requires an authenticated session.';
    END IF;

    -- 2. Resolve Reviewer Profile and Scoping
    SELECT id, role, client_id, employee_id, full_name, email
    INTO v_reviewer
    FROM public.user_profiles
    WHERE id = v_caller_auth_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_PROFILE_NOT_FOUND: Caller profile does not exist in user_profiles.';
    END IF;

    -- 3. Reviewer Role Authority Check
    IF v_reviewer.role NOT IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager', 'location_manager') THEN
        RAISE EXCEPTION 'PERMISSION_ERROR: Role % is not authorized to review leave requests.', v_reviewer.role;
    END IF;

    -- 4. Validate Decision Parameter
    IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'INVALID_DECISION: Decision must be either APPROVED or REJECTED.';
    END IF;

    -- 5. Lock Target Leave Request (Pessimistic Concurrency Guard)
    SELECT * INTO v_req
    FROM public.leave_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Leave request % does not exist.', p_request_id;
    END IF;

    -- 6. State Machine Transition Guard
    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'STATE_ERROR: Leave request is in status %, only PENDING requests can be reviewed.', v_req.status;
    END IF;

    -- 7. Corporate Governance: Anti-Self-Approval Enforcement
    IF v_reviewer.employee_id IS NOT NULL AND v_reviewer.employee_id = v_req.employee_id THEN
        RAISE EXCEPTION 'GOVERNANCE_VIOLATION: Employees are strictly prohibited from reviewing their own leave requests.';
    END IF;

    -- 8. Organizational & Tenancy Scoping
    IF v_reviewer.role <> 'super_admin' THEN
        IF v_req.client_id <> v_reviewer.client_id THEN
            RAISE EXCEPTION 'PERMISSION_ERROR: Cross-tenant leave review is forbidden.';
        END IF;

        IF v_reviewer.role = 'location_manager' THEN
            SELECT work_location_id INTO v_applicant_loc_id
            FROM public.employees
            WHERE id = v_req.employee_id;

            SELECT work_location_id INTO v_manager_loc_id
            FROM public.employees
            WHERE id = v_reviewer.employee_id;

            IF v_applicant_loc_id IS DISTINCT FROM v_manager_loc_id THEN
                RAISE EXCEPTION 'PERMISSION_ERROR: Location Managers may only review requests for employees at their assigned work location.';
            END IF;
        END IF;
    END IF;

    -- 9. Cross-Year Leave Accounting & Balance Deductions (On Approval for Paid Types)
    IF p_decision = 'APPROVED' AND v_req.leave_type IN ('PL', 'CL', 'SL', 'COMP_OFF') THEN
        IF v_applicant_loc_id IS NULL THEN
            SELECT work_location_id INTO v_applicant_loc_id
            FROM public.employees
            WHERE id = v_req.employee_id;
        END IF;

        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = v_req.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

        FOR v_year_rec IN
            WITH calendar_series AS (
                SELECT 
                    d::date AS cal_date,
                    EXTRACT(YEAR FROM d)::INT AS cal_year,
                    UPPER(TRIM(TO_CHAR(d, 'FMDAY'))) AS cal_day_name
                FROM generate_series(v_req.start_date::timestamp, v_req.end_date::timestamp, '1 day'::interval) d
            ),
            day_evaluations AS (
                SELECT 
                    cs.cal_date,
                    cs.cal_year,
                    CASE 
                        WHEN cs.cal_day_name = ANY(v_weekly_offs) THEN 0.0
                        WHEN EXISTS (
                            SELECT 1 FROM public.statutory_holidays sh
                            WHERE sh.date = cs.cal_date
                              AND (sh.client_id = v_req.client_id OR sh.client_id IS NULL)
                              AND (sh.work_location_id = v_applicant_loc_id OR sh.work_location_id IS NULL)
                        ) THEN 0.0
                        WHEN v_req.start_date = v_req.end_date AND v_req.total_days = 0.5 THEN 0.5
                        ELSE 1.0
                    END AS leave_amount
                FROM calendar_series cs
            )
            SELECT 
                cal_year AS target_year,
                SUM(leave_amount)::NUMERIC(4,1) AS required_days
            FROM day_evaluations
            GROUP BY cal_year
            HAVING SUM(leave_amount) > 0
            ORDER BY cal_year ASC
        LOOP
            SELECT * INTO v_bal
            FROM public.leave_balances
            WHERE employee_id = v_req.employee_id
              AND leave_type = v_req.leave_type
              AND year = v_year_rec.target_year
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'BALANCE_ERROR: No % leave ledger row exists for employee in year %.', 
                    v_req.leave_type, v_year_rec.target_year;
            END IF;

            IF v_bal.closing < v_year_rec.required_days THEN
                RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient % balance for year %. Available: %, Required: %',
                    v_req.leave_type, v_year_rec.target_year, v_bal.closing, v_year_rec.required_days;
            END IF;

            UPDATE public.leave_balances
            SET used = used + v_year_rec.required_days,
                closing = opening + credited - (used + v_year_rec.required_days),
                updated_at = NOW()
            WHERE id = v_bal.id;

            v_total_calculated := v_total_calculated + v_year_rec.required_days;

            v_deductions := v_deductions || jsonb_build_object(
                'year', v_year_rec.target_year,
                'deducted_days', v_year_rec.required_days,
                'previous_closing', v_bal.closing,
                'new_closing', (v_bal.opening + v_bal.credited - (v_bal.used + v_year_rec.required_days))
            );
        END LOOP;
    END IF;

    -- 10. Transition Request Status
    UPDATE public.leave_requests
    SET status = p_decision,
        reviewed_by = v_reviewer.id,
        reviewed_at = NOW(),
        manager_remarks = p_manager_remarks
    WHERE id = v_req.id;

    -- 11. Append Schema-Conforming Audit Log
    v_audit_id := 'audit-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 16);

    INSERT INTO public.audit_logs (
        id,
        client_id,
        actor_name,
        actor_email,
        actor_role,
        action,
        target_entity,
        target_id,
        details,
        ip_address,
        timestamp,
        severity
    ) VALUES (
        v_audit_id,
        v_req.client_id,
        v_reviewer.full_name,
        v_reviewer.email,
        v_reviewer.role,
        CASE WHEN p_decision = 'APPROVED' THEN 'LEAVE_APPROVE' ELSE 'LEAVE_REJECT' END,
        'leave_requests',
        v_req.id::text,
        jsonb_build_object(
            'decision', p_decision,
            'employee_id', v_req.employee_id,
            'leave_type', v_req.leave_type,
            'total_days', v_req.total_days,
            'deductions', v_deductions,
            'manager_remarks', p_manager_remarks
        )::text,
        '127.0.0.1',
        NOW(),
        'info'
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_req.id,
        'status', p_decision,
        'leave_type', v_req.leave_type,
        'total_days', v_req.total_days,
        'reviewer_id', v_reviewer.id,
        'reviewer_name', v_reviewer.full_name,
        'reviewed_at', NOW(),
        'deductions', v_deductions
    );
END;
$$;

REVOKE ALL ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- REPAIR 5: Re-assert Hardened RLS Policies (Migration 16)
-- ------------------------------------------------------------------------------
-- Guarantee all legacy/flawed policies are dropped
DROP POLICY IF EXISTS "leave_requests_employee_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_cancel" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_super_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_modify" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_payroll_admin_select" ON public.leave_requests;

DROP POLICY IF EXISTS "leave_balances_employee_select" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_all" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_super_admin_all" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_select" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_modify" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_payroll_admin_select" ON public.leave_balances;

-- Create hardened policies on leave_requests
CREATE POLICY "leave_requests_employee_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

CREATE POLICY "leave_requests_employee_insert" ON public.leave_requests
FOR INSERT TO authenticated
WITH CHECK (
    employee_id = public.get_user_employee_id()
    AND client_id = public.get_user_client_id()
    AND status = 'PENDING'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
);

CREATE POLICY "leave_requests_employee_cancel" ON public.leave_requests
FOR UPDATE TO authenticated
USING (
    employee_id = public.get_user_employee_id()
    AND status = 'PENDING'
)
WITH CHECK (
    employee_id = public.get_user_employee_id()
    AND status = 'CANCELLED'
    AND reviewed_by IS NULL
);

CREATE POLICY "leave_requests_super_admin_all" ON public.leave_requests
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "leave_requests_tenant_admin_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND (
        public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
        OR (
            public.get_user_role() = 'location_manager'
            AND employee_id IN (
                SELECT e.id FROM public.employees e
                WHERE e.work_location_id = (
                    SELECT m.work_location_id FROM public.employees m
                    WHERE m.id = public.get_user_employee_id()
                )
            )
        )
    )
);

CREATE POLICY "leave_requests_tenant_admin_modify" ON public.leave_requests
FOR UPDATE TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id()
    AND (
        public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
        OR (
            public.get_user_role() = 'location_manager'
            AND employee_id IN (
                SELECT e.id FROM public.employees e
                WHERE e.work_location_id = (
                    SELECT m.work_location_id FROM public.employees m
                    WHERE m.id = public.get_user_employee_id()
                )
            )
        )
    )
)
WITH CHECK (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id()
    AND (
        public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
        OR (
            public.get_user_role() = 'location_manager'
            AND employee_id IN (
                SELECT e.id FROM public.employees e
                WHERE e.work_location_id = (
                    SELECT m.work_location_id FROM public.employees m
                    WHERE m.id = public.get_user_employee_id()
                )
            )
        )
    )
);

CREATE POLICY "leave_requests_payroll_admin_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() = 'payroll_admin'
);

-- Create hardened policies on leave_balances
CREATE POLICY "leave_balances_employee_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

CREATE POLICY "leave_balances_super_admin_all" ON public.leave_balances
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "leave_balances_tenant_admin_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND (
        public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
        OR (
            public.get_user_role() = 'location_manager'
            AND employee_id IN (
                SELECT e.id FROM public.employees e
                WHERE e.work_location_id = (
                    SELECT m.work_location_id FROM public.employees m
                    WHERE m.id = public.get_user_employee_id()
                )
            )
        )
    )
);

CREATE POLICY "leave_balances_tenant_admin_modify" ON public.leave_balances
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
)
WITH CHECK (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
);

CREATE POLICY "leave_balances_payroll_admin_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() = 'payroll_admin'
);

-- ------------------------------------------------------------------------------
-- REPAIR 6: Re-assert Safe Muster Synchronization Trigger (Migration 17)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_approved_leave_to_muster()
RETURNS TRIGGER AS $$
DECLARE
    v_curr_date DATE;
    v_target_status VARCHAR(30);
    v_weekly_offs TEXT[];
    v_emp_loc_id UUID;
    v_day_name TEXT;
    v_is_weekly_off BOOLEAN;
    v_is_holiday BOOLEAN;
    v_existing RECORD;
BEGIN
    IF NEW.status = 'APPROVED' AND (TG_OP = 'INSERT' OR OLD.status <> 'APPROVED' OR OLD.start_date <> NEW.start_date OR OLD.end_date <> NEW.end_date) THEN
        v_target_status := CASE WHEN NEW.leave_type = 'LWP' THEN 'UNPAID_LEAVE' ELSE 'PAID_LEAVE' END;

        SELECT work_location_id INTO v_emp_loc_id
        FROM public.employees
        WHERE id = NEW.employee_id;

        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = NEW.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' AND (OLD.start_date <> NEW.start_date OR OLD.end_date <> NEW.end_date) THEN
            UPDATE public.daily_attendance_records
            SET status = 'ABSENT',
                leave_request_id = NULL,
                updated_at = NOW()
            WHERE leave_request_id = NEW.id
              AND (date < NEW.start_date OR date > NEW.end_date)
              AND check_in_time IS NULL
              AND total_hours = 0
              AND is_regularised = FALSE;
        END IF;

        v_curr_date := NEW.start_date;
        WHILE v_curr_date <= NEW.end_date LOOP
            v_day_name := UPPER(TRIM(TO_CHAR(v_curr_date, 'FMDAY')));
            v_is_weekly_off := (v_day_name = ANY(v_weekly_offs));

            SELECT EXISTS (
                SELECT 1 FROM public.statutory_holidays sh
                WHERE sh.date = v_curr_date
                  AND (sh.client_id = NEW.client_id OR sh.client_id IS NULL)
                  AND (sh.work_location_id = v_emp_loc_id OR sh.work_location_id IS NULL)
            ) INTO v_is_holiday;

            SELECT * INTO v_existing
            FROM public.daily_attendance_records
            WHERE employee_id = NEW.employee_id
              AND date = v_curr_date;

            IF FOUND THEN
                IF (v_existing.check_in_time IS NOT NULL OR v_existing.total_hours > 0 OR v_existing.is_regularised = TRUE) THEN
                    UPDATE public.daily_attendance_records
                    SET leave_request_id = NEW.id,
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                ELSIF v_is_weekly_off THEN
                    UPDATE public.daily_attendance_records
                    SET status = 'WEEKLY_OFF',
                        leave_request_id = NEW.id,
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                ELSIF v_is_holiday THEN
                    UPDATE public.daily_attendance_records
                    SET status = 'HOLIDAY',
                        leave_request_id = NEW.id,
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                ELSE
                    UPDATE public.daily_attendance_records
                    SET status = v_target_status,
                        leave_request_id = NEW.id,
                        location_name = COALESCE(v_existing.location_name, 'Approved Leave'),
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                END IF;
            ELSE
                INSERT INTO public.daily_attendance_records (
                    client_id,
                    employee_id,
                    date,
                    status,
                    leave_request_id,
                    total_hours,
                    location_name,
                    is_regularised
                ) VALUES (
                    NEW.client_id,
                    NEW.employee_id,
                    v_curr_date,
                    CASE 
                        WHEN v_is_weekly_off THEN 'WEEKLY_OFF'
                        WHEN v_is_holiday THEN 'HOLIDAY'
                        ELSE v_target_status
                    END,
                    NEW.id,
                    0,
                    'Approved Leave',
                    FALSE
                );
            END IF;

            v_curr_date := v_curr_date + INTERVAL '1 day';
        END LOOP;

    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' AND NEW.status IN ('CANCELLED', 'REJECTED') THEN
        SELECT work_location_id INTO v_emp_loc_id
        FROM public.employees
        WHERE id = NEW.employee_id;

        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = NEW.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

        UPDATE public.daily_attendance_records
        SET leave_request_id = NULL,
            updated_at = NOW()
        WHERE leave_request_id = NEW.id
          AND (check_in_time IS NOT NULL OR total_hours > 0 OR is_regularised = TRUE);

        FOR v_existing IN 
            SELECT * FROM public.daily_attendance_records
            WHERE leave_request_id = NEW.id
              AND check_in_time IS NULL
              AND total_hours = 0
              AND is_regularised = FALSE
        LOOP
            v_day_name := UPPER(TRIM(TO_CHAR(v_existing.date, 'FMDAY')));
            v_is_weekly_off := (v_day_name = ANY(v_weekly_offs));

            SELECT EXISTS (
                SELECT 1 FROM public.statutory_holidays sh
                WHERE sh.date = v_existing.date
                  AND (sh.client_id = NEW.client_id OR sh.client_id IS NULL)
                  AND (sh.work_location_id = v_emp_loc_id OR sh.work_location_id IS NULL)
            ) INTO v_is_holiday;

            IF v_is_weekly_off THEN
                UPDATE public.daily_attendance_records
                SET status = 'WEEKLY_OFF',
                    leave_request_id = NULL,
                    updated_at = NOW()
                WHERE id = v_existing.id;
            ELSIF v_is_holiday THEN
                UPDATE public.daily_attendance_records
                SET status = 'HOLIDAY',
                    leave_request_id = NULL,
                    updated_at = NOW()
                WHERE id = v_existing.id;
            ELSE
                UPDATE public.daily_attendance_records
                SET status = 'ABSENT',
                    leave_request_id = NULL,
                    updated_at = NOW()
                WHERE id = v_existing.id;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_approved_leave_to_muster ON public.leave_requests;

CREATE TRIGGER trg_sync_approved_leave_to_muster
AFTER INSERT OR UPDATE OF status, start_date, end_date ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_approved_leave_to_muster();

COMMIT;

-- ------------------------------------------------------------------------------
-- POST-EXECUTION VERIFICATION
-- ------------------------------------------------------------------------------
SELECT 'REPAIR COMPLETE. Run supabase/verification/AVENCIS_WFM_MASTER_DATABASE_AUDIT.sql to confirm 100% PASS.' AS repair_status;
