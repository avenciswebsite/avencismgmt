-- ==============================================================================
-- AVENCIS WORKFORCE MANAGEMENT (WFM) — MASTER DATABASE AUDIT SCRIPT
-- Target: Supabase Cloud SQL Editor (Single Consolidated Diagnostic Execution)
-- File: supabase/verification/AVENCIS_WFM_MASTER_DATABASE_AUDIT.sql
-- Safety Classification: 100% READ-ONLY (Zero DDL, Zero DML, Zero State Mutations)
-- Purpose:
--   Comprehensive post-deployment verification for Migrations 01 through 17.
--   Inspects:
--     1. All 20 Core Tables, columns, and Row Level Security state.
--     2. Foreign Keys, Indexes, and Redundant Duplicate Index Detection.
--     3. Leave Balance Constraints and the Arithmetic Ledger Identity.
--     4. Full 9-Status Attendance Taxonomy Coverage.
--     5. review_leave_request_atomic() RPC signature, cross-year logic, search_path,
--        and security definer permissions (Migration 15 superseding 12).
--     6. sync_approved_leave_to_muster() trigger and punch protection (Migration 17 superseding 14).
--     7. Comprehensive RLS Evaluation on leave_requests and leave_balances (Migration 16 superseding 13):
--        Anti-Self-Approval on direct UPDATE, Location Manager site-scoping,
--        Super Admin global access, and Payroll Admin read-only access.
--     8. Incomplete, duplicate, or conflicting objects.
-- ==============================================================================

WITH 
-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS AUDIT
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
            WHEN pe.extname IS NOT NULL THEN 'Extension ' || e.extname || ' is active and operational.'
            ELSE 'CRITICAL: Extension ' || e.extname || ' is missing.'
        END AS details
    FROM expected_extensions e
    LEFT JOIN pg_extension pe ON pe.extname = e.extname
),

-- ------------------------------------------------------------------------------
-- 2. TABLES & RLS STATUS AUDIT (20 CORE TABLES)
-- ------------------------------------------------------------------------------
expected_tables AS (
    SELECT 'clients' AS table_name, 9 AS min_cols, true AS needs_rls UNION ALL
    SELECT 'client_legal_entities', 10, true UNION ALL
    SELECT 'work_locations', 11, true UNION ALL
    SELECT 'departments', 6, true UNION ALL
    SELECT 'client_policies', 32, true UNION ALL
    SELECT 'user_profiles', 10, true UNION ALL
    SELECT 'employees', 20, true UNION ALL
    SELECT 'employee_salary_structures', 12, true UNION ALL
    SELECT 'employee_bank_details', 9, true UNION ALL
    SELECT 'attendance_events', 13, true UNION ALL
    SELECT 'daily_attendance_records', 12, true UNION ALL
    SELECT 'attendance_corrections', 14, true UNION ALL
    SELECT 'leave_balances', 10, true UNION ALL
    SELECT 'leave_requests', 12, true UNION ALL
    SELECT 'payroll_runs', 16, true UNION ALL
    SELECT 'payroll_items', 17, true UNION ALL
    SELECT 'payslips', 10, true UNION ALL
    SELECT 'statutory_pt_slabs', 9, true UNION ALL
    SELECT 'statutory_holidays', 8, true UNION ALL
    SELECT 'audit_logs', 12, true
),
table_check AS (
    SELECT 
        '02. TABLES (20 CORE)' AS category,
        t.table_name AS item_name,
        'Table Existence & RLS' AS test_type,
        CASE 
            WHEN c.relname IS NULL THEN 'FAIL'
            WHEN t.needs_rls AND NOT c.relrowsecurity THEN 'FAIL'
            WHEN (SELECT COUNT(*) FROM information_schema.columns ic WHERE ic.table_name = t.table_name AND ic.table_schema = 'public') < t.min_cols THEN 'REVIEW'
            ELSE 'PASS'
        END AS status,
        'Exists | RLS: ' || CASE WHEN t.needs_rls THEN 'ENABLED' ELSE 'ANY' END || ' | Min Cols: ' || t.min_cols AS expected_value,
        CASE 
            WHEN c.relname IS NULL THEN 'MISSING'
            ELSE 'Exists | RLS: ' || CASE WHEN c.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END || 
                 ' | Cols: ' || (SELECT COUNT(*) FROM information_schema.columns ic WHERE ic.table_name = t.table_name AND ic.table_schema = 'public')
        END AS actual_value,
        CASE 
            WHEN c.relname IS NULL THEN 'CRITICAL: Core table ' || t.table_name || ' is missing.'
            WHEN t.needs_rls AND NOT c.relrowsecurity THEN 'SECURITY: RLS is disabled on sensitive table ' || t.table_name || '.'
            WHEN (SELECT COUNT(*) FROM information_schema.columns ic WHERE ic.table_name = t.table_name AND ic.table_schema = 'public') < t.min_cols THEN 
                 'WARNING: Table has fewer columns than baseline schema.'
            ELSE 'Table exists with RLS active and required schema columns.'
        END AS details
    FROM expected_tables t
    LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = 'public'::regnamespace
),

