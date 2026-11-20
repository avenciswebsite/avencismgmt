-- ==============================================================================
-- MIGRATION 09: Comprehensive Multi-Tenant Row Level Security (RLS) Policies
-- File: supabase/migrations/20261103000009_row_level_security_policies.sql
-- ==============================================================================

-- 1. Enable RLS on all sensitive tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. CLIENTS TABLE POLICIES
-- ==============================================================================
CREATE POLICY "clients_super_admin_all" ON clients
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin');

CREATE POLICY "clients_client_admin_select" ON clients
FOR SELECT TO authenticated
USING (id = public.get_user_client_id());

-- ==============================================================================
-- 3. EMPLOYEES TABLE POLICIES
-- ==============================================================================
CREATE POLICY "employees_super_admin_all" ON employees
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin');

CREATE POLICY "employees_client_admin_tenant" ON employees
FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin', 'payroll_admin'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin', 'payroll_admin'));

CREATE POLICY "employees_self_select" ON employees
FOR SELECT TO authenticated
USING (id = public.get_user_employee_id());

-- ==============================================================================
-- 4. SALARY STRUCTURES & BANKING SECURITY (RESTRICTED ACCESS)
-- ==============================================================================
CREATE POLICY "salary_super_admin_all" ON employee_salary_structures
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin');

CREATE POLICY "salary_payroll_admin_tenant" ON employee_salary_structures
FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'payroll_admin'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'payroll_admin'));

CREATE POLICY "salary_employee_self_select" ON employee_salary_structures
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id() AND is_active = TRUE);

CREATE POLICY "bank_super_admin_all" ON employee_bank_details
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin');

CREATE POLICY "bank_payroll_admin_tenant" ON employee_bank_details
FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'payroll_admin'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'payroll_admin'));

CREATE POLICY "bank_employee_self_select" ON employee_bank_details
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

-- ==============================================================================
-- 5. ATTENDANCE EVENTS (APPEND-ONLY RAW LEDGER)
-- ==============================================================================
CREATE POLICY "events_super_admin_select" ON attendance_events
FOR SELECT TO authenticated
USING (public.get_user_role() = 'super_admin');

CREATE POLICY "events_tenant_admin_select" ON attendance_events
FOR SELECT TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager'));

CREATE POLICY "events_employee_self_select" ON attendance_events
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

CREATE POLICY "events_employee_self_insert" ON attendance_events
FOR INSERT TO authenticated
WITH CHECK (
    employee_id = public.get_user_employee_id() AND 
    client_id = public.get_user_client_id()
);

-- Note: No UPDATE or DELETE policy exists on attendance_events (strictly immutable)

-- ==============================================================================
-- 6. DAILY ATTENDANCE & REGULARISATIONS
-- ==============================================================================
CREATE POLICY "daily_attendance_super_admin_all" ON daily_attendance_records
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin');

CREATE POLICY "daily_attendance_tenant_admin_all" ON daily_attendance_records
FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager'));

CREATE POLICY "daily_attendance_employee_select" ON daily_attendance_records
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

CREATE POLICY "corrections_employee_apply" ON attendance_corrections
FOR INSERT TO authenticated
WITH CHECK (employee_id = public.get_user_employee_id() AND client_id = public.get_user_client_id());

CREATE POLICY "corrections_employee_select" ON attendance_corrections
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

CREATE POLICY "corrections_tenant_admin_all" ON attendance_corrections
FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager'));

-- ==============================================================================
-- 7. LEAVE BALANCES & REQUESTS
-- ==============================================================================
CREATE POLICY "leave_balances_employee_select" ON leave_balances
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

CREATE POLICY "leave_balances_tenant_admin_all" ON leave_balances
FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin'));

CREATE POLICY "leave_requests_employee_all" ON leave_requests
FOR ALL TO authenticated
USING (employee_id = public.get_user_employee_id())
WITH CHECK (employee_id = public.get_user_employee_id() AND client_id = public.get_user_client_id());

CREATE POLICY "leave_requests_tenant_admin_all" ON leave_requests
FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager'));

-- ==============================================================================
-- 8. PAYROLL RUNS, ITEMS & PAYSLIPS
-- ==============================================================================
CREATE POLICY "payroll_runs_admin_all" ON payroll_runs
FOR ALL TO authenticated
USING (
    public.get_user_role() = 'super_admin' OR 
    (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'payroll_admin'))
)
WITH CHECK (
    public.get_user_role() = 'super_admin' OR 
    (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'payroll_admin'))
);

CREATE POLICY "payroll_items_admin_all" ON payroll_items
FOR ALL TO authenticated
USING (
    public.get_user_role() = 'super_admin' OR 
    (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'payroll_admin'))
);

CREATE POLICY "payroll_items_employee_self_select" ON payroll_items
FOR SELECT TO authenticated
USING (
    employee_id = public.get_user_employee_id() AND
    EXISTS (SELECT 1 FROM payroll_runs r WHERE r.id = run_id AND r.status IN ('approved', 'locked'))
);

CREATE POLICY "payslips_admin_all" ON payslips
FOR ALL TO authenticated
USING (
    public.get_user_role() = 'super_admin' OR 
    (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'payroll_admin', 'hr_admin'))
);

CREATE POLICY "payslips_employee_self_select" ON payslips
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id() AND is_published = TRUE);

-- ==============================================================================
-- 9. AUDIT LOGS (IMMUTABLE SECURITY LEDGER)
-- ==============================================================================
CREATE POLICY "audit_logs_super_admin_select" ON audit_logs
FOR SELECT TO authenticated
USING (public.get_user_role() = 'super_admin');

CREATE POLICY "audit_logs_client_admin_select" ON audit_logs
FOR SELECT TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() = 'client_admin');

CREATE POLICY "audit_logs_authenticated_insert" ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- Note: No UPDATE or DELETE policy exists on audit_logs (append-only ledger)
