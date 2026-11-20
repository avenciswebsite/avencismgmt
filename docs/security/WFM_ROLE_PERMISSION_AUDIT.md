# AVENCIS WFM — MILESTONE 2.4F
# ROLE & PERMISSION SECURITY AUDIT
## Seven-Role by 17-Domain Dual-Layer Access Control Matrix

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Evaluation Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Security Verification Engine  
**Architecture:** Dual-Layer Defense (Frontend Route/Component Guards + PostgreSQL RLS & Stored Procedures)  

---

## 1. Executive Overview

Avencis Workforce Management enforces Role-Based Access Control (RBAC) across two independent layers:
1. **Frontend Presentation Layer (`src/`):** React components, navigation shells (`Sidebar.tsx`, `AppShell.tsx`), and context providers (`AuthContext.tsx`, `WorkspaceContext.tsx`) that conditionally render routes, buttons, forms, and sensitive data fields based on the authenticated user's resolved role and tenant scope.
2. **Database Engine Layer (PostgreSQL):** Row-Level Security (RLS) policies, stored procedures (`generate_payroll_run`, `lock_payroll_run`, `review_leave_request_atomic`), and database triggers (`trg_guard_attendance_events_immutability`, `trg_guard_payroll_run_lock`, `trg_guard_audit_logs_immutability`) that execute within the database kernel.

This document presents a comprehensive audit of all **7 defined platform roles** across **17 distinct operational domains**, evaluating both layers and highlighting discrepancies, gaps, and defense-in-depth guarantees.

---

## 2. Defined Platform Roles

```
+---------------------------------------------------------------------------------------------------------------+
| Role Identifier     | Display Title           | Operational Scope          | Key Responsibilities             |
+---------------------+-------------------------+----------------------------+----------------------------------+
| super_admin         | Super Administrator     | Global Multi-Tenant        | Cross-tenant governance, setup   |
| client_admin        | Client Administrator    | Single Organization Tenant | Tenant executive, final locks    |
| hr_admin            | HR Administrator        | Single Organization Tenant | Employee onboarding, leaves      |
| payroll_admin       | Payroll Administrator   | Single Organization Tenant | Salary structures, payroll drafts|
| client_manager      | Client General Manager  | Single Organization Tenant | Attendance/leave approvals       |
| location_manager    | Location Manager        | Worksite Scoped            | Worksite attendance/leaves       |
| employee            | Employee (Self-Service) | Individual Employee Scoped | Punch, self leaves, my payslips  |
+---------------------------------------------------------------------------------------------------------------+
```

---

## 3. Seven-Role by 17-Domain Access Control Matrix

### Legend:
- **UI:** Visible in Frontend Navigation & Interface (`ALLOW` / `DENY`)
- **DB:** Permitted by PostgreSQL RLS / Stored Procedures (`ALLOW` / `DENY` / `FILTERED`)
- **MATCH:** `SYNC` = Full alignment between UI and DB; `GAP` = Discrepancy between UI and DB; `DEFENSE` = DB denies request if UI is bypassed.

