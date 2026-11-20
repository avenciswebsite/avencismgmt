# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4D.1 REMEDIATION PLAN & GAP RESOLUTION MATRIX

**Document Version:** 1.0.0  
**Date:** November 14, 2026  
**Auditor / Engineering Lead:** Antigravity Engineering (Google DeepMind)  
**Milestone:** 2.4D.1 Database Migration & Integrity Remediation  
**Status:** Remediations Prepared & Validated — Awaiting Migration Approval  

---

### 1. Executive Summary

Following the comprehensive Milestone 2.4D post-implementation audit, 13 implementation defects and 7 architectural gaps were identified. This document serves as the master engineering plan detailing the root cause, required correction, affected database objects, affected source code files, verification test coverage, and migration requirements for every identified finding.

---

### 2. Comprehensive Remediation Checklist

| ID | Finding / Gap | Root Cause | Required Correction | Affected DB Objects | Affected Code Files | Test Required | Migration Req? |
|---|---|---|---|---|---|---|:---:|
| **REM-01** | Non-Atomic Approval Race Hazard | Approval split into 2 separate PostgREST queries in `leaveService.ts:423-462`. | Wrap approval in PostgreSQL stored procedure with `SELECT ... FOR UPDATE` row locking. | Stored Procedure: `public.review_leave_request_atomic` | `leaveService.ts`, `store.ts` | Concurrency double-approval test, balance deduction test | **YES** (Migration 12) |
| **REM-02** | Employee Direct Status Modification | RLS policy `leave_requests_employee_all` granted `FOR ALL`, including `UPDATE`. | Split policy into granular `SELECT`, `INSERT (PENDING only)`, and `UPDATE (CANCELLED only)`. | Policy: `leave_requests_employee_*` | `20261114000013_leave_rls_remediation.sql` | Direct PostgREST UPDATE tamper test | **YES** (Migration 13) |
| **REM-03** | Super Admin Cross-Tenant Lockout | RLS enforced `client_id = public.get_user_client_id()`; Super Admin profile has `client_id IS NULL`. | Decouple Super Admin policies from `client_id` check: `USING (public.get_user_role() = 'super_admin')`. | Policies: `leave_requests_super_admin_all`, `leave_balances_super_admin_all` | `20261114000013_leave_rls_remediation.sql` | Super Admin cross-client query test | **YES** (Migration 13) |
| **REM-04** | Location Manager Omission in RLS | `location_manager` role omitted from `leave_requests_tenant_admin_all`. | Add `location_manager` to manager policies with site-level verification in RPC. | Policies: `leave_requests_tenant_admin_*`, `leave_balances_tenant_admin_*` | `20261114000013_leave_rls_remediation.sql`, `20261114000012_atomic_leave_decision_rpc.sql` | Location Manager queue and review test | **YES** (Migration 13) |
| **REM-05** | Client Manager Balance Update Block (42501) | `client_manager` permitted to update requests but omitted from `leave_balances_tenant_admin_all`. | Authorize manager balance deductions through `SECURITY DEFINER` RPC. | Table: `public.leave_balances` | `leaveService.ts`, Migration 12 | Client Manager approval and balance update test | **YES** (Migration 12 & 13) |
| **REM-06** | Payroll Admin Leave Read Block | `payroll_admin` had zero SELECT policies on `leave_requests` and `leave_balances`. | Add read-only `SELECT` policies for `payroll_admin` scoped to client tenant. | Policies: `leave_requests_payroll_admin_select`, `leave_balances_payroll_admin_select` | `20261114000013_leave_rls_remediation.sql` | Payroll Admin directory retrieval test | **YES** (Migration 13) |
| **REM-07** | LWP Excluded from Attendance Schema | `daily_attendance_records.status` CHECK constraint omitted `'UNPAID_LEAVE'`. | Expand CHECK constraint to include `'UNPAID_LEAVE'`. | Constraint: `daily_attendance_records_status_check` | `20261114000014_attendance_leave_classification.sql`, `database.types.ts`, `index.ts` | Insert muster record with status UNPAID_LEAVE | **YES** (Migration 14) |
| **REM-08** | Disconnected Muster Synchronization | `reviewLeaveRequest` did not create or link attendance records. | Add `leave_request_id` FK and PostgreSQL trigger `trg_sync_approved_leave_to_muster`. | Column: `daily_attendance_records.leave_request_id`, Trigger: `trg_sync_approved_leave_to_muster` | `20261114000014_attendance_leave_classification.sql`, `store.ts` | Approved leave reflected in attendance muster | **YES** (Migration 14) |
| **REM-09** | False Absenteeism in Command Center | `AttendanceCommandCenter.tsx` did not account for unpaid leave or weekly offs. | Enhance metric calculation to subtract unpaid leave, weekly offs, and holidays. | None (Frontend logic) | `AttendanceCommandCenter.tsx` | Weekend attendance view reports 0 false absences | **NO** (Code only) |
| **REM-10** | Naive Calendar-Day Formula | `EmployeePortal.tsx` used `(end - start) + 1` calendar days. | Create `calculateEffectiveLeaveDays` excluding weekly offs and holidays. | None (Service logic) | `leaveCalculationHelper.ts`, `EmployeePortal.tsx`, `leaveService.ts` | Fri-Mon leave calculates 2 days for Sat-Sun off | **NO** (Code only) |
| **REM-11** | Half-Day Leave Unsupported in UI | Form lacked half-day toggle despite `NUMERIC(4,1)` schema support. | Add Half-Day toggle checkbox when `startDate === endDate`. | None (Frontend UI) | `EmployeePortal.tsx`, `serviceTypes.ts` | Submit 0.5 day leave application | **NO** (Code only) |
| **REM-12** | Cross-Year Span Ledger Distortion | `leaveService.ts` derived year solely from `startDate`. | Decompose cross-year spans into per-year buckets (`daysByYear`). | None (Service logic) | `leaveCalculationHelper.ts`, `leaveService.ts` | Dec 30 - Jan 3 splits days into 2026 and 2027 | **NO** (Code only) |
| **REM-13** | Balance Ledger Invariant Not Enforced | Schema lacked CHECK constraint verifying `closing = opening + credited - used`. | Add table CHECK constraint `chk_leave_balance_identity`. | Constraint: `chk_leave_balance_identity` on `leave_balances` | `20261114000011_leave_schema_and_balance_integrity.sql` | Update used without updating closing rejected | **YES** (Migration 11) |
| **REM-14** | `COMP_OFF` Constraint Conflict | `leave_balances.leave_type` CHECK only allowed `('PL', 'CL', 'SL')` while seed data had `COMP_OFF`. | Expand CHECK constraints to include `'COMP_OFF'`. | Constraints: `leave_balances_leave_type_check`, `leave_requests_leave_type_check` | `20261114000011_leave_schema_and_balance_integrity.sql`, `database.types.ts` | Insert COMP_OFF balance row | **YES** (Migration 11) |
| **REM-15** | Missing Cross-Tenant Check in Review | `reviewLeaveRequest` did not check `callerScope.clientId === existing.clientId`. | Add cross-tenant isolation guard in `reviewLeaveRequest`. | None (Service logic) | `leaveService.ts` | Cross-tenant review returns PERMISSION_ERROR | **NO** (Code only) |

---

### 3. Implementation Phasing & Boundaries

1. **Database Schema & RPC Migrations (Migrations 11–14):**
   - Prepared in `supabase/migrations/`.
   - Strictly frozen and awaiting approval before live application.
2. **Service Layer & Business Logic:**
   - Implemented `src/services/leaveCalculationHelper.ts`.
   - Updated `src/services/leaveService.ts` and `src/data/store.ts`.
   - Full mock and fallback compatibility ensured.
3. **User Interface Refinements:**
   - Half-day application toggle in `src/app/portal/EmployeePortal.tsx`.
   - False-absenteeism prevention and status badges in `src/app/workspace/AttendanceCommandCenter.tsx`.
   - Existing approved Stitch layout and visual styling 100% preserved.