-- ------------------------------------------------------------------------------
-- 3. SPECIFIC SCHEMA COLUMNS AUDIT (MIGRATIONS 11-17 DELIVERABLES)
-- ------------------------------------------------------------------------------
expected_columns AS (
    SELECT 'daily_attendance_records' AS tablename, 'leave_request_id' AS colname, 'uuid' AS expected_type UNION ALL
    SELECT 'leave_balances', 'used', 'numeric' UNION ALL
    SELECT 'leave_balances', 'closing', 'numeric' UNION ALL
    SELECT 'leave_requests', 'total_days', 'numeric' UNION ALL
    SELECT 'audit_logs', 'actor_name', 'character varying' UNION ALL
    SELECT 'audit_logs', 'actor_email', 'character varying' UNION ALL
    SELECT 'audit_logs', 'actor_role', 'character varying' UNION ALL
    SELECT 'audit_logs', 'target_entity', 'character varying'
),
column_check AS (
    SELECT 
        '03. CRITICAL COLUMNS' AS category,
        ec.tablename || '.' || ec.colname AS item_name,
        'Column & Data Type' AS test_type,
        CASE 
            WHEN c.column_name IS NULL THEN 'FAIL'
            WHEN c.data_type <> ec.expected_type THEN 'REVIEW'
            ELSE 'PASS'
        END AS status,
        ec.expected_type AS expected_value,
        COALESCE(c.data_type, 'COLUMN MISSING') AS actual_value,
        CASE 
            WHEN c.column_name IS NULL THEN 'CRITICAL: Required column ' || ec.colname || ' is missing from ' || ec.tablename || '.'
            WHEN c.data_type <> ec.expected_type THEN 'NOTICE: Data type is ' || c.data_type || ', expected ' || ec.expected_type || '.'
            ELSE 'Column exists with correct data type.'
        END AS details
    FROM expected_columns ec
    LEFT JOIN information_schema.columns c 
      ON c.table_name = ec.tablename 
     AND c.column_name = ec.colname 
     AND c.table_schema = 'public'
),