```
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| Operational Domain                                          | super_admin | client_admin | hr_admin | payroll_admin | client_manager | location_manager | employee |
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 1. Client Directory & Global Tenants                        | UI: ALLOW   | UI: DENY     | UI: DENY | UI: DENY      | UI: DENY       | UI: DENY         | UI: DENY |
|                                                             | DB: ALLOW   | DB: FILTERED | DB: DENY | DB: DENY      | DB: DENY       | DB: DENY         | DB: DENY |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:DEF| MATCH: DEF    | MATCH: DEF     | MATCH: DEF       | MATCH:DEF|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 2. Legal Entity Governance & Multi-Entity                   | UI: ALLOW   | UI: ALLOW    | UI: DENY | UI: DENY      | UI: DENY       | UI: DENY         | UI: DENY |
|                                                             | DB: GAP*    | DB: GAP*     | DB: DENY | DB: DENY      | DB: DENY       | DB: DENY         | DB: DENY |
|                                                             | MATCH: GAP* | MATCH: GAP*  | MATCH:DEF| MATCH: DEF    | MATCH: DEF     | MATCH: DEF       | MATCH:DEF|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 3. Operational Policy & Divisor Settings                    | UI: ALLOW   | UI: ALLOW    | UI: DENY | UI: DENY      | UI: DENY       | UI: DENY         | UI: DENY |
|                                                             | DB: GAP*    | DB: GAP*     | DB: DENY | DB: DENY      | DB: DENY       | DB: DENY         | DB: DENY |
|                                                             | MATCH: GAP* | MATCH: GAP*  | MATCH:DEF| MATCH: DEF    | MATCH: DEF     | MATCH: DEF       | MATCH:DEF|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 4. Employee Master Directory (General Info)                 | UI: ALLOW   | UI: ALLOW    | UI: ALLOW| UI: ALLOW     | UI: ALLOW      | UI: FILTERED     | UI: DENY |
|                                                             | DB: ALLOW   | DB: FILTERED | DB:FILT  | DB: FILTERED  | DB: DENY**     | DB: DENY**       | DB: SELF |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: SYNC   | MATCH: GAP**   | MATCH: GAP**     | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 5. Sensitive Employee Compensation (CTC/Base)               | UI: ALLOW   | UI: ALLOW    | UI: DENY | UI: ALLOW     | UI: DENY       | UI: DENY         | UI: SELF |
|                                                             | DB: ALLOW   | DB: FILTERED | DB: DENY | DB: FILTERED  | DB: DENY       | DB: DENY         | DB: SELF |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: SYNC   | MATCH: DEF     | MATCH: DEF       | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 6. Sensitive Bank Details & Tax Coordinates                 | UI: ALLOW   | UI: ALLOW    | UI: DENY | UI: ALLOW     | UI: DENY       | UI: DENY         | UI: SELF |
|                                                             | DB: ALLOW   | DB: FILTERED | DB: DENY | DB: FILTERED  | DB: DENY       | DB: DENY         | DB: SELF |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: SYNC   | MATCH: DEF     | MATCH: DEF       | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 7. Mobile GPS Clock-In/Out & Biometric Punch                | UI: DENY    | UI: DENY     | UI: DENY | UI: DENY      | UI: DENY       | UI: DENY         | UI: ALLOW|
|                                                             | DB: DENY    | DB: DENY     | DB: DENY | DB: DENY      | DB: DENY       | DB: DENY         | DB: SELF |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: SYNC   | MATCH: SYNC    | MATCH: SYNC      | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 8. Daily Attendance Muster & Command Center                 | UI: ALLOW   | UI: ALLOW    | UI: ALLOW| UI: DENY      | UI: ALLOW      | UI: FILTERED     | UI: SELF |
|                                                             | DB: ALLOW   | DB: FILTERED | DB:FILT  | DB: DENY      | DB: FILTERED   | DB: FILTERED     | DB: SELF |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: DEF    | MATCH: SYNC    | MATCH: SYNC      | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 9. Attendance Regularisation Filing                         | UI: DENY    | UI: DENY     | UI: DENY | UI: DENY      | UI: DENY       | UI: DENY         | UI: ALLOW|
|                                                             | DB: DENY    | DB: DENY     | DB: DENY | DB: DENY      | DB: DENY       | DB: DENY         | DB: SELF |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: SYNC   | MATCH: SYNC    | MATCH: SYNC      | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 10. Attendance Regularisation Approval                      | UI: ALLOW   | UI: ALLOW    | UI: ALLOW| UI: DENY      | UI: ALLOW      | UI: DENY***      | UI: DENY |
|     (Enforcing Anti-Self-Approval)                          | DB: ALLOW   | DB: NO-SELF  | DB:NO-SLF| DB: DENY      | DB: NO-SELF    | DB: DENY***      | DB: DENY |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: DEF    | MATCH: SYNC    | MATCH: SYNC      | MATCH:DEF|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 11. Leave Application Submission                            | UI: DENY    | UI: DENY     | UI: DENY | UI: DENY      | UI: DENY       | UI: DENY         | UI: ALLOW|
|                                                             | DB: DENY    | DB: DENY     | DB: DENY | DB: DENY      | DB: DENY       | DB: DENY         | DB: SELF |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: SYNC   | MATCH: SYNC    | MATCH: SYNC      | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 12. Leave Ledger & Accrual Balances (View)                  | UI: ALLOW   | UI: ALLOW    | UI: ALLOW| UI: ALLOW     | UI: ALLOW      | UI: FILTERED     | UI: SELF |
|                                                             | DB: ALLOW   | DB: FILTERED | DB:FILT  | DB: FILTERED  | DB: FILTERED   | DB: FILTERED     | DB: SELF |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: SYNC   | MATCH: SYNC    | MATCH: SYNC      | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 13. Leave Approval & Rejection (Anti-Self-Approval)         | UI: ALLOW   | UI: ALLOW    | UI: ALLOW| UI: DENY      | UI: ALLOW      | UI: LOC-SCOPED   | UI: DENY |
|                                                             | DB: ALLOW   | DB: NO-SELF  | DB:NO-SLF| DB: DENY      | DB: NO-SELF    | DB: LOC-NO-SELF  | DB: DENY |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: DEF    | MATCH: SYNC    | MATCH: SYNC      | MATCH:DEF|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 14. Payroll Generation & Calculation (Drafts)               | UI: ALLOW   | UI: ALLOW    | UI: DENY | UI: ALLOW     | UI: DENY       | UI: DENY         | UI: DENY |
|                                                             | DB: ALLOW   | DB: FILTERED | DB: DENY | DB: FILTERED  | DB: DENY       | DB: DENY         | DB: DENY |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:DEF| MATCH: SYNC   | MATCH: DEF     | MATCH: DEF       | MATCH:DEF|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 15. Overtime & Variable Overrides                           | UI: ALLOW   | UI: ALLOW    | UI: DENY | UI: ALLOW     | UI: DENY       | UI: DENY         | UI: DENY |
|                                                             | DB: ALLOW   | DB: FILTERED | DB: DENY | DB: FILTERED  | DB: DENY       | DB: DENY         | DB: DENY |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:DEF| MATCH: SYNC   | MATCH: DEF     | MATCH: DEF       | MATCH:DEF|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 16. Terminal Cryptographic Payroll Locking                  | UI: ALLOW   | UI: ALLOW    | UI: DENY | UI: DENY      | UI: DENY       | UI: DENY         | UI: DENY |
|     (Segregation of Duties / Four-Eyes Principle)           | DB: ALLOW   | DB: FILTERED | DB: DENY | DB: DENY      | DB: DENY       | DB: DENY         | DB: DENY |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:DEF| MATCH: DEF    | MATCH: DEF     | MATCH: DEF       | MATCH:DEF|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
| 17. Form XIX Statutory Payslip Retrieval                    | UI: ALLOW   | UI: ALLOW    | UI: ALLOW| UI: ALLOW     | UI: DENY       | UI: DENY         | UI: SELF |
|                                                             | DB: ALLOW   | DB: FILTERED | DB:FILT  | DB: FILTERED  | DB: DENY       | DB: DENY         | DB: PUBL |
|                                                             | MATCH: SYNC | MATCH: SYNC  | MATCH:SYN| MATCH: SYNC   | MATCH: DEF     | MATCH: DEF       | MATCH:SYN|
+-------------------------------------------------------------+-------------+--------------+----------+---------------+----------------+------------------+----------+
```

