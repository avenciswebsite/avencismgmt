-- ==============================================================================
-- MIGRATION 16: Hardened Leave Row Level Security (RLS) & Multi-Role Policies
-- File: supabase/migrations/20261115000016_hardened_leave_rls.sql
-- Milestone: 2.4D.2 Security & Data Integrity Review
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT APPROVAL)
-- ==============================================================================
-- SUPERSEDES: 20261114000013_leave_rls_remediation.sql
-- Dependencies: 20261103000009, 20261115000015
--
-- Architectural Corrections Implemented:
--   1. Comprehensive Anti-Self-Approval on Direct UPDATE:
--      Guarantees no manager or HR administrator can self-approve their own request
--      via direct PostgREST calls (enforces employee_id <> public.get_user_employee_id()).
--   2. Location Manager Site Scoping in System Catalog:
--      Restricts Location Managers to viewing and reviewing applications and balances
--      only for employees belonging to their assigned work_location_id.
--   3. Employee Privilege Escalation Neutralization:
--      Granular separation of SELECT, INSERT (PENDING only), and UPDATE (CANCELLED only).
--   4. Super Admin Global Decoupling:
--      Removes client_id restriction for Super Admin (whose profile client_id is NULL).
--   5. Payroll Admin Read-Only Entitlement Inspection:
--      Permits client-scoped SELECT on leave_requests and leave_balances.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLEANUP ALL EXISTING POLICIES ON LEAVE_REQUESTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "leave_requests_employee_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_employee_cancel" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_super_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_modify" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_payroll_admin_select" ON public.leave_requests;

-- ------------------------------------------------------------------------------
-- 2. HARDENED POLICIES ON LEAVE_REQUESTS
-- ------------------------------------------------------------------------------

-- A. Employee Self-Service: SELECT own requests only
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

-- D. Super Admin: Global Unrestricted Access across all tenants
CREATE POLICY "leave_requests_super_admin_all" ON public.leave_requests
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');

-- E. Tenant Administration & Managers: Read applications for client/facility
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

-- F. Tenant Administration & Managers: Direct status updates (Guarded fallback)
-- Strictly enforces Anti-Self-Approval: employee_id <> public.get_user_employee_id()
CREATE POLICY "leave_requests_tenant_admin_modify" ON public.leave_requests
FOR UPDATE TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id() -- Anti-Self-Approval
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
    AND employee_id <> public.get_user_employee_id() -- Anti-Self-Approval
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

-- G. Payroll Admin: Read-only access to leave applications for pay period processing
CREATE POLICY "leave_requests_payroll_admin_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() = 'payroll_admin'
);

-- ------------------------------------------------------------------------------
-- 3. CLEANUP ALL EXISTING POLICIES ON LEAVE_BALANCES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "leave_balances_employee_select" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_all" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_super_admin_all" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_select" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_modify" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances_payroll_admin_select" ON public.leave_balances;

-- ------------------------------------------------------------------------------
-- 4. HARDENED POLICIES ON LEAVE_BALANCES
-- ------------------------------------------------------------------------------

-- A. Employee Self-Service: View own balances only
CREATE POLICY "leave_balances_employee_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

-- B. Super Admin: Global Unrestricted Access
CREATE POLICY "leave_balances_super_admin_all" ON public.leave_balances
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');

-- C. Tenant Administration & Managers: Read balances for authorized staff
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

-- D. Tenant Administrators: Manual balance adjustments (Restricted to Client Admin / HR Admin)
-- Strictly prevents HR / Admin from adjusting their own balance directly
CREATE POLICY "leave_balances_tenant_admin_modify" ON public.leave_balances
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id() -- Anti-Self-Adjustment
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
)
WITH CHECK (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id() -- Anti-Self-Adjustment
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
);

-- E. Payroll Admin: Read-only balance inspection for entitlement reconciliation
CREATE POLICY "leave_balances_payroll_admin_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() = 'payroll_admin'
);
