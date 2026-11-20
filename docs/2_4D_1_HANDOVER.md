# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4D.1 REMEDIATION & MIGRATION HANDOVER

**Document Version:** 1.0.0  
**Date:** November 14, 2026  
**Auditor / Engineering Lead:** Antigravity Engineering (Google DeepMind)  
**Milestone:** 2.4D.1 Database Migration & Integrity Remediation  
**Target Environment:** Supabase Cloud (`https://mlopgvkvzhwhkbewhefb.supabase.co`)  
**Handover Gate Status:** **CRITICAL STOPPING GATE REACHED — AWAITING USER APPROVAL**  

---

### 1. Executive Summary

Milestone 2.4D.1 (Database Migration & Integrity Remediation) has been fully prepared and verified across all engineering layers. This phase directly remediates all **13 implementation defects** and **7 architectural gaps** identified during the Milestone 2.4D post-implementation audit.

#### Key Highlights & Status:
1. **Four Additive & Idempotent Migrations Authored:**
   - [`20261114000011_leave_schema_and_balance_integrity.sql`](file:///c:/Avencis%20Management/supabase/migrations/20261114000011_leave_schema_and_balance_integrity.sql): Expands `leave_type` to include `COMP_OFF` and enforces strict ledger balance identity `closing = opening + credited - used`.
   - [`20261114000012_atomic_leave_decision_rpc.sql`](file:///c:/Avencis%20Management/supabase/migrations/20261114000012_atomic_leave_decision_rpc.sql): Transactional PostgreSQL RPC (`review_leave_request_atomic`) with `auth.uid()` derivation, pessimistic row locking (`SELECT ... FOR UPDATE`), anti-self-approval, location scoping, balance solvency validation, and authoritative audit logging.
   - [`20261114000013_leave_rls_remediation.sql`](file:///c:/Avencis%20Management/supabase/migrations/20261114000013_leave_rls_remediation.sql): Fixes RLS security across all 7 organizational roles; neutralizes employee direct UPDATE privilege escalation; eliminates Super Admin cross-client lockout; grants Location Manager site access; provides read-only access for Payroll Admin.
   - [`20261114000014_attendance_leave_classification.sql`](file:///c:/Avencis%20Management/supabase/migrations/20261114000014_attendance_leave_classification.sql): Adds `UNPAID_LEAVE` status to daily attendance; links muster rows to leave requests via foreign key; installs trigger `trg_sync_approved_leave_to_muster` to automatically reflect approved leaves in attendance without altering raw punch events.
2. **Policy-Aware Business Logic & UI Enhancements:**
   - Implemented `src/services/leaveCalculationHelper.ts` to compute working leave days by excluding client-configured weekly offs and statutory holidays, handle half-day (0.5d) leaves, and split cross-year spans into per-year accounting buckets.
   - Added Half-Day application toggle in `src/app/portal/EmployeePortal.tsx` with zero disruption to approved Stitch screens.
   - Remediated Attendance Command Center (`src/app/workspace/AttendanceCommandCenter.tsx`) metrics and badges to eliminate false absenteeism on weekends and holidays.
3. **Automated Verification:**
   - Dedicated remediation test suite: **15/15 checks PASSED**.
   - Full regression test suites: **173/173 checks PASSED**.
   - Master verification total: **188/188 automated checks PASSED (100% pass rate)**.
   - TypeScript compiler (`tsc --noEmit`): **Zero errors**.
   - Production Vite build: **Clean pass (Exit code: 0)**.
4. **Mandatory Stop Condition Enforced:**
   - In accordance with Milestone 2.4D instructions, **NO migrations have been executed against the live Supabase instance**.
   - All files are staged and verified. We stop here for explicit customer approval.

---

### 2. Comprehensive Remediation Mapping Matrix (All 20 Audit Findings)

The table below maps all 13 defects and 7 architectural gaps from the Milestone 2.4D audit to their exact resolution:

| Audit Finding ID | Finding Title & Description | Category | Root Cause | Remediation Mechanism | Test Coverage | Resolution Status |
|---|---|---|---|---|---|:---:|
| **GAP-01 / DEF-01** | Non-Atomic Approval Race Hazard | Transactional | `leaveService.ts` executed two separate PostgREST queries for request update and balance deduction. | Created `public.review_leave_request_atomic()` RPC with `SELECT ... FOR UPDATE` row locking. | `TR-09`, `TR-10`, `TR-08` | **RESOLVED** (Staged in Migration 12) |
| **DEF-02** | Employee Privilege Escalation | Security / RLS | RLS policy `leave_requests_employee_all` granted `FOR ALL`, allowing direct `PATCH` updates to `status = 'APPROVED'`. | Replaced with granular `SELECT`, `INSERT (PENDING only)`, and `UPDATE (CANCELLED only)`. | `TR-05`, Static RLS AST check | **RESOLVED** (Staged in Migration 13) |
| **DEF-03** | Super Admin Cross-Tenant Lockout | Security / RLS | RLS policy checked `client_id = public.get_user_client_id()`, but Super Admin profile has `client_id IS NULL`. | Decoupled policy: `USING (public.get_user_role() = 'super_admin')`. | Static RLS check, Service fallback | **RESOLVED** (Staged in Migration 13) |
| **DEF-04** | Location Manager Omission in RLS | Security / RLS | `location_manager` was omitted from managerial RLS policies on `leave_requests` and `leave_balances`. | Added `location_manager` to manager policies with site-level verification in RPC. | Service layer test, RLS check | **RESOLVED** (Staged in Migration 13) |
| **DEF-05** | Client Manager Balance Update Block | Security / RLS | `client_manager` had request update rights but lacked balance update rights (returned 42501). | Authorized balance deduction via `SECURITY DEFINER` atomic RPC function. | Service layer test, `TR-08` | **RESOLVED** (Staged in Migration 12 & 13) |
| **DEF-06** | Payroll Admin Leave Read Block | Security / RLS | `payroll_admin` role had zero `SELECT` policies on leave tables. | Added read-only `SELECT` policies scoped to tenant for `payroll_admin`. | Static RLS check | **RESOLVED** (Staged in Migration 13) |
| **GAP-02 / DEF-07** | LWP Excluded from Attendance Schema | Data Integrity | `daily_attendance_records.status` constraint omitted `UNPAID_LEAVE`. | Expanded constraint to include `'UNPAID_LEAVE'`. | `TR-12`, Schema check | **RESOLVED** (Staged in Migration 14) |
| **GAP-03 / DEF-08** | Disconnected Attendance Muster | Data Integrity | Leave approval did not create or update `daily_attendance_records`. | Added `leave_request_id` FK and PostgreSQL trigger `trg_sync_approved_leave_to_muster`. | `TR-12`, `TR-13` | **RESOLVED** (Staged in Migration 14 & store.ts) |
| **DEF-09** | False Absenteeism in Command Center | UI / Analytics | `AttendanceCommandCenter.tsx` counted weekend non-working employees as absent. | Updated calculation to exclude weekly offs, holidays, and unpaid leave. | UI regression, Store tests | **RESOLVED** (Code only) |
| **GAP-04 / DEF-10** | Naive Calendar-Day Formula | Business Logic | Inclusive formula `(end - start) + 1` counted non-working weekends and holidays. | Implemented `calculateEffectiveLeaveDays()` excluding client-configured weekly offs and holidays. | `TR-01`, `TR-02` | **RESOLVED** (Code only) |
| **DEF-11** | Half-Day Leave Unsupported in UI | Business Logic | Employee portal lacked UI toggle for 0.5-day leave applications. | Added inline Half-Day toggle checkbox when start date equals end date. | `TR-03`, Portal tests | **RESOLVED** (Code only) |
| **DEF-12** | Cross-Year Span Ledger Distortion | Business Logic | `leaveService.ts` derived accounting year solely from `startDate`. | Decomposed cross-year spans into per-year buckets (`daysByYear`). | `TR-04` | **RESOLVED** (Code only) |
| **GAP-05 / DEF-13** | Balance Ledger Invariant Not Enforced | Data Integrity | Schema lacked database-level constraint enforcing `closing = opening + credited - used`. | Added CHECK constraint `chk_leave_balance_identity` to `leave_balances`. | Schema check, Ledger tests | **RESOLVED** (Staged in Migration 11) |
| **GAP-06** | `COMP_OFF` Constraint Conflict | Schema | `leave_balances` and `leave_requests` check constraints omitted `COMP_OFF`, conflicting with seed data. | Expanded `leave_type` check constraints on both tables to include `'COMP_OFF'`. | `testServices.ts`, Schema check | **RESOLVED** (Staged in Migration 11) |
| **GAP-07** | Missing Cross-Tenant Check in Review | Security | `reviewLeaveRequest` did not verify `callerScope.clientId === existing.clientId`. | Added cross-tenant isolation guard in both mock and live paths of `leaveService.ts`. | `TR-06` | **RESOLVED** (Code only) |
| **AUDIT-16** | Anti-Self-Approval Enforcement | Governance | Managers could potentially approve their own leave applications. | Verified and reinforced anti-self-approval in both `leaveService.ts` and `review_leave_request_atomic` RPC. | `TR-05` | **RESOLVED** (Migration 12 & Code) |
| **AUDIT-17** | Silent Balance Clamping Prevention | Data Integrity | UI or service could clamp negative balances via `Math.max(0, ...)`. | Enforced strict balance solvency check returning `VALIDATION_ERROR` when balance is insufficient. | Concurrency matrix, `TR-08` | **RESOLVED** (Migration 12 & Code) |
| **AUDIT-18** | Immutable Raw Attendance Events | Compliance | Risk of modifying raw biometric events during leave approval. | Isolated muster updates strictly to `daily_attendance_records`; zero modification of `attendance_events`. | Schema & Trigger check | **RESOLVED** (Migration 14) |
| **AUDIT-19** | Authoritative Database Timestamps | Security | Browser-supplied timestamps could be spoofed. | Database RPC enforces `NOW() AT TIME ZONE 'utc'` for `reviewed_at` and audit timestamps. | RPC code check | **RESOLVED** (Migration 12) |
| **AUDIT-20** | Payroll Admin Readiness | Integration | Payroll engine could not distinguish paid leave from unpaid leave. | Clear segregation established in both `leave_requests.leave_type` (`LWP` vs paid) and `daily_attendance_records.status` (`PAID_LEAVE` vs `UNPAID_LEAVE`). | `TR-11`, `TR-12`, `TR-13` | **RESOLVED** (Migrations 11, 14 & Types) |

---

### 3. Inventory of Migration Deliverables

All 4 migrations are placed in `supabase/migrations/` and follow strict version numbering:

```
supabase/migrations/
├── 20261103000001_initial_schema_clients_and_entities.sql
├── 20261103000002_locations_departments_and_policies.sql
├── 20261103000003_auth_profiles_and_rbac.sql
├── 20261103000004_employees_and_compensation.sql
├── 20261103000005_attendance_and_regularisations.sql
├── 20261103000006_leave_management.sql
├── 20261103000007_payroll_engine_and_payslips.sql
├── 20261103000008_statutory_and_audit_ledgers.sql
├── 20261103000009_row_level_security_policies.sql
├── 20261103000010_database_triggers_and_guards.sql
├── 20261114000011_leave_schema_and_balance_integrity.sql       <-- MILESTONE 2.4D.1
├── 20261114000012_atomic_leave_decision_rpc.sql                <-- MILESTONE 2.4D.1
├── 20261114000013_leave_rls_remediation.sql                    <-- MILESTONE 2.4D.1
└── 20261114000014_attendance_leave_classification.sql          <-- MILESTONE 2.4D.1
```

---

### 4. Inventory of Code Modifications

| File Path | Type | Key Enhancements & Remediation Logic |
|---|---|---|
| [`src/services/leaveCalculationHelper.ts`](file:///c:/Avencis%20Management/src/services/leaveCalculationHelper.ts) | New Utility | Implemented `calculateEffectiveLeaveDays()`: excludes weekly offs, statutory holidays; supports half-days; decomposes cross-year spans into `daysByYear`. |
| [`src/types/database.types.ts`](file:///c:/Avencis%20Management/src/types/database.types.ts) | Types | Added `COMP_OFF` to `leave_type`, `UNPAID_LEAVE` to `attendance_status`, and `leave_request_id` to `daily_attendance_records`. |
| [`src/types/index.ts`](file:///c:/Avencis%20Management/src/types/index.ts) | Types | Updated `AttendanceRecord` interface to include optional `leaveRequestId?: string`. |
| [`src/services/serviceTypes.ts`](file:///c:/Avencis%20Management/src/services/serviceTypes.ts) | Types | Updated `SubmitLeavePayload` to allow `COMP_OFF` and optional `isHalfDay?: boolean`. |
| [`src/services/leaveService.ts`](file:///c:/Avencis%20Management/src/services/leaveService.ts) | Service | Integrated policy-aware duration calculation, cross-tenant review isolation guards, pre-approval balance solvency validation, and PostgreSQL `review_leave_request_atomic` RPC dispatch. |
| [`src/data/store.ts`](file:///c:/Avencis%20Management/src/data/store.ts) | Mock Store | Synchronized approved leaves into `attendanceRecords` as `PAID_LEAVE` or `UNPAID_LEAVE`; added muster row reversion on cancellation; enforced ledger math identities. |
| [`src/app/portal/EmployeePortal.tsx`](file:///c:/Avencis%20Management/src/app/portal/EmployeePortal.tsx) | UI | Added policy-aware day calculation with client weekly off exclusions; added Half-Day toggle checkbox (0.5d) when `startDate === endDate`. Preserved Stitch UI design. |
| [`src/app/workspace/AttendanceCommandCenter.tsx`](file:///c:/Avencis%20Management/src/app/workspace/AttendanceCommandCenter.tsx) | UI | Added status badges and dropdown items for `UNPAID_LEAVE`, `WEEKLY_OFF`, `HOLIDAY`; eliminated false absenteeism on non-working days. |
| [`scripts/testLeaveRemediation.ts`](file:///c:/Avencis%20Management/scripts/testLeaveRemediation.ts) | Test Suite | Comprehensive 15-test validation suite covering calculations, anti-self-approval, cross-tenant security, balance deduction, concurrency, and attendance sync. |

---

### 5. Verification & Test Suite Summary

All automated test suites pass with a **100% success rate**:

```
========================================================================================
AVENCIS WFM: MASTER TEST EXECUTION REPORT (188/188 CHECKS PASSED)
========================================================================================
1. scripts/testLeaveRemediation.ts       --> 15/15 PASSED (100%)  [Remediation Suite]
2. scripts/testServices.ts               --> 50/50 PASSED (100%)  [Core Services Suite]
3. scripts/testAuthAndWorkspace.ts       --> 13/13 PASSED (100%)  [Auth & Role Scopes]
4. scripts/testClientManagement.ts       --> 20/20 PASSED (100%)  [Tenant & Policy Mgmt]
5. scripts/testEmployeeManagement.ts     --> 28/28 PASSED (100%)  [Employee Lifecycle]
6. scripts/testAttendanceManagement.ts   --> 28/28 PASSED (100%)  [Attendance & Roster]
7. scripts/testLeaveManagement.ts        --> 34/34 PASSED (100%)  [Leave Management Suite]
----------------------------------------------------------------------------------------
Total Automated Test Checks:                 188 / 188 PASSED (100%)
TypeScript Static Check (`tsc --noEmit`):    0 Errors (Clean Compilation)
Production Vite Bundle (`npm run build`):    Successful (836.47 kB bundle)
========================================================================================
```

---

### 6. Documentation Deliverables Index

The following authoritative documents are delivered under `docs/`:

1. [`docs/2_4D_1_REMEDIATION_PLAN.md`](file:///c:/Avencis%20Management/docs/2_4D_1_REMEDIATION_PLAN.md): Master engineering remediation checklist mapping all 20 findings to root causes and fixes.
2. [`docs/2_4D_1_MIGRATION_REVIEW.md`](file:///c:/Avencis%20Management/docs/2_4D_1_MIGRATION_REVIEW.md): In-depth technical review of Migrations 11–14, dependencies, and safety analysis.
3. [`docs/2_4D_1_RLS_REMEDIATION.md`](file:///c:/Avencis%20Management/docs/2_4D_1_RLS_REMEDIATION.md): Detailed role-by-role security review for all 7 organizational roles.
4. [`docs/2_4D_1_TRANSACTIONAL_WORKFLOW.md`](file:///c:/Avencis%20Management/docs/2_4D_1_TRANSACTIONAL_WORKFLOW.md): Step-by-step documentation of the `review_leave_request_atomic` RPC workflow and concurrency handling.
5. [`docs/2_4D_1_ATTENDANCE_INTEGRITY.md`](file:///c:/Avencis%20Management/docs/2_4D_1_ATTENDANCE_INTEGRITY.md): Documentation of attendance leave classification, muster synchronization trigger, and false-absenteeism elimination.
6. [`docs/2_4D_1_TEST_RESULTS.md`](file:///c:/Avencis%20Management/docs/2_4D_1_TEST_RESULTS.md): Detailed verification test results across all 188 checks.
7. [`docs/2_4D_1_DEPLOYMENT_AND_ROLLBACK.md`](file:///c:/Avencis%20Management/docs/2_4D_1_DEPLOYMENT_AND_ROLLBACK.md): Authoritative operational runbook containing deployment steps, individual rollback SQL scripts, and consolidated health-check SQL.
8. [`docs/2_4D_1_HANDOVER.md`](file:///c:/Avencis%20Management/docs/2_4D_1_HANDOVER.md): This master handover gateway document.

---

### 7. Stopping Gate Confirmation & Next Steps

> [!IMPORTANT]
> ### CRITICAL STOPPING GATE REACHED
> **NO DATABASE MIGRATIONS HAVE BEEN APPLIED TO THE LIVE SUPABASE PROJECT.**
> 
> As instructed by the Milestone 2.4D and 2.4D.1 mandate:
> 1. All SQL migration files (`20261114000011` through `20261114000014`) are prepared, staged, and reviewed in `supabase/migrations/`.
> 2. Full forward and reverse rollback SQL scripts are documented in [`docs/2_4D_1_DEPLOYMENT_AND_ROLLBACK.md`](file:///c:/Avencis%20Management/docs/2_4D_1_DEPLOYMENT_AND_ROLLBACK.md).
> 3. Zero destructive operations or data losses have occurred.
> 4. We do **NOT** proceed to Milestone 2.4E (Payroll and Payslips) until you have reviewed this handover and provided your explicit approval to apply the migrations.

#### Operator Approval Form:

| Milestone Gate | Action | Approved By | Approval Date | Sign-off Status |
|---|---|---|---|:---:|
| **2.4D.1** | Apply Migrations 11–14 to Supabase Cloud | *Pending User Approval* | — | **AWAITING APPROVAL** |
| **2.4E** | Proceed to Payroll Engine & Payslips | *Blocked pending 2.4D.1 Approval* | — | **BLOCKED** |
