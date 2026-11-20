-- ==============================================================================
-- AVENCIS WORKFORCE MANAGEMENT (WFM) — POST-MIGRATION DATABASE VERIFICATION
-- Target: Supabase SQL Editor (Single Consolidated Diagnostic Execution)
-- Purpose: Evaluates all 10 migrations, 20 tables, constraints, foreign keys,
--          indexes, RLS policies, functions, triggers, and post-Oct 30 Data API grants.
-- Safety: 100% READ-ONLY. Zero DDL/DML, zero table creation, zero modifications.
-- ==============================================================================

WITH 
-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS VERIFICATION
-- ------------------------------------------------------------------------------
expected_extensions AS (
    SELECT 'uuid-ossp' AS extname UNION ALL
    SELECT 'pgcrypto'
),
ext_check AS (
    SELECT 
        '01. EXTENSIONS' AS category,
        e.extname AS item_name,
        'Extension Installed' AS test_type,
        CASE WHEN pe.extname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
        'Installed & Active' AS expected_value,
        COALESCE(pe.extname || ' (v' || pe.extversion || ')', 'NOT INSTALLED') AS actual_value,
        CASE 
            WHEN pe.extname IS NOT NULL THEN 'Extension ' || e.extname || ' is active.'
            ELSE 'CRITICAL: Extension ' || e.extname || ' is missing.'
        END AS details
    FROM expected_extensions e
    LEFT JOIN pg_extension pe ON pe.extname = e.extname
),

-- ------------------------------------------------------------------------------
-- 2. TABLES & COLUMN COUNT VERIFICATION (20 TABLES)
-- ------------------------------------------------------------------------------
expected_tables AS (
    SELECT 'clients' AS table_name, 10 AS min_cols, true AS needs_rls, '01' AS migration UNION ALL
    SELECT 'client_legal_entities', 14, true, '01' UNION ALL
    SELECT 'work_locations', 10, true, '02' UNION ALL
    SELECT 'departments', 6, true, '02' UNION ALL
    SELECT 'client_policies', 30, true, '02' UNION ALL
    SELECT 'user_profiles', 10, true, '03' UNION ALL
    SELECT 'employees', 20, true, '04' UNION ALL
    SELECT 'employee_salary_structures', 11, true, '04' UNION ALL
    SELECT 'employee_bank_details', 8, true, '04' UNION ALL
    SELECT 'attendance_events', 12, true, '05' UNION ALL
    SELECT 'daily_attendance_records', 11, true, '05' UNION ALL
    SELECT 'attendance_corrections', 12, true, '05' UNION ALL
    SELECT 'leave_balances', 9, true, '06' UNION ALL
    SELECT 'leave_requests', 11, true, '06' UNION ALL
    SELECT 'payroll_runs', 15, true, '07' UNION ALL
    SELECT 'payroll_items', 18, true, '07' UNION ALL
    SELECT 'payslips', 10, true, '07' UNION ALL
    SELECT 'statutory_pt_slabs', 9, false, '08' UNION ALL
    SELECT 'statutory_holidays', 7, false, '08' UNION ALL
    SELECT 'audit_logs', 11, true, '08'
),
table_check AS (
    SELECT 
        '02. TABLES (20 CORE)' AS category,
        et.table_name AS item_name,
        'Table Existence & Columns (M-' || et.migration || ')' AS test_type,
        CASE 
            WHEN t.table_name IS NULL THEN 'FAIL'
            WHEN COUNT(c.column_name) >= et.min_cols THEN 'PASS'
            ELSE 'WARNING'
        END AS status,
        '>= ' || et.min_cols || ' columns' AS expected_value,
        CASE 
            WHEN t.table_name IS NULL THEN 'TABLE MISSING'
            ELSE COUNT(c.column_name)::text || ' columns found'
        END AS actual_value,
        CASE 
            WHEN t.table_name IS NULL THEN 'CRITICAL: Table public.' || et.table_name || ' does not exist.'
            WHEN COUNT(c.column_name) < et.min_cols THEN 'WARNING: Found ' || COUNT(c.column_name) || ' columns, expected at least ' || et.min_cols
            ELSE 'Table public.' || et.table_name || ' verified with ' || COUNT(c.column_name) || ' columns.'
        END AS details
    FROM expected_tables et
    LEFT JOIN information_schema.tables t 
        ON t.table_schema = 'public' AND t.table_name = et.table_name AND t.table_type = 'BASE TABLE'
    LEFT JOIN information_schema.columns c 
        ON c.table_schema = 'public' AND c.table_name = et.table_name
    GROUP BY et.table_name, et.min_cols, et.migration, t.table_name
),

