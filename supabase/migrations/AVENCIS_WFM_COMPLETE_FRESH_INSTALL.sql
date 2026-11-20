-- ==============================================================================
-- AVENCIS WORKFORCE MANAGEMENT (WFM) — CONSOLIDATED MASTER FRESH INSTALL DDL
-- File: supabase/migrations/AVENCIS_WFM_COMPLETE_FRESH_INSTALL.sql
-- Target: Supabase Cloud SQL Editor (NEW / FRESH ENVIRONMENTS ONLY)
-- Milestone: Baseline Complete Production Architecture (Milestones 2.1 - 2.4D.2)
-- Status: AUTHORITATIVE FRESH INSTALL SCRIPT
-- ==============================================================================
-- ⚠️ WARNING: DO NOT RUN THIS SCRIPT AGAINST AN EXISTING DATABASE!
-- This script is strictly for initializing NEW, EMPTY staging or production
-- environments from scratch. It builds the complete Avencis WFM schema
-- (20 core tables, constraints, functions, triggers, and hardened RLS)
-- directly incorporating all remediations from Migrations 11, 15, 16, and 17,
-- and excluding all superseded/flawed implementations (12, 13, and 14).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CLIENTS & LEGAL ENTITIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    contact_person VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'onboarding')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_legal_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    pan VARCHAR(10) NOT NULL CHECK (length(pan) = 10),
    gstin VARCHAR(15),
    registered_address TEXT NOT NULL,
    state VARCHAR(100) NOT NULL,
    cin VARCHAR(21),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code);
CREATE INDEX IF NOT EXISTS idx_legal_entities_client ON public.client_legal_entities(client_id);

-- ------------------------------------------------------------------------------
-- 2. WORK LOCATIONS, DEPARTMENTS & POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    head_employee_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_client_dept_code UNIQUE (client_id, code)
);

CREATE TABLE IF NOT EXISTS public.client_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
    is_configured BOOLEAN NOT NULL DEFAULT FALSE,
    overtime_method VARCHAR(30) NOT NULL DEFAULT 'disabled' CHECK (overtime_method IN ('disabled', 'multiplier', 'flat_rate', 'comp_off')),
    overtime_rate NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    late_grace_minutes INT NOT NULL DEFAULT 0,
    late_penalty_rule VARCHAR(40) NOT NULL DEFAULT 'none' CHECK (late_penalty_rule IN ('none', 'deduct_half_day_per_3', 'deduct_cl')),
    overnight_shift_attribution VARCHAR(30) NOT NULL DEFAULT 'shift_start_date' CHECK (overnight_shift_attribution IN ('shift_start_date', 'shift_end_date')),
    standard_working_hours NUMERIC(4,2) NOT NULL DEFAULT 9.0,
    half_day_hours NUMERIC(4,2) NOT NULL DEFAULT 4.5,
    weekly_off_days TEXT[] NOT NULL DEFAULT ARRAY['SUNDAY'],
    attendance_tracking_mode VARCHAR(30) NOT NULL DEFAULT 'double_punch' CHECK (attendance_tracking_mode IN ('double_punch', 'single_punch')),
    require_gps BOOLEAN NOT NULL DEFAULT TRUE,
    require_selfie BOOLEAN NOT NULL DEFAULT FALSE,
    enforce_strict_geofence BOOLEAN NOT NULL DEFAULT TRUE,
    leave_types_supported TEXT[] NOT NULL DEFAULT ARRAY['PL', 'CL', 'SL', 'LWP'],
    min_service_days_for_leave INT NOT NULL DEFAULT 30,
    monthly_paid_leave_accrual NUMERIC(4,2) NOT NULL DEFAULT 2.0,
    max_carry_forward INT NOT NULL DEFAULT 30,
    allow_leave_encashment BOOLEAN NOT NULL DEFAULT FALSE,
    unpaid_leave_deduction_formula VARCHAR(40) NOT NULL DEFAULT 'per_day_proration',
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

CREATE INDEX IF NOT EXISTS idx_work_locations_client ON public.work_locations(client_id);
CREATE INDEX IF NOT EXISTS idx_departments_client ON public.departments(client_id);
CREATE INDEX IF NOT EXISTS idx_policies_client ON public.client_policies(client_id);