### Explanatory Notes on Discrepancies:
- `* GAP (Domains 2 & 3):` On `client_legal_entities` and `client_policies`, RLS is active with 0 policies. PostgREST denies direct queries for all non-superusers. The frontend assumes access, but the database defaults to deny-all. (Remediated in Migration 20).
- `** GAP (Domain 4):` In `employees` table, `employees_client_admin_tenant` policy includes `client_admin`, `hr_admin`, `payroll_admin`. `client_manager` and `location_manager` are not included in `employees_client_admin_tenant`. Therefore, direct PostgREST employee directory queries by managers return 0 rows unless querying through an RPC.
- `*** NOTE (Domain 10):` In `attendance_corrections`, `corrections_tenant_admin_all` includes `super_admin`, `client_admin`, `hr_admin`, `client_manager`, but omits `location_manager`. Location Managers cannot approve regularisations at the database layer.

---

## 4. In-Depth Operational Domain Analysis

### 4.1. Domain 5 & 6: Sensitive Compensation & Bank Coordinates
- **Frontend Protection:** The employee directory in `src/app/workspace/EmployeeDirectory.tsx` hides salary and bank tabs for `hr_admin` and `client_manager`.
- **Database RLS Protection:** 
  - On `employee_salary_structures`, `salary_payroll_admin_tenant` strictly limits access to `['client_admin', 'payroll_admin']`.
  - On `employee_bank_details`, `bank_payroll_admin_tenant` strictly limits access to `['client_admin', 'payroll_admin']`.
  - Even if an HR Admin or Manager executes a crafted PostgREST query to `/rest/v1/employee_salary_structures`, PostgreSQL returns **0 rows**.

