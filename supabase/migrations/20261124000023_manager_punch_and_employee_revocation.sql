-- ==============================================================================
-- MIGRATION 23: Manager Self-Punch & Employee Revocation Schema
-- File: supabase/migrations/20261124000023_manager_punch_and_employee_revocation.sql
-- Milestone: Manager Self-Attendance & Soft Deactivation Access Revocation
-- ==============================================================================

-- 1. Add last_working_day and termination_reason to employees if not exists
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS last_working_day DATE,
ADD COLUMN IF NOT EXISTS termination_reason TEXT;

-- 2. Tenant Admin INSERT Policy on attendance_events (allows managers to record punch telemetry)
DROP POLICY IF EXISTS "events_tenant_admin_insert" ON public.attendance_events;

CREATE POLICY "events_tenant_admin_insert" ON public.attendance_events
FOR INSERT TO authenticated
WITH CHECK (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'client_manager', 'hr_admin')
);

-- 3. Hardened RLS Session Invalidation for Deactivated Users
-- When an employee is removed/terminated and their user_profile.is_active is set to false,
-- these functions return NULL, immediately revoking all RLS read/write access.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT client_id FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_user_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT employee_id FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
$$;
