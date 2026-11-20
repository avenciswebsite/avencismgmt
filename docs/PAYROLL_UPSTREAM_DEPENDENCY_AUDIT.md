# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E: PAYROLL MANAGEMENT
## UPSTREAM MODULE DEPENDENCY & INTEGRATION AUDIT

> **Document:** `docs/PAYROLL_UPSTREAM_DEPENDENCY_AUDIT.md`  
> **Status:** AUTHORITATIVE INTEGRATION AUDIT  
> **Milestone:** 2.4E (Payroll Management)  
> **Dependencies Audited:** Employee Management, Attendance Management, Leave Management  

---

## 1. EMPLOYEE MANAGEMENT INTEGRATION AUDIT

### 1.1 Salary Structure Storage & History [VERIFIED FACT]
- **Storage Model:** Salary structures are decoupled from `employees` into `employee_salary_structures`.
- **Granular Components in Schema:**
  - `fixed_monthly_base NUMERIC(12,2)`
  - `hra NUMERIC(12,2)`
  - `conveyance NUMERIC(12,2)`
  - `special_allowances NUMERIC(12,2)`
  - `variable_incentives NUMERIC(12,2)`
- **Effective Dating & Historical Tracking:**
  - Schema includes `effective_from DATE NOT NULL`, `effective_to DATE`, and `is_active BOOLEAN NOT NULL DEFAULT TRUE`.
  - **Gap Identified [VERIFIED FACT]:** Currently, the database lacks a partial unique index ensuring that only *one* row has `is_active = TRUE` per employee at any given time. If two active records exist, a payroll calculation query could fail or return inconsistent results.
- **Component Configurability [EXISTING IMPLEMENTATION]:**
  - In `employee_salary_structures`, standard Indian allowances (`HRA`, `Conveyance`, `Special Allowances`) are fixed columns.
  - Custom or client-specific allowances (e.g., Medical, Uniform, Shift Allowance) cannot be added dynamically without schema modification or storing a JSONB payload.

### 1.2 Legal Employer vs. Payroll Responsibility [VERIFIED FACT]
- **Schema Representation:**
  - `employees.client_id UUID` indicates the tenant client.
  - `employees.legal_entity_id UUID REFERENCES client_legal_entities(id)` indicates the registered corporate employer holding the PAN/TAN and responsible for statutory tax remittances.
- **Employment Arrangements Supported:**
  - `DIRECT_PERMANENT` — On payroll of client legal entity.
  - `DIRECT_CONTRACT` — Fixed-term contract under client legal entity.
  - `DEPUTED_STAFFING` — Deployed at client, but payroll responsibility may belong to Avencis or staffing vendor.
  - `INTERN` — Stipend-based, exempt from EPF/ESIC wage thresholds.
- **Payroll Risk [UNRESOLVED DECISION]:**
  - Does a single monthly payroll run cover all employment arrangements, or must `DEPUTED_STAFFING` and `INTERN` employees be processed in segregated sub-runs?

### 1.3 Employee Bank Details Security [VERIFIED FACT]
- **Storage Model:** Decoupled into `employee_bank_details` with `UNIQUE (employee_id)`.
- **Sensitive Fields:** `bank_name`, `account_number`, `ifsc_code`, `account_type`.
- **Security Boundary:**
  - RLS policy `bank_payroll_admin_tenant` strictly limits access to `super_admin`, `client_admin`, and `payroll_admin`.
  - HR Admins and Location Managers are denied access (HTTP 403 / zero rows).
- **Payroll Risk [VERIFIED FACT]:**
  - If an employee has no record in `employee_bank_details` or `is_verified = FALSE`, the payroll engine must flag a payout disbursement warning but should still calculate earnings.

---

## 2. ATTENDANCE MANAGEMENT INTEGRATION AUDIT

### 2.1 Daily Attendance Muster & Status Taxonomy [VERIFIED FACT]
- **Table:** `daily_attendance_records`
- **Comprehensive 9-Status Taxonomy:**
  - `PRESENT`: Full day worked (1.0 paid day).
  - `ABSENT`: Unexcused absence (0.0 paid day, 1.0 unpaid day).
  - `HALF_DAY`: Partial day worked (0.5 paid day, 0.5 unpaid day).
  - `LATE`: Arrival after grace period. (Subject to client late penalty rules).
  - `ON_DUTY`: Approved outdoor client assignment (1.0 paid day).
  - `PAID_LEAVE`: Approved leave with pay (1.0 paid day, 0.0 unpaid day).
  - `UNPAID_LEAVE`: Approved Leave Without Pay (LWP) (0.0 paid day, 1.0 unpaid day).
  - `WEEKLY_OFF`: Configured rest day (e.g. Sunday) (1.0 paid day under monthly wage rules).
  - `HOLIDAY`: Declared statutory or client holiday (1.0 paid day).