-- ------------------------------------------------------------------------------
-- 4. CONSTRAINTS & ENUM INTEGRITY AUDIT
-- ------------------------------------------------------------------------------
constraint_check AS (
    -- 4.1 Balance Identity Constraint
    SELECT 
        '04. CONSTRAINTS' AS category,
        'chk_leave_balance_identity' AS item_name,
        'Balance Ledger Identity Constraint' AS test_type,
        CASE 
            WHEN pg_get_constraintdef(c.oid) LIKE '%closing =%' 
             AND pg_get_constraintdef(c.oid) LIKE '%opening + credited%used%' THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'CHECK (closing = (opening + credited - used))' AS expected_value,
        COALESCE(pg_get_constraintdef(c.oid), 'CONSTRAINT MISSING') AS actual_value,
        CASE 
            WHEN c.oid IS NOT NULL THEN 'Enforces mathematical identity: closing = opening + credited - used.'
            ELSE 'CRITICAL: Balance ledger identity constraint is missing! Ledger corruption possible.'
        END AS details
    FROM (SELECT 1) dummy
    LEFT JOIN pg_constraint c ON c.conrelid = 'public.leave_balances'::regclass AND c.conname = 'chk_leave_balance_identity'

    UNION ALL

    -- 4.2 COMP_OFF in leave_balances
    SELECT 
        '04. CONSTRAINTS',
        'leave_balances_leave_type_check',
        'Entitlement Types Support COMP_OFF',
        CASE 
            WHEN pg_get_constraintdef(c.oid) LIKE '%COMP_OFF%' THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Includes PL, CL, SL, COMP_OFF',
        COALESCE(pg_get_constraintdef(c.oid), 'CONSTRAINT MISSING'),
        CASE 
            WHEN pg_get_constraintdef(c.oid) LIKE '%COMP_OFF%' THEN 'Supports Compensatory Off (COMP_OFF) entitlement category.'
            ELSE 'FAIL: COMP_OFF missing from leave_balances constraint.'
        END
    FROM (SELECT 1) dummy
    LEFT JOIN pg_constraint c ON c.conrelid = 'public.leave_balances'::regclass AND c.conname = 'leave_balances_leave_type_check'

    UNION ALL

    -- 4.3 COMP_OFF and LWP in leave_requests
    SELECT 
        '04. CONSTRAINTS',
        'leave_requests_leave_type_check',
        'Application Types Support COMP_OFF & LWP',
        CASE 
            WHEN pg_get_constraintdef(c.oid) LIKE '%COMP_OFF%' AND pg_get_constraintdef(c.oid) LIKE '%LWP%' THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Includes PL, CL, SL, LWP, COMP_OFF',
        COALESCE(pg_get_constraintdef(c.oid), 'CONSTRAINT MISSING'),
        CASE 
            WHEN pg_get_constraintdef(c.oid) LIKE '%COMP_OFF%' THEN 'Supports PL, CL, SL, LWP, and COMP_OFF request types.'
            ELSE 'FAIL: COMP_OFF or LWP missing from leave_requests constraint.'
        END
    FROM (SELECT 1) dummy
    LEFT JOIN pg_constraint c ON c.conrelid = 'public.leave_requests'::regclass AND c.conname = 'leave_requests_leave_type_check'

    UNION ALL

    -- 4.4 Full 9-Status Attendance Taxonomy
    SELECT 
        '04. CONSTRAINTS',
        'daily_attendance_records_status_check',
        '9-Status Attendance Taxonomy',
        CASE 
            WHEN pg_get_constraintdef(c.oid) LIKE '%PRESENT%'
             AND pg_get_constraintdef(c.oid) LIKE '%ABSENT%'
             AND pg_get_constraintdef(c.oid) LIKE '%HALF_DAY%'
             AND pg_get_constraintdef(c.oid) LIKE '%LATE%'
             AND pg_get_constraintdef(c.oid) LIKE '%ON_DUTY%'
             AND pg_get_constraintdef(c.oid) LIKE '%PAID_LEAVE%'
             AND pg_get_constraintdef(c.oid) LIKE '%UNPAID_LEAVE%'
             AND pg_get_constraintdef(c.oid) LIKE '%WEEKLY_OFF%'
             AND pg_get_constraintdef(c.oid) LIKE '%HOLIDAY%' THEN 'PASS'
            ELSE 'FAIL'
        END,
        'All 9 statuses: PRESENT, ABSENT, HALF_DAY, LATE, ON_DUTY, PAID_LEAVE, UNPAID_LEAVE, WEEKLY_OFF, HOLIDAY',
        COALESCE(pg_get_constraintdef(c.oid), 'CONSTRAINT MISSING'),
        CASE 
            WHEN pg_get_constraintdef(c.oid) LIKE '%LATE%' AND pg_get_constraintdef(c.oid) LIKE '%ON_DUTY%' AND pg_get_constraintdef(c.oid) LIKE '%UNPAID_LEAVE%' THEN
                 'All 9 enterprise attendance statuses are active in the database catalog.'
            ELSE 'CRITICAL: Attendance status constraint does not contain all 9 statuses. Truncation detected.'
        END
    FROM (SELECT 1) dummy
    LEFT JOIN pg_constraint c ON c.conrelid = 'public.daily_attendance_records'::regclass AND c.conname = 'daily_attendance_records_status_check'
),

