-- ==============================================================================
-- MIGRATION 22: Attendance Muster Employee Self-Service RLS Remediation
-- File: supabase/migrations/20261121000022_attendance_muster_employee_rls.sql
-- Milestone: Attendance Self-Service & Mobile Punch Integrity
-- ==============================================================================
-- Root Cause:
--   Previously, daily_attendance_records only granted SELECT to employees
--   ("daily_attendance_employee_select"). When an employee recorded their daily
--   check-in or check-out punch via attendanceService.recordPunch, the raw telemetry
--   in attendance_events was recorded successfully, but the corresponding upsert into
--   daily_attendance_records failed with error 42501 (insufficient_privilege):
--   "[attendanceService.recordPunch.muster] Access denied: You do not have permission to view or modify this record."
--
-- Remediation:
--   1. Add "daily_attendance_employee_insert" policy granting authenticated employees
--      permission to insert their daily presence ledger row for their own employee_id and client_id.
--   2. Add "daily_attendance_employee_update" policy granting authenticated employees
--      permission to update their daily presence ledger row (e.g. check-out timestamp, total_hours)
--      for their own employee_id and client_id.
-- ==============================================================================

-- 1. Employee Self-Service INSERT Policy on daily_attendance_records
DROP POLICY IF EXISTS "daily_attendance_employee_insert" ON public.daily_attendance_records;

CREATE POLICY "daily_attendance_employee_insert" ON public.daily_attendance_records
FOR INSERT TO authenticated
WITH CHECK (
    employee_id = public.get_user_employee_id()
    AND client_id = public.get_user_client_id()
);

-- 2. Employee Self-Service UPDATE Policy on daily_attendance_records
DROP POLICY IF EXISTS "daily_attendance_employee_update" ON public.daily_attendance_records;

CREATE POLICY "daily_attendance_employee_update" ON public.daily_attendance_records
FOR UPDATE TO authenticated
USING (
    employee_id = public.get_user_employee_id()
    AND client_id = public.get_user_client_id()
)
WITH CHECK (
    employee_id = public.get_user_employee_id()
    AND client_id = public.get_user_client_id()
);
