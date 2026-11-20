-- ==============================================================================
-- MIGRATION 10: Database Triggers, Tamper Guards & Immutability Enforcement
-- File: supabase/migrations/20261103000010_database_triggers_and_guards.sql
-- ==============================================================================

-- 1. Function to maintain updated_at timestamps automatically
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_client_policies_updated_at
BEFORE UPDATE ON client_policies
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_daily_attendance_updated_at
BEFORE UPDATE ON daily_attendance_records
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Guard against tampering with locked payroll runs
CREATE OR REPLACE FUNCTION public.guard_locked_payroll_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'locked' THEN
        RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Payroll run % is locked and immutable. Modifications are prohibited.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_payroll_run_lock
BEFORE UPDATE OR DELETE ON payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.guard_locked_payroll_modification();

-- 3. Guard against modifying payroll items belonging to a locked run
CREATE OR REPLACE FUNCTION public.guard_locked_payroll_items()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR(30);
BEGIN
    SELECT status INTO v_status FROM payroll_runs WHERE id = OLD.run_id;
    IF v_status = 'locked' THEN
        RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Payroll items for locked run % cannot be modified or deleted.', OLD.run_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_payroll_items_lock
BEFORE UPDATE OR DELETE ON payroll_items
FOR EACH ROW EXECUTE FUNCTION public.guard_locked_payroll_items();

-- 4. Guard against updating or deleting immutable attendance events
CREATE OR REPLACE FUNCTION public.guard_immutable_attendance_events()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AUDIT SECURITY VIOLATION: Raw attendance events are immutable. Deletions and updates are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_attendance_events_immutability
BEFORE UPDATE OR DELETE ON attendance_events
FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_attendance_events();

-- 5. Guard against updating or deleting audit logs
CREATE OR REPLACE FUNCTION public.guard_immutable_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AUDIT SECURITY VIOLATION: Audit log records are cryptographically protected and immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_audit_logs_immutability
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_audit_logs();

-- Explicit Function Execution Grants (Post-October 30 Supabase Requirement)
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_locked_payroll_modification() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_locked_payroll_items() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_immutable_attendance_events() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_immutable_audit_logs() TO authenticated, service_role;