-- ------------------------------------------------------------------------------
-- 3. PRIMARY KEY INTEGRITY
-- ------------------------------------------------------------------------------
pk_check AS (
    SELECT 
        '03. PRIMARY KEYS' AS category,
        et.table_name AS item_name,
        'Primary Key Defined' AS test_type,
        CASE WHEN pk.constraint_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
        'PRIMARY KEY defined' AS expected_value,
        COALESCE(pk.constraint_name, 'NO PRIMARY KEY') AS actual_value,
        CASE 
            WHEN pk.constraint_name IS NOT NULL THEN 'PK constraint (' || pk.constraint_name || ') active.'
            ELSE 'CRITICAL: Table ' || et.table_name || ' has no PRIMARY KEY defined.'
        END AS details
    FROM expected_tables et
    LEFT JOIN (
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
    ) pk ON pk.table_name = et.table_name
),

-- ------------------------------------------------------------------------------
-- 4. FOREIGN KEY RELATIONSHIPS
-- ------------------------------------------------------------------------------
expected_foreign_keys AS (
    SELECT 'client_legal_entities' AS src_table, 'client_id' AS src_col, 'clients' AS tgt_table UNION ALL
    SELECT 'work_locations', 'client_id', 'clients' UNION ALL
    SELECT 'departments', 'client_id', 'clients' UNION ALL
    SELECT 'client_policies', 'client_id', 'clients' UNION ALL
    SELECT 'employees', 'client_id', 'clients' UNION ALL
    SELECT 'employees', 'legal_entity_id', 'client_legal_entities' UNION ALL
    SELECT 'employees', 'work_location_id', 'work_locations' UNION ALL
    SELECT 'employees', 'department_id', 'departments' UNION ALL
    SELECT 'employee_salary_structures', 'employee_id', 'employees' UNION ALL
    SELECT 'employee_bank_details', 'employee_id', 'employees' UNION ALL
    SELECT 'attendance_events', 'employee_id', 'employees' UNION ALL
    SELECT 'daily_attendance_records', 'employee_id', 'employees' UNION ALL
    SELECT 'attendance_corrections', 'employee_id', 'employees' UNION ALL
    SELECT 'leave_balances', 'employee_id', 'employees' UNION ALL
    SELECT 'leave_requests', 'employee_id', 'employees' UNION ALL
    SELECT 'payroll_runs', 'client_id', 'clients' UNION ALL
    SELECT 'payroll_items', 'run_id', 'payroll_runs' UNION ALL
    SELECT 'payroll_items', 'employee_id', 'employees' UNION ALL
    SELECT 'payslips', 'payroll_item_id', 'payroll_items' UNION ALL
    SELECT 'payslips', 'employee_id', 'employees'
),
fk_check AS (
    SELECT 
        '04. FOREIGN KEYS' AS category,
        efk.src_table || '.' || efk.src_col || ' -> ' || efk.tgt_table AS item_name,
        'Foreign Key Relationship' AS test_type,
        CASE WHEN fkc.constraint_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
        efk.src_table || '(' || efk.src_col || ') -> ' || efk.tgt_table AS expected_value,
        COALESCE(fkc.constraint_name, 'MISSING FK') AS actual_value,
        CASE 
            WHEN fkc.constraint_name IS NOT NULL THEN 'FK constraint ' || fkc.constraint_name || ' active.'
            ELSE 'CRITICAL: Missing foreign key on ' || efk.src_table || '.' || efk.src_col || ' referencing ' || efk.tgt_table
        END AS details
    FROM expected_foreign_keys efk
    LEFT JOIN (
        SELECT 
            tc.table_name AS src_table,
            kcu.column_name AS src_col,
            ccu.table_name AS tgt_table,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
    ) fkc ON fkc.src_table = efk.src_table AND fkc.src_col = efk.src_col AND fkc.tgt_table = efk.tgt_table
),

