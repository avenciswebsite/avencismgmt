-- ============================================================================
-- AVENCIS WFM — MIGRATION 21: RBAC DISCREPANCY REMEDIATION & PROFILE HARDENING
-- ============================================================================
-- Description:
-- 1. DISC-01: Creates get_manager_team() secure RPC for scoped team directory access
-- 2. DISC-02: Hardens attendance_corrections policies with location_manager authority
--    and strict anti-self-approval protection (employee_id <> get_user_employee_id())
-- 3. DISC-03: Scopes location_manager access on daily_attendance_records to facility
-- 4. User Profile Hardening: Implements guard_user_profile_privilege_escalation()
--    trigger to prevent any unauthorized role, tenant, or employee_id modification.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. User Profile Privilege Escalation Guard Trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_user_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_caller_role text;
    v_caller_client_id uuid;
    v_caller_uid uuid;
BEGIN
    v_caller_uid := auth.uid();
    
    -- If executed outside Supabase Auth context (e.g., initial seed or postgres admin)
    IF v_caller_uid IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_caller_role := public.get_user_role();
    v_caller_client_id := public.get_user_client_id();

    -- Super Admin has full administrative rights over user_profiles
    IF v_caller_role = 'super_admin' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- ON INSERT:
    IF TG_OP = 'INSERT' THEN
        -- Only super_admin or client_admin may insert profiles
        IF v_caller_role = 'client_admin' THEN
            -- Cannot create super_admin
            IF NEW.role = 'super_admin' THEN
                RAISE EXCEPTION 'Client admins cannot create super_admin profiles'
                    USING ERRCODE = '42501';
            END IF;
            -- Must assign to their own tenant
            IF NEW.client_id IS DISTINCT FROM v_caller_client_id THEN
                RAISE EXCEPTION 'Client admins can only create profiles within their own client tenant'
                    USING ERRCODE = '42501';
            END IF;
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Unauthorized profile creation'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- ON UPDATE:
    IF TG_OP = 'UPDATE' THEN
        -- Client Admin updating a profile
        IF v_caller_role = 'client_admin' THEN
            -- Cannot modify super_admin profiles
            IF OLD.role = 'super_admin' OR NEW.role = 'super_admin' THEN
                RAISE EXCEPTION 'Client admins cannot modify or grant super_admin roles'
                    USING ERRCODE = '42501';
            END IF;
            -- Cannot move users between tenants
            IF OLD.client_id IS DISTINCT FROM v_caller_client_id OR NEW.client_id IS DISTINCT FROM v_caller_client_id THEN
                RAISE EXCEPTION 'Client admins cannot transfer profiles across client tenants'
                    USING ERRCODE = '42501';
            END IF;
            -- Client Admin updating their OWN profile: cannot self-escalate or change tenant
            IF OLD.id = v_caller_uid THEN
                IF NEW.role IS DISTINCT FROM OLD.role THEN
                    RAISE EXCEPTION 'Administrators cannot alter their own role'
                        USING ERRCODE = '42501';
                END IF;
                IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
                    RAISE EXCEPTION 'Administrators cannot alter their own client tenant'
                        USING ERRCODE = '42501';
                END IF;
            END IF;
            RETURN NEW;
        END IF;

        -- Non-admin users (employee, manager, hr_admin, payroll_admin) updating self:
        IF OLD.id = v_caller_uid THEN
            -- Immutability of role, client_id, employee_id, and id
            IF NEW.role IS DISTINCT FROM OLD.role THEN
                RAISE EXCEPTION 'Users cannot alter their own role'
                    USING ERRCODE = '42501';
            END IF;
            IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
                RAISE EXCEPTION 'Users cannot alter their own client tenant'
                    USING ERRCODE = '42501';
            END IF;
            IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
                RAISE EXCEPTION 'Users cannot alter their own employee linkage'
                    USING ERRCODE = '42501';
            END IF;
            IF NEW.id IS DISTINCT FROM OLD.id THEN
                RAISE EXCEPTION 'Profile ID is immutable'
                    USING ERRCODE = '42501';
            END IF;
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Unauthorized profile modification'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- ON DELETE:
    IF TG_OP = 'DELETE' THEN
        IF v_caller_role = 'client_admin' THEN
            IF OLD.role = 'super_admin' THEN
                RAISE EXCEPTION 'Client admins cannot delete super_admin profiles'
                    USING ERRCODE = '42501';
            END IF;
            IF OLD.client_id IS DISTINCT FROM v_caller_client_id THEN
                RAISE EXCEPTION 'Client admins can only delete profiles within their own client tenant'
                    USING ERRCODE = '42501';
            END IF;
            IF OLD.id = v_caller_uid THEN
                RAISE EXCEPTION 'Administrators cannot delete their own profile'
                    USING ERRCODE = '42501';
            END IF;
            RETURN OLD;
        ELSE
            RAISE EXCEPTION 'Unauthorized profile deletion'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profile_privilege_escalation ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profile_privilege_escalation
