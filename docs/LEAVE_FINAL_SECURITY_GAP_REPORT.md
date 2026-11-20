# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE MANAGEMENT FINAL SECURITY GAP REPORT

**Document Version:** 1.0.0  
**Milestone:** 2.4D Verification Gate  
**Security Classification:** Highly Confidential / Enterprise Governance  
**Scope:** Security Architecture, Multi-Tenancy, Row Level Security, Corporate Anti-Self-Approval  

---

### 1. Threat Modeling & Vulnerability Register

The table below catalogs every identified security vulnerability, privilege escalation path, and data isolation risk within the Leave Management module:

| Vuln ID | Vulnerability Title | Affected Layer | Severity | Status | Attack Vector / Risk |
|---|---|---|:---:|:---:|---|
| **SEC-01** | Employee Self-Approval via RLS `FOR ALL` | PostgreSQL RLS | **CRITICAL** | **FAIL** | Employee can issue direct PostgREST `UPDATE` to set `status = 'APPROVED'` on own requests. |
| **SEC-02** | Non-Atomic Approval Race Hazard | Service & Database | **HIGH** | **FAIL** | Two concurrent approval requests result in double deduction or corrupted balances. |
| **SEC-03** | Super Admin Cross-Tenant Lockout | PostgreSQL RLS | **HIGH** | **FAIL** | Super Admin profiles with `client_id IS NULL` cannot access leave records. |
| **SEC-04** | Location Manager Omission from RLS | PostgreSQL RLS | **HIGH** | **FAIL** | Location Managers cannot review or view leave requests for their facility under RLS. |
| **SEC-05** | Client Manager Balance Update Block (42501) | PostgreSQL RLS | **HIGH** | **FAIL** | Client Manager can update requests, but lacks RLS permissions on `leave_balances`. |
| **SEC-06** | Payroll Admin Complete Blindness | PostgreSQL RLS | **MEDIUM** | **FAIL** | `payroll_admin` has zero SELECT policies on leave tables; payroll engine cannot read leave records. |
| **SEC-07** | Live Audit Log Bypassed in Leave Reviews | Service Layer | **MEDIUM** | **NOT IMPLEMENTED** | `reviewLeaveRequest` in `leaveService.ts` does not write to `audit_logs` in live Supabase mode. |
| **SEC-08** | Client Manager Department Leaks | Service Layer | **MEDIUM** | **FAIL** | `getLeaveRequests` returns all client requests to `client_manager` without filtering by department. |
| **SEC-09** | Peer Balance Inspection by Payroll Admin | Service Layer | **LOW** | **FAIL** | `getLeaveBalances` in `leaveService.ts` line 46 only checks `callerScope.role === 'employee'`. |
| **SEC-10** | Missing Live Supabase Auth Test Personas | Auth Infrastructure | **LOW** | **BLOCKED** | Live Supabase instance has zero passwords provisioned in `auth.users`. |

---

### 2. Deep-Dive Security Analysis

#### SEC-01: Critical Privilege Escalation via `leave_requests_employee_all`
- **Location:** `supabase/migrations/20261103000009_row_level_security_policies.sql`, lines 146–149.
- **Description:**
  ```sql
  CREATE POLICY "leave_requests_employee_all" ON leave_requests
  FOR ALL TO authenticated
  USING (employee_id = public.get_user_employee_id())
  WITH CHECK (employee_id = public.get_user_employee_id() AND client_id = public.get_user_client_id());
  ```
- **Vulnerability:**
  The `FOR ALL` directive includes `UPDATE`. Because neither the `USING` nor the `WITH CHECK` clause restricts which columns can be modified or what the status must be, an authenticated employee with an active Supabase session token can execute:
  ```json
  PATCH /rest/v1/leave_requests?id=eq.<my_request_id>
  Host: mlopgvkvzhwhkbewhefb.supabase.co
  apikey: <anon_key>
  Authorization: Bearer <employee_jwt>
  Content-Type: application/json

  { "status": "APPROVED" }
  ```
  PostgREST evaluates `employee_id = public.get_user_employee_id()`, which is valid. PostgreSQL updates the status to `APPROVED`.
- **Impact:** Complete circumvention of corporate governance, manager approval gates, and balance deduction.

#### SEC-02: Non-Atomic Concurrency Race Hazards
- **Location:** `src/services/leaveService.ts`, lines 423–462.
- **Description:**
  Updating `leave_requests` and `leave_balances` in two separate HTTP calls leaves a window of vulnerability where concurrent requests produce lost updates, double balance debits, or requests left in `APPROVED` status with zero balance deduction.

#### SEC-03: Multi-Tenancy Lockout of Global Super Admins
- **Location:** `supabase/migrations/20261103000009_row_level_security_policies.sql`, lines 143, 153.
- **Description:**
  The expression `client_id = public.get_user_client_id()` causes Super Admin profiles (which have `client_id IS NULL`) to evaluate `client_id = NULL` -> `FALSE`. Super Admins are locked out of cross-tenant oversight.

---

### 3. Verification & Compliance Classification

| Security Gate | Status | Evidence / Notes |
|---|:---:|---|
| Corporate Anti-Self-Approval (Frontend) | **PASS** | Validated in `testLeaveManagement.ts` Test 09 & `LeaveManagement.tsx`. |
| Corporate Anti-Self-Approval (Database Tier) | **FAIL** | No DB trigger or check constraint prevents self-approval. |
| Fail-Closed Peer Isolation (Balances) | **PASS** | Employee attempting to view peer balances receives HTTP 403. |
| Fail-Closed Peer Isolation (Requests) | **PASS** | Employee attempting to view peer requests receives HTTP 403. |
| Multi-Tenant Cross-Client Isolation | **PASS** | Cross-tenant submission and retrieval blocked in service layer. |
| Append-Only Audit Trail for Reviews | **NOT IMPLEMENTED** | Live mode reviews do not append entries to `public.audit_logs`. |
| Row-Level Immutability of Punch Telemetry | **PASS** | Enforced by PostgreSQL trigger `trg_guard_attendance_events_immutability`. |
| Safe Integration with Payroll | **FAIL** | False absenteeism risks and LWP check constraint errors make payroll unsafe. |

---

### 4. Required Security Action Items Before Production

1. **Deploy Transactional RPC Function (`approve_leave_request_atomic`):**
   Removes balance deduction and status updates from PostgREST direct client access, encapsulating both inside a single atomic, row-locked database transaction.
2. **Revoke `FOR ALL` from `leave_requests_employee_all`:**
   Replace with separate `SELECT`, `INSERT (status = 'PENDING')`, and `UPDATE (status = 'CANCELLED')` policies.
3. **Correct Super Admin, Location Manager, and Payroll Admin RLS Policies:**
   Apply proposed SQL from [LEAVE_RLS_VERIFICATION_REPORT.md](file:///c:/Avencis%20Management/docs/LEAVE_RLS_VERIFICATION_REPORT.md).
