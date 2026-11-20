-- ==============================================================================
-- AVENCIS WORKFORCE MANAGEMENT (WFM)
-- DATABASE SEED SCRIPT (DEMONSTRATION & FOUNDATION DATA)
-- File: supabase/seed.sql
-- ==============================================================================
--
-- PURPOSE:
-- Populates foundational demonstration data for 3 fictional client organisations:
--   1. Suman Technologies & Retail (Active client, standard policy, retail/IT)
--   2. Maha India Logistics & Fleet (Active client, flat-rate OT, transport/fleet)
--   3. Apex Precision Engineering (Onboarding client, unconfigured policy)
--
-- SAFETY & RESTRICTIONS:
--   - 100% IDEMPOTENT: Uses deterministic UUIDs and ON CONFLICT DO UPDATE.
--   - DEMO DATA ONLY: All records have clear demonstration markers (DEMO-*, [Demo]).
--   - NO PAYROLL SEEDING: No payroll runs, payslips, or salary amounts are seeded.
--   - NO DIRECT AUTH INJECTION: Does not insert into auth.users or user_profiles.
--   - NON-DESTRUCTIVE: Contains no TRUNCATE, DROP, or unconstrained DELETE statements.
--   - TRANSACTION PROTECTED: All statements run inside an atomic transaction block.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. DEMONSTRATION CLIENT ORGANISATIONS (clients)
-- ==============================================================================
-- Stable UUIDs:
--   Suman: 10000000-0000-0000-0000-000000000001
--   Maha:  10000000-0000-0000-0000-000000000002
--   Apex:  10000000-0000-0000-0000-000000000003

