-- ==============================================================================
-- MIGRATION 03: User Profiles & Granular Role-Based Access Control (RBAC)
-- File: supabase/migrations/20261103000003_auth_profiles_and_rbac.sql
-- ==============================================================================

-- 6. user_profiles (Links Supabase auth.users to Avencis WFM roles and tenant scopes)
CREATE TABLE IF NOT EXISTS user_profiles (
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
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    employee_id UUID, -- Foreign key linked to employees table
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_client ON user_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_employee ON user_profiles(employee_id);

-- Explicit Data API Grants (Post-October 30 Supabase Requirement)
GRANT SELECT ON public.user_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

-- Helper functions for Row Level Security (Created in public schema to avoid auth schema permission errors)
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

-- Grant execute on security helper functions
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_client_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_employee_id() TO authenticated, anon, service_role;
