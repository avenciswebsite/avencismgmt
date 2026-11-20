# AVENCIS WORKFORCE MANAGEMENT
## Document 17 — Suite H: Security, Multi-Tenant Isolation & Negative Attack Scenarios Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 30  
**Priority Breakdown:** P0: 12 | P1: 12 | P2: 5 | P3: 1  
**Target Module:** RLS Boundaries, ID Injection, Immutability Guards, Peer Privacy, JWT Security, Input Sanitization  

---

### TC-SEC-001: Cross-Tenant PostgREST SELECT Tampering (`employees`)
- **Scenario:** Malicious actor authenticated as Acme Admin queries Globex employees via PostgREST parameter tampering.
- **Priority:** P0
- **User Role:** `client_admin` (Acme Corp)
- **Target URL / View:** `GET /rest/v1/employees?client_id=eq.[Globex_Client_UUID]`
- **Preconditions:** Authenticated session as `admin.acme@avencis.test`. Globex has 2 employees.
- **Test Data:** Globex Client UUID: `22222222-2222-2222-2222-222222222222`
- **Execution Steps:**
  1. Capture authenticated JWT token for Acme Admin.
  2. Send direct HTTP GET request to PostgREST with Globex `client_id` filter.
- **Expected Result (UI / API):** HTTP 200 OK with empty JSON array `[]`. Zero rows returned.
- **Database Verification:** RLS policy `client_admin_tenant` forces `client_id = get_user_client_id()`, evaluating to FALSE.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-002: Cross-Tenant ID Injection on INSERT (`employees`)
- **Scenario:** Acme Admin attempts to insert a new employee record into Globex Logistics by spoofing `client_id`.
- **Priority:** P0
- **User Role:** `client_admin` (Acme Corp)
- **Target URL / View:** `POST /rest/v1/employees`
- **Preconditions:** Acme session active.
- **Test Data:** Body: `{"client_id": "[Globex_UUID]", "employee_code": "INJECT-01", "first_name": "Injected", "last_name": "Worker", ...}`
- **Execution Steps:**
  1. Send direct HTTP POST to `/rest/v1/employees` with Globex `client_id`.
- **Expected Result (UI / API):** HTTP 403 Forbidden with PostgreSQL error `42501`: `new row violates row-level security policy for table "employees"`.
- **Database Verification:** `SELECT COUNT(*) FROM public.employees WHERE employee_code = 'INJECT-01';` (Returns 0).
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-003: Horizontal Peer Privacy: ESS Employee Queries Peer Salary Structure
- **Scenario:** Rahul Sharma attempts to fetch Sneha Patil's master salary structure and CTC breakdown.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `GET /rest/v1/employee_salary_structures?employee_id=eq.[Sneha_UUID]`
- **Preconditions:** Rahul logged in with valid ESS JWT. Sneha has active salary structure.
- **Test Data:** Sneha's Employee UUID
- **Execution Steps:**
  1. Rahul sends REST query targeting Sneha's `employee_id`.
- **Expected Result (UI / API):** HTTP 200 OK with empty array `[]`. Zero financial data returned.
- **Database Verification:** Table RLS policy `payroll_admin_tenant` strictly excludes standard `employee` role.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-004: Horizontal Peer Privacy: ESS Employee Queries Peer Payslip
- **Scenario:** Rahul Sharma attempts to access Sneha Patil's generated Form XIX payslip document.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `GET /rest/v1/payslips?employee_id=eq.[Sneha_UUID]`
- **Preconditions:** Sneha has generated payslips in `payslips` table.
- **Test Data:** Sneha's Employee UUID
- **Execution Steps:**
  1. Send REST request targeting Sneha's payslip.
- **Expected Result (UI / API):** HTTP 200 OK with empty array `[]`.
- **Database Verification:** RLS policy `employee_own_payslips` enforces `employee_id = get_current_employee_id()`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-005: Horizontal Peer Privacy: ESS Employee Queries Peer Daily Attendance
- **Scenario:** Employee attempts to inspect peer's punch-in timestamps and GPS locations.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `GET /rest/v1/daily_attendance_records?employee_id=eq.[Peer_UUID]`
- **Preconditions:** Peer attendance records exist.
- **Test Data:** Peer Employee UUID
- **Execution Steps:**
  1. Send REST query.
