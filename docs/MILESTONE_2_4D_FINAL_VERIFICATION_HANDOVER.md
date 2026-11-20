# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4D FINAL VERIFICATION HANDOVER GATEWAY

**Document Version:** 1.0.0  
**Date:** November 14, 2026  
**Auditor / Engineering Lead:** Antigravity Engineering (Google DeepMind)  
**Milestone:** 2.4D (Leave Management & Attendance Integration)  
**Next Target Milestone:** Milestone 2.4E (Payroll and Payslips) — **PAUSED / ON HOLD**  

---

### 1. Final Gateway Outcome

```
================================================================================
                    MILESTONE 2.4D GATEWAY VERDICT:
          OUTCOME C — BLOCKED: DATABASE CHANGES REQUIRE APPROVAL
================================================================================
```

#### Decision Justification:
While the automated regression test suite passes **173/173** checks and the TypeScript compiler and production build succeed with zero errors, technical inspection of the database schema, SQL RLS policies, concurrency mechanics, and attendance integration revealed **critical blockers** that prevent safe progression to Milestone 2.4E (Payroll and Payslips):

1. **Transaction Hazard:** Leave approval (`reviewLeaveRequest`) is non-atomic and executes as multiple uncoordinated PostgREST queries. A transactional PostgreSQL function (`approve_leave_request_atomic`) with row locks is mandatory.
2. **Database RLS Policy Deficiencies:**
   - Super Admin is locked out of multi-tenant leave administration due to `client_id = public.get_user_client_id()`.
   - Location Manager is authorized in the permission matrix but completely omitted from database RLS policies.
   - Client Manager is blocked from updating `leave_balances` upon approval.
   - Employees possess `FOR ALL` RLS privileges on `leave_requests`, enabling direct self-approval via PostgREST.
   - Payroll Admin has no read access to `leave_requests`, blocking payroll leave consumption.
3. **Database Schema Constraints:**
   - `daily_attendance_records.status` check constraint rejects `'UNPAID_LEAVE'` and `'LWP'`.
   - `leave_balances.leave_type` check constraint rejects `'COMP_OFF'` (present in Maha Logistics seed data).
4. **False Absenteeism Risk:**
   - Approved leave is never written to `daily_attendance_records`.
   - In `AttendanceCommandCenter.tsx`, staff on approved leave are counted as ABSENT and flagged "Triggers LWP Deduction". If payroll is executed in this state, employees on approved paid leave will suffer unjustified salary cuts.

Under Strict Rule 1, database migrations must not be silently applied. The required SQL migrations have been drafted and presented for explicit stakeholder review and approval.

---

### 2. Comprehensive Issue Classification Matrix

Every verified issue across the Milestone 2.4D technical audit is classified below:

| ID | Issue Domain | Verification Item | Classification | File / Line Reference | Evidence / Details |
|---|---|---|:---:|---|---|
| **ISS-01** | **Regression** | 6 Automated Test Suites (173 checks) | **PASS** | `scripts/test*.ts` | 173/173 tests passed cleanly with `--env-file=.env`. |
| **ISS-02** | **Compilation** | TypeScript Typecheck (`tsc --noEmit`) | **PASS** | `tsconfig.json` | Clean exit with code 0. |
| **ISS-03** | **Build** | Production Bundle (`npm run build`) | **PASS** | `vite.config.ts` | Clean build in 20.55s, bundle 832.48 kB. |
| **ISS-04** | **Leave Math** | Weekend (Sat/Sun) Exclusion | **NOT IMPLEMENTED** | `EmployeePortal.tsx:253` | Counts calendar days `(end - start) + 1`; debits weekends from leave balance. |
| **ISS-05** | **Leave Math** | Client-Specific Weekly Offs | **NOT IMPLEMENTED** | `leaveService.ts:90` | `client_policies.weekly_off_days` is ignored during leave application. |
| **ISS-06** | **Leave Math** | Public & Company Holidays | **NOT IMPLEMENTED** | `statutory_holidays` | Table exists in schema but is never checked during leave application. |
| **ISS-07** | **Leave Math** | Half-Day Leave Application | **NOT IMPLEMENTED** | `EmployeePortal.tsx:705` | UI only has integer date pickers; cannot apply for 0.5 day leave. |
| **ISS-08** | **Leave Math** | Cross-Year Balance Splitting | **FAIL** | `leaveService.ts:201` | Year derived from `startDate`; all days debited from first year. |
| **ISS-09** | **Transaction** | Multi-Table Atomic Approval | **FAIL** | `leaveService.ts:423-462` | 2 separate PostgREST calls; no PostgreSQL transaction or RPC function. |
| **ISS-10** | **Transaction** | Pessimistic Row Locking | **NOT IMPLEMENTED** | `leaveService.ts:393` | No `FOR UPDATE` lock; concurrent approvals produce lost updates. |
| **ISS-11** | **Transaction** | Approval-Time Balance Solvency | **FAIL** | `leaveService.ts:440` | No balance re-check before approval; overdrawing clamps to 0. |
| **ISS-12** | **Transaction** | Partial Failure Recovery | **FAIL** | `leaveService.ts:435` | If balance update fails, request remains APPROVED with 0 deduction. |
| **ISS-13** | **Transaction** | Proposed Transactional RPC | **REQUIRES APPROVAL** | `docs/LEAVE_TRANSACTION_INTEGRITY_REPORT.md` | Stored procedure `approve_leave_request_atomic` drafted; awaiting sign-off. |
| **ISS-14** | **Security/RLS** | Employee Direct Self-Approval | **FAIL** | `20261103000009:146` | Policy uses `FOR ALL`; employee can update own request to APPROVED. |
| **ISS-15** | **Security/RLS** | Super Admin Cross-Tenant Lockout | **FAIL** | `20261103000009:143,153` | Enforces `client_id = get_user_client_id()`; NULL locks out Super Admin. |
| **ISS-16** | **Security/RLS** | Location Manager Omission | **FAIL** | `20261103000009:153` | Location Manager omitted from `leave_requests_tenant_admin_all`. |
| **ISS-17** | **Security/RLS** | Client Manager Balance Update Block | **FAIL** | `20261103000009:143` | Client Manager omitted from `leave_balances`; gets RLS error 42501 on review. |
| **ISS-18** | **Security/RLS** | Payroll Admin Leave Read Block | **FAIL** | `20261103000009:158` | Payroll Admin has no SELECT policy on leave tables. |
| **ISS-19** | **Security/RLS** | Proposed RLS Policy Fixes | **REQUIRES APPROVAL** | `docs/LEAVE_RLS_VERIFICATION_REPORT.md` | Complete replacement policies drafted; awaiting sign-off. |
| **ISS-20** | **LWP/Paid** | LWP Exemption from Balance Check | **PASS** | `leaveService.ts:138,200` | LWP applications correctly bypass balance solvency checks. |
| **ISS-21** | **LWP/Paid** | LWP Zero Deduction on Approval | **PASS** | `leaveService.ts:440` | Approving LWP does not touch `leave_balances`. |
| **ISS-22** | **LWP/Paid** | LWP Status in Daily Attendance | **FAIL** | `20261103000005:32` | Schema check constraint rejects `'UNPAID_LEAVE'` and `'LWP'`. |
| **ISS-23** | **Attendance** | Automatic Muster Population | **NOT IMPLEMENTED** | `leaveService.ts:440` | Approving leave does not create rows in `daily_attendance_records`. |
| **ISS-24** | **Attendance** | False Absenteeism Hazard | **FAIL** | `AttendanceCommandCenter.tsx:140` | Approved leave staff counted in `absentCount` ("Triggers LWP Deduction"). |
| **ISS-25** | **Attendance** | Weekend/Holiday Counted Absent | **FAIL** | `AttendanceCommandCenter.tsx:140` | Roster metric does not exclude weekly offs or declared holidays. |
| **ISS-26** | **Attendance** | Punch Events Immutability | **PASS** | `20261103000010:72` | `attendance_events` protected by immutability trigger. |
| **ISS-27** | **Ledger** | Balance Identity ($O+C-U=Cl$) | **PASS** | `mockData.ts:701` | Balance formula verified consistent across all active mock rows. |
| **ISS-28** | **Ledger** | Automated Accrual Engine | **NOT IMPLEMENTED** | System Architecture | Monthly accruals, carry-forward, and expiry are not implemented. |
| **ISS-29** | **Ledger** | `COMP_OFF` Schema Compatibility | **FAIL** | `20261103000006:11` | Check constraint allows only PL, CL, SL; rejects COMP_OFF. |
| **ISS-30** | **Live Auth** | Supabase Auth Test Personas | **BLOCKED** | Live Backend Auth | Live Supabase instance has zero passwords provisioned in `auth.users`. |

---

### 3. Summary of Proposed Database Migrations Awaiting Approval

To resolve all FAIL and NOT IMPLEMENTED defects before Milestone 2.4E, three consolidated SQL migrations are prepared for approval:

1. **Migration 20261114000001_atomic_leave_approval_rpc.sql:**
   - Implements `public.approve_leave_request_atomic(p_request_id, p_reviewer_id, p_remarks)` with row locking (`FOR UPDATE`), balance validation, anti-self-approval, and audit logging.
2. **Migration 20261114000002_fix_leave_rls_policies.sql:**
   - Revokes `FOR ALL` from employees on `leave_requests` (restricting them to SELECT, INSERT PENDING, and UPDATE CANCELLED).
   - Fixes Super Admin global access by removing `client_id = get_user_client_id()` check.
   - Adds Location Manager to `leave_requests` and `leave_balances`.
   - Adds Client Manager to `leave_balances`.
   - Adds read-only SELECT policies for `payroll_admin`.
3. **Migration 20261114000003_attendance_and_balance_schema_fixes.sql:**
   - Expands `daily_attendance_records.status` to include `'UNPAID_LEAVE'`.
   - Adds `leave_request_id` foreign key on `daily_attendance_records`.
   - Expands `leave_balances.leave_type` to include `'COMP_OFF'`.
   - Adds sync trigger `trg_sync_approved_leave_to_muster` to automatically populate daily attendance when leave is approved.

---

### 4. Stopping Gate

In strict adherence to instructions:
- No database migrations have been executed.
- No existing UI or Stitch designs have been altered.
- Milestone 2.4E (Payroll and Payslips) has **NOT** been started.
- Antigravity is stopped at this gate and awaits explicit stakeholder approval on the proposed migrations and findings.