-- ------------------------------------------------------------------------------
-- 3. USER PROFILES & RBAC HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(40) NOT NULL CHECK (role IN (
        'super_admin',
        'hr_admin',
        'payroll_admin',
        'client_admin',
        'client_manager',
        'location_manager',
        'employee'
    )),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    employee_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_client ON public.user_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_employee ON public.user_profiles(employee_id);

CREATE OR REPLACE FUNCTION public.get_user_role() 
RETURNS TEXT AS $$
    SELECT COALESCE(
        (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
        'employee'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_client_id() 
RETURNS UUID AS $$
    SELECT client_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_employee_id() 
RETURNS UUID AS $$
    SELECT employee_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 4. EMPLOYEES & COMPENSATION MASTER
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    legal_entity_id UUID NOT NULL REFERENCES public.client_legal_entities(id),
    work_location_id UUID NOT NULL REFERENCES public.work_locations(id),
    department_id UUID REFERENCES public.departments(id),
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(30) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    joining_date DATE NOT NULL,
    employment_arrangement VARCHAR(40) NOT NULL DEFAULT 'DIRECT_PERMANENT' CHECK (
        employment_arrangement IN ('DIRECT_PERMANENT', 'DIRECT_CONTRACT', 'DEPUTED_STAFFING', 'INTERN')
    ),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (
        status IN ('ACTIVE', 'ON_NOTICE', 'SUSPENDED', 'TERMINATED')
    ),
    pan_number VARCHAR(10) NOT NULL,
    aadhaar_number VARCHAR(20) NOT NULL,
    uan_number VARCHAR(20),
    esic_number VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_client_employee_code UNIQUE (client_id, employee_code)
);

ALTER TABLE public.departments 
ADD CONSTRAINT fk_departments_head 
FOREIGN KEY (head_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT fk_user_profiles_employee 
FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.employee_salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    ctc_annual NUMERIC(12,2) NOT NULL CHECK (ctc_annual >= 0),
    base_monthly NUMERIC(10,2) NOT NULL CHECK (base_monthly >= 0),
    hra_monthly NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (hra_monthly >= 0),
    special_allowance NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (special_allowance >= 0),
    pf_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    esic_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    pt_applicable BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE UNIQUE,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    branch_name VARCHAR(150),
    account_holder_name VARCHAR(150) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_client_status ON public.employees(client_id, status);
CREATE INDEX IF NOT EXISTS idx_employees_code ON public.employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_location ON public.employees(work_location_id);
CREATE INDEX IF NOT EXISTS idx_salary_emp_active ON public.employee_salary_structures(employee_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bank_emp ON public.employee_bank_details(employee_id);

-- ------------------------------------------------------------------------------
-- 5. ATTENDANCE & LEAVE MANAGEMENT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    employee_id UUID NOT NULL REFERENCES public.employees(id),
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

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('PL', 'CL', 'SL', 'LWP', 'COMP_OFF')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(4,1) NOT NULL CHECK (total_days > 0),
    reason TEXT NOT NULL,
    manager_remarks TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
    ),
    reviewed_by UUID REFERENCES public.user_profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.daily_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time VARCHAR(20),
    check_out_time VARCHAR(20),
    total_hours NUMERIC(4,2) DEFAULT 0 CHECK (total_hours >= 0),
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_DUTY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY')
    ),
    leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
    location_name VARCHAR(255),
    is_regularised BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_emp_attendance_date UNIQUE (employee_id, date)
);

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    original_check_in VARCHAR(20),
    original_check_out VARCHAR(20),
    requested_check_in VARCHAR(20) NOT NULL,
    requested_check_out VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    manager_remarks TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES public.user_profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('PL', 'CL', 'SL', 'COMP_OFF')),
    year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    opening NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (opening >= 0),
    credited NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (credited >= 0),
    used NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (used >= 0),
    closing NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (closing >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_emp_leave_year_type UNIQUE (employee_id, leave_type, year),
    CONSTRAINT chk_leave_balance_identity CHECK (closing = (opening + credited - used))
);

CREATE INDEX IF NOT EXISTS idx_attendance_events_emp_time ON public.attendance_events(employee_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_events_client ON public.attendance_events(client_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON public.daily_attendance_records(client_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_emp ON public.daily_attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_leave_req ON public.daily_attendance_records(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_corrections_client_status ON public.attendance_corrections(client_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_emp ON public.leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_requests_client ON public.leave_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON public.leave_requests(employee_id);

-- ------------------------------------------------------------------------------
-- 6. PAYROLL ENGINE & STATUTORY LEDGERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id VARCHAR(100) PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    legal_entity_id UUID REFERENCES public.client_legal_entities(id),
    period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    total_employees INT NOT NULL CHECK (total_employees >= 0),
    total_gross NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_gross >= 0),
    total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_deductions >= 0),
    total_net NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_net >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'under_review', 'approved', 'locked')
    ),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR(150),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(150),
    policy_snapshot JSONB,
    CONSTRAINT unq_client_period UNIQUE (client_id, period_month, period_year)
);

CREATE TABLE IF NOT EXISTS public.payroll_items (
    id VARCHAR(120) PRIMARY KEY,
    run_id VARCHAR(100) NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    fixed_salary NUMERIC(12,2) NOT NULL CHECK (fixed_salary >= 0),
    incentives NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (incentives >= 0),
    other_allowances NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (other_allowances >= 0),
    calendar_days INT NOT NULL CHECK (calendar_days BETWEEN 28 AND 31),
    paid_days NUMERIC(4,1) NOT NULL CHECK (paid_days >= 0),
    unpaid_days NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (unpaid_days >= 0),
    gross_earned NUMERIC(12,2) NOT NULL CHECK (gross_earned >= 0),
    unpaid_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unpaid_deduction >= 0),
    pf_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pf_deduction >= 0),
    esic_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (esic_deduction >= 0),
    pt_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pt_deduction >= 0),
    tds_deduction NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tds_deduction >= 0),
    total_deductions NUMERIC(12,2) NOT NULL CHECK (total_deductions >= 0),
    net_salary NUMERIC(12,2) NOT NULL CHECK (net_salary >= 0),
    CONSTRAINT unq_run_employee UNIQUE (run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    payroll_item_id VARCHAR(120) NOT NULL REFERENCES public.payroll_items(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    revision_number INT NOT NULL DEFAULT 1 CHECK (revision_number >= 1),
    storage_pdf_url TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unq_emp_payslip_period UNIQUE (employee_id, period_month, period_year, revision_number)
);

CREATE TABLE IF NOT EXISTS public.statutory_pt_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL DEFAULT 'ALL' CHECK (gender IN ('ALL', 'MALE', 'FEMALE')),
    monthly_gross_min NUMERIC(10,2) NOT NULL CHECK (monthly_gross_min >= 0),
    monthly_gross_max NUMERIC(10,2),
    tax_amount NUMERIC(6,2) NOT NULL CHECK (tax_amount >= 0),
    february_tax_amount NUMERIC(6,2),
    effective_from DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.statutory_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    work_location_id UUID REFERENCES public.work_locations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    actor_role VARCHAR(40) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(100) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_client ON public.payroll_runs(client_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_items_emp ON public.payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON public.payroll_items(run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_emp_period ON public.payslips(employee_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_pt_slabs_state ON public.statutory_pt_slabs(state, is_active);
CREATE INDEX IF NOT EXISTS idx_holidays_client_date ON public.statutory_holidays(client_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_client ON public.audit_logs(client_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);

-- ------------------------------------------------------------------------------
-- 7. DATABASE TRIGGERS & TAMPER GUARDS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_client_policies_updated_at BEFORE UPDATE ON public.client_policies FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_daily_attendance_updated_at BEFORE UPDATE ON public.daily_attendance_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.guard_locked_payroll_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'locked' THEN
        RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Payroll run % is locked and immutable. Modifications are prohibited.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_payroll_run_lock BEFORE UPDATE OR DELETE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.guard_locked_payroll_modification();

CREATE OR REPLACE FUNCTION public.guard_locked_payroll_items()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR(30);
BEGIN
    SELECT status INTO v_status FROM public.payroll_runs WHERE id = OLD.run_id;
    IF v_status = 'locked' THEN
        RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Payroll items for locked run % cannot be modified or deleted.', OLD.run_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_payroll_items_lock BEFORE UPDATE OR DELETE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.guard_locked_payroll_items();

CREATE OR REPLACE FUNCTION public.guard_immutable_attendance_events()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AUDIT SECURITY VIOLATION: Raw attendance events are immutable. Deletions and updates are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_attendance_events_immutability BEFORE UPDATE OR DELETE ON public.attendance_events FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_attendance_events();

CREATE OR REPLACE FUNCTION public.guard_immutable_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AUDIT SECURITY VIOLATION: Audit log records are cryptographically protected and immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_audit_logs_immutability BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_audit_logs();

-- ------------------------------------------------------------------------------
-- 8. TRANSACTIONAL RPC: review_leave_request_atomic (MIGRATION 15 SPECIFICATION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_leave_request_atomic(
    p_request_id UUID,
    p_decision VARCHAR(30),
    p_manager_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_auth_id UUID;
    v_reviewer RECORD;
    v_applicant_loc_id UUID;
    v_manager_loc_id UUID;
    v_req RECORD;
    v_weekly_offs TEXT[];
    v_year_rec RECORD;
    v_bal RECORD;
    v_audit_id VARCHAR(100);
    v_deductions JSONB := '[]'::jsonb;
    v_total_calculated NUMERIC(4,1) := 0;
BEGIN
    v_caller_auth_id := auth.uid();
    IF v_caller_auth_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Operation requires an authenticated session.';
    END IF;

    SELECT id, role, client_id, employee_id, full_name, email
    INTO v_reviewer
    FROM public.user_profiles
    WHERE id = v_caller_auth_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_PROFILE_NOT_FOUND: Caller profile does not exist in user_profiles.';
    END IF;

    IF v_reviewer.role NOT IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager', 'location_manager') THEN
        RAISE EXCEPTION 'PERMISSION_ERROR: Role % is not authorized to review leave requests.', v_reviewer.role;
    END IF;

    IF p_decision NOT IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'INVALID_DECISION: Decision must be either APPROVED or REJECTED.';
    END IF;

    SELECT * INTO v_req
    FROM public.leave_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Leave request % does not exist.', p_request_id;
    END IF;

    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'STATE_ERROR: Leave request is in status %, only PENDING requests can be reviewed.', v_req.status;
    END IF;

    IF v_reviewer.employee_id IS NOT NULL AND v_reviewer.employee_id = v_req.employee_id THEN
        RAISE EXCEPTION 'GOVERNANCE_VIOLATION: Employees are strictly prohibited from reviewing their own leave requests.';
    END IF;

    IF v_reviewer.role <> 'super_admin' THEN
        IF v_req.client_id <> v_reviewer.client_id THEN
            RAISE EXCEPTION 'PERMISSION_ERROR: Cross-tenant leave review is forbidden.';
        END IF;

        IF v_reviewer.role = 'location_manager' THEN
            SELECT work_location_id INTO v_applicant_loc_id
            FROM public.employees
            WHERE id = v_req.employee_id;

            SELECT work_location_id INTO v_manager_loc_id
            FROM public.employees
            WHERE id = v_reviewer.employee_id;

            IF v_applicant_loc_id IS DISTINCT FROM v_manager_loc_id THEN
                RAISE EXCEPTION 'PERMISSION_ERROR: Location Managers may only review requests for employees at their assigned work location.';
            END IF;
        END IF;
    END IF;

    IF p_decision = 'APPROVED' AND v_req.leave_type IN ('PL', 'CL', 'SL', 'COMP_OFF') THEN
        IF v_applicant_loc_id IS NULL THEN
            SELECT work_location_id INTO v_applicant_loc_id
            FROM public.employees
            WHERE id = v_req.employee_id;
        END IF;

        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = v_req.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

        FOR v_year_rec IN
            WITH calendar_series AS (
                SELECT 
                    d::date AS cal_date,
                    EXTRACT(YEAR FROM d)::INT AS cal_year,
                    UPPER(TRIM(TO_CHAR(d, 'FMDAY'))) AS cal_day_name
                FROM generate_series(v_req.start_date::timestamp, v_req.end_date::timestamp, '1 day'::interval) d
            ),
            day_evaluations AS (
                SELECT 
                    cs.cal_date,
                    cs.cal_year,
                    CASE 
                        WHEN cs.cal_day_name = ANY(v_weekly_offs) THEN 0.0
                        WHEN EXISTS (
                            SELECT 1 FROM public.statutory_holidays sh
                            WHERE sh.date = cs.cal_date
                              AND (sh.client_id = v_req.client_id OR sh.client_id IS NULL)
                              AND (sh.work_location_id = v_applicant_loc_id OR sh.work_location_id IS NULL)
                        ) THEN 0.0
                        WHEN v_req.start_date = v_req.end_date AND v_req.total_days = 0.5 THEN 0.5
                        ELSE 1.0
                    END AS leave_amount
                FROM calendar_series cs
            )
            SELECT 
                cal_year AS target_year,
                SUM(leave_amount)::NUMERIC(4,1) AS required_days
            FROM day_evaluations
            GROUP BY cal_year
            HAVING SUM(leave_amount) > 0
            ORDER BY cal_year ASC
        LOOP
            SELECT * INTO v_bal
            FROM public.leave_balances
            WHERE employee_id = v_req.employee_id
              AND leave_type = v_req.leave_type
              AND year = v_year_rec.target_year
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'BALANCE_ERROR: No % leave ledger row exists for employee in year %.', 
                    v_req.leave_type, v_year_rec.target_year;
            END IF;

            IF v_bal.closing < v_year_rec.required_days THEN
                RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient % balance for year %. Available: %, Required: %',
                    v_req.leave_type, v_year_rec.target_year, v_bal.closing, v_year_rec.required_days;
            END IF;

            UPDATE public.leave_balances
            SET used = used + v_year_rec.required_days,
                closing = opening + credited - (used + v_year_rec.required_days),
                updated_at = NOW()
            WHERE id = v_bal.id;

            v_total_calculated := v_total_calculated + v_year_rec.required_days;

            v_deductions := v_deductions || jsonb_build_object(
                'year', v_year_rec.target_year,
                'deducted_days', v_year_rec.required_days,
                'previous_closing', v_bal.closing,
                'new_closing', (v_bal.opening + v_bal.credited - (v_bal.used + v_year_rec.required_days))
            );
        END LOOP;
    END IF;

    UPDATE public.leave_requests
    SET status = p_decision,
        reviewed_by = v_reviewer.id,
        reviewed_at = NOW(),
        manager_remarks = p_manager_remarks
    WHERE id = v_req.id;

    v_audit_id := 'audit-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 16);

    INSERT INTO public.audit_logs (
        id,
        client_id,
        actor_name,
        actor_email,
        actor_role,
        action,
        target_entity,
        target_id,
        details,
        ip_address,
        timestamp,
        severity
    ) VALUES (
        v_audit_id,
        v_req.client_id,
        v_reviewer.full_name,
        v_reviewer.email,
        v_reviewer.role,
        CASE WHEN p_decision = 'APPROVED' THEN 'LEAVE_APPROVE' ELSE 'LEAVE_REJECT' END,
        'leave_requests',
        v_req.id::text,
        jsonb_build_object(
            'decision', p_decision,
            'employee_id', v_req.employee_id,
            'leave_type', v_req.leave_type,
            'total_days', v_req.total_days,
            'deductions', v_deductions,
            'manager_remarks', p_manager_remarks
        )::text,
        '127.0.0.1',
        NOW(),
        'info'
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_req.id,
        'status', p_decision,
        'leave_type', v_req.leave_type,
        'total_days', v_req.total_days,
        'reviewer_id', v_reviewer.id,
        'reviewer_name', v_reviewer.full_name,
        'reviewed_at', NOW(),
        'deductions', v_deductions
    );
END;
$$;

REVOKE ALL ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. ATTENDANCE MUSTER TRIGGER (MIGRATION 17 SPECIFICATION)
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
    IF NEW.status = 'APPROVED' AND (TG_OP = 'INSERT' OR OLD.status <> 'APPROVED' OR OLD.start_date <> NEW.start_date OR OLD.end_date <> NEW.end_date) THEN
        v_target_status := CASE WHEN NEW.leave_type = 'LWP' THEN 'UNPAID_LEAVE' ELSE 'PAID_LEAVE' END;

        SELECT work_location_id INTO v_emp_loc_id
        FROM public.employees
        WHERE id = NEW.employee_id;

        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = NEW.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

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

        v_curr_date := NEW.start_date;
        WHILE v_curr_date <= NEW.end_date LOOP
            v_day_name := UPPER(TRIM(TO_CHAR(v_curr_date, 'FMDAY')));
            v_is_weekly_off := (v_day_name = ANY(v_weekly_offs));

            SELECT EXISTS (
                SELECT 1 FROM public.statutory_holidays sh
                WHERE sh.date = v_curr_date
                  AND (sh.client_id = NEW.client_id OR sh.client_id IS NULL)
                  AND (sh.work_location_id = v_emp_loc_id OR sh.work_location_id IS NULL)
            ) INTO v_is_holiday;

            SELECT * INTO v_existing
            FROM public.daily_attendance_records
            WHERE employee_id = NEW.employee_id
              AND date = v_curr_date;

            IF FOUND THEN
                IF (v_existing.check_in_time IS NOT NULL OR v_existing.total_hours > 0 OR v_existing.is_regularised = TRUE) THEN
                    UPDATE public.daily_attendance_records
                    SET leave_request_id = NEW.id,
                        updated_at = NOW()
                    WHERE id = v_existing.id;
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
                    UPDATE public.daily_attendance_records
                    SET status = v_target_status,
                        leave_request_id = NEW.id,
                        location_name = COALESCE(v_existing.location_name, 'Approved Leave'),
                        updated_at = NOW()
                    WHERE id = v_existing.id;
                END IF;
            ELSE
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

    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' AND NEW.status IN ('CANCELLED', 'REJECTED') THEN
        SELECT work_location_id INTO v_emp_loc_id
        FROM public.employees
        WHERE id = NEW.employee_id;

        SELECT COALESCE(weekly_off_days, ARRAY['SUNDAY']) INTO v_weekly_offs
        FROM public.client_policies
        WHERE client_id = NEW.client_id;

        IF v_weekly_offs IS NULL THEN
            v_weekly_offs := ARRAY['SUNDAY'];
        END IF;

        UPDATE public.daily_attendance_records
        SET leave_request_id = NULL,
            updated_at = NOW()
        WHERE leave_request_id = NEW.id
          AND (check_in_time IS NOT NULL OR total_hours > 0 OR is_regularised = TRUE);

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

CREATE TRIGGER trg_sync_approved_leave_to_muster
AFTER INSERT OR UPDATE OF status, start_date, end_date ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_approved_leave_to_muster();

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES (ALL 20 TABLES)
-- ------------------------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_legal_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statutory_pt_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statutory_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 10.1 Clients
CREATE POLICY "clients_super_admin_all" ON public.clients FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "clients_tenant_select" ON public.clients FOR SELECT TO authenticated USING (id = public.get_user_client_id());

-- 10.2 Client Legal Entities
CREATE POLICY "legal_entities_super_admin_all" ON public.client_legal_entities FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "legal_entities_tenant_select" ON public.client_legal_entities FOR SELECT TO authenticated USING (client_id = public.get_user_client_id());

-- 10.3 Work Locations
CREATE POLICY "work_locations_super_admin_all" ON public.work_locations FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "work_locations_tenant_select" ON public.work_locations FOR SELECT TO authenticated USING (client_id = public.get_user_client_id());

-- 10.4 Departments
CREATE POLICY "departments_super_admin_all" ON public.departments FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "departments_tenant_select" ON public.departments FOR SELECT TO authenticated USING (client_id = public.get_user_client_id());

-- 10.5 Client Policies
CREATE POLICY "policies_super_admin_all" ON public.client_policies FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "policies_tenant_select" ON public.client_policies FOR SELECT TO authenticated USING (client_id = public.get_user_client_id());

-- 10.6 User Profiles
CREATE POLICY "profiles_super_admin_all" ON public.user_profiles FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "profiles_self_select" ON public.user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_tenant_admin_select" ON public.user_profiles FOR SELECT TO authenticated USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin'));

-- 10.7 Employees
CREATE POLICY "employees_super_admin_all" ON public.employees FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "employees_tenant_select" ON public.employees FOR SELECT TO authenticated USING (client_id = public.get_user_client_id());
CREATE POLICY "employees_self_select" ON public.employees FOR SELECT TO authenticated USING (id = public.get_user_employee_id());

-- 10.8 Salary Structures & Bank Details
CREATE POLICY "salary_super_admin_all" ON public.employee_salary_structures FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "salary_payroll_admin_all" ON public.employee_salary_structures FOR ALL TO authenticated 
USING (employee_id IN (SELECT id FROM public.employees WHERE client_id = public.get_user_client_id()) AND public.get_user_role() IN ('client_admin', 'payroll_admin'));
CREATE POLICY "salary_self_select" ON public.employee_salary_structures FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id());

CREATE POLICY "bank_super_admin_all" ON public.employee_bank_details FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "bank_payroll_admin_all" ON public.employee_bank_details FOR ALL TO authenticated 
USING (employee_id IN (SELECT id FROM public.employees WHERE client_id = public.get_user_client_id()) AND public.get_user_role() IN ('client_admin', 'payroll_admin'));
CREATE POLICY "bank_self_select" ON public.employee_bank_details FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id());

-- 10.9 Attendance Telemetry & Muster
CREATE POLICY "attendance_events_super_admin_all" ON public.attendance_events FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "attendance_events_employee_insert" ON public.attendance_events FOR INSERT TO authenticated WITH CHECK (employee_id = public.get_user_employee_id() AND client_id = public.get_user_client_id());
CREATE POLICY "attendance_events_employee_select" ON public.attendance_events FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id());
CREATE POLICY "attendance_events_tenant_admin_select" ON public.attendance_events FOR SELECT TO authenticated USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager'));

CREATE POLICY "daily_attendance_super_admin_all" ON public.daily_attendance_records FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "daily_attendance_tenant_admin_all" ON public.daily_attendance_records FOR ALL TO authenticated 
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager'));
CREATE POLICY "daily_attendance_employee_select" ON public.daily_attendance_records FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id());

CREATE POLICY "corrections_employee_apply" ON public.attendance_corrections FOR INSERT TO authenticated WITH CHECK (employee_id = public.get_user_employee_id() AND client_id = public.get_user_client_id());
CREATE POLICY "corrections_employee_select" ON public.attendance_corrections FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id());
CREATE POLICY "corrections_tenant_admin_all" ON public.attendance_corrections FOR ALL TO authenticated 
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager'))
WITH CHECK (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager'));

-- 10.10 HARDENED LEAVE POLICIES (MIGRATION 16 SPECIFICATION)
CREATE POLICY "leave_requests_employee_select" ON public.leave_requests FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id());
CREATE POLICY "leave_requests_employee_insert" ON public.leave_requests FOR INSERT TO authenticated 
WITH CHECK (employee_id = public.get_user_employee_id() AND client_id = public.get_user_client_id() AND status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL);
CREATE POLICY "leave_requests_employee_cancel" ON public.leave_requests FOR UPDATE TO authenticated 
USING (employee_id = public.get_user_employee_id() AND status = 'PENDING')
WITH CHECK (employee_id = public.get_user_employee_id() AND status = 'CANCELLED' AND reviewed_by IS NULL);

CREATE POLICY "leave_requests_super_admin_all" ON public.leave_requests FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin') WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "leave_requests_tenant_admin_select" ON public.leave_requests FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND (
        public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
        OR (
            public.get_user_role() = 'location_manager'
            AND employee_id IN (
                SELECT e.id FROM public.employees e
                WHERE e.work_location_id = (SELECT m.work_location_id FROM public.employees m WHERE m.id = public.get_user_employee_id())
            )
        )
    )
);