- **Expected Result (UI / API):** HTTP 200 OK with empty array `[]`.
- **Database Verification:** RLS policy `employee_view_own` restricts records to `user_id = auth.uid()`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-006: Database Immutability Guard: Reject UPDATE on `audit_logs`
- **Scenario:** Direct SQL update on regulatory audit log is aborted by trigger `guard_immutable_audit_logs()`.
- **Priority:** P0
- **User Role:** Direct SQL / PostgREST
- **Target URL / View:** PostgreSQL Engine
- **Preconditions:** Audit log entry exists.
- **Test Data:** `UPDATE public.audit_logs SET action = 'TAMPERED' WHERE id = (SELECT id FROM public.audit_logs LIMIT 1);`
- **Execution Steps:**
  1. Execute UPDATE query in SQL editor.
- **Expected Result (UI / API):** PostgreSQL raises exception: `Audit logs are immutable and cannot be updated or deleted.` Transaction rolled back.
- **Database Verification:** `action` remains original value.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-007: Database Immutability Guard: Reject DELETE on `audit_logs`
- **Scenario:** Direct SQL delete on regulatory audit log is aborted by trigger.
- **Priority:** P0
- **User Role:** Direct SQL / PostgREST
- **Target URL / View:** PostgreSQL Engine
- **Preconditions:** Audit logs exist.
- **Test Data:** `DELETE FROM public.audit_logs;`
- **Execution Steps:**
  1. Execute DELETE query.
- **Expected Result (UI / API):** PostgreSQL raises exception: `Audit logs are immutable and cannot be updated or deleted.`
- **Database Verification:** Log count remains unchanged.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-008: Database Immutability Guard: Reject UPDATE on Locked Payroll Batch
- **Scenario:** Attempting to alter figures on a locked payroll run raises an exception.
- **Priority:** P0
- **User Role:** Direct SQL / PostgREST
- **Target URL / View:** PostgreSQL Engine
- **Preconditions:** Payroll run has `status = 'LOCKED'`.
- **Test Data:** `UPDATE public.payroll_runs SET total_net_salary = 1.00 WHERE status = 'LOCKED';`
- **Execution Steps:**
  1. Execute UPDATE on locked payroll run.
- **Expected Result (UI / API):** Exception raised: `guard_locked_payroll_modification(): Payroll run is locked and cannot be modified or deleted.`
- **Database Verification:** Figures unaltered.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-009: Database Immutability Guard: Reject DELETE on Locked Payroll Batch
- **Scenario:** Attempting to delete a locked payroll run is aborted by trigger.
- **Priority:** P0
- **User Role:** Direct SQL / PostgREST
- **Target URL / View:** PostgreSQL Engine
- **Preconditions:** Locked payroll run exists.
- **Test Data:** `DELETE FROM public.payroll_runs WHERE status = 'LOCKED';`
- **Execution Steps:**
  1. Execute DELETE on locked run.
- **Expected Result (UI / API):** Exception raised; deletion aborted.
- **Database Verification:** Run record preserved.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-010: Privilege Escalation Defense: Client Admin Assigns `super_admin` Role
- **Scenario:** Client Admin attempts to insert or elevate a user to `super_admin` via API.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `POST /rest/v1/user_roles`
- **Preconditions:** Client Admin authenticated.
- **Test Data:** Body: `{"user_id": "[Target_UUID]", "role": "super_admin", "client_id": null}`
- **Execution Steps:**
  1. Send direct POST to insert `super_admin` role.
- **Expected Result (UI / API):** HTTP 403 Forbidden (`42501` RLS violation).
- **Database Verification:** RLS policy `client_admin_manage_tenant` enforces `role != 'super_admin' AND client_id = get_user_client_id()`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-011: Role Bypass Defense: Location Manager Invoking Payroll API
- **Scenario:** Location Manager attempts to directly trigger payroll calculation via PostgREST.
- **Priority:** P0
- **User Role:** `location_manager` (`mgr.pune@avencis.test`)
- **Target URL / View:** `POST /rest/v1/payroll_runs`
- **Preconditions:** Location Manager authenticated.
- **Test Data:** Valid payroll run JSON payload.
- **Execution Steps:**
  1. Send POST request to `/rest/v1/payroll_runs`.
