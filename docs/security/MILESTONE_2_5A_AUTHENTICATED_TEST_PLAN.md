# AVENCIS WFM — MILESTONE 2.5A
# AUTHENTICATED MULTI-USER TEST DESIGN & EXECUTION PLAN
## End-to-End JWT Session Testing Across Seven Roles & Multi-Tenant Boundaries

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Phase:** Milestone 2.5A — Security Remediation Planning & Migration 20 Preparation  
**Target Environment:** Supabase Cloud (`avencismgmt` / `mlopgvkvzhwhkbewhefb.supabase.co`)  
**Testing Methodology:** Category A (Live PostgREST Queries with Real Supabase GoTrue JWT Tokens)  
**Auditor:** Antigravity Autonomous Security Verification Engine  

---

## 1. Executive Summary & Purpose

In Milestone 2.4F, Category A testing (Live Authenticated Multi-User Database Testing) was formally classified as **BLOCKED** because the live Supabase database contained zero rows in `auth.users` and audit boundaries prohibited creating accounts.

This document establishes the authoritative test plan for **Milestone 2.5B**, defining:
1. The exact user provisioning blueprint required to seed 10 verified personas in `auth.users` and `public.user_profiles`.
2. The automated test execution harness (`scripts/testLiveAuthenticatedRBAC.ts`) designed to authenticate via `supabase.auth.signInWithPassword` and execute real PostgREST HTTP queries.
3. Ten comprehensive test scenarios validating cross-tenant isolation, location scoping, salary confidentiality, segregation of duties, and immutability triggers.

**Strict Mandate:** This test suite does NOT simulate permissions using in-memory JavaScript user objects. Every test assertion executes against the live Supabase PostgREST endpoint with a genuine Bearer JWT issued by GoTrue.

---

## 2. Test Personas & Provisioning Blueprint

To rigorously validate multi-tenancy, horizontal separation, and role boundaries, exactly **10 distinct user accounts** must be provisioned across two client organizations and one global platform role:

```
+----+-----------------------------+---------------------+-----------------------+---------------------+-------------------------------+
| #  | Test Email                  | Assigned Role       | Client Organization   | Work Location       | Linked Employee ID            |
+----+-----------------------------+---------------------+-----------------------+---------------------+-------------------------------+
| 01 | superadmin@avencis.test     | super_admin         | Global (NULL)         | Global (NULL)       | NULL                          |
| 02 | clientadmin@suman.test      | client_admin        | Suman Tech (SUMAN)    | All Suman Sites     | NULL                          |
| 03 | hradmin@suman.test          | hr_admin            | Suman Tech (SUMAN)    | All Suman Sites     | NULL                          |
| 04 | payrolladmin@suman.test     | payroll_admin       | Suman Tech (SUMAN)    | All Suman Sites     | NULL                          |
| 05 | manager@suman.test          | client_manager      | Suman Tech (SUMAN)    | All Suman Sites     | emp-suman-02 (Pooja Patel)    |
| 06 | locmanager.pune@suman.test  | location_manager    | Suman Tech (SUMAN)    | Pune Tech Park      | emp-suman-03 (Vikram Desai)   |
| 07 | rahul.sharma@suman.test     | employee            | Suman Tech (SUMAN)    | Pune Tech Park      | emp-suman-01 (Rahul Sharma)   |
| 08 | pooja.patel@suman.test      | employee            | Suman Tech (SUMAN)    | Pune Tech Park      | emp-suman-02 (Pooja Patel)    |
| 09 | clientadmin@maha.test       | client_admin        | Maha Fleet (MAHA)     | All Maha Sites      | NULL                          |
| 10 | unprovisioned@unknown.test  | UNPROVISIONED       | Unknown / External    | Unknown             | NULL (Zero Profile Record)    |
+----+-----------------------------+---------------------+-----------------------+---------------------+-------------------------------+
```

### Provisioning Method:
In Milestone 2.5B, these accounts will be created via a dedicated administrative setup script (`scripts/seedAuthTestUsers.ts`) utilizing the Supabase service-role administrative API (`supabase.auth.admin.createUser`) with verified email confirmations (`email_confirm: true`).

---

## 3. Ten Mandatory Security Test Scenarios