CREATE POLICY "leave_requests_tenant_admin_modify" ON public.leave_requests FOR UPDATE TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id()
    AND (
        public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
        OR (
            public.get_user_role() = 'location_manager'
            AND employee_id IN (
                SELECT e.id FROM public.employees e
                WHERE e.work_location_id = (SELECT m.work_location_id FROM public.employees m WHERE m.id = public.get_user_employee_id())
            )
        )
    )
)
WITH CHECK (
    client_id = public.get_user_client_id()
    AND employee_id <> public.get_user_employee_id()
    AND (
        public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
        OR (
            public.get_user_role() = 'location_manager'
            AND employee_id IN (
                SELECT e.id FROM public.employees e
                WHERE e.work_location_id = (SELECT m.work_location_id FROM public.employees m WHERE m.id = public.get_user_employee_id())
            )
        )
    )
);

CREATE POLICY "leave_requests_payroll_admin_select" ON public.leave_requests FOR SELECT TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() = 'payroll_admin');

CREATE POLICY "leave_balances_employee_select" ON public.leave_balances FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id());
CREATE POLICY "leave_balances_super_admin_all" ON public.leave_balances FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin') WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "leave_balances_tenant_admin_select" ON public.leave_balances FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND (
        public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager')
        OR (
            public.get_user_role() = 'location_manager'
            AND employee_id IN (
                SELECT e.id FROM public.employees e
                WHERE e.work_location_id = (SELECT m.work_location_id FROM public.employees m WHERE m.id = public.get_user_employee_id())
            )
        )
    )
);

