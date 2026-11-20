-- ==============================================================================
-- MIGRATION 05: Attendance Telemetry, Aggregate Muster & Regularisations
-- File: supabase/migrations/20261103000005_attendance_and_regularisations.sql
-- ==============================================================================

-- 10. attendance_events (Append-only immutable raw punch telemetry)
CREATE TABLE IF NOT EXISTS attendance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('CHECK_IN', 'CHECK_OUT')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_meters NUMERIC(6,2),
    geofence_status VARCHAR(30) NOT NULL CHECK (geofence_status IN ('WITHIN_GEOFENCE', 'OUT_OF_BOUNDS')),
    ip_address VARCHAR(45) NOT NULL,
    device_info TEXT NOT NULL,
    selfie_url TEXT,
    is_suspicious BOOLEAN NOT NULL DEFAULT FALSE
);

-- 11. daily_attendance_records (Aggregated daily presence ledger)
CREATE TABLE IF NOT EXISTS daily_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time VARCHAR(20),
    check_out_time VARCHAR(20),
    total_hours NUMERIC(4,2) DEFAULT 0 CHECK (total_hours >= 0),
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY')
    ),
    location_name VARCHAR(255),
    is_regularised BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_emp_attendance_date UNIQUE (employee_id, date)
);

-- 12. attendance_corrections (Regularisation requests & managerial approval trail)
-- Preserves original attendance timestamps alongside requested changes
CREATE TABLE IF NOT EXISTS attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    original_check_in VARCHAR(20),
    original_check_out VARCHAR(20),
    requested_check_in VARCHAR(20) NOT NULL,
    requested_check_out VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    manager_remarks TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES user_profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_events_emp_time ON attendance_events(employee_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_events_client ON attendance_events(client_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON daily_attendance_records(client_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_emp ON daily_attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_corrections_client_status ON attendance_corrections(client_id, status);

-- Explicit Data API Grants (Post-October 30 Supabase Requirement)
GRANT SELECT, INSERT ON public.attendance_events TO anon, authenticated;
GRANT ALL ON public.attendance_events TO service_role;

GRANT SELECT ON public.daily_attendance_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_attendance_records TO authenticated;
GRANT ALL ON public.daily_attendance_records TO service_role;

GRANT SELECT ON public.attendance_corrections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_corrections TO authenticated;
GRANT ALL ON public.attendance_corrections TO service_role;
