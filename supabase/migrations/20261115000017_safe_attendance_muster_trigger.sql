-- ==============================================================================
-- MIGRATION 17: Safe Attendance Muster Synchronization & Comprehensive Status Constraints
-- File: supabase/migrations/20261115000017_safe_attendance_muster_trigger.sql
-- Milestone: 2.4D.2 Security & Data Integrity Review
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE WITHOUT APPROVAL)
-- ==============================================================================
-- SUPERSEDES: 20261114000014_attendance_leave_classification.sql
-- Dependencies: 20261103000002, 20261103000005, 20261103000006, 20261103000008
--
-- Architectural Corrections Implemented:
--   1. Comprehensive Status Coverage (All 9 Legitimate Statuses Preserved):
--      Preserves PRESENT, ABSENT, HALF_DAY, LATE, ON_DUTY, PAID_LEAVE, UNPAID_LEAVE,
--      WEEKLY_OFF, and HOLIDAY.
--   2. Absolute Biometric & Raw Punch Protection:
--      Never touches attendance_events.
--      Never overwrites muster rows having actual punch timestamps (check_in_time / total_hours > 0).
--   3. Regularisation & Manual Correction Protection:
--      Never overwrites muster records where is_regularised = TRUE.
--   4. Calendar-Aware Muster Mapping:
--      Does not convert non-working weekly rest days or statutory holidays into leave rows.
--   5. Safe Cancellation & Reversion:
--      When approved leave is cancelled or rejected, rows are not indiscriminately deleted;
--      weekly offs and holidays are restored, actual punches are preserved, and synthetic
--      records revert safely without orphaning or destroying history.
--   6. Full Lifecycle Event Coverage:
--      Fires on AFTER INSERT OR UPDATE OF status, start_date, end_date.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPAND DAILY_ATTENDANCE_RECORDS STATUS CHECK CONSTRAINT (ALL 9 STATUSES)
-- ------------------------------------------------------------------------------
ALTER TABLE public.daily_attendance_records
DROP CONSTRAINT IF EXISTS daily_attendance_records_status_check;

ALTER TABLE public.daily_attendance_records
ADD CONSTRAINT daily_attendance_records_status_check
CHECK (status IN (
    'PRESENT',
    'ABSENT',
    'HALF_DAY',
    'LATE',
    'ON_DUTY',
    'PAID_LEAVE',
    'UNPAID_LEAVE',
    'WEEKLY_OFF',
    'HOLIDAY'
));

-- ------------------------------------------------------------------------------
-- 2. TRACEABILITY FOREIGN KEY TO LEAVE_REQUESTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.daily_attendance_records
ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_attendance_leave_req
ON public.daily_attendance_records(leave_request_id);

-- ------------------------------------------------------------------------------
-- 3. HARDENED MUSTER SYNCHRONIZATION TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_approved_leave_to_muster()
RETURNS TRIGGER AS $$
DECLARE
    v_curr_date DATE;
    v_target_status VARCHAR(30);
    v_weekly_offs TEXT[];
    v_emp_loc_id UUID;
    v_day_name TEXT;
    v_is_weekly_off BOOLEAN;
    v_is_holiday BOOLEAN;
    v_existing RECORD;