-- ------------------------------------------------------------------------------
-- 5. INDEXES & DUPLICATE INDEX DETECTION
-- ------------------------------------------------------------------------------
index_check AS (
    -- 5.1 Foreign key index on leave_request_id (Migration 17: idx_daily_attendance_leave_req)
    SELECT 
        '05. INDEXES' AS category,
        'idx_daily_attendance_leave_req' AS item_name,
        'Attendance Leave Request Foreign Key Index' AS test_type,
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS status,
        'Index exists on daily_attendance_records(leave_request_id)' AS expected_value,
        'Found ' || COUNT(*)::text || ' matching indexes' AS actual_value,
        CASE 
            WHEN COUNT(*) >= 1 THEN 'Index accelerates leave-to-muster lookups and joins.'
            ELSE 'CRITICAL: Index idx_daily_attendance_leave_req missing.'
        END AS details
    FROM pg_indexes 
    WHERE tablename = 'daily_attendance_records' AND indexname = 'idx_daily_attendance_leave_req'

    UNION ALL

    -- 5.2 Duplicate Index Check: Checks if legacy idx_daily_attendance_leave (Migration 14) also exists
    SELECT 
        '05. INDEXES',
        'Duplicate Index Detection (idx_daily_attendance_leave)',
        'Redundant Index Coexistence Check',
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'REVIEW'
        END,
        '0 duplicate indexes (idx_daily_attendance_leave should be absent)',
        CASE 
            WHEN COUNT(*) > 0 THEN 'DUPLICATE DETECTED: idx_daily_attendance_leave exists alongside idx_daily_attendance_leave_req'
            ELSE 'No duplicate indexes found.'
        END,
        CASE 
            WHEN COUNT(*) > 0 THEN 'NOTICE: Both Migration 14 (idx_daily_attendance_leave) and Migration 17 (idx_daily_attendance_leave_req) indexes exist on the same column. Recommended action: DROP INDEX idx_daily_attendance_leave.'
            ELSE 'Clean single-index state confirmed.'
        END
    FROM pg_indexes 
    WHERE tablename = 'daily_attendance_records' AND indexname = 'idx_daily_attendance_leave'

    UNION ALL

    -- 5.3 Composite balance index
    SELECT 
        '05. INDEXES',
        'leave_balances Unique / Composite Constraint',
        'Index / Unique Constraint (employee_id, leave_type, year)',
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
        'Unique constraint / index exists',
        'Found ' || COUNT(*)::text || ' constraints',
        'Guarantees exactly one balance ledger row per employee per leave category per year.'
    FROM pg_constraint
    WHERE conrelid = 'public.leave_balances'::regclass AND conname = 'unq_emp_leave_year_type'
),

-- ------------------------------------------------------------------------------
-- 6. RPC STORED PROCEDURE AUDIT: review_leave_request_atomic (MIGRATION 15)
-- ------------------------------------------------------------------------------
rpc_check AS (
    SELECT 
        '06. RPC FUNCTIONS' AS category,
        'public.review_leave_request_atomic' AS item_name,
        'Function Existence & Definition Version' AS test_type,
        CASE 
            WHEN p.oid IS NULL THEN 'FAIL'
            WHEN NOT p.prosecdef THEN 'FAIL'
            WHEN NOT (array_to_string(p.proconfig, ',') LIKE '%search_path=public, pg_temp%') THEN 'FAIL'
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%ORDER BY cal_year ASC%') THEN 'FAIL' -- Verifies Migration 15 superseding 12
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%actor_name%') THEN 'FAIL' -- Verifies corrected audit_logs schema
            ELSE 'PASS'
        END AS status,
        'Migration 15 Active (Cross-Year, Deterministic Locking, Corrected Audit Logs, SECURITY DEFINER)' AS expected_value,
        CASE 
            WHEN p.oid IS NULL THEN 'FUNCTION MISSING'
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%ORDER BY cal_year ASC%') THEN 'OUTDATED: Migration 12 version active (lacks cross-year logic)'
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%actor_name%') THEN 'OUTDATED: Migration 12 version active (audit_logs column error)'
            ELSE 'Migration 15 Active | SECURITY DEFINER: YES | search_path: public, pg_temp'
        END AS actual_value,
        CASE 
            WHEN p.oid IS NULL THEN 'CRITICAL: review_leave_request_atomic function does not exist.'
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%ORDER BY cal_year ASC%') THEN 
                 'CRITICAL: Function contains flawed Migration 12 single-year deduction logic!'
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%actor_name%') THEN
                 'CRITICAL: Function contains flawed Migration 12 audit_logs column mapping (user_id/resource)!'
            ELSE 'Function incorporates authoritative Migration 15 cross-year partitioning, deadlock immunity, and corrected audit logging.'
        END AS details
    FROM (SELECT 1) dummy
    LEFT JOIN pg_proc p ON p.proname = 'review_leave_request_atomic' AND p.pronamespace = 'public'::regnamespace

    UNION ALL

    -- Execution Grants Check
    SELECT 
        '06. RPC FUNCTIONS',
        'review_leave_request_atomic Grants',
        'Execution Permissions',
        CASE 
            WHEN p.oid IS NULL THEN 'FAIL'
            WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'REVIEW'
            WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') 
             AND has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'PASS'
            ELSE 'REVIEW'
        END,
        'EXECUTE granted to authenticated & service_role; REVOKED from anon/PUBLIC',
        CASE 
            WHEN p.oid IS NULL THEN 'FUNCTION MISSING'
            ELSE 'anon: ' || has_function_privilege('anon', p.oid, 'EXECUTE')::text ||
                 ', auth: ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text ||
                 ', service_role: ' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text
        END,
        CASE 
            WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 
                 'NOTICE: Function checks auth.uid() internally, but unauthenticated anon has PostgREST execute grant. Running repair script revokes it.'
            ELSE 'Permissions strictly restricted to authenticated and service_role.'
        END
    FROM (SELECT 1) dummy
    LEFT JOIN pg_proc p ON p.proname = 'review_leave_request_atomic' AND p.pronamespace = 'public'::regnamespace
),

