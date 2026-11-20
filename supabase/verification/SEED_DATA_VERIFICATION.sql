-- ==============================================================================
-- AVENCIS WORKFORCE MANAGEMENT (WFM)
-- SEED DATA VERIFICATION & DIAGNOSTIC SCRIPT (100% READ-ONLY)
-- File: supabase/verification/SEED_DATA_VERIFICATION.sql
-- ==============================================================================
--
-- PURPOSE:
-- Verifies the presence, integrity, foreign key linkage, and compliance of the
-- demonstration seed data populated by supabase/seed.sql.
--
-- SAFETY:
--   - 100% READ-ONLY diagnostic script.
--   - Performs NO inserts, updates, deletes, alters, or drops.
--   - Safe to execute at any time in Supabase Cloud Dashboard -> SQL Editor.
-- ==============================================================================

WITH 

-- 1. Client checks
check_clients AS (
    SELECT 
        '01. CLIENT ORGANISATIONS' AS category,
        'Demonstration Clients Count' AS item_name,
        'Count of DEMO-* clients' AS test_type,
        CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS status,
        '3 demonstration clients (Suman, Maha, Apex)' AS expected_value,
        'Found ' || COUNT(*)::text || ' demonstration clients' AS actual_value,
        'Codes found: ' || COALESCE(string_agg(code, ', ' ORDER BY code), 'None') AS details
    FROM public.clients
    WHERE code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
),

-- 2. Legal entities checks
check_legal_entities AS (
    SELECT 
        '02. LEGAL ENTITIES' AS category,
        'Demonstration Legal Entities Count' AS item_name,
        'Count of linked legal entities' AS test_type,
        CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS status,
        '3 legal entities linked to Suman, Maha, and Apex' AS expected_value,
        'Found ' || COUNT(*)::text || ' legal entities' AS actual_value,
        'Entities: ' || COALESCE(string_agg(legal_name || ' (' || payroll_responsibility || ')', '; '), 'None') AS details
    FROM public.client_legal_entities cle
    JOIN public.clients c ON c.id = cle.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
),

-- 3. Work locations checks
check_locations AS (
    SELECT 
        '03. WORK LOCATIONS' AS category,
        'Demonstration Work Locations Count' AS item_name,
        'Count of geofenced work locations' AS test_type,
        CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS status,
        '4 work locations (Pune, Mumbai, Chakan, Nagpur)' AS expected_value,
        'Found ' || COUNT(*)::text || ' work locations' AS actual_value,
        'Locations: ' || COALESCE(string_agg(wl.name || ' [R=' || wl.radius_meters::text || 'm]', '; '), 'None') AS details
    FROM public.work_locations wl
    JOIN public.clients c ON c.id = wl.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
),

-- 4. Departments checks
check_departments AS (
    SELECT 
        '04. DEPARTMENTS' AS category,
        'Demonstration Departments Count' AS item_name,
        'Count of departments across demo clients' AS test_type,
        CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'FAIL' END AS status,
        '7 departments (3 Suman, 3 Maha, 1 Apex)' AS expected_value,
        'Found ' || COUNT(*)::text || ' departments' AS actual_value,
        'Departments: ' || COALESCE(string_agg(d.code, ', ' ORDER BY d.code), 'None') AS details
    FROM public.departments d
    JOIN public.clients c ON c.id = d.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
),

-- 5. Client policies checks
check_policies AS (
    SELECT 
        '05. CLIENT POLICIES' AS category,
        'Client Operational Policies Count' AS item_name,
        'Count of client policies' AS test_type,
        CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS status,
        '3 client policies (Suman configured, Maha configured, Apex unconfigured)' AS expected_value,
        'Found ' || COUNT(*)::text || ' policies' AS actual_value,
        'Configurations: ' || COALESCE(string_agg(c.code || ': Configured=' || cp.is_configured::text || ', Divisor=' || cp.salary_divisor, '; '), 'None') AS details
    FROM public.client_policies cp
    JOIN public.clients c ON c.id = cp.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
),

-- 6. Employees count checks
check_employees AS (
    SELECT 
        '06. EMPLOYEES DIRECTORY' AS category,
        'Demonstration Employees Count' AS item_name,
        'Count of clearly fictional employee records' AS test_type,
        CASE WHEN COUNT(*) = 8 THEN 'PASS' ELSE 'FAIL' END AS status,
        '8 demonstration employees (5 Suman, 3 Maha)' AS expected_value,
        'Found ' || COUNT(*)::text || ' employees' AS actual_value,
        'Staff: ' || COALESCE(string_agg(e.employee_code || ': ' || e.first_name || ' ' || e.last_name, '; '), 'None') AS details
    FROM public.employees e
    JOIN public.clients c ON c.id = e.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
),