-- ------------------------------------------------------------------------------
-- 5. UNIQUE CONSTRAINTS
-- ------------------------------------------------------------------------------
expected_unique_constraints AS (
    SELECT 'clients' AS table_name, 'code' AS constraint_indicator, 'unq_clients_code' AS descr UNION ALL
    SELECT 'client_legal_entities', 'pan', 'unq_client_pan' UNION ALL
    SELECT 'departments', 'code', 'unq_client_dept_code' UNION ALL
    SELECT 'client_policies', 'client_id', 'unq_policies_client_id' UNION ALL
    SELECT 'employees', 'code', 'unq_client_employee_code' UNION ALL
    SELECT 'employee_bank_details', 'employee_id', 'unq_bank_employee_id' UNION ALL
    SELECT 'daily_attendance_records', 'date', 'unq_emp_attendance_date' UNION ALL
    SELECT 'leave_balances', 'year', 'unq_emp_leave_year_type' UNION ALL
    SELECT 'payroll_runs', 'period', 'unq_client_period' UNION ALL
    SELECT 'payroll_items', 'employee', 'unq_run_employee' UNION ALL
    SELECT 'payslips', 'period', 'unq_emp_payslip_period'
),
unique_check AS (
    SELECT 
        '05. UNIQUE CONSTRAINTS' AS category,
        euc.table_name || ' (' || euc.descr || ')' AS item_name,
        'Unique Constraint Exists' AS test_type,
        CASE WHEN c.conname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
        'UNIQUE constraint on indicator: ' || euc.constraint_indicator AS expected_value,
        COALESCE(c.conname, 'MISSING') AS actual_value,
        CASE 
            WHEN c.conname IS NOT NULL THEN 'Unique constraint ' || c.conname || ' active.'
            ELSE 'CRITICAL: Unique constraint for ' || euc.descr || ' missing on ' || euc.table_name
        END AS details
    FROM expected_unique_constraints euc
    LEFT JOIN pg_constraint c ON c.conrelid = to_regclass('public.' || euc.table_name)
        AND c.contype = 'u' 
        AND c.conname ILIKE '%' || euc.constraint_indicator || '%'
),

