# Avencis WFM — Milestone 2.5: Business Integrity & Domain Workflow Audit
**Document ID:** `DOC-WFM-2.5-INTEG-001`  
**Date:** 2026-11-16  
**Status:** COMPLETE / RIGOROUSLY AUDITED  
**Domains Covered:** Attendance Telemetry, Leave Ledgers, Payroll Engine  
**PostgreSQL Version:** 17.11  

---

## 1. Executive Summary & Domain Scope

Security in an enterprise Workforce Management system extends beyond authentication and network firewalls to encompass **business process integrity**. A system that allows managers to approve their own leaves, allows preparers to lock payroll unreviewed, or allows historical compensation records to mutate upon salary revisions is fundamentally compromised.

This document audits the integrity controls, invariant rules, and procedural guards across the three core operational modules:
1. **Attendance Telemetry & Regularisation Engine**
2. **Leave Accounting Ledger & Approval Workflow**
3. **Payroll Calculation Engine & Segregation of Duties**

---

## 2. Attendance Domain Integrity & Immutability

### 2.1 Raw Punch Telemetry Ledger (`attendance_events`)
- **Immutability Invariant:** Once recorded, raw biometric or mobile punch events can **never** be edited or deleted.
- **Engine Enforcement:** Guard trigger `guard_immutable_attendance_events()` on `attendance_events`:
  ```sql
  CREATE OR REPLACE FUNCTION public.guard_immutable_attendance_events()
  RETURNS TRIGGER AS $$
  BEGIN
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Attendance telemetry events are strictly immutable'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END;
  $$;
  ```
- **Audit Verification:** Confirmed active on live database. Direct SQL updates or deletions are rejected by the engine.

### 2.2 Geofencing & GPS Telemetry
- **Haversine Distance Engine:** Verifies that punches occur within the authorized radius of the assigned work location (default 150m).
- **Graceful Handling of Telemetry:** If GPS accuracy is degraded (>100m) or punch coordinates fall outside the geofence, the event is flagged as `OUT_OF_BOUNDS` / `is_suspicious = true` for managerial review rather than crashing or silently corrupting coordinates.

### 2.3 Anti-Self-Approval for Attendance Regularisations
- **Governance Invariant:** No employee or manager may approve their own attendance regularisation request.
- **Enforcement:** Enforced in `attendance_corrections` RLS policies via:
  `employee_id <> get_user_employee_id()`.

---

## 3. Leave Domain Accounting & Atomic Workflows

### 3.1 Balance Accounting Invariant
- **Mathematical Formula:** For every active balance row:
  $$\text{Closing Balance} = \text{Opening Balance} + \text{Credited} - \text{Used}$$
- **Invariant Verification:** Tested across all active balance records. Pending requests do not prematurely deduct balances; rejected or cancelled requests never reduce available leave.

### 3.2 Atomic Leave Decision RPC (`review_leave_request_atomic`)
- **Vulnerability Prevented:** In distributed systems, approving a request and deducting a leave balance via two separate HTTP requests creates a race condition where network interruption leaves a request approved with zero balance deduction.
- **Remediation:** Executed via PostgreSQL `SECURITY DEFINER` atomic stored procedure:
  ```sql
  CREATE OR REPLACE FUNCTION public.review_leave_request_atomic(
    p_request_id uuid,
    p_decision varchar,
    p_manager_remarks text
  ) RETURNS jsonb ...
  ```
- Within a single ACID database transaction:
  1. Validates that reviewer is not the applicant (`applicant_id <> auth.uid()`).
  2. Updates request status (`APPROVED` or `REJECTED`).
  3. Increments `used` days on `leave_balances` if approved.
  4. Triggers automatic insertion into `daily_attendance_records` as `PAID_LEAVE`.
  5. If any step fails, the entire transaction rolls back.

---

## 4. Payroll Engine Integrity & Segregation of Duties

### 4.1 Attendance Finalization Gate
- **Business Rule:** Payroll cannot be generated or approved while pending attendance corrections or unfinalized punch records exist for that pay period.
- **Verification:** Tested in `scripts/testPayrollIntegration.ts` (Test 01 & 02). Attempting to calculate or approve payroll with unresolved regularisations is strictly blocked.

### 4.2 Segregation of Duties (Four-Eyes Principle)
- **Governance Invariant:** The individual who calculates or prepares a payroll batch (`payroll_admin`) cannot execute the terminal lock. Terminal locking requires formal executive sign-off (`client_admin` or `super_admin`).
- **Enforcement:** Enforced in `lock_payroll_run()` stored procedure:
  - If caller role is `payroll_admin`, the lock operation is rejected.
  - Only `client_admin` or `super_admin` identities can sign off and lock the run.

### 4.3 Terminal Immutability & Salary Revision Invariant
- **Terminal Lock:** Once a payroll batch transitions to `LOCKED`, the trigger `guard_locked_payroll_modification()` activates on `payroll_runs` and `payroll_items`.
- **Salary Revision Invariant:** Subsequent promotions, pay raises, or retroactive CTC adjustments applied to the `employee_salary_structures` table do **not** alter historical locked payroll runs, line items, or published payslips. Historical net pay and gross earnings remain frozen in stone.

---

## 5. Verification Sign-off

The business integrity controls across Attendance, Leave, and Payroll are mathematically verified, protected by atomic database procedures, and guarded by PostgreSQL engine-level triggers.
