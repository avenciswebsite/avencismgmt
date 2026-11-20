-- ==============================================================================
-- MIGRATION 12: Atomic Leave Decision RPC Function
-- File: supabase/migrations/20261114000012_atomic_leave_decision_rpc.sql
-- Milestone: 2.4D.1 Remediation
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT APPROVAL)
-- ==============================================================================
-- Dependencies: 20261103000006_leave_management.sql, 20261103000008_statutory_and_audit_ledgers.sql
-- Summary:
--   Implements public.review_leave_request_atomic() stored procedure with:
--   1. Authoritative reviewer resolution from auth.uid().
--   2. Pessimistic row locking (FOR UPDATE) on request and balance ledgers.
--   3. Anti-self-approval enforcement.
--   4. Role and organizational scoping (including Location Manager site check).
--   5. Balance solvency check and atomic single deduction.
--   6. Audit log entry generation.
--   7. Full transaction rollback on any failure.
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
    v_reviewer_profile_id UUID;
    v_reviewer_role TEXT;
    v_reviewer_client_id UUID;
    v_reviewer_emp_id UUID;
    v_applicant_loc_id UUID;
    v_manager_loc_id UUID;
    v_req RECORD;
    v_bal RECORD;
    v_year INT;
    v_new_used NUMERIC(4,1);
    v_new_closing NUMERIC(4,1);
BEGIN
    -- 1. Derive Authenticated Caller Identity
    v_caller_auth_id := auth.uid();
    IF v_caller_auth_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Operation requires an authenticated session.';
    END IF;

    -- 2. Resolve Reviewer Profile and Scoping
    SELECT id, role, client_id, employee_id
    INTO v_reviewer_profile_id, v_reviewer_role, v_reviewer_client_id, v_reviewer_emp_id
    FROM public.user_profiles
    WHERE id = v_caller_auth_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_PROFILE_NOT_FOUND: Caller profile does not exist.';
    END IF;

    -- 3. Reviewer Role Authority Check
    IF v_reviewer_role NOT IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager', 'location_manager') THEN
        RAISE EXCEPTION 'PERMISSION_ERROR: Role % is not authorized to review leave requests.', v_reviewer_role;
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

    -- 7. Anti-Self-Approval Enforcement
    IF v_reviewer_emp_id IS NOT NULL AND v_reviewer_emp_id = v_req.employee_id THEN
        RAISE EXCEPTION 'GOVERNANCE_VIOLATION: Employees are strictly prohibited from reviewing their own leave requests.';
    END IF;

    -- 8. Organizational & Tenancy Scoping
    IF v_reviewer_role <> 'super_admin' THEN
        -- Verify Client Tenancy Match
        IF v_req.client_id <> v_reviewer_client_id THEN
            RAISE EXCEPTION 'PERMISSION_ERROR: Cross-tenant leave review is forbidden.';
        END IF;

        -- Location Manager Facility Scoping
        IF v_reviewer_role = 'location_manager' THEN
            SELECT work_location_id INTO v_applicant_loc_id
            FROM public.employees
            WHERE id = v_req.employee_id;

            SELECT work_location_id INTO v_manager_loc_id
            FROM public.employees
            WHERE id = v_reviewer_emp_id;

            IF v_applicant_loc_id IS DISTINCT FROM v_manager_loc_id THEN
                RAISE EXCEPTION 'PERMISSION_ERROR: Location Managers may only review requests for employees at their assigned work location.';
            END IF;
        END IF;
    END IF;

    -- 9. Atomic Balance Deduction (On Approval for Paid Leave Types)
    IF p_decision = 'APPROVED' AND v_req.leave_type IN ('PL', 'CL', 'SL', 'COMP_OFF') THEN
        v_year := EXTRACT(YEAR FROM v_req.start_date)::INT;

        -- Lock Target Balance Ledger Row
        SELECT * INTO v_bal
        FROM public.leave_balances
        WHERE employee_id = v_req.employee_id
          AND leave_type = v_req.leave_type
          AND year = v_year
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'BALANCE_ERROR: No % leave ledger row exists for employee in year %.', v_req.leave_type, v_year;
        END IF;

        -- Verify Balance Solvency (Strictly Prevent Overdrawing)
        IF v_bal.closing < v_req.total_days THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient % balance. Available: %, Requested: %',
                v_req.leave_type, v_bal.closing, v_req.total_days;
        END IF;

        v_new_used := v_bal.used + v_req.total_days;
        v_new_closing := v_bal.opening + v_bal.credited - v_new_used;

        UPDATE public.leave_balances
        SET used = v_new_used,
            closing = v_new_closing,
            updated_at = NOW()
        WHERE id = v_bal.id;
    END IF;

    -- 10. Update Leave Request Record
    UPDATE public.leave_requests
    SET status = p_decision,
        reviewed_by = v_reviewer_profile_id,
        reviewed_at = NOW(),
        manager_remarks = p_manager_remarks
    WHERE id = v_req.id;

    -- 11. Append Cryptographically Secure Immutable Audit Log
    INSERT INTO public.audit_logs (
        client_id,
        user_id,
        action,
        resource,
        resource_id,
        details,
        severity
    ) VALUES (
        v_req.client_id,
        v_reviewer_profile_id,
        CASE WHEN p_decision = 'APPROVED' THEN 'LEAVE_APPROVE' ELSE 'LEAVE_REJECT' END,
        'leave_requests',
        v_req.id,
        jsonb_build_object(
            'decision', p_decision,
            'employee_id', v_req.employee_id,
            'leave_type', v_req.leave_type,
            'total_days', v_req.total_days,
            'new_closing_balance', v_new_closing,
            'manager_remarks', p_manager_remarks
        ),
        'INFO'
    );

    -- 12. Return Structured Success Object
    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_req.id,
        'status', p_decision,
        'leave_type', v_req.leave_type,
        'total_days', v_req.total_days,
        'reviewer_id', v_reviewer_profile_id,
        'reviewed_at', NOW(),
        'remaining_balance', v_new_closing
    );
END;
$$;

-- Security Grants
REVOKE ALL ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) TO authenticated;

COMMENT ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) IS 
'Authoritative transactional RPC for reviewing leave requests with row locking, balance deduction, anti-self-approval, and audit tracking.';