-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
expected_indexes AS (
    SELECT 'idx_clients_status' AS index_name, 'clients' AS table_name UNION ALL
    SELECT 'idx_clients_code', 'clients' UNION ALL
    SELECT 'idx_legal_entities_client', 'client_legal_entities' UNION ALL
    SELECT 'idx_work_locations_client', 'work_locations' UNION ALL
    SELECT 'idx_departments_client', 'departments' UNION ALL
    SELECT 'idx_policies_client', 'client_policies' UNION ALL
    SELECT 'idx_user_profiles_role', 'user_profiles' UNION ALL
    SELECT 'idx_user_profiles_client', 'user_profiles' UNION ALL
    SELECT 'idx_user_profiles_employee', 'user_profiles' UNION ALL
    SELECT 'idx_employees_client', 'employees' UNION ALL
    SELECT 'idx_employees_location', 'employees' UNION ALL
    SELECT 'idx_employees_legal_entity', 'employees' UNION ALL
    SELECT 'idx_salary_structures_emp', 'employee_salary_structures' UNION ALL
    SELECT 'idx_bank_details_emp', 'employee_bank_details' UNION ALL
    SELECT 'idx_attendance_events_emp_time', 'attendance_events' UNION ALL
    SELECT 'idx_attendance_events_client', 'attendance_events' UNION ALL
    SELECT 'idx_daily_attendance_date', 'daily_attendance_records' UNION ALL
    SELECT 'idx_daily_attendance_emp', 'daily_attendance_records' UNION ALL
    SELECT 'idx_corrections_client_status', 'attendance_corrections' UNION ALL
    SELECT 'idx_leave_balances_emp', 'leave_balances' UNION ALL
    SELECT 'idx_leave_requests_client', 'leave_requests' UNION ALL
    SELECT 'idx_leave_requests_emp', 'leave_requests' UNION ALL
    SELECT 'idx_payroll_runs_client', 'payroll_runs' UNION ALL
    SELECT 'idx_payroll_items_emp', 'payroll_items' UNION ALL
    SELECT 'idx_payroll_items_run', 'payroll_items' UNION ALL
    SELECT 'idx_payslips_emp_period', 'payslips' UNION ALL
    SELECT 'idx_pt_slabs_state', 'statutory_pt_slabs' UNION ALL
    SELECT 'idx_holidays_client_date', 'statutory_holidays' UNION ALL
    SELECT 'idx_audit_logs_client', 'audit_logs' UNION ALL
    SELECT 'idx_audit_logs_severity', 'audit_logs'
),
index_check AS (
    SELECT 
        '06. INDEXES' AS category,
        ei.index_name AS item_name,
        'Index on ' || ei.table_name AS test_type,
        CASE WHEN pi.indexname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
        'Index present' AS expected_value,
        COALESCE(pi.indexname, 'MISSING') AS actual_value,
        CASE 
            WHEN pi.indexname IS NOT NULL THEN 'Index ' || ei.index_name || ' active.'
            ELSE 'CRITICAL: Index ' || ei.index_name || ' is missing on table ' || ei.table_name
        END AS details
    FROM expected_indexes ei
    LEFT JOIN pg_indexes pi ON pi.schemaname = 'public' AND pi.indexname = ei.index_name
),

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) STATUS (17 SENSITIVE TABLES)
-- ------------------------------------------------------------------------------
rls_status_check AS (
    SELECT 
        '07. RLS STATUS' AS category,
        et.table_name AS item_name,
        'RLS Enabled' AS test_type,
        CASE 
            WHEN NOT et.needs_rls THEN 'PASS'
            WHEN c.relrowsecurity THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        CASE WHEN et.needs_rls THEN 'RLS ENABLED' ELSE 'OPTIONAL (Reference)' END AS expected_value,
        CASE 
            WHEN c.relrowsecurity IS NULL THEN 'TABLE MISSING'
            WHEN c.relrowsecurity THEN 'RLS ENABLED'
            ELSE 'RLS DISABLED (SECURITY RISK)'
        END AS actual_value,
        CASE 
            WHEN NOT et.needs_rls THEN 'Public reference schedule (RLS not required).'
            WHEN c.relrowsecurity THEN 'RLS is active on public.' || et.table_name || '.'
            ELSE 'CRITICAL VULNERABILITY: Table ' || et.table_name || ' has RLS DISABLED!'
        END AS details
    FROM expected_tables et
    LEFT JOIN pg_class c ON c.relname = et.table_name AND c.relnamespace = 'public'::regnamespace
),