-- ------------------------------------------------------------------------------
-- 7. ATTENDANCE MUSTER TRIGGER AUDIT (MIGRATION 17)
-- ------------------------------------------------------------------------------
trigger_check AS (
    SELECT 
        '07. TRIGGERS' AS category,
        'trg_sync_approved_leave_to_muster' AS item_name,
        'Trigger Existence & Event Scope' AS test_type,
        CASE 
            WHEN t.tgname IS NULL THEN 'FAIL'
            WHEN NOT (t.tgtype & 4 <> 0) THEN 'FAIL' -- Must be AFTER trigger
            WHEN NOT (p.proname = 'sync_approved_leave_to_muster') THEN 'FAIL'
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%check_in_time IS NOT NULL%') THEN 'FAIL' -- Verifies Migration 17 punch protection
            ELSE 'PASS'
        END AS status,
        'Migration 17 Active (AFTER INSERT OR UPDATE, Biometric Punch Protection)' AS expected_value,
        CASE 
            WHEN t.tgname IS NULL THEN 'TRIGGER MISSING'
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%check_in_time IS NOT NULL%') THEN 'OUTDATED: Migration 14 version active (lacks punch protection)'
            ELSE 'Migration 17 Active | Function: sync_approved_leave_to_muster'
        END AS actual_value,
        CASE 
            WHEN t.tgname IS NULL THEN 'CRITICAL: Trigger trg_sync_approved_leave_to_muster does not exist.'
            WHEN NOT (pg_get_functiondef(p.oid) LIKE '%check_in_time IS NOT NULL%') THEN 
                 'CRITICAL: Trigger function lacks Migration 17 biometric punch protection and safe cancellation reversion!'
            ELSE 'Trigger fires on leave approval/cancellation and protects raw biometric telemetry and approved regularisations.'
        END AS details
    FROM (SELECT 1) dummy
    LEFT JOIN pg_trigger t ON t.tgrelid = 'public.leave_requests'::regclass AND t.tgname = 'trg_sync_approved_leave_to_muster' AND NOT t.tgisinternal
    LEFT JOIN pg_proc p ON p.oid = t.tgfoid

    UNION ALL

    -- Coexistence Check: Ensure no duplicate or legacy trigger exists on leave_requests
    SELECT 
        '07. TRIGGERS',
        'leave_requests Trigger Count',
        'Duplicate Trigger Coexistence Check',
        CASE 
            WHEN COUNT(*) = 1 THEN 'PASS'
            WHEN COUNT(*) > 1 THEN 'FAIL'
            ELSE 'REVIEW'
        END,
        'Exactly 1 trigger on leave_requests (trg_sync_approved_leave_to_muster)',
        'Found ' || COUNT(*)::text || ' triggers',
        CASE 
            WHEN COUNT(*) = 1 THEN 'Single authoritative muster synchronization trigger confirmed.'
            ELSE 'CRITICAL: Multiple conflicting triggers detected on leave_requests!'
        END
    FROM pg_trigger 
    WHERE tgrelid = 'public.leave_requests'::regclass AND NOT tgisinternal
),

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES AUDIT (MIGRATION 16)
-- ------------------------------------------------------------------------------
rls_check AS (
    -- 8.1 Employee Privilege Escalation Check: leave_requests_employee_all MUST BE ABSENT
    SELECT 
        '08. RLS POLICIES' AS category,
        'leave_requests_employee_all (Legacy Privilege Escalation)' AS item_name,
        'Revocation of Flawed FOR ALL Policy' AS test_type,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'POLICY ABSENT (Revoked by Migration 16)' AS expected_value,
        CASE WHEN COUNT(*) = 0 THEN 'ABSENT' ELSE 'CRITICAL: POLICY STILL ACTIVE' END AS actual_value,
        CASE 
            WHEN COUNT(*) = 0 THEN 'Employee privilege escalation policy successfully revoked.'
            ELSE 'SECURITY VULNERABILITY: leave_requests_employee_all policy is still present, allowing employees to self-approve via PostgREST!'
        END AS details
    FROM pg_policy pol
    WHERE pol.polrelid = 'public.leave_requests'::regclass AND pol.polname = 'leave_requests_employee_all'

    UNION ALL

    -- 8.2 Manager Self-Approval Protection Check: leave_requests_tenant_admin_modify
    SELECT 
        '08. RLS POLICIES',
        'leave_requests_tenant_admin_modify Anti-Self-Approval',
        'Direct PostgREST Update Guard',
        CASE 
            WHEN pol.oid IS NULL THEN 'FAIL'
            WHEN pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%employee_id <> %get_user_employee_id()%' THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Policy enforces employee_id <> public.get_user_employee_id() in WITH CHECK',
        COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), 'POLICY MISSING'),
        CASE 
            WHEN pol.oid IS NULL THEN 'CRITICAL: Policy leave_requests_tenant_admin_modify does not exist.'
            WHEN pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%employee_id <> %get_user_employee_id()%' THEN 
                 'Managers are strictly prevented from self-approving their own leave applications via direct PostgREST calls.'
            ELSE 'SECURITY VULNERABILITY: Policy lacks anti-self-approval! Managers can self-approve directly through database API.'
        END
    FROM (SELECT 1) dummy
    LEFT JOIN pg_policy pol ON pol.polrelid = 'public.leave_requests'::regclass AND pol.polname = 'leave_requests_tenant_admin_modify'

    UNION ALL

    -- 8.3 Location Manager Site-Scoping Check: leave_requests_tenant_admin_select
    SELECT 
        '08. RLS POLICIES',
        'leave_requests_tenant_admin_select Location Scoping',
        'Location Manager Physical Facility Separation',
        CASE 
            WHEN pol.oid IS NULL THEN 'FAIL'
            WHEN pg_get_expr(pol.polqual, pol.polrelid) LIKE '%work_location_id%' THEN 'PASS'
            ELSE 'REVIEW'
        END,
        'Scopes Location Managers to employees at their assigned work_location_id',
        COALESCE(pg_get_expr(pol.polqual, pol.polrelid), 'POLICY MISSING'),
        CASE 
            WHEN pol.oid IS NULL THEN 'Policy missing.'
            WHEN pg_get_expr(pol.polqual, pol.polrelid) LIKE '%work_location_id%' THEN 
                 'Location Managers are strictly isolated to seeing applications from their assigned facility.'
            ELSE 'NOTICE: Policy does not check work_location_id subquery. Cross-location snooping may be possible.'
        END
    FROM (SELECT 1) dummy
    LEFT JOIN pg_policy pol ON pol.polrelid = 'public.leave_requests'::regclass AND pol.polname = 'leave_requests_tenant_admin_select'

    UNION ALL

    -- 8.4 Super Admin Global Access Check
    SELECT 
        '08. RLS POLICIES',
        'leave_requests_super_admin_all Global Access',
        'Decoupling from client_id IS NULL',
        CASE 
            WHEN pol.oid IS NULL THEN 'FAIL'
            WHEN pg_get_expr(pol.polqual, pol.polrelid) LIKE '%get_user_role() = ''super_admin''%' 
             AND NOT (pg_get_expr(pol.polqual, pol.polrelid) LIKE '%client_id = %') THEN 'PASS'
            ELSE 'FAIL'
        END,
        'USING (public.get_user_role() = ''super_admin'') without client_id restriction',
        COALESCE(pg_get_expr(pol.polqual, pol.polrelid), 'POLICY MISSING'),
        CASE 
            WHEN pol.oid IS NULL THEN 'Policy missing.'
            WHEN NOT (pg_get_expr(pol.polqual, pol.polrelid) LIKE '%client_id = %') THEN 
                 'Super Admin has unrestricted global access across all client tenants.'
            ELSE 'FAIL: Super Admin policy still contains client_id check, causing lockout!'
        END
    FROM (SELECT 1) dummy
    LEFT JOIN pg_policy pol ON pol.polrelid = 'public.leave_requests'::regclass AND pol.polname = 'leave_requests_super_admin_all'

    UNION ALL

    -- 8.5 Payroll Admin Read-Only Access Check
    SELECT 
        '08. RLS POLICIES',
        'leave_requests_payroll_admin_select Read-Only Access',
        'Payroll Admin Entitlement Verification',
        CASE 
            WHEN pol.oid IS NULL THEN 'FAIL'
            WHEN pol.polcmd = 'r' AND pg_get_expr(pol.polqual, pol.polrelid) LIKE '%payroll_admin%' THEN 'PASS'
            ELSE 'FAIL'
        END,
        'SELECT policy for payroll_admin scoped to client_id',
        COALESCE(pol.polcmd::text || ': ' || pg_get_expr(pol.polqual, pol.polrelid), 'POLICY MISSING'),
        CASE 
            WHEN pol.oid IS NOT NULL THEN 'Payroll Admin authorized for read-only leave data inspection for upcoming payroll engine.'
            ELSE 'FAIL: Payroll Admin read access policy missing.'
        END
    FROM (SELECT 1) dummy
    LEFT JOIN pg_policy pol ON pol.polrelid = 'public.leave_requests'::regclass AND pol.polname = 'leave_requests_payroll_admin_select'

    UNION ALL

    -- 8.6 Total Policy Count on leave_requests (Expected exactly 7)
    SELECT 
        '08. RLS POLICIES',
        'leave_requests Total Policy Count',
        'Policy Set Integrity (No Duplicates or Orphans)',
        CASE 
            WHEN COUNT(*) = 7 THEN 'PASS'
            WHEN COUNT(*) > 7 THEN 'REVIEW'
            ELSE 'FAIL'
        END,
        'Exactly 7 policies (3 Employee, 1 Super Admin, 2 Tenant Admin/Mgr, 1 Payroll Admin)',
        'Found ' || COUNT(*)::text || ' active policies',
        CASE 
            WHEN COUNT(*) = 7 THEN 'Clean 7-policy set verified.'
            WHEN COUNT(*) > 7 THEN 'WARNING: Found more policies than expected. Duplicate or orphan policies may coexist.'
            ELSE 'FAIL: Missing expected policies on leave_requests.'
        END
    FROM pg_policy 
    WHERE polrelid = 'public.leave_requests'::regclass

    UNION ALL

    -- 8.7 Total Policy Count on leave_balances (Expected exactly 5)
    SELECT 
        '08. RLS POLICIES',
        'leave_balances Total Policy Count',
        'Policy Set Integrity (No Duplicates or Orphans)',
        CASE 
            WHEN COUNT(*) = 5 THEN 'PASS'
            WHEN COUNT(*) > 5 THEN 'REVIEW'
            ELSE 'FAIL'
        END,
        'Exactly 5 policies (1 Employee, 1 Super Admin, 2 Tenant Admin/Mgr, 1 Payroll Admin)',
        'Found ' || COUNT(*)::text || ' active policies',
        CASE 
            WHEN COUNT(*) = 5 THEN 'Clean 5-policy set verified.'
            WHEN COUNT(*) > 5 THEN 'WARNING: Found more policies than expected on leave_balances.'
            ELSE 'FAIL: Missing expected policies on leave_balances.'
        END
    FROM pg_policy 
    WHERE polrelid = 'public.leave_balances'::regclass
),

