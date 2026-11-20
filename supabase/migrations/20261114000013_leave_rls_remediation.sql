-- ==============================================================================
-- MIGRATION 13: Leave Row Level Security (RLS) Remediation
-- File: supabase/migrations/20261114000013_leave_rls_remediation.sql
-- Milestone: 2.4D.1 Remediation
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT APPROVAL)
-- ==============================================================================
-- Dependencies: 20261103000009_row_level_security_policies.sql, 20261114000012_atomic_leave_decision_rpc.sql
-- Summary:
--   1. Revokes 'FOR ALL' from employees on leave_requests to block self-approval privilege escalation.
--   2. Grants granular employee SELECT, INSERT (PENDING only), and UPDATE (CANCELLED only).
--   3. Fixes Super Admin global access on leave_requests and leave_balances.
--   4. Adds Location Manager and Client Manager access.
--   5. Grants Payroll Admin read-only access for upcoming Milestone 2.4E integration.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REMEDIATE LEAVE_REQUESTS POLICIES
-- ------------------------------------------------------------------------------

-- Drop legacy flawed policies
DROP POLICY IF EXISTS "leave_requests_employee_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_cancel" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_super_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_modify" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_payroll_admin_select" ON public.leave_requests;

-- A. Employee Self-Service: SELECT own requests
CREATE POLICY "leave_requests_employee_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

-- B. Employee Self-Service: INSERT own requests ONLY in PENDING status
CREATE POLICY "leave_requests_employee_insert" ON public.leave_requests
FOR INSERT TO authenticated
WITH CHECK (
    employee_id = public.get_user_employee_id()
    AND client_id = public.get_user_client_id()
    AND status = 'PENDING'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
);

-- C. Employee Self-Service: UPDATE (Cancel) ONLY own PENDING requests to CANCELLED
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

-- D. Super Admin: Global Unrestricted Access across all clients
CREATE POLICY "leave_requests_super_admin_all" ON public.leave_requests
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');

-- E. Tenant Administration & Managers: Read applications for client/facility
CREATE POLICY "leave_requests_tenant_admin_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager')
);

-- F. Tenant Administration & Managers: Direct status updates (fallback for RPC)
CREATE POLICY "leave_requests_tenant_admin_modify" ON public.leave_requests
FOR UPDATE TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager')
)
WITH CHECK (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager')
);

-- G. Payroll Admin: Read-only access to approved leave data for payroll calculations
CREATE POLICY "leave_requests_payroll_admin_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() = 'payroll_admin'
);

-- ------------------------------------------------------------------------------
-- 2. REMEDIATE LEAVE_BALANCES POLICIES
-- ------------------------------------------------------------------------------

-- Drop legacy flawed policies
DROP POLICY IF EXISTS "leave_balances_employee_select" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_all" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_super_admin_all" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_select" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_modify" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_payroll_admin_select" ON public.leave_balances;

-- A. Employee Self-Service: View own balances only
CREATE POLICY "leave_balances_employee_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

-- B. Super Admin: Global Unrestricted Access
CREATE POLICY "leave_balances_super_admin_all" ON public.leave_balances
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');

-- C. Tenant Administrators & Managers: Read balances for staff in client
CREATE POLICY "leave_balances_tenant_admin_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager')
);

-- D. Tenant Administrators: Manual balance adjustments (restricted to Admin/HR)
CREATE POLICY "leave_balances_tenant_admin_modify" ON public.leave_balances
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
)
WITH CHECK (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
);

-- E. Payroll Admin: Read-only balance inspection for paid entitlement verification
CREATE POLICY "leave_balances_payroll_admin_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() = 'payroll_admin'
);