-- ------------------------------------------------------------------------------
-- 8. RLS POLICIES VERIFICATION (33 POLICIES)
-- ------------------------------------------------------------------------------
expected_policies AS (
    SELECT 'clients_super_admin_all' AS policy_name, 'clients' AS table_name UNION ALL
    SELECT 'clients_client_admin_select', 'clients' UNION ALL
    SELECT 'employees_super_admin_all', 'employees' UNION ALL
    SELECT 'employees_client_admin_tenant', 'employees' UNION ALL
    SELECT 'employees_self_select', 'employees' UNION ALL
    SELECT 'salary_super_admin_all', 'employee_salary_structures' UNION ALL
    SELECT 'salary_payroll_admin_tenant', 'employee_salary_structures' UNION ALL
    SELECT 'salary_employee_self_select', 'employee_salary_structures' UNION ALL
    SELECT 'bank_super_admin_all', 'employee_bank_details' UNION ALL
    SELECT 'bank_payroll_admin_tenant', 'employee_bank_details' UNION ALL
    SELECT 'bank_employee_self_select', 'employee_bank_details' UNION ALL
    SELECT 'events_super_admin_select', 'attendance_events' UNION ALL
    SELECT 'events_tenant_admin_select', 'attendance_events' UNION ALL
    SELECT 'events_employee_self_select', 'attendance_events' UNION ALL
    SELECT 'events_employee_self_insert', 'attendance_events' UNION ALL
    SELECT 'daily_attendance_super_admin_all', 'daily_attendance_records' UNION ALL
    SELECT 'daily_attendance_tenant_admin_all', 'daily_attendance_records' UNION ALL
    SELECT 'daily_attendance_employee_select', 'daily_attendance_records' UNION ALL
    SELECT 'corrections_employee_apply', 'attendance_corrections' UNION ALL
    SELECT 'corrections_employee_select', 'attendance_corrections' UNION ALL
    SELECT 'corrections_tenant_admin_all', 'attendance_corrections' UNION ALL
    SELECT 'leave_balances_employee_select', 'leave_balances' UNION ALL
    SELECT 'leave_balances_tenant_admin_all', 'leave_balances' UNION ALL
    SELECT 'leave_requests_employee_all', 'leave_requests' UNION ALL
    SELECT 'leave_requests_tenant_admin_all', 'leave_requests' UNION ALL
    SELECT 'payroll_runs_admin_all', 'payroll_runs' UNION ALL
    SELECT 'payroll_items_admin_all', 'payroll_items' UNION ALL
    SELECT 'payroll_items_employee_self_select', 'payroll_items' UNION ALL
    SELECT 'payslips_admin_all', 'payslips' UNION ALL
    SELECT 'payslips_employee_self_select', 'payslips' UNION ALL
    SELECT 'audit_logs_super_admin_select', 'audit_logs' UNION ALL
    SELECT 'audit_logs_client_admin_select', 'audit_logs' UNION ALL
    SELECT 'audit_logs_authenticated_insert', 'audit_logs'
),
policy_check AS (
    SELECT 
        '08. RLS POLICIES' AS category,
        ep.policy_name AS item_name,
        'Policy on ' || ep.table_name AS test_type,
        CASE WHEN pol.policyname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
        'Policy active on ' || ep.table_name AS expected_value,
        COALESCE(pol.policyname, 'POLICY MISSING') AS actual_value,
        CASE 
            WHEN pol.policyname IS NOT NULL THEN 'Policy active (cmd: ' || pol.cmd || ', roles: ' || array_to_string(pol.roles, ', ') || ').'
            ELSE 'CRITICAL: RLS policy ' || ep.policy_name || ' missing on table ' || ep.table_name
        END AS details
    FROM expected_policies ep
    LEFT JOIN pg_policies pol ON pol.schemaname = 'public' AND pol.tablename = ep.table_name AND pol.policyname = ep.policy_name
),

-- ------------------------------------------------------------------------------
-- 9. FUNCTIONS & SECURITY DEFINER STATUS
-- ------------------------------------------------------------------------------
expected_functions AS (
    SELECT 'get_user_role' AS func_name, 'public' AS schema_name, 'text' AS return_type, true AS sec_definer UNION ALL
    SELECT 'get_user_client_id', 'public', 'uuid', true UNION ALL
    SELECT 'get_user_employee_id', 'public', 'uuid', true UNION ALL
    SELECT 'handle_updated_at', 'public', 'trigger', false UNION ALL
    SELECT 'guard_locked_payroll_modification', 'public', 'trigger', false UNION ALL
    SELECT 'guard_locked_payroll_items', 'public', 'trigger', false UNION ALL
    SELECT 'guard_immutable_attendance_events', 'public', 'trigger', false UNION ALL
    SELECT 'guard_immutable_audit_logs', 'public', 'trigger', false
),
function_check AS (
    SELECT 
        '09. FUNCTIONS' AS category,
        ef.schema_name || '.' || ef.func_name || '()' AS item_name,
        'Function Implementation' AS test_type,
        CASE 
            WHEN p.proname IS NULL THEN 'FAIL'
            WHEN ef.sec_definer AND NOT p.prosecdef THEN 'WARNING'
            ELSE 'PASS'
        END AS status,
        'Function ' || ef.func_name || ' (secdef=' || ef.sec_definer::text || ')' AS expected_value,
        CASE 
            WHEN p.proname IS NULL THEN 'FUNCTION MISSING'
            ELSE 'Exists (secdef=' || p.prosecdef::text || ')'
        END AS actual_value,
        CASE 
            WHEN p.proname IS NULL THEN 'CRITICAL: Function ' || ef.schema_name || '.' || ef.func_name || ' does not exist.'
            WHEN ef.sec_definer AND NOT p.prosecdef THEN 'WARNING: ' || ef.func_name || ' is missing SECURITY DEFINER flag!'
            ELSE 'Function ' || ef.func_name || ' is active and returns ' || ef.return_type || '.'
        END AS details
    FROM expected_functions ef
    LEFT JOIN pg_proc p ON p.proname = ef.func_name AND p.pronamespace = ef.schema_name::regnamespace
),