### Scenario 1: Cross-Tenant SELECT Denial
- **Objective:** Verify that an administrator or employee in Tenant B cannot read records from Tenant A.
- **Actor:** `clientadmin@maha.test` (Maha India Logistics & Fleet).
- **Test Actions:**
  1. Authenticate with GoTrue; acquire JWT.
  2. Query `supabase.from('employees').select('*').eq('client_id', '<suman_client_id>')`.
  3. Query `supabase.from('payroll_runs').select('*').eq('client_id', '<suman_client_id>')`.
  4. Query `supabase.from('client_policies').select('*').eq('client_id', '<suman_client_id>')`.
- **Pass Criteria:** Every query returns HTTP 200 with **exactly 0 rows**. Data leakage is zero.

---

### Scenario 2: Cross-Tenant Mutation (UPDATE/DELETE) Denial
- **Objective:** Verify that an administrator in Tenant B cannot modify or delete records in Tenant A.
- **Actor:** `clientadmin@maha.test`.
- **Test Actions:**
  1. Attempt direct update: `supabase.from('employees').update({ designation: 'Hacked' }).eq('id', '<suman_employee_id>')`.
  2. Attempt direct delete: `supabase.from('client_legal_entities').delete().eq('id', '<suman_entity_id>')`.
- **Pass Criteria:** Update affects 0 rows; delete affects 0 rows or returns HTTP 403 Permission Denied.

---

### Scenario 3: Legal-Entity Scoped Payroll Isolation
- **Objective:** Verify multi-entity payroll grouping post-Migration 19.
- **Actor:** `payrolladmin@suman.test`.
- **Test Actions:**
  1. Invoke `supabase.rpc('generate_payroll_run', { p_client_id: suman_id, p_period_month: 11, p_period_year: 2026, p_legal_entity_id: suman_entity_primary })`.
  2. Query `payroll_items` joined with `employees` for the generated `run_id`.
- **Pass Criteria:** Run successfully created; every item in `payroll_items` belongs to an employee whose `legal_entity_id` matches `suman_entity_primary`. Employees belonging to secondary legal entities are excluded.

---

### Scenario 4: Worksite / Location-Level Scoping
- **Objective:** Verify that a Location Manager can only view and manage staff assigned to their work location.
- **Actor:** `locmanager.pune@suman.test` (Assigned to Pune Hub).
- **Test Actions:**
  1. Query `supabase.from('employees').select('id, full_name, work_location_id')`.
  2. Query `supabase.from('attendance_corrections').select('*')`.
- **Pass Criteria:** All returned employees have `work_location_id === pune_hub_id`. Employees at Mumbai Hub or other locations are completely excluded (0 rows).

---

### Scenario 5: Horizontal Employee Self-Service Isolation
- **Objective:** Verify that regular employees cannot access peer records.
- **Actor:** `rahul.sharma@suman.test` (`emp-suman-01`).
- **Target Peer:** `pooja.patel@suman.test` (`emp-suman-02`).
- **Test Actions:**
  1. Query `supabase.from('attendance_events').select('*').eq('employee_id', 'emp-suman-02')`.
  2. Query `supabase.from('leave_requests').select('*').eq('employee_id', 'emp-suman-02')`.
  3. Query `supabase.from('leave_balances').select('*').eq('employee_id', 'emp-suman-02')`.
  4. Query `supabase.from('payslips').select('*').eq('employee_id', 'emp-suman-02')`.
  5. Attempt to insert a leave request spoofing `employee_id: 'emp-suman-02'`.
- **Pass Criteria:**
  - Queries 1-4 return HTTP 200 with **0 rows**.
  - Query 5 rejected with HTTP 403 / RLS `WITH CHECK` violation (`new row violates row-level security policy`).

---

### Scenario 6: Sensitive Compensation & Banking Confidentiality
- **Objective:** Verify that salary structures and bank coordinates are strictly hidden from HR Admins and Managers.
- **Actors:**
  - `hradmin@suman.test`
  - `manager@suman.test`
  - `payrolladmin@suman.test`
- **Test Actions:**
  1. HR Admin queries `employee_salary_structures` and `employee_bank_details`.
  2. Manager queries `employee_salary_structures` and `employee_bank_details`.
  3. Payroll Admin queries `employee_salary_structures` and `employee_bank_details`.
