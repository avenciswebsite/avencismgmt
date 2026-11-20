-- ==============================================================================
-- MIGRATION 04: Employees Master, Salary Structures & Banking Security
-- File: supabase/migrations/20261103000004_employees_and_compensation.sql
-- ==============================================================================

-- 7. employees (Core staff directory)
-- Models employment arrangement and separate legal entity employer
CREATE TABLE IF NOT EXISTS employees (
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

-- Link head_employee_id in departments table
ALTER TABLE departments 
ADD CONSTRAINT fk_departments_head 
FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Link employee_id in user_profiles table
ALTER TABLE user_profiles 
ADD CONSTRAINT fk_user_profiles_employee 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- 8. employee_salary_structures (Decoupled compensation table for security & audit)
CREATE TABLE IF NOT EXISTS employee_salary_structures (
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

-- 9. employee_bank_details (Protected financial disbursement information)
CREATE TABLE IF NOT EXISTS employee_bank_details (
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_employees_client ON employees(client_id);
CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(work_location_id);
CREATE INDEX IF NOT EXISTS idx_employees_legal_entity ON employees(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_salary_structures_emp ON employee_salary_structures(employee_id);
CREATE INDEX IF NOT EXISTS idx_bank_details_emp ON employee_bank_details(employee_id);

-- Explicit Data API Grants (Post-October 30 Supabase Requirement)
GRANT SELECT ON public.employees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

GRANT SELECT ON public.employee_salary_structures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_salary_structures TO authenticated;
GRANT ALL ON public.employee_salary_structures TO service_role;

GRANT SELECT ON public.employee_bank_details TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_bank_details TO authenticated;
GRANT ALL ON public.employee_bank_details TO service_role;