-- ------------------------------------------------------------------------------
-- 10. DATABASE TRIGGERS
-- ------------------------------------------------------------------------------
expected_triggers AS (
    SELECT 'trg_clients_updated_at' AS trigger_name, 'clients' AS table_name, 'BEFORE UPDATE' AS timing UNION ALL
    SELECT 'trg_client_policies_updated_at', 'client_policies', 'BEFORE UPDATE' UNION ALL
    SELECT 'trg_employees_updated_at', 'employees', 'BEFORE UPDATE' UNION ALL
    SELECT 'trg_daily_attendance_updated_at', 'daily_attendance_records', 'BEFORE UPDATE' UNION ALL
    SELECT 'trg_guard_payroll_run_lock', 'payroll_runs', 'BEFORE UPDATE OR DELETE' UNION ALL
    SELECT 'trg_guard_payroll_items_lock', 'payroll_items', 'BEFORE UPDATE OR DELETE' UNION ALL
    SELECT 'trg_guard_attendance_events_immutability', 'attendance_events', 'BEFORE UPDATE OR DELETE' UNION ALL
    SELECT 'trg_guard_audit_logs_immutability', 'audit_logs', 'BEFORE UPDATE OR DELETE'
),
trigger_check AS (
    SELECT 
        '10. TRIGGERS' AS category,
        etg.trigger_name AS item_name,
        'Trigger on ' || etg.table_name AS test_type,
        CASE WHEN t.trigger_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
        etg.timing || ' trigger active' AS expected_value,
        COALESCE(t.trigger_name, 'TRIGGER MISSING') AS actual_value,
        CASE 
            WHEN t.trigger_name IS NOT NULL THEN 'Trigger active on ' || etg.table_name || ' (' || t.action_timing || ' ' || t.event_manipulation || ').'
            ELSE 'CRITICAL SECURITY DEFECT: Missing trigger ' || etg.trigger_name || ' on table ' || etg.table_name
        END AS details
    FROM expected_triggers etg
    LEFT JOIN information_schema.triggers t 
        ON t.trigger_schema = 'public' AND t.event_object_table = etg.table_name AND t.trigger_name = etg.trigger_name
),

-- ------------------------------------------------------------------------------
-- 11. DATA API PERMISSIONS (POST-OCT 30 SUPABASE GRANTS)
-- ------------------------------------------------------------------------------
grant_check AS (
    SELECT 
        '11. DATA API GRANTS' AS category,
        et.table_name AS item_name,
        'PostgREST Access Grants' AS test_type,
        CASE 
            WHEN count(distinct rtg.grantee) >= 2 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Granted to authenticated & service_role' AS expected_value,
        COALESCE('Grantees: ' || string_agg(distinct rtg.grantee, ', '), 'NO GRANTS') AS actual_value,
        CASE 
            WHEN count(distinct rtg.grantee) >= 2 THEN 'Table public.' || et.table_name || ' has required Data API grants.'
            ELSE 'CRITICAL: Table public.' || et.table_name || ' lacks explicit Post-Oct 30 Data API grants!'
        END AS details
    FROM expected_tables et
    LEFT JOIN information_schema.role_table_grants rtg 
        ON rtg.table_schema = 'public' 
        AND rtg.table_name = et.table_name 
        AND rtg.grantee IN ('anon', 'authenticated', 'service_role')
    GROUP BY et.table_name
),

