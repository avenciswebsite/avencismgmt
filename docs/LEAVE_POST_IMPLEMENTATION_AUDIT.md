# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4D POST-IMPLEMENTATION VERIFICATION AUDIT

**Audit Date:** November 14, 2026  
**Auditor:** Antigravity Engineering (Google DeepMind)  
**Milestone:** 2.4D Leave Management & Attendance Integration  
**Operational Scope:** Verification Gate prior to Milestone 2.4E (Payroll and Payslips)  
**Target Repository:** `c:\Avencis Management`  

---

### 1. Executive Summary & Verification Purpose

The Milestone 2.4D automated regression test suite was reported as passing **173/173** checks across 6 test suites, and production builds (`tsc && vite build`) compile with zero errors (exit code 0).

However, a strict post-implementation verification gate was mandated before commencing Milestone 2.4E (Payroll and Payslips). The purpose of this audit is to bypass unit test complacency, interrogate actual source code implementations, evaluate database schema invariants, verify PostgreSQL Row Level Security (RLS) enforcement, examine concurrency failure modes, and establish whether the leave management module is safe to integrate with payroll.

#### Verification Verdict Summary:
- **Baseline Automated Test Suites:** PASS (173/173 passed)
- **TypeScript Compilation (`tsc --noEmit`):** PASS (Exit code 0)
- **Production Bundle Build (`npm run build`):** PASS (Exit code 0, 832.48 kB index chunk)
- **Genuine Implementation Defects Identified:** 13
- **Missing Capabilities / Architectural Gaps:** 7
- **Blocked Live Tests (Unprovisioned Auth):** 1
- **Overall Gateway Decision:** **OUTCOME C: BLOCKED — DATABASE CHANGES REQUIRE APPROVAL**

---

### 2. Regression Suite Execution Record

All six pre-existing test suites were executed sequentially using live environment variables (`--env-file=.env`):

| Test Suite | File Reference | Checks | Passed | Failed | Exit Code | Execution Time |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Service Layer Validation** | `scripts/testServices.ts` | 50 | 50 | 0 | 0 | 8.2s |
| **Auth & Workspace Scoping** | `scripts/testAuthAndWorkspace.ts` | 13 | 13 | 0 | 0 | 7.1s |
| **Client Management** | `scripts/testClientManagement.ts` | 20 | 20 | 0 | 0 | 9.0s |
| **Employee Management & CTC** | `scripts/testEmployeeManagement.ts` | 28 | 28 | 0 | 0 | 9.8s |
| **Attendance & Geofencing** | `scripts/testAttendanceManagement.ts` | 28 | 28 | 0 | 0 | 9.1s |
| **Leave Management** | `scripts/testLeaveManagement.ts` | 34 | 34 | 0 | 0 | 9.4s |
| **Total Automated Regression** | — | **173** | **173** | **0** | **0** | **52.6s** |

#### Build Verification:
```bash
$ npx tsc --noEmit
# Exit code: 0 (No type errors)

$ npm run build
> avencis-workforce-management@1.0.0 build
> tsc && vite build
vite v5.4.21 building for production...
✓ 1666 modules transformed.
dist/index.html                   1.03 kB │ gzip:   0.55 kB
dist/assets/index-CtJDlD8b.css   39.61 kB │ gzip:   7.36 kB
dist/assets/index-DF4SrxtF.js   832.48 kB │ gzip: 196.05 kB
✓ built in 20.55s (Exit code: 0)
```

---

### 3. Key Findings & Critical Gaps Overview

While high-level unit tests passed, in-depth technical inspection uncovered fundamental architectural and transactional defects:

#### 1. Non-Atomic Leave Balance Deduction (Critical Race Hazard)
- `leaveService.reviewLeaveRequest()` in `src/services/leaveService.ts` (lines 423–462) executes two disconnected PostgREST calls:
  1. `UPDATE leave_requests SET status = 'APPROVED'`
  2. `UPDATE leave_balances SET used = ..., closing = ...`
- There is no PostgreSQL transaction boundary (`BEGIN...COMMIT`), stored procedure, or database trigger.
- If two managers approve the same request or concurrent requests simultaneously, lost updates occur and balances can be deducted twice or clamped improperly.
- If the balance update fails (e.g. network partition, timeout, or RLS permission error), the request remains permanently `APPROVED` with zero balance deduction.