- **Expected Result (UI / API):** HTTP 403 Forbidden (`42501` RLS policy violation).
- **Database Verification:** Zero rows committed.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-012: Expired JWT Token Handling
- **Scenario:** Expired session token is rejected; frontend gracefully redirects to login.
- **Priority:** P1
- **User Role:** Any Authenticated Persona
- **Target URL / View:** Application Route
- **Preconditions:** User session JWT with `exp` in the past.
- **Test Data:** Expired token.
- **Execution Steps:**
  1. Set expired token in `localStorage`.
  2. Refresh application.
- **Expected Result (UI):** Supabase client attempts refresh. If refresh fails, storage is cleared and user is redirected to `/login` with banner: "Your session has expired. Please sign in again."
- **Database Verification:** API calls return HTTP 401 Unauthorized (`JWT expired`).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-013: Tampered JWT Signature Rejection
- **Scenario:** Sending a modified JWT with altered payload and invalid cryptographic signature.
- **Priority:** P0
- **User Role:** Unauthenticated Attacker
- **Target URL / View:** PostgREST API
- **Preconditions:** Valid JWT modified (changed `role` claim to `super_admin`).
- **Test Data:** Tampered JWT.
- **Execution Steps:**
  1. Send request with `Authorization: Bearer [Tampered_JWT]`.
- **Expected Result (UI / API):** HTTP 401 Unauthorized: `{"message": "invalid JWT signature"}`.
- **Database Verification:** Request rejected at GoTrue / PostgREST gateway.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-014: Stored XSS Injection Sanitization in Employee Master
- **Scenario:** Attacker enters script payload `<script>alert('XSS')</script>` in Employee First Name.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Add Employee
- **Preconditions:** Add Employee wizard open.
- **Test Data:** First Name: `<script>alert('XSS')</script>`, Last Name: "Tester"
- **Execution Steps:**
  1. Submit employee with script tags.
  2. View employee profile and directory list.
- **Expected Result (UI):** UI escapes and renders text literally: `&lt;script&gt;alert('XSS')&lt;/script&gt;`. No browser alert dialog appears.
- **Database Verification:** Text stored sanitized.
- **Audit Verification:** None.
- **Cleanup / Teardown:** Delete test employee.
- **Status:** NOT RUN

---

### TC-SEC-015: Stored XSS Injection in Attendance Regularisation Reason
- **Scenario:** Submitting `<img src=x onerror=alert(1)>` in correction justification remarks.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal/regularisations`
- **Preconditions:** Regularisation modal open.
- **Test Data:** Reason: `<img src=x onerror=alert(1)>`
- **Execution Steps:**
  1. Submit regularisation.
  2. Manager views regularisation list.
- **Expected Result (UI):** Remarks render safely as plaintext string. Zero script execution.
- **Database Verification:** Stored as plaintext string.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Clear.
- **Status:** NOT RUN

---

### TC-SEC-016: Stored Procedure Parameter SQL Injection Resistance
- **Scenario:** Injecting `' OR 1=1 --` into `get_manager_team` RPC arguments.
- **Priority:** P0
- **User Role:** `location_manager`
- **Target URL / View:** `POST /rest/v1/rpc/get_manager_team`
- **Preconditions:** Function exists.
- **Test Data:** Payload: `{"p_manager_user_id": "00000000-0000-0000-0000-000000000000' OR 1=1 --", "p_client_id": "[id]"}`
- **Execution Steps:**
  1. Send RPC request with malformed UUID payload.
- **Expected Result (UI / API):** PostgreSQL rejects query with type validation error: `invalid input syntax for type uuid`. Injection cannot execute.
- **Database Verification:** Zero injection execution.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-017: CORS Preflight Origin Enforcement
- **Scenario:** Browser requests from unauthorized third-party origin (`https://malicious-site.com`) are blocked.
- **Priority:** P1
- **User Role:** External Origin
- **Target URL / View:** API Gateway
- **Preconditions:** Origin header set to `https://malicious-site.com`.
- **Test Data:** `Origin: https://malicious-site.com`
- **Execution Steps:**
  1. Send HTTP OPTIONS preflight request with unauthorized Origin header.
- **Expected Result (UI / API):** Response omits `Access-Control-Allow-Origin` or returns 403 Forbidden. Browser blocks cross-origin fetch.
- **Database Verification:** N/A.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-018: Leap Year February 29 Date Handling (Boundary Edge Case)
- **Scenario:** System correctly handles attendance punches and payroll proration on leap day (Feb 29, 2028).
- **Priority:** P2
- **User Role:** Automated Date Engine
- **Target URL / View:** `/attendance` & `/payroll`
- **Preconditions:** Calendar year is leap year (2028).
- **Test Data:** Date: 2028-02-29
- **Execution Steps:**
  1. Verify punch on Feb 29 commits with valid date.
  2. Verify February payroll proration uses 29-day divisor.
