-- ==============================================================================
-- MIGRATION 06: Leave Balances, Application Workflow & Approval Registers
-- File: supabase/migrations/20261103000006_leave_management.sql
-- ==============================================================================

-- 13. leave_balances (Individual employee balance ledger by entitlement type)
CREATE TABLE IF NOT EXISTS leave_balances (
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

-- 14. leave_requests (Formal employee leave applications with review trail)
CREATE TABLE IF NOT EXISTS leave_requests (
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_leave_balances_emp ON leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_requests_client ON leave_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);

-- Explicit Data API Grants (Post-October 30 Supabase Requirement)
GRANT SELECT ON public.leave_balances TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;

GRANT SELECT ON public.leave_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