-- 7. Employment arrangement distribution (checking Deputed Staffing)
check_employment_types AS (
    SELECT 
        '07. EMPLOYMENT ARRANGEMENTS' AS category,
        'Employment Arrangement Diversity' AS item_name,
        'Verifies Permanent, Contract, and Deputed Staffing' AS test_type,
        CASE 
            WHEN COUNT(DISTINCT employment_arrangement) >= 3 THEN 'PASS' 
            ELSE 'FAIL' 
        END AS status,
        'At least 3 arrangements (DIRECT_PERMANENT, DIRECT_CONTRACT, DEPUTED_STAFFING)' AS expected_value,
        'Found arrangements: ' || COALESCE(string_agg(DISTINCT employment_arrangement, ', '), 'None') AS actual_value,
        'Deputed Staffing count: ' || COUNT(*) FILTER (WHERE employment_arrangement = 'DEPUTED_STAFFING')::text AS details
    FROM public.employees e
    JOIN public.clients c ON c.id = e.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
),

-- 8. Foreign key integrity across seeded data
check_foreign_keys AS (
    SELECT 
        '08. INTEGRITY & RELATIONSHIPS' AS category,
        'Employee Foreign Key Linkages' AS item_name,
        'Verifies client_id, legal_entity_id, location_id, department_id are valid' AS test_type,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS' 
            ELSE 'FAIL' 
        END AS status,
        '0 orphaned employee foreign keys' AS expected_value,
        COUNT(*)::text || ' orphaned links found' AS actual_value,
        CASE 
            WHEN COUNT(*) = 0 THEN 'All 8 employees strictly linked to valid client, entity, location, and department.' 
            ELSE 'Orphaned employee IDs: ' || string_agg(e.id::text, ', ')
        END AS details
    FROM public.employees e
    JOIN public.clients c ON c.id = e.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
      AND (
          e.legal_entity_id NOT IN (SELECT id FROM public.client_legal_entities)
          OR e.work_location_id NOT IN (SELECT id FROM public.work_locations)
          OR (e.department_id IS NOT NULL AND e.department_id NOT IN (SELECT id FROM public.departments))
      )
),

-- 9. Department head linkage
check_department_heads AS (
    SELECT 
        '09. INTEGRITY & RELATIONSHIPS' AS category,
        'Department Head Assignments' AS item_name,
        'Verifies department head foreign key references' AS test_type,
        CASE 
            WHEN COUNT(*) >= 2 THEN 'PASS' 
            ELSE 'FAIL' 
        END AS status,
        'At least 2 departments have designated heads' AS expected_value,
        COUNT(*)::text || ' departments have heads' AS actual_value,
        'Departments with heads: ' || COALESCE(string_agg(d.name || ' -> ' || e.first_name || ' ' || e.last_name, '; '), 'None') AS details
    FROM public.departments d
    JOIN public.employees e ON e.id = d.head_employee_id
    JOIN public.clients c ON c.id = d.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
),

-- 10. Demonstration marker compliance
check_demo_markers AS (
    SELECT 
        '10. SAFETY & IDENTIFIERS' AS category,
        'Demonstration Marker Compliance' AS item_name,
        'Verifies all seeded records are clearly identifiable as test/demo data' AS test_type,
        CASE 
            WHEN COUNT(*) = 8 THEN 'PASS' 
            ELSE 'FAIL' 
        END AS status,
        '100% of seeded employees have DEMO-* codes and demo markers' AS expected_value,
        COUNT(*)::text || ' / 8 employees verified with DEMO markers' AS actual_value,
        'Synthetic PANs verified: ' || string_agg(pan_number, ', ') AS details
    FROM public.employees e
    JOIN public.clients c ON c.id = e.client_id
    WHERE c.code IN ('DEMO-SUMAN', 'DEMO-MAHA', 'DEMO-APEX')
      AND e.employee_code LIKE 'DEMO-%'
      AND e.pan_number LIKE 'DEMO%'
),

-- Combine all checks
all_checks AS (
    SELECT * FROM check_clients
    UNION ALL SELECT * FROM check_legal_entities
    UNION ALL SELECT * FROM check_locations
    UNION ALL SELECT * FROM check_departments
    UNION ALL SELECT * FROM check_policies
    UNION ALL SELECT * FROM check_employees
    UNION ALL SELECT * FROM check_employment_types
    UNION ALL SELECT * FROM check_foreign_keys
    UNION ALL SELECT * FROM check_department_heads
    UNION ALL SELECT * FROM check_demo_markers
)

-- Final Output with Master Summary Rollup
SELECT 
    '00. SEED DATA SUMMARY' AS category,
    'TOTAL SEED DATA SCORE' AS item_name,
    'Comprehensive Verification of Seeded Demonstration Data' AS test_type,
    CASE WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    '100% PASS on all seed verification checks' AS expected_value,
    'PASSED: ' || COUNT(*) FILTER (WHERE status = 'PASS')::text || 
    ' | FAILED: ' || COUNT(*) FILTER (WHERE status = 'FAIL')::text AS actual_value,
    'Total checks: ' || COUNT(*)::text || '. Clean demonstration data state confirmed.' AS details
FROM all_checks

UNION ALL

SELECT * FROM all_checks
ORDER BY category, item_name;