- **Expected Result (UI):** No date overflow error; 29 days accounted for in February muster.
- **Database Verification:** `SELECT '2028-02-29'::DATE;` succeeds; `daily_attendance_records` records Feb 29.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-019: Zero Basic Salary Validation (Edge Case)
- **Scenario:** Attempting to onboard an employee with ₹0.00 Basic Salary.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Step 3
- **Preconditions:** Step 3 open.
- **Test Data:** Basic: ₹0.00, Gross: ₹10,000.00
- **Execution Steps:**
  1. Input Basic: 0.
  2. Click Next.
- **Expected Result (UI):** Warning/Block: "Under the Code on Wages 2019, Basic Salary must be greater than zero and at least 50% of Gross."
- **Database Verification:** Prevented.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-020: Negative Component Deduction Resistance
- **Scenario:** Attempting to inject negative numbers in manual payroll additions/deductions.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/[id]` -> Edit Item
- **Preconditions:** Draft run open.
- **Test Data:** Deduction: -5000 (Negative deduction attempted to inflate net pay)
- **Execution Steps:**
  1. Enter -5000 in deduction field and save.
- **Expected Result (UI):** Validation flag: "Deduction amount must be a positive number." Save blocked.
- **Database Verification:** Prevented by domain constraint.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-021: Zero Payable Days Salary Payout (100% Unpaid LWP)
- **Scenario:** Employee absent for entire month (0 payable days); net pay calculates to exactly ₹0.00 with zero negative deductions.
- **Priority:** P0
- **User Role:** Automated Payroll Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Employee has 30 LWP days in 30-day month.
- **Test Data:** Master Gross: ₹35,000, Payable Days: 0.0
- **Execution Steps:**
  1. Calculate payroll item.
- **Expected Result (UI):** Earned Gross: ₹0.00, EPF: ₹0.00, ESIC: ₹0.00, PT: ₹0.00, Net Salary: ₹0.00. No negative balance generated.
- **Database Verification:** `SELECT earned_gross, net_salary FROM public.payroll_items WHERE employee_id = [id];` (Both 0.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-022: Net Pay Capped at Gross (No Negative Salary)
- **Scenario:** Total manual deductions exceed gross earnings; system caps deductions to prevent negative net salary.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Earned Gross: ₹15,000, Deductions entered: ₹18,000.
- **Test Data:** Deductions > Gross
- **Execution Steps:**
  1. Attempt to apply deductions.
- **Expected Result (UI):** System warns: "Deductions (₹18,000) exceed Gross Earnings (₹15,000). Maximum deductible amount capped at ₹15,000; remaining balance carried to next month." Net Salary: ₹0.00.
- **Database Verification:** `net_salary >= 0`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-023: Concurrent Modification on Same Employee Profile
- **Scenario:** Two HR Admins submit profile edits simultaneously; second submit detects conflict.
- **Priority:** P2
- **User Role:** `hr_admin` (Concurrent sessions)
- **Target URL / View:** `/employees/[id]`
- **Preconditions:** Admin 1 and Admin 2 have profile open.
- **Test Data:** Admin 1 updates phone; Admin 2 updates address.
- **Execution Steps:**
  1. Admin 1 saves phone.
  2. Admin 2 saves address 2 seconds later.
- **Expected Result (UI):** Both updates merge cleanly or optimistic locking banner alerts Admin 2 to refresh before overwriting.
- **Database Verification:** Database committed without corruption.
- **Audit Verification:** Separate audit log entries.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-024: PostgREST SQL Injection via Column Filter
- **Scenario:** Attempting SQL injection via query param: `?first_name=eq.test';DROP TABLE clients;--`.
- **Priority:** P0
- **User Role:** Attacker
- **Target URL / View:** `GET /rest/v1/employees?first_name=eq.test';DROP TABLE clients;--`
- **Preconditions:** Valid session.
- **Test Data:** Malicious SQL fragment.
- **Execution Steps:**
  1. Send request with SQL injection string.