INSERT INTO public.clients (
    id,
    code,
    name,
    industry,
    status,
    contact_person,
    contact_email,
    contact_phone,
    created_at,
    updated_at
) VALUES 
    (
        '10000000-0000-0000-0000-000000000001'::uuid,
        'DEMO-SUMAN',
        'Suman Technologies & Retail [Demo]',
        'Retail & Technology Solutions',
        'active',
        'Suresh Patil [Demo]',
        'demo.spatil@suman-demo.test',
        '+91 99999 00001',
        NOW(),
        NOW()
    ),
    (
        '10000000-0000-0000-0000-000000000002'::uuid,
        'DEMO-MAHA',
        'Maha India Logistics & Fleet [Demo]',
        'Logistics, Fleet & Supply Chain',
        'active',
        'Vikram Deshmukh [Demo]',
        'demo.vdeshmukh@mahaindia-demo.test',
        '+91 99999 00002',
        NOW(),
        NOW()
    ),
    (
        '10000000-0000-0000-0000-000000000003'::uuid,
        'DEMO-APEX',
        'Apex Precision Engineering [Demo]',
        'Automotive & Heavy Manufacturing',
        'onboarding',
        'Rajiv Mehra [Demo]',
        'demo.rmehra@apexengg-demo.test',
        '+91 99999 00003',
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    industry = EXCLUDED.industry,
    status = EXCLUDED.status,
    contact_person = EXCLUDED.contact_person,
    contact_email = EXCLUDED.contact_email,
    contact_phone = EXCLUDED.contact_phone,
    updated_at = NOW();


-- ==============================================================================
-- 2. DEMONSTRATION CLIENT LEGAL ENTITIES (client_legal_entities)
-- ==============================================================================
-- Models legal employer of record and payroll responsibility:
--   Suman: SELF_MANAGED
--   Maha:  SELF_MANAGED
--   Apex:  AVENCIS_MANAGED (Demonstrates Avencis-managed payroll model)

INSERT INTO public.client_legal_entities (
    id,
    client_id,
    legal_name,
    trade_name,
    registration_type,
    registration_number,
    pan,
    tan,
    gstin,
    pf_establishment_code,
    esic_registration_code,
    registered_address,
    payroll_responsibility,
    is_primary,
    created_at
) VALUES 
    (
        '20000000-0000-0000-0000-000000000001'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        'Suman Technologies Private Limited [Demo]',
        'Suman Tech & Retail',
        'PRIVATE_LIMITED',
        'U72900PN2021PTC199821-DEMO',
        'DEMOPS1234',
        'PUNS12345D',
        '27DEMOPS1234F1Z',
        'MH/PUN/0045678/DEMO',
        '31000567890001DEMO',
        'Floor 4, Tower B, Cyber City, Magarpatta, Pune, Maharashtra 411028 (Demonstration Address)',
        'SELF_MANAGED',
        TRUE,
        NOW()
    ),
    (
        '20000000-0000-0000-0000-000000000002'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        'Maha India Logistics (India) Pvt Ltd [Demo]',
        'Maha India Fleet',
        'PRIVATE_LIMITED',
        'U60200MH2019PTC184420-DEMO',
        'DEMOPM9876',
        'PUNM98765E',
        '27DEMOPM9876K1Z',
        'MH/PUN/0089123/DEMO',
        '31000987650002DEMO',
        'Gate No. 142, MIDC Chakan Industrial Zone, Pune, Maharashtra 410501 (Demonstration Address)',
        'SELF_MANAGED',
        TRUE,
        NOW()
    ),
    (
        '20000000-0000-0000-0000-000000000003'::uuid,
        '10000000-0000-0000-0000-000000000003'::uuid,
        'Apex Precision Engineering LLP [Demo]',
        'Apex Precision',
        'LLP',
        'AAA-9999-DEMO',
        'DEMOPA5544',
        'PUNA55443F',
        '27DEMOPA5544L1Z',
        'MH/PUN/0099887/DEMO',
        '31000998870003DEMO',
        'Plot 18, Phase 2, Bhosari Industrial Area, Pune, Maharashtra 411026 (Demonstration Address)',
        'AVENCIS_MANAGED',
        TRUE,
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    legal_name = EXCLUDED.legal_name,
    trade_name = EXCLUDED.trade_name,
    registration_type = EXCLUDED.registration_type,
    registration_number = EXCLUDED.registration_number,
    pan = EXCLUDED.pan,
    tan = EXCLUDED.tan,
    gstin = EXCLUDED.gstin,
    pf_establishment_code = EXCLUDED.pf_establishment_code,
    esic_registration_code = EXCLUDED.esic_registration_code,
    registered_address = EXCLUDED.registered_address,
    payroll_responsibility = EXCLUDED.payroll_responsibility,
    is_primary = EXCLUDED.is_primary;


-- ==============================================================================
-- 3. DEMONSTRATION WORK LOCATIONS WITH GEOFENCES (work_locations)
-- ==============================================================================
-- 4 Geofenced sites across Pune, Mumbai, and Nagpur:
--   Suman Pune HQ:       18.5913 N, 73.7389 E, Radius 150m
--   Suman Mumbai BKC:    19.0664 N, 72.8682 E, Radius 200m
--   Maha Chakan Depot:   18.7618 N, 73.8542 E, Radius 250m
--   Maha Nagpur Freight: 21.0538 N, 79.0384 E, Radius 300m

INSERT INTO public.work_locations (
    id,
    client_id,
    name,
    code,
    address,
    state,
    latitude,
    longitude,
    radius_meters,
    active_headcount,
    created_at
) VALUES 
    (
        '30000000-0000-0000-0000-000000000001'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        'Suman HQ — Pune Technology Park [Demo]',
        'LOC_DEMO_S_PUN',
        'Hinjawadi Phase 1, Pune, Maharashtra 411057',
        'Maharashtra',
        18.5913,
        73.7389,
        150,
        3,
        NOW()
    ),
    (
        '30000000-0000-0000-0000-000000000002'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        'Suman Retail Hub — BKC Mumbai [Demo]',
        'LOC_DEMO_S_BOM',
        'G Block, Bandra Kurla Complex, Mumbai, Maharashtra 400051',
        'Maharashtra',
        19.0664,
        72.8682,
        200,
        2,
        NOW()
    ),
    (
        '30000000-0000-0000-0000-000000000003'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        'Maha Chakan Central Depot [Demo]',
        'LOC_DEMO_M_CHK',
        'Chakan Phase 2, Pune, Maharashtra 410501',
        'Maharashtra',
        18.7618,
        73.8542,
        250,
        2,
        NOW()
    ),
    (
        '30000000-0000-0000-0000-000000000004'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        'Maha Nagpur Freight Terminal [Demo]',
        'LOC_DEMO_M_NAG',
        'MIHAN SEZ, Nagpur, Maharashtra 441108',
        'Maharashtra',
        21.0538,
        79.0384,
        300,
        1,
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    address = EXCLUDED.address,
    state = EXCLUDED.state,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    radius_meters = EXCLUDED.radius_meters,
    active_headcount = EXCLUDED.active_headcount;


-- ==============================================================================
-- 4. DEMONSTRATION DEPARTMENTS (departments)
-- ==============================================================================
-- 7 Functional departments across the 3 clients:

INSERT INTO public.departments (
    id,
    client_id,
    name,
    code,
    head_employee_id,
    created_at
) VALUES 
    (
        '40000000-0000-0000-0000-000000000001'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        'Operations & Delivery [Demo]',
        'DEMO_S_OPS',
        NULL,
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000002'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        'Software Engineering [Demo]',
        'DEMO_S_ENG',
        NULL,
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000003'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        'Finance & Accounts [Demo]',
        'DEMO_S_FIN',
        NULL,
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000004'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        'Fleet Operations [Demo]',
        'DEMO_M_FLT',
        NULL,
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000005'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        'Warehouse & Yard [Demo]',
        'DEMO_M_WH',
        NULL,
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000006'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        'Dispatch & Routing [Demo]',
        'DEMO_M_DSP',
        NULL,
        NOW()
    ),
    (
        '40000000-0000-0000-0000-000000000007'::uuid,
        '10000000-0000-0000-0000-000000000003'::uuid,
        'Plant Engineering [Demo]',
        'DEMO_A_PLT',
        NULL,
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code;


-- ==============================================================================
-- 5. DEMONSTRATION CLIENT OPERATIONAL POLICIES (client_policies)
-- ==============================================================================
-- Policy configurations for each client:
--   Suman: Configured (1.5x OT multiplier, Divisor 30, strict geofence)
--   Maha:  Configured (Flat-rate Rs 120/hr OT, Divisor 26, selfie required)
--   Apex:  Unconfigured (Demonstrates system safety gating before onboarding)

INSERT INTO public.client_policies (
    id,
    client_id,
    is_configured,
    overtime_method,
    overtime_rate,
    late_grace_minutes,
    late_penalty_rule,
    overnight_shift_attribution,
    standard_working_hours,
    half_day_hours,
    weekly_off_days,
    attendance_tracking_mode,
    require_gps,
    require_selfie,
    enforce_strict_geofence,
    leave_types_supported,
    min_service_days_for_leave,
    monthly_paid_leave_accrual,
    max_carry_forward,
    allow_leave_encashment,
    unpaid_leave_deduction_formula,
    salary_divisor,
    pf_enabled,
    pf_employee_percent,
    pf_employer_percent,
    esic_enabled,
    esic_employee_percent,
    esic_employer_percent,
    pt_enabled,
    tds_enabled,
    updated_at,
    updated_by
) VALUES 
    (
        '50000000-0000-0000-0000-000000000001'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        TRUE,
        'multiplier',
        1.50,
        15,
        'deduct_half_day_per_3',
        'shift_start_date',
        9.00,
        4.50,
        ARRAY['SUNDAY'],
        'double_punch',
        TRUE,
        FALSE,
        TRUE,
        ARRAY['PL', 'CL', 'SL', 'LWP'],
        30,
        2.00,
        30,
        TRUE,
        'per_day_proration',
        '30',
        TRUE,
        12.00,
        12.00,
        TRUE,
        0.75,
        3.25,
        TRUE,
        TRUE,
        NOW(),
        'Seed Initialiser [Demo]'
    ),
    (
        '50000000-0000-0000-0000-000000000002'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        TRUE,
        'flat_rate',
        75.00, -- Adjusted to 75.00 to conform to NUMERIC(4,2) column limit (< 100.00)
        10,
        'deduct_cl',
        'shift_start_date',
        8.50,
        4.25,
        ARRAY['SUNDAY'],
        'double_punch',
        TRUE,
        TRUE,
        TRUE,
        ARRAY['PL', 'CL', 'SL', 'COMP_OFF', 'LWP'],
        60,
        1.75,
        24,
        FALSE,
        'per_day_proration',
        '26',
        TRUE,
        12.00,
        12.00,
        TRUE,
        0.75,
        3.25,
        TRUE,
        FALSE,
        NOW(),
        'Seed Initialiser [Demo]'
    ),
    (
        '50000000-0000-0000-0000-000000000003'::uuid,
        '10000000-0000-0000-0000-000000000003'::uuid,
        FALSE, -- Unconfigured to verify safety gate in client dashboard
        'disabled',
        1.00,
        0,
        'none',
        'shift_start_date',
        8.00,
        4.00,
        ARRAY['SUNDAY'],
        'double_punch',
        TRUE,
        FALSE,
        FALSE,
        ARRAY['PL', 'LWP'],
        90,
        1.50,
        15,
        FALSE,
        'per_day_proration',
        '30',
        FALSE,
        0.00,
        0.00,
        FALSE,
        0.00,
        0.00,
        FALSE,
        FALSE,
        NOW(),
        'Pending Onboarding [Demo]'
    )
ON CONFLICT (client_id) DO UPDATE SET
    is_configured = EXCLUDED.is_configured,
    overtime_method = EXCLUDED.overtime_method,
    overtime_rate = EXCLUDED.overtime_rate,
    late_grace_minutes = EXCLUDED.late_grace_minutes,
    late_penalty_rule = EXCLUDED.late_penalty_rule,
    overnight_shift_attribution = EXCLUDED.overnight_shift_attribution,
    standard_working_hours = EXCLUDED.standard_working_hours,
    half_day_hours = EXCLUDED.half_day_hours,
    weekly_off_days = EXCLUDED.weekly_off_days,
    attendance_tracking_mode = EXCLUDED.attendance_tracking_mode,
    require_gps = EXCLUDED.require_gps,
    require_selfie = EXCLUDED.require_selfie,
    enforce_strict_geofence = EXCLUDED.enforce_strict_geofence,
    leave_types_supported = EXCLUDED.leave_types_supported,
    min_service_days_for_leave = EXCLUDED.min_service_days_for_leave,
    monthly_paid_leave_accrual = EXCLUDED.monthly_paid_leave_accrual,
    max_carry_forward = EXCLUDED.max_carry_forward,
    allow_leave_encashment = EXCLUDED.allow_leave_encashment,
    unpaid_leave_deduction_formula = EXCLUDED.unpaid_leave_deduction_formula,
    salary_divisor = EXCLUDED.salary_divisor,
    pf_enabled = EXCLUDED.pf_enabled,
    pf_employee_percent = EXCLUDED.pf_employee_percent,
    pf_employer_percent = EXCLUDED.pf_employer_percent,
    esic_enabled = EXCLUDED.esic_enabled,
    esic_employee_percent = EXCLUDED.esic_employee_percent,
    esic_employer_percent = EXCLUDED.esic_employer_percent,
    pt_enabled = EXCLUDED.pt_enabled,
    tds_enabled = EXCLUDED.tds_enabled,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by;


-- ==============================================================================
-- 6. DEMONSTRATION EMPLOYEES (employees)
-- ==============================================================================
-- 8 Clearly fictional staff members:
--   Suman Tech (5 staff):
--     DEMO-ST-0101: Rahul Sharma [Demo]     (DIRECT_PERMANENT, Hinjawadi Pune)
--     DEMO-ST-0102: Priya Verma [Demo]      (DIRECT_PERMANENT, Hinjawadi Pune)
--     DEMO-ST-0103: Amit Patel [Demo]       (DIRECT_PERMANENT, BKC Mumbai)
--     DEMO-ST-0104: Sneha Joshi [Demo]      (DIRECT_PERMANENT, Hinjawadi Pune)
--     DEMO-ST-0105: Vikram Rao [Demo]       (DIRECT_CONTRACT,  BKC Mumbai)
--   Maha India (3 staff):
--     DEMO-MI-0201: Rajesh Nair [Demo]      (DIRECT_PERMANENT, Chakan Depot)
--     DEMO-MI-0202: Sunil Gaikwad [Demo]    (DIRECT_PERMANENT, Chakan Depot)
--     DEMO-MI-0203: Anil Kadam [Demo]       (DEPUTED_STAFFING, Nagpur Terminal)
--
-- NOTE ON STATUTORY IDENTIFIERS:
-- All PAN, Aadhaar, UAN, and ESIC numbers below are synthetic demonstration values.
-- None represent real persons or active government identifiers.

INSERT INTO public.employees (
    id,
    client_id,
    legal_entity_id,
    work_location_id,
    department_id,
    employee_code,
    first_name,
    last_name,
    email,
    mobile,
    designation,
    joining_date,
    employment_arrangement,
    status,
    pan_number,
    aadhaar_number,
    uan_number,
    esic_number,
    avatar_url,
    created_at,
    updated_at
) VALUES 
    (
        '60000000-0000-0000-0000-000000000001'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        '20000000-0000-0000-0000-000000000001'::uuid,
        '30000000-0000-0000-0000-000000000001'::uuid,
        '40000000-0000-0000-0000-000000000001'::uuid,
        'DEMO-ST-0101',
        'Rahul [Demo]',
        'Sharma',
        'demo.rahul.sharma@suman-demo.test',
        '+91 99999 00101',
        'Senior Operations Executive',
        '2026-01-10',
        'DIRECT_PERMANENT',
        'ACTIVE',
        'DEMOPS0101',
        '0000 0000 0101',
        '100000000101',
        '3100000101',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
        NOW(),
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000002'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        '20000000-0000-0000-0000-000000000001'::uuid,
        '30000000-0000-0000-0000-000000000001'::uuid,
        '40000000-0000-0000-0000-000000000002'::uuid,
        'DEMO-ST-0102',
        'Priya [Demo]',
        'Verma',
        'demo.priya.verma@suman-demo.test',
        '+91 99999 00102',
        'Platform Integration Engineer',
        '2026-03-01',
        'DIRECT_PERMANENT',
        'ACTIVE',
        'DEMOPS0102',
        '0000 0000 0102',
        '100000000102',
        '3100000102',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
        NOW(),
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000003'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        '20000000-0000-0000-0000-000000000001'::uuid,
        '30000000-0000-0000-0000-000000000002'::uuid,
        '40000000-0000-0000-0000-000000000001'::uuid,
        'DEMO-ST-0103',
        'Amit [Demo]',
        'Patel',
        'demo.amit.patel@suman-demo.test',
        '+91 99999 00103',
        'Retail Store Supervisor',
        '2026-05-15',
        'DIRECT_PERMANENT',
        'ACTIVE',
        'DEMOPS0103',
        '0000 0000 0103',
        '100000000103',
        '3100000103',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
        NOW(),
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000004'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        '20000000-0000-0000-0000-000000000001'::uuid,
        '30000000-0000-0000-0000-000000000001'::uuid,
        '40000000-0000-0000-0000-000000000003'::uuid,
        'DEMO-ST-0104',
        'Sneha [Demo]',
        'Joshi',
        'demo.sneha.joshi@suman-demo.test',
        '+91 99999 00104',
        'Accounts Executive',
        '2026-06-01',
        'DIRECT_PERMANENT',
        'ACTIVE',
        'DEMOPS0104',
        '0000 0000 0104',
        '100000000104',
        '3100000104',
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
        NOW(),
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000005'::uuid,
        '10000000-0000-0000-0000-000000000001'::uuid,
        '20000000-0000-0000-0000-000000000001'::uuid,
        '30000000-0000-0000-0000-000000000002'::uuid,
        '40000000-0000-0000-0000-000000000001'::uuid,
        'DEMO-ST-0105',
        'Vikram [Demo]',
        'Rao',
        'demo.vikram.rao@suman-demo.test',
        '+91 99999 00105',
        'Inventory Coordinator',
        '2026-07-20',
        'DIRECT_CONTRACT',
        'ACTIVE',
        'DEMOPS0105',
        '0000 0000 0105',
        '100000000105',
        '3100000105',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        NOW(),
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000006'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        '20000000-0000-0000-0000-000000000002'::uuid,
        '30000000-0000-0000-0000-000000000003'::uuid,
        '40000000-0000-0000-0000-000000000004'::uuid,
        'DEMO-MI-0201',
        'Rajesh [Demo]',
        'Nair',
        'demo.rajesh.nair@mahaindia-demo.test',
        '+91 99999 00201',
        'Fleet Dispatch Controller',
        '2026-02-15',
        'DIRECT_PERMANENT',
        'ACTIVE',
        'DEMOPM0201',
        '0000 0000 0201',
        '100000000201',
        '3100000201',
        'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
        NOW(),
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000007'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        '20000000-0000-0000-0000-000000000002'::uuid,
        '30000000-0000-0000-0000-000000000003'::uuid,
        '40000000-0000-0000-0000-000000000005'::uuid,
        'DEMO-MI-0202',
        'Sunil [Demo]',
        'Gaikwad',
        'demo.sunil.gaikwad@mahaindia-demo.test',
        '+91 99999 00202',
        'Yard Operations Supervisor',
        '2026-04-01',
        'DIRECT_PERMANENT',
        'ACTIVE',
        'DEMOPM0202',
        '0000 0000 0202',
        '100000000202',
        '3100000202',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
        NOW(),
        NOW()
    ),
    (
        '60000000-0000-0000-0000-000000000008'::uuid,
        '10000000-0000-0000-0000-000000000002'::uuid,
        '20000000-0000-0000-0000-000000000002'::uuid,
        '30000000-0000-0000-0000-000000000004'::uuid,
        '40000000-0000-0000-0000-000000000004'::uuid,
        'DEMO-MI-0203',
        'Anil [Demo]',
        'Kadam',
        'demo.anil.kadam@mahaindia-demo.test',
        '+91 99999 00203',
        'Senior Long-Haul Fleet Driver',
        '2026-05-10',
        'DEPUTED_STAFFING', -- Demonstrates Case C (Deputed Staffing)
        'ACTIVE',
        'DEMOPM0203',
        '0000 0000 0203',
        '100000000203',
        '3100000203',
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    legal_entity_id = EXCLUDED.legal_entity_id,
    work_location_id = EXCLUDED.work_location_id,
    department_id = EXCLUDED.department_id,
    employee_code = EXCLUDED.employee_code,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    mobile = EXCLUDED.mobile,
    designation = EXCLUDED.designation,
    joining_date = EXCLUDED.joining_date,
    employment_arrangement = EXCLUDED.employment_arrangement,
    status = EXCLUDED.status,
    pan_number = EXCLUDED.pan_number,
    aadhaar_number = EXCLUDED.aadhaar_number,
    uan_number = EXCLUDED.uan_number,
    esic_number = EXCLUDED.esic_number,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();


-- ==============================================================================
-- 7. POST-INSERTION RELATIONSHIPS (Head of Department Assignment)
-- ==============================================================================
-- Assign department heads now that employee records exist:
--   Suman Operations: Rahul Sharma (60000000-0000-0000-0000-000000000001)
--   Maha Fleet Ops:   Rajesh Nair  (60000000-0000-0000-0000-000000000006)

UPDATE public.departments
SET head_employee_id = '60000000-0000-0000-0000-000000000001'::uuid
WHERE id = '40000000-0000-0000-0000-000000000001'::uuid;

UPDATE public.departments
SET head_employee_id = '60000000-0000-0000-0000-000000000006'::uuid
WHERE id = '40000000-0000-0000-0000-000000000004'::uuid;

COMMIT;
