# AVENCIS WORKFORCE MANAGEMENT (MODULE 01)
## DATABASE SCHEMA & RELATIONAL ARCHITECTURE

**Project:** Avencis ERP / Business Management Platform  
**Target Backend:** PostgreSQL 15+ / Supabase  
**Tenant Model:** Client-Partitioned Shared Database with Multi-Tenant Row Level Security (RLS)  
**Implementation Stage:** Target Architectural Specification (Phase 2 Roadmap)  
**Current Draft Reality:** **NOT YET IMPLEMENTED ON LIVE POSTGRESQL** (Managed via client-side `AppStore` and browser `localStorage`)  

> [!WARNING]
> **AUDIT STATUS CLARIFICATION:**  
> The physical table definitions and Row Level Security (RLS) scripts documented below represent the **approved target design specifications** for backend integration.  
> In the First Functional Working Draft, `@supabase/supabase-js` is not installed, no live PostgreSQL instance is connected, and no SQL migrations have been executed. All live database RLS tests are officially marked **NOT EXECUTED**.

---

### 1. Conceptual Entity Relationship Model

```
   ┌──────────────────────────────────────────────┐
   │                   clients                    │
   └──────┬────────────────┬──────────────┬───────┘
          │ 1:N            │ 1:1          │ 1:N
          ▼                ▼              ▼
┌──────────────────┐ ┌──────────────┐ ┌───────────────┐
│client_legal_     │ │client_       │ │work_locations │
│entities          │ │policies      │ └───────┬───────┘
└────────┬─────────┘ └──────────────┘         │ 1:N
         │ 1:N                                │
         ▼                                    ▼
┌─────────────────────────────────────────────────────┐
│                      employees                      │
└────────┬─────────────────┬───────────────────┬──────┘
         │ 1:N             │ 1:N               │ 1:N
         ▼                 ▼                   ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│attendance_events│ │leave_balances│ │payroll_items    │
│(immutable raw)  │ └──────┬───────┘ └────────┬────────┘
└────────┬────────┘        │ 1:N              │
         │ aggregate       ▼                  │ N:1
         ▼          ┌──────────────┐          ▼
┌─────────────────┐ │leave_requests│ ┌─────────────────┐
│daily_attendance │ └──────────────┘ │payroll_runs     │
│records          │                  └─────────────────┘
└─────────────────┘
```

---

### 2. Physical Table Specifications

#### 2.1. `clients`
Represents the top-level organisation subscribing to Avencis WFM services.
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

#### 2.2. `client_legal_entities`
The statutory legal employer holding PAN, TAN, GSTIN, PF establishment codes, and ESIC registrations.
```sql
CREATE TABLE client_legal_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    registration_type VARCHAR(50) NOT NULL CHECK (registration_type IN ('PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PROPRIETORSHIP')),
    registration_number VARCHAR(100),
    pan VARCHAR(10) NOT NULL,
    gstin VARCHAR(15),
    pf_establishment_code VARCHAR(50),
    esic_registration_code VARCHAR(50),
    registered_address TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_client_pan UNIQUE (client_id, pan)
);
```

#### 2.3. `client_policies`
Houses the 20 operational, attendance, leave, and payroll policies strictly configured at the client tenant level.
```sql
CREATE TABLE client_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
    is_configured BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Overtime Policy
    overtime_method VARCHAR(30) NOT NULL DEFAULT 'disabled' CHECK (overtime_method IN ('multiplier', 'flat_rate', 'comp_off', 'disabled')),
    overtime_rate NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    
    -- Late Arrival Policy
    late_grace_minutes INT NOT NULL DEFAULT 0,
    late_penalty_rule VARCHAR(40) NOT NULL DEFAULT 'none' CHECK (late_penalty_rule IN ('none', 'deduct_half_day_per_3', 'deduct_cl')),
    
    -- Overnight Shift
    overnight_shift_attribution VARCHAR(30) NOT NULL DEFAULT 'shift_start_date' CHECK (overnight_shift_attribution IN ('shift_start_date', 'shift_end_date')),
    
    -- Working Hours & Calendar
    standard_working_hours NUMERIC(4,2) NOT NULL DEFAULT 9.0,
    half_day_hours NUMERIC(4,2) NOT NULL DEFAULT 4.5,
    weekly_off_days TEXT[] NOT NULL DEFAULT ARRAY['SUNDAY'],
    
    -- Telemetry & Geofencing
    attendance_tracking_mode VARCHAR(30) NOT NULL DEFAULT 'double_punch' CHECK (attendance_tracking_mode IN ('double_punch', 'single_punch')),
    require_gps BOOLEAN NOT NULL DEFAULT TRUE,
    require_selfie BOOLEAN NOT NULL DEFAULT FALSE,
    enforce_strict_geofence BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Leave Management
    leave_types_supported TEXT[] NOT NULL DEFAULT ARRAY['PL', 'CL', 'SL', 'LWP'],
    min_service_days_for_leave INT NOT NULL DEFAULT 30,
    monthly_paid_leave_accrual NUMERIC(4,2) NOT NULL DEFAULT 2.0,
    max_carry_forward INT NOT NULL DEFAULT 30,
    allow_leave_encashment BOOLEAN NOT NULL DEFAULT FALSE,
    unpaid_leave_deduction_formula VARCHAR(40) NOT NULL DEFAULT 'per_day_proration',
    
    -- Payroll & Statutory
    salary_divisor VARCHAR(20) NOT NULL DEFAULT '30' CHECK (salary_divisor IN ('26', '30', 'calendar_days')),
    pf_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    pf_employee_percent NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    pf_employer_percent NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    esic_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    esic_employee_percent NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    esic_employer_percent NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    pt_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    tds_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(150) NOT NULL
);
```

#### 2.4. `work_locations`
Operating sites, depot yards, and corporate offices with geofence center coordinates and perimeter radii.
```sql
CREATE TABLE work_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INT NOT NULL DEFAULT 150 CHECK (radius_meters BETWEEN 20 AND 2000),
    active_headcount INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 2.5. `employees`
Central worker master linking individual personnel to Client Legal Entities and Work Locations.
```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    legal_entity_id UUID NOT NULL REFERENCES client_legal_entities(id),
    work_location_id UUID NOT NULL REFERENCES work_locations(id),
    department_id VARCHAR(50) NOT NULL,
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(30) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    joining_date DATE NOT NULL,
    employment_type VARCHAR(40) NOT NULL CHECK (employment_type IN ('FULL_TIME', 'CONTRACT', 'INTERN')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_NOTICE', 'SUSPENDED', 'TERMINATED')),
    fixed_monthly_salary NUMERIC(12,2) NOT NULL,
    variable_incentive NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    pan_number VARCHAR(10) NOT NULL,
    aadhaar_number VARCHAR(20) NOT NULL,
    uan_number VARCHAR(20),
    esic_number VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_client_emp_code UNIQUE (client_id, employee_code)
);
```

#### 2.6. `attendance_events` (Raw Append-Only Ledger)
Every raw GPS check-in or check-out event recorded via mobile device or biometric terminal.
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
    is_suspicious BOOLEAN NOT NULL DEFAULT FALSE
);
```

#### 2.7. `daily_attendance_records` (Aggregated Muster)
Consolidated daily presence, check-in/out times, and calculated session duration.
```sql
CREATE TABLE daily_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time VARCHAR(20),
    check_out_time VARCHAR(20),
    total_hours NUMERIC(4,2) DEFAULT 0,
    status VARCHAR(30) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY')),
    location_name VARCHAR(255),
    is_regularised BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_emp_date UNIQUE (employee_id, date)
);
```

#### 2.8. `payroll_runs` & `payroll_items`
Monthly compensation batches and individual itemized employee earnings/deductions lines.
```sql
CREATE TABLE payroll_runs (
    id VARCHAR(100) PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id),
    period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    total_employees INT NOT NULL,
    total_gross NUMERIC(14,2) NOT NULL,
    total_deductions NUMERIC(14,2) NOT NULL,
    total_net NUMERIC(14,2) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('draft', 'approved', 'locked')),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR(150),
    policy_snapshot JSONB
);

CREATE TABLE payroll_items (
    id VARCHAR(100) PRIMARY KEY,
    run_id VARCHAR(100) NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    fixed_salary NUMERIC(12,2) NOT NULL,
    incentives NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
    calendar_days INT NOT NULL,
    paid_days INT NOT NULL,
    unpaid_days INT NOT NULL,
    gross_earned NUMERIC(12,2) NOT NULL,
    unpaid_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    pf_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    esic_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    pt_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    tds_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_deductions NUMERIC(12,2) NOT NULL,
    net_salary NUMERIC(12,2) NOT NULL
);
```

#### 2.9. `audit_logs`
Cryptographic-grade governance ledger tracking all administrative state changes.
```sql
CREATE TABLE audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    client_id UUID,
    actor_name VARCHAR(150) NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    actor_role VARCHAR(40) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(100) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical'))
);
```

---

### 3. Multi-Tenant Row Level Security (RLS) Policies

Every client-scoped table implements Row Level Security in PostgreSQL:

```sql
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Rule for Client Administrators
CREATE POLICY tenant_isolation_client_admin ON employees
FOR ALL TO authenticated
USING (
    client_id = (SELECT client_id FROM user_profiles WHERE id = auth.uid())
    OR
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
);
```
