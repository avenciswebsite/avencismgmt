-- ==============================================================================
-- MIGRATION 02: Work Locations, Departments & Client Operational Policies
-- File: supabase/migrations/20261103000002_locations_departments_and_policies.sql
-- ==============================================================================

-- 3. work_locations (Authorized work sites, branches, yards, with GPS geofence)
CREATE TABLE IF NOT EXISTS work_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    address TEXT NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Maharashtra',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INT NOT NULL DEFAULT 150 CHECK (radius_meters BETWEEN 20 AND 5000),
    active_headcount INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. departments (Client organizational divisions)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    head_employee_id UUID, -- Foreign key added after employees table
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_client_dept_code UNIQUE (client_id, code)
);

-- 5. client_policies (20 client-level operational, attendance, leave, and payroll rules)
CREATE TABLE IF NOT EXISTS client_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
    is_configured BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Overtime Policy Domain
    overtime_method VARCHAR(30) NOT NULL DEFAULT 'disabled' CHECK (overtime_method IN ('disabled', 'multiplier', 'flat_rate', 'comp_off')),
    overtime_rate NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    
    -- Late Arrival Policy Domain
    late_grace_minutes INT NOT NULL DEFAULT 0,
    late_penalty_rule VARCHAR(40) NOT NULL DEFAULT 'none' CHECK (late_penalty_rule IN ('none', 'deduct_half_day_per_3', 'deduct_cl')),
    
    -- Overnight Shift Domain
    overnight_shift_attribution VARCHAR(30) NOT NULL DEFAULT 'shift_start_date' CHECK (overnight_shift_attribution IN ('shift_start_date', 'shift_end_date')),
    
    -- Working Hours & Calendar Domain
    standard_working_hours NUMERIC(4,2) NOT NULL DEFAULT 9.0,
    half_day_hours NUMERIC(4,2) NOT NULL DEFAULT 4.5,
    weekly_off_days TEXT[] NOT NULL DEFAULT ARRAY['SUNDAY'],
    
    -- Telemetry & Geofencing Domain
    attendance_tracking_mode VARCHAR(30) NOT NULL DEFAULT 'double_punch' CHECK (attendance_tracking_mode IN ('double_punch', 'single_punch')),
    require_gps BOOLEAN NOT NULL DEFAULT TRUE,
    require_selfie BOOLEAN NOT NULL DEFAULT FALSE,
    enforce_strict_geofence BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Leave Management Domain
    leave_types_supported TEXT[] NOT NULL DEFAULT ARRAY['PL', 'CL', 'SL', 'LWP'],
    min_service_days_for_leave INT NOT NULL DEFAULT 30,
    monthly_paid_leave_accrual NUMERIC(4,2) NOT NULL DEFAULT 2.0,
    max_carry_forward INT NOT NULL DEFAULT 30,
    allow_leave_encashment BOOLEAN NOT NULL DEFAULT FALSE,
    unpaid_leave_deduction_formula VARCHAR(40) NOT NULL DEFAULT 'per_day_proration',
    
    -- Payroll & Statutory Domain
    salary_divisor VARCHAR(20) NOT NULL DEFAULT '30' CHECK (salary_divisor IN ('26', '30', 'calendar_days')),
    pf_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    pf_employee_percent NUMERIC(4,2) NOT NULL DEFAULT 12.0,
    pf_employer_percent NUMERIC(4,2) NOT NULL DEFAULT 12.0,
    esic_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    esic_employee_percent NUMERIC(4,2) NOT NULL DEFAULT 0.75,
    esic_employer_percent NUMERIC(4,2) NOT NULL DEFAULT 3.25,
    pt_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    tds_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(150) NOT NULL DEFAULT 'System Initialiser'
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_work_locations_client ON work_locations(client_id);
CREATE INDEX IF NOT EXISTS idx_departments_client ON departments(client_id);
CREATE INDEX IF NOT EXISTS idx_policies_client ON client_policies(client_id);

-- Explicit Data API Grants (Post-October 30 Supabase Requirement)
GRANT SELECT ON public.work_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_locations TO authenticated;
GRANT ALL ON public.work_locations TO service_role;

GRANT SELECT ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;

GRANT SELECT ON public.client_policies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_policies TO authenticated;
GRANT ALL ON public.client_policies TO service_role;