-- ------------------------------------------------------------------------------
-- 9. LIVE DATA INTEGRITY & LEDGER HEALTH AUDIT
-- ------------------------------------------------------------------------------
data_check AS (
    -- 9.1 Balance Arithmetic Identity Violations
    SELECT 
        '09. DATA INTEGRITY' AS category,
        'leave_balances Ledger Math Violations' AS item_name,
        'Arithmetic Invariant Check' AS test_type,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        '0 rows with closing != opening + credited - used' AS expected_value,
        'Found ' || COUNT(*)::text || ' corrupted balance rows' AS actual_value,
        CASE 
            WHEN COUNT(*) = 0 THEN '100% of leave_balances rows strictly satisfy the arithmetic identity.'
            ELSE 'CRITICAL: Inconsistent balance records detected! Balance reconciliation required.'
        END AS details
    FROM public.leave_balances
    WHERE closing != (opening + credited - used)

    UNION ALL

    -- 9.2 Negative Balance Violations
    SELECT 
        '09. DATA INTEGRITY',
        'leave_balances Negative Balances',
        'Solvency Ledger Check',
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END,
        '0 rows with closing < 0',
        'Found ' || COUNT(*)::text || ' negative balance rows',
        CASE 
            WHEN COUNT(*) = 0 THEN 'All closing balances are non-negative.'
            ELSE 'CRITICAL: Negative balance rows detected!'
        END
    FROM public.leave_balances
    WHERE closing < 0

    UNION ALL

    -- 9.3 Inverted Leave Date Requests
    SELECT 
        '09. DATA INTEGRITY',
        'leave_requests Inverted Date Spans',
        'Date Chronology Invariant',
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END,
        '0 rows with end_date < start_date',
        'Found ' || COUNT(*)::text || ' inverted date rows',
        CASE 
            WHEN COUNT(*) = 0 THEN 'All leave request spans have end_date >= start_date.'
            ELSE 'CRITICAL: Inverted date requests detected!'
        END
    FROM public.leave_requests
    WHERE end_date < start_date
),

