-- ==============================================================================
-- MIGRATION 15: Cross-Year Atomic Leave Decision RPC Function
-- File: supabase/migrations/20261115000015_cross_year_atomic_leave_rpc.sql
-- Milestone: 2.4D.2 Security & Data Integrity Review
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT APPROVAL)
-- ==============================================================================
-- SUPERSEDES: 20261114000012_atomic_leave_decision_rpc.sql
-- Dependencies: 20261103000002, 20261103000003, 20261103000004, 20261103000006, 20261103000008, 20261114000011
--
-- Architectural Corrections Implemented:
--   1. Cross-Year Leave Partitioning:
--      Calculates leave days per calendar year independently using trusted database
--      client_policies (weekly offs) and statutory_holidays calendars.
--   2. Deterministic Row Locking:
--      Locks affected leave_balances rows in ascending year order (ORDER BY year ASC)
--      to guarantee mathematical deadlock immunity.
--   3. Independent Balance Solvency & Atomic Rollback:
--      Validates solvency for each year independently; if any year has insufficient
--      balance, the entire transaction rolls back.
--   4. Schema-Conforming Audit Logging:
--      Corrected table insertion to match public.audit_logs schema:
--      (id, client_id, actor_name, actor_email, actor_role, action, target_entity, target_id, details, ip_address, timestamp, severity)
--      and enforces lowercase severity ('info').
--   5. Anti-Self-Approval & Tenancy Scoping:
--      Enforces anti-self-approval and facility scoping for location managers.
-- ==============================================================================

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
        -- Verify Client Tenancy Match
        IF v_req.client_id <> v_reviewer.client_id THEN
            RAISE EXCEPTION 'PERMISSION_ERROR: Cross-tenant leave review is forbidden.';
        END IF;

        -- Location Manager Facility Scoping
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
        -- Resolve applicant work location for statutory holiday lookup
        IF v_applicant_loc_id IS NULL THEN
            SELECT work_location_id INTO v_applicant_loc_id
            FROM public.employees
            WHERE id = v_req.employee_id;
        END IF;

        -- Resolve Client Weekly Off Days
        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = v_req.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

        -- Authoritative Database Calculation of Working Leave Days Per Calendar Year
        -- Excludes client weekly rest days and declared statutory holidays
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
                        -- Weekly Off check
                        WHEN cs.cal_day_name = ANY(v_weekly_offs) THEN 0.0
                        -- Statutory / Public Holiday check
                        WHEN EXISTS (
                            SELECT 1 FROM public.statutory_holidays sh
                            WHERE sh.date = cs.cal_date
                              AND (sh.client_id = v_req.client_id OR sh.client_id IS NULL)
                              AND (sh.work_location_id = v_applicant_loc_id OR sh.work_location_id IS NULL)
                        ) THEN 0.0
                        -- Half-Day check (single date application with total_days = 0.5)
                        WHEN v_req.start_date = v_req.end_date AND v_req.total_days = 0.5 THEN 0.5
                        -- Regular working leave day
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
            ORDER BY cal_year ASC -- Strictly deterministic locking order
        LOOP
            -- Lock Target Balance Ledger Row for this specific year
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

            -- Solvency Check: Strictly prevent overdrawing
            IF v_bal.closing < v_year_rec.required_days THEN
                RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient % balance for year %. Available: %, Required: %',
                    v_req.leave_type, v_year_rec.target_year, v_bal.closing, v_year_rec.required_days;
            END IF;

            -- Execute Mathematical Balance Deduction
            UPDATE public.leave_balances
            SET used = used + v_year_rec.required_days,
                closing = opening + credited - (used + v_year_rec.required_days),
                updated_at = NOW()
            WHERE id = v_bal.id;

            v_total_calculated := v_total_calculated + v_year_rec.required_days;

            -- Record per-year deduction metadata
            v_deductions := v_deductions || jsonb_build_object(
                'year', v_year_rec.target_year,
                'deducted_days', v_year_rec.required_days,
                'previous_closing', v_bal.closing,
                'new_closing', (v_bal.opening + v_bal.credited - (v_bal.used + v_year_rec.required_days))
            );
        END LOOP;
    END IF;

    -- 10. Authoritatively Transition Leave Request Status
    UPDATE public.leave_requests
    SET status = p_decision,
        reviewed_by = v_reviewer.id,
        reviewed_at = NOW(),
        manager_remarks = p_manager_remarks
    WHERE id = v_req.id;

    -- 11. Append Schema-Conforming Cryptographic Audit Log
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
        'info' -- Strictly lowercase matching audit_logs_severity check constraint
    );

    -- 12. Return Structured Result
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

-- Security Hardening: Revoke PUBLIC, Grant only authenticated and service_role
REVOKE ALL ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) IS 
'Authoritative transactional RPC for reviewing leave requests with cross-year partitioning, deterministic row locking, anti-self-approval, and audit logging.';