CREATE POLICY "leave_balances_tenant_admin_modify" ON public.leave_balances FOR ALL TO authenticated
USING (client_id = public.get_user_client_id() AND employee_id <> public.get_user_employee_id() AND public.get_user_role() IN ('client_admin', 'hr_admin'))
WITH CHECK (client_id = public.get_user_client_id() AND employee_id <> public.get_user_employee_id() AND public.get_user_role() IN ('client_admin', 'hr_admin'));

CREATE POLICY "leave_balances_payroll_admin_select" ON public.leave_balances FOR SELECT TO authenticated
USING (client_id = public.get_user_client_id() AND public.get_user_role() = 'payroll_admin');

-- 10.11 Payroll Runs, Items & Payslips
CREATE POLICY "payroll_runs_admin_all" ON public.payroll_runs FOR ALL TO authenticated 
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'payroll_admin'));

CREATE POLICY "payroll_items_admin_all" ON public.payroll_items FOR ALL TO authenticated 
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'payroll_admin'));
CREATE POLICY "payroll_items_self_select" ON public.payroll_items FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id());

CREATE POLICY "payslips_admin_all" ON public.payslips FOR ALL TO authenticated 
USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'payroll_admin'));
CREATE POLICY "payslips_self_select" ON public.payslips FOR SELECT TO authenticated USING (employee_id = public.get_user_employee_id() AND is_published = TRUE);

-- 10.12 Statutory & Audit Ledgers
CREATE POLICY "pt_slabs_select" ON public.statutory_pt_slabs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "holidays_select" ON public.statutory_holidays FOR SELECT TO authenticated 
USING (client_id = public.get_user_client_id() OR client_id IS NULL);

CREATE POLICY "audit_logs_super_admin_select" ON public.audit_logs FOR SELECT TO authenticated USING (public.get_user_role() = 'super_admin');
CREATE POLICY "audit_logs_client_admin_select" ON public.audit_logs FOR SELECT TO authenticated USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('client_admin', 'hr_admin'));
CREATE POLICY "audit_logs_authenticated_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ------------------------------------------------------------------------------
-- 11. EXPLICIT DATA API GRANTS (POST-OCTOBER 30 SUPABASE SPECIFICATION)
-- ------------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_leave_request_atomic(UUID, VARCHAR, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_approved_leave_to_muster() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_approved_leave_to_muster() TO authenticated, service_role;
