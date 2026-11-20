-- ==============================================================================
-- MIGRATION 08: Statutory Reference Tables & Immutable Audit Ledger
-- File: supabase/migrations/20261103000008_statutory_and_audit_ledgers.sql
-- ==============================================================================

-- 18. statutory_pt_slabs (State-specific Professional Tax schedules)
CREATE TABLE IF NOT EXISTS statutory_pt_slabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state VARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL DEFAULT 'ALL' CHECK (gender IN ('ALL', 'MALE', 'FEMALE')),
    monthly_gross_min NUMERIC(10,2) NOT NULL CHECK (monthly_gross_min >= 0),
    monthly_gross_max NUMERIC(10,2), -- NULL denotes no upper ceiling
    tax_amount NUMERIC(6,2) NOT NULL CHECK (tax_amount >= 0),
    february_tax_amount NUMERIC(6,2), -- Special February spike (e.g. Maharashtra ₹300)
    effective_from DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed Maharashtra Standard PT Schedule
INSERT INTO statutory_pt_slabs (state, gender, monthly_gross_min, monthly_gross_max, tax_amount, february_tax_amount, effective_from)
VALUES 
    ('Maharashtra', 'ALL', 0.00, 7500.00, 0.00, 0.00, '2020-01-01'),
    ('Maharashtra', 'ALL', 7500.01, 10000.00, 175.00, 175.00, '2020-01-01'),
    ('Maharashtra', 'ALL', 10000.01, NULL, 200.00, 300.00, '2020-01-01')
ON CONFLICT DO NOTHING;

-- 19. statutory_holidays (Public and Client holiday calendars)
CREATE TABLE IF NOT EXISTS statutory_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE, -- NULL denotes national holiday
    work_location_id UUID REFERENCES work_locations(id) ON DELETE CASCADE, -- NULL denotes all locations in client
    name VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. audit_logs (Append-only tamper-evident security & governance ledger)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY, -- e.g. audit-179368-x8f2
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pt_slabs_state ON statutory_pt_slabs(state, is_active);
CREATE INDEX IF NOT EXISTS idx_holidays_client_date ON statutory_holidays(client_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_client ON audit_logs(client_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- Explicit Data API Grants (Post-October 30 Supabase Requirement)
GRANT SELECT ON public.statutory_pt_slabs TO anon, authenticated;
GRANT ALL ON public.statutory_pt_slabs TO service_role;

GRANT SELECT ON public.statutory_holidays TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.statutory_holidays TO authenticated;
GRANT ALL ON public.statutory_holidays TO service_role;

GRANT SELECT, INSERT ON public.audit_logs TO anon, authenticated;
GRANT ALL ON public.audit_logs TO service_role;