-- ------------------------------------------------------------------------------
-- 12. STATUTORY SEED DATA (MAHARASHTRA PT SCHEDULE)
-- ------------------------------------------------------------------------------
seed_check AS (
    SELECT 
        '12. SEED DATA' AS category,
        'statutory_pt_slabs' AS item_name,
        'Maharashtra Standard Slabs' AS test_type,
        CASE 
            WHEN to_regclass('public.statutory_pt_slabs') IS NULL THEN 'FAIL'
            WHEN (SELECT count(*) FROM public.statutory_pt_slabs WHERE state = 'Maharashtra') >= 3 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        '3 statutory PT slab records' AS expected_value,
        CASE 
            WHEN to_regclass('public.statutory_pt_slabs') IS NULL THEN 'TABLE MISSING'
            ELSE (SELECT count(*)::text FROM public.statutory_pt_slabs WHERE state = 'Maharashtra') || ' records found'
        END AS actual_value,
        CASE 
            WHEN to_regclass('public.statutory_pt_slabs') IS NULL THEN 'CRITICAL: Table public.statutory_pt_slabs does not exist.'
            WHEN (SELECT count(*) FROM public.statutory_pt_slabs WHERE state = 'Maharashtra') >= 3 THEN 'Maharashtra Professional Tax schedule records verified.'
            ELSE 'WARNING: Expected 3 statutory PT records in statutory_pt_slabs.'
        END AS details
),

-- ------------------------------------------------------------------------------
-- 13. CONSOLIDATED DETAIL CHECKS
-- ------------------------------------------------------------------------------
all_checks AS (
    SELECT * FROM ext_check
    UNION ALL
    SELECT * FROM table_check
    UNION ALL
    SELECT * FROM pk_check
    UNION ALL
    SELECT * FROM fk_check
    UNION ALL
    SELECT * FROM unique_check
    UNION ALL
    SELECT * FROM index_check
    UNION ALL
    SELECT * FROM rls_status_check
    UNION ALL
    SELECT * FROM policy_check
    UNION ALL
    SELECT * FROM function_check
    UNION ALL
    SELECT * FROM trigger_check
    UNION ALL
    SELECT * FROM grant_check
    UNION ALL
    SELECT * FROM seed_check
),