BEFORE INSERT OR UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_user_profile_privilege_escalation();

-- ----------------------------------------------------------------------------
-- 2. DISC-01: Scoped Team Directory RPC (get_manager_team)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_manager_team()
RETURNS TABLE (
    id uuid,
    client_id uuid,
    work_location_id uuid,
    department_id uuid,
    employee_code varchar,
    first_name varchar,
    last_name varchar,
    email varchar,
    mobile varchar,
    designation varchar,
    joining_date date,
    employment_arrangement varchar,
    status varchar,
    avatar_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_role text;
    v_client_id uuid;
    v_employee_id uuid;
    v_work_location_id uuid;
BEGIN
    v_role := public.get_user_role();
    v_client_id := public.get_user_client_id();
    v_employee_id := public.get_user_employee_id();

    -- Reject unauthenticated or unprovisioned callers
    IF v_role IS NULL OR (v_role <> 'super_admin' AND v_client_id IS NULL) THEN
        RETURN;
    END IF;

    -- Super Admin: can view all employees across all clients (safe operational fields only)
    IF v_role = 'super_admin' THEN
        RETURN QUERY
        SELECT 
            e.id, e.client_id, e.work_location_id, e.department_id,
            e.employee_code, e.first_name, e.last_name, e.email, e.mobile,
            e.designation, e.joining_date, e.employment_arrangement, e.status, e.avatar_url
        FROM public.employees e;
        RETURN;
    END IF;

    -- Client Admin, HR Admin, Client Manager: view all employees within their client tenant
    IF v_role IN ('client_admin', 'hr_admin', 'client_manager') THEN
        RETURN QUERY
        SELECT 
            e.id, e.client_id, e.work_location_id, e.department_id,
            e.employee_code, e.first_name, e.last_name, e.email, e.mobile,
            e.designation, e.joining_date, e.employment_arrangement, e.status, e.avatar_url
        FROM public.employees e
        WHERE e.client_id = v_client_id;
        RETURN;
    END IF;

    -- Location Manager: view only employees assigned to the same work location
    IF v_role = 'location_manager' THEN
        SELECT work_location_id INTO v_work_location_id
        FROM public.employees
        WHERE id = v_employee_id;

        IF v_work_location_id IS NOT NULL THEN
            RETURN QUERY
            SELECT 
                e.id, e.client_id, e.work_location_id, e.department_id,
                e.employee_code, e.first_name, e.last_name, e.email, e.mobile,
                e.designation, e.joining_date, e.employment_arrangement, e.status, e.avatar_url
            FROM public.employees e
            WHERE e.client_id = v_client_id
              AND e.work_location_id = v_work_location_id;
        END IF;
        RETURN;
    END IF;

    -- Employee or other role: view only self
    IF v_role = 'employee' AND v_employee_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            e.id, e.client_id, e.work_location_id, e.department_id,
            e.employee_code, e.first_name, e.last_name, e.email, e.mobile,
            e.designation, e.joining_date, e.employment_arrangement, e.status, e.avatar_url
        FROM public.employees e
        WHERE e.id = v_employee_id;
        RETURN;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_manager_team() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_manager_team() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_manager_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_manager_team() TO service_role;

-- ----------------------------------------------------------------------------
-- 3. DISC-02: Hardened Attendance Corrections Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS corrections_tenant_admin_all ON public.attendance_corrections;

-- Client Admin, HR Admin, Client Manager: Tenant-wide review with anti-self-approval
CREATE POLICY corrections_tenant_admin_modify ON public.attendance_corrections
    FOR ALL
    TO authenticated
    USING (
        client_id = public.get_user_client_id()
        AND employee_id <> public.get_user_employee_id()
        AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
    )
    WITH CHECK (
        client_id = public.get_user_client_id()
        AND employee_id <> public.get_user_employee_id()
        AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
    );

-- Location Manager: Location-scoped review with anti-self-approval
CREATE POLICY corrections_location_manager_modify ON public.attendance_corrections
    FOR ALL
    TO authenticated
    USING (
        client_id = public.get_user_client_id()
        AND employee_id <> public.get_user_employee_id()
        AND public.get_user_role() = 'location_manager'
        AND employee_id IN (
            SELECT e.id FROM public.employees e
            WHERE e.work_location_id = (
                SELECT m.work_location_id FROM public.employees m
                WHERE m.id = public.get_user_employee_id()
            )
        )
    )
    WITH CHECK (
        client_id = public.get_user_client_id()
        AND employee_id <> public.get_user_employee_id()
        AND public.get_user_role() = 'location_manager'
        AND employee_id IN (
            SELECT e.id FROM public.employees e
            WHERE e.work_location_id = (
                SELECT m.work_location_id FROM public.employees m
                WHERE m.id = public.get_user_employee_id()
            )
        )
    );

-- Manager & Admin SELECT policy: permits viewing submitted corrections for authorized subordinates
CREATE POLICY corrections_tenant_manager_select ON public.attendance_corrections
    FOR SELECT
    TO authenticated
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

-- Super Admin: Full catalog access
CREATE POLICY corrections_super_admin_all ON public.attendance_corrections
    FOR ALL
    TO authenticated
    USING (public.get_user_role() = 'super_admin')
    WITH CHECK (public.get_user_role() = 'super_admin');

-- ----------------------------------------------------------------------------
-- 4. DISC-03: Hardened Daily Attendance Records Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS daily_attendance_tenant_admin_all ON public.daily_attendance_records;

-- Client Admin, HR Admin, Client Manager: Tenant-wide attendance access
CREATE POLICY daily_attendance_tenant_admin_all ON public.daily_attendance_records
    FOR ALL
    TO authenticated
    USING (
        client_id = public.get_user_client_id()
        AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
    )
    WITH CHECK (
        client_id = public.get_user_client_id()
        AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
    );

-- Location Manager: Scoped strictly to facility assigned to location manager
CREATE POLICY daily_attendance_location_manager_all ON public.daily_attendance_records
    FOR ALL
    TO authenticated
    USING (
        client_id = public.get_user_client_id()
        AND public.get_user_role() = 'location_manager'
        AND employee_id IN (
            SELECT e.id FROM public.employees e
            WHERE e.work_location_id = (
                SELECT m.work_location_id FROM public.employees m
                WHERE m.id = public.get_user_employee_id()
            )
        )
    )
    WITH CHECK (
        client_id = public.get_user_client_id()
        AND public.get_user_role() = 'location_manager'
        AND employee_id IN (
            SELECT e.id FROM public.employees e
            WHERE e.work_location_id = (
                SELECT m.work_location_id FROM public.employees m
                WHERE m.id = public.get_user_employee_id()
            )
        )
    );
