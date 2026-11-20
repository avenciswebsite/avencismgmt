-- ==============================================================================
-- AVENCIS WFM — MIGRATION 20: SECURITY HARDENING & RLS POLICY COMPLETION
-- File: supabase/migrations/20261115000020_security_hardening.sql
-- Milestone: 2.5A Security Remediation & Access Control Completion
-- Target Database: PostgreSQL 17.11 (Supabase Cloud)
-- Status: PROPOSED FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT EXPLICIT APPROVAL
-- ==============================================================================
-- Dependencies: 20261103000001 through 20261115000019
--
-- Summary of Hardening Actions:
--   1. SEC-01: Deploy tenant-scoped & role-based RLS policies on the 7 deficient tables:
--      - user_profiles (Self-read, tenant-admin read/write, super_admin all)
--      - client_legal_entities (Tenant read, admin write)
--      - work_locations (Tenant read, admin write)
--      - departments (Tenant read, admin/HR write)
--      - client_policies (Tenant read, admin write)
--      - statutory_holidays (National + tenant read, admin write)
--      - statutory_pt_slabs (Universal authenticated read, super_admin write)
--   2. SEC-02: Fix mutable search_path across 8 stored routines (pin to public, auth, pg_temp).
--   3. SEC-03: Revoke EXECUTE on internal routines from PUBLIC and anon; grant to authenticated/service_role.
--   4. SEC-04: Implement Fail-Closed role resolution in get_user_role() (return NULL on missing profile).
--   5. Supporting Indexes: Ensure optimal query planning for tenant-scoping RLS predicates.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. HARDEN SECURITY HELPER FUNCTIONS (SEC-02, SEC-03, SEC-04)
-- ==============================================================================

-- 1.1 get_user_role(): Fail-Closed Identity Resolution & Pinned Search Path
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 1.2 get_user_client_id(): Pinned Search Path
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT client_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 1.3 get_user_employee_id(): Pinned Search Path
CREATE OR REPLACE FUNCTION public.get_user_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT employee_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- 1.4 Revoke public and anon execution on security helpers
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_client_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_employee_id() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_client_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_employee_id() TO authenticated, service_role;


-- ==============================================================================
-- 2. HARDEN TRIGGER & EVENT ROUTINES (SEC-02, SEC-03)
-- ==============================================================================

-- 2.1 Pin search paths on trigger handlers
ALTER FUNCTION public.guard_immutable_attendance_events() SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_immutable_audit_logs() SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_locked_payroll_modification() SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_locked_payroll_items() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;

-- 2.2 Revoke excessive privileges on trigger routines
REVOKE EXECUTE ON FUNCTION public.guard_immutable_attendance_events() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_immutable_audit_logs() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_locked_payroll_modification() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_locked_payroll_items() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_approved_leave_to_muster() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.guard_immutable_attendance_events() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_immutable_audit_logs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_locked_payroll_modification() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_locked_payroll_items() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_approved_leave_to_muster() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres, service_role;


-- ==============================================================================
-- 3. ROW-LEVEL SECURITY POLICIES: USER_PROFILES (SEC-01)
-- ==============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_self_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_tenant_admin_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_tenant_admin_modify" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_super_admin_all" ON public.user_profiles;

-- 3.1 Self-Service: Authenticated user can read their own profile row
CREATE POLICY "user_profiles_self_select" ON public.user_profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

-- 3.2 Self-Service: Authenticated user can update only safe metadata (last_login_at)
-- Role, client_id, and employee_id escalation are strictly prevented
CREATE POLICY "user_profiles_self_update" ON public.user_profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid() 
    AND role = (SELECT up.role FROM public.user_profiles up WHERE up.id = auth.uid())
    AND client_id IS NOT DISTINCT FROM (SELECT up.client_id FROM public.user_profiles up WHERE up.id = auth.uid())
    AND employee_id IS NOT DISTINCT FROM (SELECT up.employee_id FROM public.user_profiles up WHERE up.id = auth.uid())
);

-- 3.3 Tenant Admin: Client Admin can inspect profiles belonging to their client organization
CREATE POLICY "user_profiles_tenant_admin_select" ON public.user_profiles
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
);

-- 3.4 Tenant Admin: Client Admin can create and manage user profiles in their tenant
-- Prohibits creating or escalating any user to 'super_admin'
CREATE POLICY "user_profiles_tenant_admin_modify" ON public.user_profiles
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
    AND role <> 'super_admin'
)
WITH CHECK (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
    AND role <> 'super_admin'
);

-- 3.5 Super Admin: Global Unrestricted Access
CREATE POLICY "user_profiles_super_admin_all" ON public.user_profiles
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');


-- ==============================================================================
-- 4. ROW-LEVEL SECURITY POLICIES: CLIENT_LEGAL_ENTITIES (SEC-01)
-- ==============================================================================
ALTER TABLE public.client_legal_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_entities_tenant_select" ON public.client_legal_entities;
DROP POLICY IF EXISTS "legal_entities_admin_modify" ON public.client_legal_entities;
DROP POLICY IF EXISTS "legal_entities_super_admin_all" ON public.client_legal_entities;

-- 4.1 Tenant Read: All authenticated users in tenant can view legal entities
CREATE POLICY "legal_entities_tenant_select" ON public.client_legal_entities
FOR SELECT TO authenticated
USING (
    public.get_user_role() = 'super_admin' 
    OR client_id = public.get_user_client_id()
);

-- 4.2 Admin Manage: Client Admin can insert/update/delete entities in their tenant
CREATE POLICY "legal_entities_admin_modify" ON public.client_legal_entities
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
)
WITH CHECK (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
);

-- 4.3 Super Admin: Global Unrestricted Access
CREATE POLICY "legal_entities_super_admin_all" ON public.client_legal_entities
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');


-- ==============================================================================
-- 5. ROW-LEVEL SECURITY POLICIES: WORK_LOCATIONS (SEC-01)
-- ==============================================================================
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_locations_tenant_select" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_admin_modify" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_super_admin_all" ON public.work_locations;

-- 5.1 Tenant Read: All authenticated users in tenant can view worksite locations & geofences
CREATE POLICY "work_locations_tenant_select" ON public.work_locations
FOR SELECT TO authenticated
USING (
    public.get_user_role() = 'super_admin' 
    OR client_id = public.get_user_client_id()
);

-- 5.2 Admin Manage: Client Admin can manage worksites
CREATE POLICY "work_locations_admin_modify" ON public.work_locations
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
)
WITH CHECK (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
);

-- 5.3 Super Admin: Global Unrestricted Access
CREATE POLICY "work_locations_super_admin_all" ON public.work_locations
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');


-- ==============================================================================
-- 6. ROW-LEVEL SECURITY POLICIES: DEPARTMENTS (SEC-01)
-- ==============================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_tenant_select" ON public.departments;
DROP POLICY IF EXISTS "departments_admin_modify" ON public.departments;
DROP POLICY IF EXISTS "departments_super_admin_all" ON public.departments;

-- 6.1 Tenant Read: All authenticated users in tenant can view departments
CREATE POLICY "departments_tenant_select" ON public.departments
FOR SELECT TO authenticated
USING (
    public.get_user_role() = 'super_admin' 
    OR client_id = public.get_user_client_id()
);

-- 6.2 Admin / HR Manage: Client Admin and HR Admin can manage departments
CREATE POLICY "departments_admin_modify" ON public.departments
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
)
WITH CHECK (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
);

-- 6.3 Super Admin: Global Unrestricted Access
CREATE POLICY "departments_super_admin_all" ON public.departments
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');


-- ==============================================================================
-- 7. ROW-LEVEL SECURITY POLICIES: CLIENT_POLICIES (SEC-01)
-- ==============================================================================
ALTER TABLE public.client_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_policies_tenant_select" ON public.client_policies;
DROP POLICY IF EXISTS "client_policies_admin_modify" ON public.client_policies;
DROP POLICY IF EXISTS "client_policies_super_admin_all" ON public.client_policies;

-- 7.1 Tenant Read: All authenticated users in tenant can view operational rules
CREATE POLICY "client_policies_tenant_select" ON public.client_policies
FOR SELECT TO authenticated
USING (
    public.get_user_role() = 'super_admin' 
    OR client_id = public.get_user_client_id()
);

-- 7.2 Admin Manage: Client Admin can update policies for their organization
CREATE POLICY "client_policies_admin_modify" ON public.client_policies
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
)
WITH CHECK (
    client_id = public.get_user_client_id() 
    AND public.get_user_role() = 'client_admin'
);

-- 7.3 Super Admin: Global Unrestricted Access
CREATE POLICY "client_policies_super_admin_all" ON public.client_policies
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');


-- ==============================================================================
-- 8. ROW-LEVEL SECURITY POLICIES: STATUTORY_HOLIDAYS (SEC-01)
-- ==============================================================================
ALTER TABLE public.statutory_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "statutory_holidays_tenant_select" ON public.statutory_holidays;
DROP POLICY IF EXISTS "statutory_holidays_admin_modify" ON public.statutory_holidays;
DROP POLICY IF EXISTS "statutory_holidays_super_admin_all" ON public.statutory_holidays;

-- 8.1 Tenant Read: National holidays (client_id IS NULL) + tenant-specific holidays
CREATE POLICY "statutory_holidays_tenant_select" ON public.statutory_holidays
FOR SELECT TO authenticated
USING (
    client_id IS NULL 
    OR public.get_user_role() = 'super_admin' 
    OR client_id = public.get_user_client_id()
);

-- 8.2 Admin Manage: Client Admin & HR Admin can manage client-specific holidays
CREATE POLICY "statutory_holidays_admin_modify" ON public.statutory_holidays
FOR ALL TO authenticated
USING (
    client_id IS NOT NULL 
    AND client_id = public.get_user_client_id() 
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
)
WITH CHECK (
    client_id IS NOT NULL 
    AND client_id = public.get_user_client_id() 
    AND public.get_user_role() IN ('client_admin', 'hr_admin')
);

-- 8.3 Super Admin: Global Unrestricted Access (including national holidays)
CREATE POLICY "statutory_holidays_super_admin_all" ON public.statutory_holidays
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');


-- ==============================================================================
-- 9. ROW-LEVEL SECURITY POLICIES: STATUTORY_PT_SLABS (SEC-01)
-- ==============================================================================
ALTER TABLE public.statutory_pt_slabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "statutory_pt_slabs_global_select" ON public.statutory_pt_slabs;
DROP POLICY IF EXISTS "statutory_pt_slabs_super_admin_modify" ON public.statutory_pt_slabs;

-- 9.1 Global Read: Public statutory tax schedules readable by all authenticated sessions
CREATE POLICY "statutory_pt_slabs_global_select" ON public.statutory_pt_slabs
FOR SELECT TO authenticated
USING (true);

-- 9.2 Super Admin Manage: Only Super Admin can alter state tax brackets
CREATE POLICY "statutory_pt_slabs_super_admin_modify" ON public.statutory_pt_slabs
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin')
WITH CHECK (public.get_user_role() = 'super_admin');


-- ==============================================================================
-- 10. SUPPORTING PERFORMANCE INDEXES FOR RLS EVALUATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_lookup 
    ON public.user_profiles (id, client_id, role);

CREATE INDEX IF NOT EXISTS idx_client_policies_lookup 
    ON public.client_policies (client_id, is_configured);

CREATE INDEX IF NOT EXISTS idx_legal_entities_lookup 
    ON public.client_legal_entities (client_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_work_locations_lookup 
    ON public.work_locations (client_id);

CREATE INDEX IF NOT EXISTS idx_statutory_holidays_lookup 
    ON public.statutory_holidays (client_id, date);

COMMIT;
