-- ==============================================================================
-- MIGRATION 07: Payroll Engine Batches, Line Items & Formal Payslip Registers
-- File: supabase/migrations/20261103000007_payroll_engine_and_payslips.sql
-- ==============================================================================

-- 15. payroll_runs (Monthly compensation run header with strict state machine)
CREATE TABLE IF NOT EXISTS payroll_runs (
    id VARCHAR(100) PRIMARY KEY, -- e.g. payrun-client-suman-10-2026
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

-- 16. payroll_items (Individual employee line-item calculation results)
CREATE TABLE IF NOT EXISTS payroll_items (
    id VARCHAR(120) PRIMARY KEY, -- e.g. pitem-emp-01-10-2026
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

-- 17. payslips (Form XIX statutory payslip registry and signed artifact URLs)
CREATE TABLE IF NOT EXISTS payslips (
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_runs_client ON payroll_runs(client_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_items_emp ON payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_emp_period ON payslips(employee_id, period_year, period_month);

-- Explicit Data API Grants (Post-October 30 Supabase Requirement)
GRANT SELECT ON public.payroll_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;

GRANT SELECT ON public.payroll_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;
GRANT ALL ON public.payroll_items TO service_role;

GRANT SELECT ON public.payslips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;