### 4.2. Domain 10 & 13: Anti-Self-Approval Corporate Governance
- **Operational Rule:** An employee who holds a managerial or administrative role CANNOT approve their own leave request or attendance regularisation.
- **Leave Approval Multi-Layer Protection:**
  1. **Frontend Guard:** In `src/app/workspace/LeaveManagement.tsx`, review action buttons are disabled when `req.employee_id === currentUser.employee_id`.
  2. **RLS Policy Guard:** In `leave_requests_tenant_admin_modify` and `leave_balances_tenant_admin_modify`, the policy includes:
     ```sql
     (employee_id <> get_user_employee_id())
     ```
     Any direct SQL `UPDATE` by an applicant on their own row fails with an RLS permission violation.
  3. **Atomic Stored Procedure Guard:** In `review_leave_request_atomic`:
     ```sql
     IF v_reviewer.employee_id IS NOT NULL AND v_reviewer.employee_id = v_req.employee_id THEN
         RAISE EXCEPTION 'GOVERNANCE_VIOLATION: Employees are strictly prohibited from reviewing their own leave requests.';
     END IF;
     ```

### 4.3. Domain 16: Segregation of Duties in Terminal Payroll Locking (Four-Eyes Principle)
- **Operational Rule:** The persona who prepares the payroll draft (Payroll Admin) must NOT be permitted to execute the terminal cryptographic lock. Only executive personnel (Client Admin or Super Admin) may lock.
- **Multi-Layer Enforcement:**
  1. **Frontend Guard:** In `src/app/workspace/PayrollDashboard.tsx`, the "Lock Payroll" button is conditionally rendered only for `currentUser.role === 'client_admin' || currentUser.role === 'super_admin'`.
  2. **RLS Policy Guard:** On `payroll_runs`, status updates to `'locked'` are guarded by `lock_payroll_run`.
  3. **RPC Authority Guard:** In `lock_payroll_run`:
     ```sql
     IF v_caller_role NOT IN ('super_admin', 'client_admin') THEN
         RAISE EXCEPTION 'SEGREGATION_OF_DUTIES_VIOLATION: Role % cannot lock payroll runs. Only Client Admin or Super Admin may execute formal lock sign-off.', v_caller_role;
     END IF;
     ```
  4. **Post-Lock Immutability Trigger:** Trigger `trg_guard_payroll_run_lock` executing `guard_locked_payroll_modification()` unconditionally throws an exception on any subsequent `UPDATE` or `DELETE` attempt once `status = 'locked'`.

### 4.4. Domain 17: Official Form XIX Payslip Retrieval
- **Operational Rule:** Employees may only view their own payslips, and ONLY after the batch has been formally approved/locked and published.
- **RLS Policy Enforcement:**
  - On `payslips`: `((employee_id = get_user_employee_id()) AND (is_published = true))`
  - On `payroll_items`: `((employee_id = get_user_employee_id()) AND (EXISTS (SELECT 1 FROM payroll_runs r WHERE r.id = payroll_items.run_id AND r.status IN ('approved', 'locked'))))`
  - Result: Employees cannot view provisional calculations or peer salaries.

---

## 5. Security Recommendations for Post-2.4F

1. **Remediate Domain 2 & 3 RLS Gaps:** Deploy Migration 20 to grant tenant-scoped read/write on `client_legal_entities` and `client_policies`.
2. **Harmonize Manager Employee Directory Access:** Update `employees_client_admin_tenant` to include `client_manager` and location-scoped `location_manager` for basic personnel info (excluding salary and bank structures).
3. **Include Location Managers in Corrections RLS:** Update `attendance_corrections` policy to permit `location_manager` approval for employees assigned to their work location.