#### 2. Discrepancies Between Database RLS and Permission Matrix
- In `supabase/migrations/20261103000009_row_level_security_policies.sql`:
  - **Super Admin Locked Out:** `leave_balances_tenant_admin_all` and `leave_requests_tenant_admin_all` enforce `client_id = public.get_user_client_id()`. A Super Admin whose profile has `client_id IS NULL` is rejected from all client records under RLS.
  - **Location Manager Missing:** The matrix specifies Location Managers can approve leave for their location. Location Managers are completely omitted from `leave_requests_tenant_admin_all` and `leave_balances_tenant_admin_all`.
  - **Client Manager Permission Mismatch:** Client Managers can update `leave_requests`, but are excluded from `leave_balances_tenant_admin_all`. An approval by a Client Manager fails on balance update with PostgreSQL error `42501 (insufficient_privilege)`.
  - **Critical Privilege Escalation Vulnerability:** The policy `leave_requests_employee_all` uses `FOR ALL TO authenticated USING (employee_id = public.get_user_employee_id())`. This permits authenticated employees to issue direct PostgREST `UPDATE` statements setting `status = 'APPROVED'` on their own leave requests.
  - **Payroll Admin Blocked:** `payroll_admin` has no SELECT policy on `leave_requests`, meaning the payroll engine cannot read leave records under RLS.

#### 3. Naive Calendar-Day Formula vs Working-Day Calculation
- `EmployeePortal.tsx` line 253 computes duration as:
  $$\text{days} = \text{Math.round}\left(\frac{\text{diffTime}}{86400000}\right) + 1$$
- This inclusive calendar-day count blindly deducts Saturdays, Sundays, configured company holidays, and weekly offs from an employee's paid leave balance.
- Half-day leaves (0.5 days) cannot be applied for in the UI despite `NUMERIC(4,1)` schema support.
- Cross-year applications (e.g., Dec 30 to Jan 3) deduct all days from the starting year without ledger splitting.

#### 4. Disconnected Attendance Integration & False Absenteeism
- `leaveService.reviewLeaveRequest()` does not insert or update records in `daily_attendance_records`.
- `AttendanceCommandCenter.tsx` lines 67–95 only queries `daily_attendance_records` and never queries `leave_requests`.
- Consequently, employees on approved leave have no attendance records and are counted under `absentCount = totalRoster - (present + halfDay + leave)`.
- The UI actively displays "Triggers LWP Deduction" for these employees, meaning employees on approved paid leave will suffer erroneous salary cuts if integrated with payroll in this state.
- In `supabase/migrations/20261103000005_attendance_and_regularisations.sql`, the check constraint on `daily_attendance_records.status` does not permit `'UNPAID_LEAVE'` or `'LWP'`.

#### 5. Schema Constraint Conflict on `COMP_OFF`
- `src/data/mockData.ts` line 709 seeds `COMP_OFF` balance for Maha Logistics (`emp-maha-01`).
- In `supabase/migrations/20261103000006_leave_management.sql`, line 11:
  `CHECK (leave_type IN ('PL', 'CL', 'SL'))`
- Attempting to load or sync this data into Supabase will fail with a check constraint violation.

---

### 4. Structure of Audit Documentation Suite

The complete verification audit is documented across eight modular reports:

1. [LEAVE_POST_IMPLEMENTATION_AUDIT.md](file:///c:/Avencis%20Management/docs/LEAVE_POST_IMPLEMENTATION_AUDIT.md) — Comprehensive executive summary, test metrics, and findings index.
2. [LEAVE_TRANSACTION_INTEGRITY_REPORT.md](file:///c:/Avencis%20Management/docs/LEAVE_TRANSACTION_INTEGRITY_REPORT.md) — Concurrency, atomic deduction, partial failure analysis, and proposed transactional PostgreSQL RPC.
3. [LEAVE_RLS_VERIFICATION_REPORT.md](file:///c:/Avencis%20Management/docs/LEAVE_RLS_VERIFICATION_REPORT.md) — Role-by-role comparison against `docs/LEAVE_APPROVAL_PERMISSION_MATRIX.md`, privilege escalation audit, and proposed SQL policies.
4. [LEAVE_DAY_CALCULATION_VERIFICATION.md](file:///c:/Avencis%20Management/docs/LEAVE_DAY_CALCULATION_VERIFICATION.md) — Inclusive calendar day vs policy-aware working day calculation audit and test cases.
5. [LEAVE_LWP_ATTENDANCE_VERIFICATION.md](file:///c:/Avencis%20Management/docs/LEAVE_LWP_ATTENDANCE_VERIFICATION.md) — LWP vs Paid Leave classification, attendance muster overlay, and false-absenteeism impact.
6. [LEAVE_BALANCE_LEDGER_VERIFICATION.md](file:///c:/Avencis%20Management/docs/LEAVE_BALANCE_LEDGER_VERIFICATION.md) — Entitlement math ($opening + credited - used = closing$), accrual gap analysis, and schema compatibility.
7. [LEAVE_FINAL_SECURITY_GAP_REPORT.md](file:///c:/Avencis%20Management/docs/LEAVE_FINAL_SECURITY_GAP_REPORT.md) — Complete security vulnerability register and fail-closed recommendations.
8. [MILESTONE_2_4D_FINAL_VERIFICATION_HANDOVER.md](file:///c:/Avencis%20Management/docs/MILESTONE_2_4D_FINAL_VERIFICATION_HANDOVER.md) — Final formal sign-off gateway, issue classification matrix, and proposed migrations awaiting approval.
