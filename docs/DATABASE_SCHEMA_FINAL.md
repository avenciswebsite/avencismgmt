# AVENCIS WORKFORCE MANAGEMENT (WFM)
## DATABASE SCHEMA SPECIFICATION (FINAL ARCHITECTURE)

**Project:** Avencis ERP / Business Management Platform  
**Target Backend:** PostgreSQL 15+ / Supabase  
**Tenant Model:** Client-Partitioned Shared Database with Multi-Tenant Row Level Security (RLS)  
**Total Tables:** 20 Relational Tables  
**Status:** **AUTHORITATIVE DESIGN SPECIFICATION**  

> [!NOTE]
> **MANDATORY DATA API GRANTS (POST-OCTOBER 30 SUPABASE SPECIFICATION):**  
> In accordance with Supabase's breaking security update, all tables in the `public` schema include explicit table grants:
> ```sql
> GRANT SELECT ON public.<table_name> TO anon;
> GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table_name> TO authenticated;
> GRANT ALL ON public.<table_name> TO service_role;
> ```
> In addition, Migration 01 applies `ALTER DEFAULT PRIVILEGES` across the `public` schema. Data access control is strictly enforced through PostgreSQL Row Level Security (RLS) policies.

---

## 1. Domain Group 1: Organisation & Client Tenancy

### 1.1. `clients`
Represents the top-level subscribing client organisation.
```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'suspended')),
    contact_person VARCHAR(150) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.2. `client_legal_entities`
Statutory employer entity holding registrations, PAN, TAN, GSTIN, PF/ESIC codes, and designated payroll responsibility.
```sql
CREATE TABLE client_legal_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    registration_type VARCHAR(50) NOT NULL CHECK (registration_type IN ('PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PROPRIETORSHIP')),
    registration_number VARCHAR(100),
    pan VARCHAR(10) NOT NULL,
    tan VARCHAR(10),
    gstin VARCHAR(15),
    pf_establishment_code VARCHAR(50),
    esic_registration_code VARCHAR(50),
    registered_address TEXT NOT NULL,
    payroll_responsibility VARCHAR(40) NOT NULL DEFAULT 'SELF_MANAGED' CHECK (payroll_responsibility IN ('SELF_MANAGED', 'AVENCIS_MANAGED', 'HYBRID')),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_client_pan UNIQUE (client_id, pan)
);
```

### 1.3. `work_locations`
Operating facilities, branches, and depots with circular GPS geofencing.
```sql
CREATE TABLE work_locations (
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
```

### 1.4. `departments`
Organizational functional divisions within a client.
```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    head_employee_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_client_dept_code UNIQUE (client_id, code)
);
```

### 1.5. `client_policies`
Comprehensive policy engine covering 20 operational, attendance, leave, and payroll rule domains.
```sql
CREATE TABLE client_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
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
```

---

## 2. Domain Group 2: Identity, Access & User Profiles

### 2.1. `user_profiles`
Bridge table linking Supabase `auth.users` to tenant roles and staff IDs.
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(40) NOT NULL CHECK (role IN (
        'super_admin', 'hr_admin', 'payroll_admin', 'client_admin',
        'client_manager', 'location_manager', 'employee'
    )),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    employee_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Domain Group 3: Workforce, Compensation & Banking

### 3.1. `employees`
Core staff master record.
```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    legal_entity_id UUID NOT NULL REFERENCES client_legal_entities(id),
    work_location_id UUID NOT NULL REFERENCES work_locations(id),
    department_id UUID REFERENCES departments(id),
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
```

### 3.2. `employee_salary_structures`
Decoupled compensation structure with temporal validity tracking.
```sql
CREATE TABLE employee_salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    fixed_monthly_base NUMERIC(12,2) NOT NULL CHECK (fixed_monthly_base >= 0),
    hra NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
    conveyance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (conveyance >= 0),
    special_allowances NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (special_allowances >= 0),
    variable_incentives NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (variable_incentives >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.3. `employee_bank_details`
Protected financial disbursement account credentials.
```sql
CREATE TABLE employee_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'SALARY' CHECK (account_type IN ('SALARY', 'SAVINGS', 'CURRENT')),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Domain Group 4: Attendance Telemetry & Muster

### 4.1. `attendance_events`
Append-only raw punch telemetry log. Strictly immutable.
```sql
CREATE TABLE attendance_events (
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
```

### 4.2. `daily_attendance_records`
Consolidated daily presence muster.
```sql
CREATE TABLE daily_attendance_records (
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
```

### 4.3. `attendance_corrections`
Missed punch and GPS exception regularisation ledger.
```sql
CREATE TABLE attendance_corrections (
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
```

---

## 5. Domain Group 5: Leave Entitlements & Applications

### 5.1. `leave_balances`
Per-employee annual leave balances by category.
```sql
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('PL', 'CL', 'SL')),
    year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    opening NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (opening >= 0),
    credited NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (credited >= 0),
    used NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (used >= 0),
    closing NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (closing >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_emp_leave_year_type UNIQUE (employee_id, leave_type, year)
);
```

### 5.2. `leave_requests`
Leave application registry with supervisor sign-off trail.
```sql
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('PL', 'CL', 'SL', 'LWP')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(4,1) NOT NULL CHECK (total_days > 0),
    reason TEXT NOT NULL,
    manager_remarks TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
    ),
    reviewed_by UUID REFERENCES user_profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);
```

---

## 6. Domain Group 6: Payroll Batches, Line Items & Payslips

### 6.1. `payroll_runs`
Monthly payroll run header with four-stage lifecycle.
```sql
CREATE TABLE payroll_runs (
    id VARCHAR(100) PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    legal_entity_id UUID REFERENCES client_legal_entities(id),
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
```

### 6.2. `payroll_items`
Itemized employee earnings and statutory deductions lines.
```sql
CREATE TABLE payroll_items (
    id VARCHAR(120) PRIMARY KEY,
    run_id VARCHAR(100) NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
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
```

### 6.3. `payslips`
Statutory Form XIX document tracking register.
```sql
CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    payroll_item_id VARCHAR(120) NOT NULL REFERENCES payroll_items(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    revision_number INT NOT NULL DEFAULT 1 CHECK (revision_number >= 1),
    storage_pdf_url TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unq_emp_payslip_period UNIQUE (employee_id, period_month, period_year, revision_number)
);
```

---

## 7. Domain Group 7: Statutory Standards & Governance

### 7.1. `statutory_pt_slabs`
State-specific professional tax rules and seasonal adjustments.
```sql
CREATE TABLE statutory_pt_slabs (
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
```

### 7.2. `statutory_holidays`
Calendar schedules per client and location.
```sql
CREATE TABLE statutory_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    work_location_id UUID REFERENCES work_locations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.3. `audit_logs`
Cryptographically timestamped, append-only security ledger.
```sql
CREATE TABLE audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
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
```