- **Expected Result (UI / API):** PostgREST parameterizes the value into a text literal string search. Queries for first name literally equal to the payload; returns empty array. Table `clients` remains untouched.
- **Database Verification:** `SELECT COUNT(*) FROM public.clients;` remains normal.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-025: Geofence GPS Spoofing Mitigation (Mock Location Flag)
- **Scenario:** Mobile device with Android "Allow Mock Locations" enabled attempts punch.
- **Priority:** P2
- **User Role:** `employee`
- **Target URL / View:** `/portal`
- **Preconditions:** Mobile client with mock location detection.
- **Test Data:** Mock GPS provider flag = true
- **Execution Steps:**
  1. Submit punch from mock location emulator.
- **Expected Result (UI):** Client rejects punch: "Mock GPS / Virtual Location detected. Punches must be logged using authentic hardware GPS."
- **Database Verification:** Zero rows committed in `attendance_events`.
- **Audit Verification:** Audit log records `MOCK_GPS_DETECTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-026: Multi-Tenant Data Leak via Error Messages
- **Scenario:** Triggering foreign key constraint violation does NOT leak internal IDs of other tenants in error messages.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** PostgREST API
- **Preconditions:** Invalid payload referencing foreign client object.
- **Test Data:** Foreign UUID
- **Execution Steps:**
  1. Send invalid request.
- **Expected Result (UI / API):** Error response returns sanitized generic message: "Foreign key violation or referenced record does not exist." No cross-tenant metadata exposed.
- **Database Verification:** Verified via error response payload.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-027: Storage Bucket Path Traversal Defense
- **Scenario:** Uploading file with relative path `../../etc/passwd` or `../../client-assets/malicious.png`.
- **Priority:** P0
- **User Role:** Attacker
- **Target URL / View:** Supabase Storage API
- **Preconditions:** Authenticated session.
- **Test Data:** Filename: `../../secret.pdf`
- **Execution Steps:**
  1. Attempt file upload with path traversal characters.
- **Expected Result (UI / API):** Storage gateway sanitizes filename to `secret.pdf` or rejects upload with 400 Bad Request.
- **Database Verification:** File cannot escape designated storage bucket path.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-028: Brute Force Password Attack Protection
- **Scenario:** 10 consecutive failed login attempts trigger temporary IP rate-limit lockout.
- **Priority:** P1
- **User Role:** Attacker
- **Target URL / View:** `/login` -> `/auth/v1/token`
- **Preconditions:** Known user email.
- **Test Data:** 10 rapid incorrect passwords.
- **Execution Steps:**
  1. Submit 10 consecutive failed logins.
- **Expected Result (UI):** On 10th attempt, response is HTTP 429 Too Many Requests: "Too many login attempts. Please wait 15 minutes before trying again."
- **Database Verification:** Rate-limiting enforced at GoTrue gateway.
- **Audit Verification:** `LOGIN_RATE_LIMIT_EXCEEDED` logged.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-SEC-029: Rapid Clock-In/Clock-Out Race Condition (Atomic Locks)
- **Scenario:** Firing 10 concurrent HTTP punch-in requests in parallel within 50 milliseconds.
- **Priority:** P1
- **User Role:** Automated Stress Script
- **Target URL / View:** `POST /rest/v1/attendance_events`
- **Preconditions:** Valid employee JWT.
- **Test Data:** 10 parallel asynchronous requests.
- **Execution Steps:**
  1. Dispatch 10 parallel requests.
- **Expected Result (UI / API):** Exactly 1 request succeeds (HTTP 201); remaining 9 are safely rejected or de-duplicated by unique constraint `uq_punch_dedup`.
- **Database Verification:** Exactly 1 row added to `attendance_events`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Clear event.
- **Status:** NOT RUN

---

### TC-SEC-030: Database Search Path Pinning Verification (SEC-02)
- **Scenario:** Confirming all 8 database stored functions have pinned `search_path` preventing schema hijacking.
- **Priority:** P0
- **User Role:** Antigravity Security Auditor
- **Target URL / View:** PostgreSQL Schema
- **Preconditions:** Migration 20 applied.
- **Test Data:** Schema inspection query.
- **Execution Steps:**
  1. Execute verification query across `pg_proc`.
- **Expected Result (UI / API):** All 8 functions return `proconfig` containing `search_path=public, auth, pg_temp`. Zero mutable search paths.
- **Database Verification:**
  ```sql
  SELECT proname, proconfig 
  FROM pg_proc 
  WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
    AND proconfig IS NULL;
  ```
  (Returns 0 rows).
- **Audit Verification:** Confirmed.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN
