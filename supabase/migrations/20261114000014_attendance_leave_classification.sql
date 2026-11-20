-- ==============================================================================
-- MIGRATION 14: Attendance Leave Classification & Muster Synchronization
-- File: supabase/migrations/20261114000014_attendance_leave_classification.sql
-- Milestone: 2.4D.1 Remediation
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT APPROVAL)
-- ==============================================================================
-- Dependencies: 20261103000005_attendance_and_regularisations.sql, 20261103000006_leave_management.sql
-- Summary:
--   1. Expands daily_attendance_records.status check constraint to include 'UNPAID_LEAVE'.
--   2. Adds foreign key column leave_request_id to daily_attendance_records for audit traceability.
--   3. Installs PostgreSQL trigger to automatically synchronize approved leave into the attendance muster.
--   4. Preserves 100% immutability of raw attendance_events.
-- ==============================================================================

-- 1. Modify CHECK constraint on daily_attendance_records to support UNPAID_LEAVE (LWP)
ALTER TABLE public.daily_attendance_records
DROP CONSTRAINT IF EXISTS daily_attendance_records_status_check;

ALTER TABLE public.daily_attendance_records
ADD CONSTRAINT daily_attendance_records_status_check
CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'));

-- 2. Add leave_request_id traceability foreign key
ALTER TABLE public.daily_attendance_records
ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_attendance_leave 
ON public.daily_attendance_records(leave_request_id);

-- 3. Trigger Function: Synchronize Approved Leave to Daily Attendance Muster
CREATE OR REPLACE FUNCTION public.sync_approved_leave_to_muster()
RETURNS TRIGGER AS $$
DECLARE
    v_curr_date DATE;
    v_target_status VARCHAR(30);
BEGIN
    -- Scenario A: Leave request is approved
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
        v_target_status := CASE WHEN NEW.leave_type = 'LWP' THEN 'UNPAID_LEAVE' ELSE 'PAID_LEAVE' END;
        
        v_curr_date := NEW.start_date;
        WHILE v_curr_date <= NEW.end_date LOOP
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
                v_target_status,
                NEW.id,
                0,
                'Approved Leave',
                FALSE
            )
            ON CONFLICT (employee_id, date) DO UPDATE
            SET status = EXCLUDED.status,
                leave_request_id = EXCLUDED.leave_request_id,
                updated_at = NOW();

            v_curr_date := v_curr_date + INTERVAL '1 day';
        END LOOP;

    -- Scenario B: Previously approved leave is revoked, cancelled, or rejected
    ELSIF OLD.status = 'APPROVED' AND NEW.status IN ('CANCELLED', 'REJECTED') THEN
        DELETE FROM public.daily_attendance_records
        WHERE leave_request_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 4. Install Trigger on leave_requests
DROP TRIGGER IF EXISTS trg_sync_approved_leave_to_muster ON public.leave_requests;

CREATE TRIGGER trg_sync_approved_leave_to_muster
AFTER UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_approved_leave_to_muster();

COMMENT ON FUNCTION public.sync_approved_leave_to_muster() IS 
'Maintains attendance muster integrity by automatically mirroring approved paid and unpaid leave into daily_attendance_records.';