BEGIN
    -- Scenario A: Leave is APPROVED (either freshly inserted as APPROVED or updated to APPROVED, or dates shifted)
    IF NEW.status = 'APPROVED' AND (TG_OP = 'INSERT' OR OLD.status <> 'APPROVED' OR OLD.start_date <> NEW.start_date OR OLD.end_date <> NEW.end_date) THEN
        v_target_status := CASE WHEN NEW.leave_type = 'LWP' THEN 'UNPAID_LEAVE' ELSE 'PAID_LEAVE' END;

        -- Fetch employee location for holiday resolution
        SELECT work_location_id INTO v_emp_loc_id
        FROM public.employees
        WHERE id = NEW.employee_id;

        -- Fetch client weekly rest days
        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = NEW.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

        -- If dates shifted on an already approved request, clean up obsolete unlinked dates
        IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' AND (OLD.start_date <> NEW.start_date OR OLD.end_date <> NEW.end_date) THEN
            UPDATE public.daily_attendance_records
            SET status = 'ABSENT',
                leave_request_id = NULL,
                updated_at = NOW()
            WHERE leave_request_id = NEW.id
              AND (date < NEW.start_date OR date > NEW.end_date)
              AND check_in_time IS NULL
              AND total_hours = 0
              AND is_regularised = FALSE;
        END IF;

        -- Synchronize each calendar day in the approved span
        v_curr_date := NEW.start_date;
        WHILE v_curr_date <= NEW.end_date LOOP
            v_day_name := UPPER(TRIM(TO_CHAR(v_curr_date, 'FMDAY')));
            v_is_weekly_off := (v_day_name = ANY(v_weekly_offs));

            -- Check statutory holiday calendar
            SELECT EXISTS (
                SELECT 1 FROM public.statutory_holidays sh
                WHERE sh.date = v_curr_date
                  AND (sh.client_id = NEW.client_id OR sh.client_id IS NULL)
                  AND (sh.work_location_id = v_emp_loc_id OR sh.work_location_id IS NULL)
            ) INTO v_is_holiday;

            -- Inspect existing muster row on this date
            SELECT * INTO v_existing
            FROM public.daily_attendance_records
            WHERE employee_id = NEW.employee_id
              AND date = v_curr_date;

            IF FOUND THEN
                -- STRICT PROTECTION GUARDS:
                -- 1. Never overwrite actual punch telemetry
                -- 2. Never overwrite manually approved regularisations
                IF (v_existing.check_in_time IS NOT NULL OR v_existing.total_hours > 0 OR v_existing.is_regularised = TRUE) THEN
                    -- Leave punch/regularisation untouched; simply link leave_request_id for audit traceability
                    UPDATE public.daily_attendance_records
                    SET leave_request_id = NEW.id,
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                -- 3. If day is weekly off or holiday, preserve calendar status
                ELSIF v_is_weekly_off THEN
                    UPDATE public.daily_attendance_records
                    SET status = 'WEEKLY_OFF',
                        leave_request_id = NEW.id,
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                ELSIF v_is_holiday THEN
                    UPDATE public.daily_attendance_records
                    SET status = 'HOLIDAY',
                        leave_request_id = NEW.id,
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                ELSE
                    -- Safely transition synthetic/absent row to approved leave
                    UPDATE public.daily_attendance_records
                    SET status = v_target_status,
                        leave_request_id = NEW.id,
                        location_name = COALESCE(v_existing.location_name, 'Approved Leave'),
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                END IF;
            ELSE
                -- Insert new muster row if not yet existing
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
                    CASE 
                        WHEN v_is_weekly_off THEN 'WEEKLY_OFF'
                        WHEN v_is_holiday THEN 'HOLIDAY'
                        ELSE v_target_status
                    END,
                    NEW.id,
                    0,
                    'Approved Leave',
                    FALSE
                );
            END IF;

            v_curr_date := v_curr_date + INTERVAL '1 day';
        END LOOP;

    -- Scenario B: Previously approved leave is CANCELLED or REJECTED
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' AND NEW.status IN ('CANCELLED', 'REJECTED') THEN
        -- Resolve client weekly offs and employee location
        SELECT work_location_id INTO v_emp_loc_id
        FROM public.employees
        WHERE id = NEW.employee_id;

        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = NEW.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

        -- For records linked to this leave request:
        -- 1. For records with actual punches or regularisations: DO NOT DELETE, simply unlink
        UPDATE public.daily_attendance_records
        SET leave_request_id = NULL,
            updated_at = NOW()
        WHERE leave_request_id = NEW.id
          AND (check_in_time IS NOT NULL OR total_hours > 0 OR is_regularised = TRUE);

        -- 2. For purely synthetic leave rows: revert calendar days to WEEKLY_OFF or HOLIDAY, or set to ABSENT
        FOR v_existing IN 
            SELECT * FROM public.daily_attendance_records
            WHERE leave_request_id = NEW.id
              AND check_in_time IS NULL
              AND total_hours = 0
              AND is_regularised = FALSE
        LOOP
            v_day_name := UPPER(TRIM(TO_CHAR(v_existing.date, 'FMDAY')));
            v_is_weekly_off := (v_day_name = ANY(v_weekly_offs));

            SELECT EXISTS (
                SELECT 1 FROM public.statutory_holidays sh
                WHERE sh.date = v_existing.date
                  AND (sh.client_id = NEW.client_id OR sh.client_id IS NULL)
                  AND (sh.work_location_id = v_emp_loc_id OR sh.work_location_id IS NULL)
            ) INTO v_is_holiday;

            IF v_is_weekly_off THEN
                UPDATE public.daily_attendance_records
                SET status = 'WEEKLY_OFF',
                    leave_request_id = NULL,
                    updated_at = NOW()
                WHERE id = v_existing.id;
            ELSIF v_is_holiday THEN
                UPDATE public.daily_attendance_records
                SET status = 'HOLIDAY',
                    leave_request_id = NULL,
                    updated_at = NOW()
                WHERE id = v_existing.id;
            ELSE
                UPDATE public.daily_attendance_records
                SET status = 'ABSENT',
                    leave_request_id = NULL,
                    updated_at = NOW()
                WHERE id = v_existing.id;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 4. INSTALL TRIGGER ON LEAVE_REQUESTS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_approved_leave_to_muster ON public.leave_requests;

CREATE TRIGGER trg_sync_approved_leave_to_muster
AFTER INSERT OR UPDATE OF status, start_date, end_date ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_approved_leave_to_muster();

COMMENT ON FUNCTION public.sync_approved_leave_to_muster() IS 
'Maintains attendance muster integrity by automatically mirroring approved paid and unpaid leave while strictly preserving punches, regularisations, and calendar rest days.';