-- ------------------------------------------------------------------------------
-- 14. MIGRATION ROLLUP SUMMARY (MIGRATIONS 01 TO 10)
-- ------------------------------------------------------------------------------
migration_summary AS (
    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 01: Clients & Entities' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'clients, client_legal_entities tables & constraints' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: clients, client_legal_entities, unq_client_pan, indexes, Data API grants.' AS details
    FROM all_checks WHERE item_name IN ('clients', 'client_legal_entities', 'client_legal_entities (unq_client_pan)', 'idx_clients_status', 'idx_clients_code', 'idx_legal_entities_client')
    
    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 02: Locations & Policies' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'work_locations, departments, client_policies' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: work_locations, departments, client_policies, unq_client_dept_code, indexes.' AS details
    FROM all_checks WHERE item_name IN ('work_locations', 'departments', 'client_policies', 'departments (unq_client_dept_code)', 'idx_work_locations_client', 'idx_departments_client', 'idx_policies_client')

    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 03: Auth Profiles & RBAC' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'user_profiles, public.get_user_role, public.get_user_client_id, public.get_user_employee_id' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: user_profiles table, RBAC helper functions, indexes, execution grants.' AS details
    FROM all_checks WHERE item_name IN ('user_profiles', 'public.get_user_role()', 'public.get_user_client_id()', 'public.get_user_employee_id()', 'idx_user_profiles_role', 'idx_user_profiles_client', 'idx_user_profiles_employee')

    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 04: Employees & Salary' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'employees, employee_salary_structures, employee_bank_details' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: employees, salary structures, bank details, unq_client_employee_code, indexes.' AS details
    FROM all_checks WHERE item_name IN ('employees', 'employee_salary_structures', 'employee_bank_details', 'employees (unq_client_employee_code)', 'idx_employees_client', 'idx_salary_structures_emp', 'idx_bank_details_emp')

    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 05: Attendance Muster' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'attendance_events, daily_attendance_records, attendance_corrections' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: Raw events, aggregate muster, corrections, unq_emp_attendance_date, indexes.' AS details
    FROM all_checks WHERE item_name IN ('attendance_events', 'daily_attendance_records', 'attendance_corrections', 'daily_attendance_records (unq_emp_attendance_date)', 'idx_attendance_events_emp_time', 'idx_daily_attendance_date')

    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 06: Leave Management' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'leave_balances, leave_requests' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: leave_balances, leave_requests, unq_emp_leave_year_type, indexes.' AS details
    FROM all_checks WHERE item_name IN ('leave_balances', 'leave_requests', 'leave_balances (unq_emp_leave_year_type)', 'idx_leave_balances_emp', 'idx_leave_requests_client')

    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 07: Payroll & Payslips' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'payroll_runs, payroll_items, payslips' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: payroll batches, line items, Form XIX payslips, unq_client_period, indexes.' AS details
    FROM all_checks WHERE item_name IN ('payroll_runs', 'payroll_items', 'payslips', 'payroll_runs (unq_client_period)', 'payroll_items (unq_run_employee)', 'payslips (unq_emp_payslip_period)', 'idx_payroll_runs_client')

    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 08: Statutory & Audit' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'statutory_pt_slabs, statutory_holidays, audit_logs' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: PT slabs, holiday schedules, immutable audit log, Maharashtra seed data.' AS details
    FROM all_checks WHERE item_name IN ('statutory_pt_slabs', 'statutory_holidays', 'audit_logs', 'idx_pt_slabs_state', 'idx_audit_logs_client')

    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 09: RLS Policies' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        'RLS enabled on 17 tables + 33 security policies' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: Multi-tenant isolation, employee self-service rules, payroll security guards.' AS details
    FROM all_checks WHERE category = '08. RLS POLICIES'

    UNION ALL

    SELECT 
        '00. MIGRATIONS ROLLUP' AS category,
        'Migration 10: Triggers & Guards' AS item_name,
        'Migration Status' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS'
            WHEN count(*) FILTER (WHERE status = 'PASS') > 0 THEN 'PARTIAL'
            ELSE 'FAIL'
        END AS status,
        '5 guard functions + 8 database triggers' AS expected_value,
        'PASS: ' || count(*) FILTER (WHERE status = 'PASS') || ' | FAIL: ' || count(*) FILTER (WHERE status = 'FAIL') AS actual_value,
        'Objects: Locked payroll tamper triggers, immutable attendance telemetry, updated_at.' AS details
    FROM all_checks WHERE category IN ('10. TRIGGERS')
),

-- ------------------------------------------------------------------------------
-- 15. MASTER AUDIT SUMMARY (SINGLE AGGREGATE ROW)
-- ------------------------------------------------------------------------------
master_summary AS (
    SELECT 
        '00. MASTER AUDIT SUMMARY' AS category,
        'TOTAL POST-MIGRATION SCORE' AS item_name,
        'System Health & Verification' AS test_type,
        CASE 
            WHEN count(*) FILTER (WHERE status = 'FAIL') > 0 THEN 'FAIL'
            WHEN count(*) FILTER (WHERE status = 'WARNING') > 0 THEN 'WARNING'
            ELSE 'PASS'
        END AS status,
        '100% PASS on all database objects' AS expected_value,
        'PASSED: ' || count(*) FILTER (WHERE status = 'PASS') || 
        ' | FAILED: ' || count(*) FILTER (WHERE status = 'FAIL') || 
        ' | WARNINGS: ' || count(*) FILTER (WHERE status = 'WARNING') AS actual_value,
        'Total checks: ' || count(*) || 
        '. Passed: ' || count(*) FILTER (WHERE status = 'PASS') || 
        ', Failed: ' || count(*) FILTER (WHERE status = 'FAIL') || 
        ', Warnings: ' || count(*) FILTER (WHERE status = 'WARNING') || '.' AS details
    FROM all_checks
)

-- ------------------------------------------------------------------------------
-- FINAL UNIFIED QUERY RESULT SET
-- ------------------------------------------------------------------------------
SELECT category, item_name, test_type, status, expected_value, actual_value, details 
FROM master_summary

UNION ALL

SELECT category, item_name, test_type, status, expected_value, actual_value, details 
FROM migration_summary

UNION ALL

SELECT category, item_name, test_type, status, expected_value, actual_value, details 
FROM all_checks

ORDER BY category ASC, status DESC, item_name ASC;