### 2.2 Attendance Corrections & Finalization Gate [VERIFIED FACT]
- **Workflow:** Missed punches or dispute resolutions are managed via `attendance_corrections`.
- **Audit Finding [CRITICAL RISK]:**
  - Currently, there is no formal **"Attendance Finalization Gate"** (e.g., an `is_finalized` flag or monthly muster sign-off).
  - If payroll is generated for October on November 1st, an employee could theoretically submit an attendance correction for October 25th on November 2nd. If approved by a manager, the attendance record in `daily_attendance_records` would change *after* the payroll run was drafted!
- **Proposed Architecture Guard:**
  - A pre-payroll validation step must verify that zero `PENDING` regularisation requests exist for the billing period.
  - Once a payroll run reaches `locked`, attendance records within that date range must be locked against further regularisation updates.

---

## 3. LEAVE MANAGEMENT INTEGRATION AUDIT

### 3.1 Paid vs. Unpaid Leave Distinctions [VERIFIED FACT]
- **Milestone 2.4D Integration:**
  - Approved paid leaves (`PL`, `CL`, `SL`, `COMP_OFF`) are synchronized into `daily_attendance_records` as `status = 'PAID_LEAVE'`.
  - Approved unpaid leaves (`LWP`) are synchronized into `daily_attendance_records` as `status = 'UNPAID_LEAVE'`.
  - Biometric punch protection ensures that if an employee worked on an approved leave day, the punch is preserved as `PRESENT`.
- **Payroll Consumption Logic [PROPOSED ARCHITECTURE]:**
  - The payroll engine does not need to duplicate leave calculation algorithms; it queries the single source of truth: `daily_attendance_records`.
  - Days with `status = 'UNPAID_LEAVE'` or `status = 'ABSENT'` are counted directly as `unpaidDays`.
  - Days with `status = 'HALF_DAY'` contribute `0.5` to `unpaidDays`.

### 3.2 Leave Cancellation After Payroll Generation [VERIFIED FACT]
- **Current State:**
  - An employee can cancel a `PENDING` leave request.
  - Once approved, leave requests cannot be cancelled by the employee. Only an admin can cancel or modify.
- **Payroll Risk [VERIFIED FACT]:**
  - If an approved leave spanning the payroll period is cancelled *after* payroll is locked, the database must reject the cancellation or trigger an explicit recalculation event.

---

## 4. UPSTREAM DEFECT & RISK REGISTER

| # | Upstream Domain | Defect / Ambiguity Description | Severity | Mitigation Strategy |
|---|:---|:---|:---:|:---|
| 1 | **Attendance Finalization** | Attendance records are not locked before payroll calculation. Late corrections can invalidate calculations. | **HIGH** | Enforce pre-run validation: 0 pending regularisations, lock attendance range upon payroll lock. |
| 2 | **Mid-Month Joining / Exit** | Employees joining on the 15th of a month should have calendar days prorated from their `joining_date`. | **HIGH** | Prorate standard calendar days: `paidDays = min(paidDays, daysFromJoining)`. |
| 3 | **Unconfigured Salary Structures** | Newly onboarded employees might lack an active record in `employee_salary_structures`. | **MEDIUM** | Payroll calculation must flag employees without salary structures as `ERROR` and exclude them from batch approval. |
| 4 | **Overtime Rate Application** | `client_policies` defines `overtime_method` and `overtime_rate`, but attendance does not store overtime hours as a dedicated numeric column. | **MEDIUM** | Derive overtime hours from `daily_attendance_records.total_hours - client_policies.standard_working_hours`. |
| 5 | **State Professional Tax Slabs** | Slabs in `statutory_pt_slabs` are keyed by `state`. Employees must be mapped to states via `work_locations.state`. | **LOW** | Join `employees` -> `work_locations` to resolve employee's tax jurisdiction state. |