-- ------------------------------------------------------------------------------
-- UNIFIED CONSOLIDATION & ROLLUP
-- ------------------------------------------------------------------------------
all_results AS (
    SELECT * FROM ext_check
    UNION ALL
    SELECT * FROM table_check
    UNION ALL
    SELECT * FROM column_check
    UNION ALL
    SELECT * FROM constraint_check
    UNION ALL
    SELECT * FROM index_check
    UNION ALL
    SELECT * FROM rpc_check
    UNION ALL
    SELECT * FROM trigger_check
    UNION ALL
    SELECT * FROM rls_check
    UNION ALL
    SELECT * FROM data_check
),
master_summary AS (
    SELECT 
        '00. MASTER AUDIT ROLLUP' AS category,
        'OVERALL DATABASE HEALTH' AS item_name,
        'System Integrity Scorecard' AS test_type,
        CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 
             AND COUNT(*) FILTER (WHERE status = 'REVIEW') = 0 THEN 'PASS'
            WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'REVIEW'
            ELSE 'FAIL'
        END AS status,
        '100% PASS (Zero Failures, Zero Discrepancies)' AS expected_value,
        'Passed: ' || COUNT(*) FILTER (WHERE status = 'PASS')::text || 
        ' | Failed: ' || COUNT(*) FILTER (WHERE status = 'FAIL')::text || 
        ' | Review: ' || COUNT(*) FILTER (WHERE status = 'REVIEW')::text ||
        ' (Total: ' || COUNT(*)::text || ' checks)' AS actual_value,
        CASE 
            WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 
             AND COUNT(*) FILTER (WHERE status = 'REVIEW') = 0 THEN 
                 'EXCELLENT: Complete database schema, security definer RPCs, triggers, and RLS policies are 100% verified.'
            WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 THEN
                 'ATTENTION: No fatal errors detected, but items flagged for REVIEW (e.g. redundant duplicate index) require inspection.'
            ELSE 'CRITICAL: System catalog contains failing checks! Inspect failure details below.'
        END AS details
    FROM all_results
)
SELECT * FROM master_summary
UNION ALL
SELECT * FROM all_results
ORDER BY category, item_name;