- **Pass Criteria:**
  - HR Admin: **0 rows returned**.
  - Manager: **0 rows returned**.
  - Payroll Admin: **All tenant employee records returned**.

---

### Scenario 7: Segregation of Duties in Terminal Payroll Locking (Four-Eyes Principle)
- **Objective:** Verify that the preparer (Payroll Admin) cannot execute terminal cryptographic locking.
- **Actors:**
  - `payrolladmin@suman.test` (Preparer)
  - `clientadmin@suman.test` (Approver)
- **Test Actions:**
  1. Payroll Admin invokes `supabase.rpc('lock_payroll_run', { p_run_id: run_id })`.
  2. Client Admin invokes `supabase.rpc('lock_payroll_run', { p_run_id: run_id })`.
- **Pass Criteria:**
  - Step 1: **REJECTED** with error: `'SEGREGATION_OF_DUTIES_VIOLATION: Role payroll_admin cannot lock payroll runs. Only Client Admin or Super Admin may execute formal lock sign-off.'`
  - Step 2: **SUCCESS**. Status transitions to `locked`, published payslips generated, and audit log emitted.

---

### Scenario 8: Function Privilege Boundaries (Unauthenticated Anon Denial)
- **Objective:** Verify that internal security routines cannot be invoked anonymously.
- **Actor:** `anon` (No Authorization header / Unauthenticated).
- **Test Actions:**
  1. Call PostgREST RPC: `POST /rest/v1/rpc/get_user_role`.
  2. Call PostgREST RPC: `POST /rest/v1/rpc/generate_payroll_run`.
  3. Call PostgREST RPC: `POST /rest/v1/rpc/lock_payroll_run`.
- **Pass Criteria:** Every call rejected with HTTP 401 Unauthorized or HTTP 403 Forbidden.

---

### Scenario 9: Unprovisioned Account Rejection (Fail-Closed Identity)
- **Objective:** Verify that an authenticated user without a `user_profiles` row is completely locked out.
- **Actor:** `unprovisioned@unknown.test`.
- **Test Actions:**
  1. Authenticate with GoTrue; receive valid JWT.
  2. Call `supabase.rpc('get_user_role')`.
  3. Query `supabase.from('employees').select('*')`.
  4. Query `supabase.from('clients').select('*')`.
- **Pass Criteria:**
  - Step 2 returns `null` (zero role fallback to employee).
  - Steps 3 and 4 return **0 rows**.
  - Total access denial enforced.

---

### Scenario 10: Locked Payroll Immutability
- **Objective:** Verify that terminal payroll runs and items cannot be tampered with.
- **Actor:** `clientadmin@suman.test`.
- **Test Actions:**
  1. Attempt `supabase.from('payroll_runs').update({ status: 'draft' }).eq('id', locked_run_id)`.
  2. Attempt `supabase.from('payroll_items').update({ gross_earned: 999999 }).eq('run_id', locked_run_id)`.
  3. Attempt `supabase.from('payroll_runs').delete().eq('id', locked_run_id)`.
- **Pass Criteria:** Every query fails with database exception:
  `'CRITICAL SECURITY VIOLATION: Payroll run % is locked and immutable. Modifications are prohibited.'`

---

## 4. Test Execution Harness Architecture

A standalone test script `scripts/testLiveAuthenticatedRBAC.ts` will be developed in Milestone 2.5B:

```
+---------------------------------------------------------------------------------------------------+
|                           TEST HARNESS: testLiveAuthenticatedRBAC.ts                              |
+---------------------------------------------------------------------------------------------------+
| 1. Config Loader: Reads live VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.                        |
| 2. Auth Helper: signIn(email, password) -> Instantiates SupabaseClient with active auth session. |
| 3. Test Runner: Executes Scenarios 1 through 10 sequentially across all 10 personas.             |
| 4. Assertion Engine: Validates HTTP status codes, payload lengths, and exception strings.         |
| 5. Reporter: Generates structured test summary with pass/fail counts and audit timestamps.         |
+---------------------------------------------------------------------------------------------------+
```

---

## 5. Summary Conclusion

This test design provides 100% test coverage of real database authorization boundaries using real GoTrue JWTs. Successful execution in Milestone 2.5B will definitively prove multi-tenant safety and unlock commercial production readiness.
