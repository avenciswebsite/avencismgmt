# AVENCIS WFM — MILESTONE 2.5A
# ROW-LEVEL SECURITY (RLS) POLICY SPECIFICATION & ARCHITECTURAL DESIGN
## Comprehensive Table-by-Table & Role-by-Role Security Model

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Phase:** Milestone 2.5A — Security Remediation Planning & Migration 20 Preparation  
**Design Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Security Verification Engine  
**Target Engine:** PostgreSQL 17.11 (Supabase Cloud)  
**Security Standard:** Principle of Least Privilege, Strict Multi-Tenancy & Cryptographic Immutability  

---

## 1. Security Architecture Principles

1. **Dual-Layer Defense:** Frontend UI visibility rules in React components are convenience controls only. All access, tenancy isolation, and anti-tamper guards must be unconditionally enforced in PostgreSQL via RLS policies and triggers.
2. **Strict Multi-Tenancy:** Users belonging to Tenant A can never query, insert, update, or delete records belonging to Tenant B under any circumstance.
3. **Fail-Closed Identity:** If an authenticated identity is unprovisioned (no matching `user_profiles` record) or deactivated (`is_active = FALSE`), all database access must be denied (`SELECT` returns 0 rows, mutations fail).
4. **Anti-Self-Approval (Corporate Governance):** Managers and administrators are strictly forbidden from approving their own leave requests or attendance regularisations.
5. **Segregation of Duties (Four-Eyes Principle):** Preparers of financial data (Payroll Admins) are forbidden from terminally locking payroll runs. Only executive roles (`client_admin` or `super_admin`) may lock.
6. **Append-Only Immutability:** Raw attendance telemetry (`attendance_events`), compliance audit logs (`audit_logs`), and locked payroll batches (`payroll_runs`, `payroll_items`) cannot be updated or deleted by any user role.

---

## 2. Platform Roles & Authorization Hierarchy

```
+-------------------------------------------------------------------------------------------------------------------+
| Role Name        | Type             | Tenant Scoping       | Geographic / Org Scoping  | Core Permissions         |
+------------------+------------------+----------------------+---------------------------+--------------------------+
| super_admin      | Platform Owner   | Global (All Clients) | Global (All Locations)    | Full governance oversight|
| client_admin     | Tenant Executive | Assigned Client Only | All Tenant Locations      | Full tenant management   |
| hr_admin         | Tenant Personnel | Assigned Client Only | All Tenant Locations      | Staff, onboarding, leaves|
| payroll_admin    | Compensation Spc | Assigned Client Only | All Tenant Locations      | Salaries, payroll batches|
| client_manager   | General Manager  | Assigned Client Only | All Tenant Locations      | Approvals, rosters, muster|
| location_manager | Worksite Manager | Assigned Client Only | Assigned Worksite Only    | Worksite approvals/muster|
| employee         | Individual Staff | Assigned Client Only | Assigned Worksite Only    | Self-service only        |
+-------------------------------------------------------------------------------------------------------------------+
```

---

## 3. Comprehensive Table-by-Table Policy Specification (20 Tables)

### Table 1: `clients` (Top-Level Client Organisations)
- **Sensitivity:** High (Tenant accounts, billing, contact coordinates).
- **Tenant Scope:** Evaluated by `id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: Unrestricted (all clients).
    - `client_admin`, `hr_admin`, `payroll_admin`, `client_manager`, `location_manager`, `employee`: Restricted to `id = get_user_client_id()`.
  - `INSERT`: `super_admin` only.
  - `UPDATE`: `super_admin` (all), `client_admin` (own organization profile).
  - `DELETE`: `super_admin` only (soft-delete preferred).
- **Intentional Denials:** All non-admins strictly denied write access.

---

### Table 2: `client_legal_entities` (Employers of Record & Statutory Registrations)
- **Sensitivity:** High (PAN, TAN, GSTIN, PF/ESIC establishment codes, payroll responsibility).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All entities.
    - All tenant roles (`client_admin`, `hr_admin`, `payroll_admin`, `client_manager`, `location_manager`, `employee`): Restricted to `client_id = get_user_client_id()`. (Employees require legal entity name for portal branding and payslip references).
  - `INSERT`: `super_admin` (any client), `client_admin` (own `client_id`).
  - `UPDATE`: `super_admin` (any client), `client_admin` (own `client_id`).
  - `DELETE`: `super_admin` only.
- **Intentional Denials:** `hr_admin`, `payroll_admin`, `client_manager`, `location_manager`, `employee` have **ZERO** write permissions.

---

### Table 3: `work_locations` (Authorized Worksites & GPS Geofences)
- **Sensitivity:** Medium (GPS coordinates, worksite addresses, geofence radius).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All locations.
    - All tenant roles: Restricted to `client_id = get_user_client_id()`. (Employees must query worksite coordinates to perform local Haversine distance checks for mobile clock-ins).
  - `INSERT`: `super_admin`, `client_admin`.
  - `UPDATE`: `super_admin`, `client_admin`.
  - `DELETE`: `super_admin`, `client_admin`.
- **Intentional Denials:** Operational staff and managers have zero write permissions.

---

### Table 4: `departments` (Organizational Divisions)
- **Sensitivity:** Low (Department names, codes).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All departments.
    - All tenant roles: Restricted to `client_id = get_user_client_id()`.
  - `INSERT`: `super_admin`, `client_admin`, `hr_admin`.
  - `UPDATE`: `super_admin`, `client_admin`, `hr_admin`.
  - `DELETE`: `super_admin`, `client_admin`.
- **Intentional Denials:** Regular employees and location managers have zero write permissions.

---

### Table 5: `client_policies` (Client Operational & Statutory Configurations)
- **Sensitivity:** High (Salary divisors, overtime formulas, EPF/ESIC percentages, late arrival rules).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All policies.
    - All tenant roles: Restricted to `client_id = get_user_client_id()`. (Necessary for attendance tracking mode, standard hours, and leave balance calculations).
  - `INSERT`: `super_admin`, `client_admin` (own `client_id`).
  - `UPDATE`: `super_admin`, `client_admin` (own `client_id`).
  - `DELETE`: Intentionally denied to all roles (policies are created once per client and updated).
- **Intentional Denials:** `hr_admin`, `payroll_admin`, `client_manager`, `location_manager`, `employee` have **ZERO** write access.

---

### Table 6: `statutory_holidays` (Public & Client Holiday Calendars)
- **Sensitivity:** Low (Holiday names, dates).
- **Tenant Scope:** Global national holidays (`client_id IS NULL`) vs client-specific holidays (`client_id = get_user_client_id()`).
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All holidays.
    - All tenant roles: `client_id IS NULL OR client_id = get_user_client_id()`.
  - `INSERT`: `super_admin` (global/client), `client_admin` / `hr_admin` (own `client_id`).
  - `UPDATE`: `super_admin` (global/client), `client_admin` / `hr_admin` (own `client_id`).
  - `DELETE`: `super_admin` (global/client), `client_admin` / `hr_admin` (own `client_id`).
- **Intentional Denials:** Employees and location managers cannot modify the holiday calendar.

---

### Table 7: `statutory_pt_slabs` (State Professional Tax Schedules)
- **Sensitivity:** Low (State tax tables published by state governments).
- **Tenant Scope:** Universal reference data (no `client_id` column).
- **Policy Rules:**
  - `SELECT`: Unrestricted read for all `authenticated` users (`USING (true)`).
  - `INSERT`: `super_admin` only (or database migrations).
  - `UPDATE`: `super_admin` only.
  - `DELETE`: `super_admin` only.
- **Intentional Denials:** All tenant administrators and staff are strictly forbidden from modifying statutory tax tables.

---

### Table 8: `user_profiles` (Auth User Mapping & RBAC Personas)
- **Sensitivity:** Critical (Maps `auth.users(id)` to `role`, `client_id`, `employee_id`).
- **Tenant Scope:** Evaluated by `id = auth.uid()` for self and `client_id = get_user_client_id()` for tenant admins.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All profiles.
    - `client_admin`: All profiles where `client_id = get_user_client_id()`.
    - `hr_admin`: Profiles where `client_id = get_user_client_id()`.
    - All other users (`payroll_admin`, `client_manager`, `location_manager`, `employee`): Strictly own profile (`id = auth.uid()`).
  - `INSERT`: `super_admin`, `client_admin` (restricted to own `client_id`; cannot insert `role = 'super_admin'`).
  - `UPDATE`:
    - `super_admin`: Any profile.
    - `client_admin`: Own tenant profiles (cannot modify own role or elevate anyone to `super_admin`).
    - Self: Allowed only for non-privilege metadata (`last_login_at`); role, client, employee linkage cannot be altered by self.
  - `DELETE`: `super_admin`, `client_admin`.
- **Intentional Denials:** Regular staff cannot see peer user accounts or modify their own role.

---

### Table 9: `employees` (Master Employee Directory)
- **Sensitivity:** High (Personal PII: PAN, Aadhaar, phone, date of birth, emergency contacts).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All employees.
    - `client_admin`, `hr_admin`, `payroll_admin`, `client_manager`: All employees in `client_id = get_user_client_id()`.
    - `location_manager`: Employees in own `client_id` assigned to the manager's `work_location_id`.
    - `employee`: Strictly own employee record (`id = get_user_employee_id()`).
  - `INSERT`: `super_admin`, `client_admin`, `hr_admin` (own `client_id`).
  - `UPDATE`: `super_admin`, `client_admin`, `hr_admin` (own `client_id`).
  - `DELETE`: `super_admin`, `client_admin` (soft-deactivation via `status = 'INACTIVE'`).
- **Intentional Denials:** Employees and location managers cannot add or modify master employee records.

---

### Table 10: `employee_salary_structures` (Sensitive Compensation Master)
- **Sensitivity:** Critical (Fixed base, HRA, conveyance, special allowance, variable incentives, CTC).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All salary records.
    - `client_admin`, `payroll_admin`: All salary structures in `client_id = get_user_client_id()`.
    - `employee`: Active salary structure for self only (`employee_id = get_user_employee_id() AND is_active = TRUE`).
    - `hr_admin`, `client_manager`, `location_manager`: **STRICTLY DENIED (0 rows)**.
  - `INSERT`: `super_admin`, `client_admin`, `payroll_admin` (own `client_id`).
  - `UPDATE`: `super_admin`, `client_admin`, `payroll_admin` (own `client_id`).
  - `DELETE`: `super_admin` only.
- **Intentional Denials:** HR Admins, Managers, and Peers cannot view compensation details.

---

### Table 11: `employee_bank_details` (Confidential Financial Coordinates)
- **Sensitivity:** Critical (Bank account number, IFSC code, bank branch, PAN).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All bank records.
    - `client_admin`, `payroll_admin`: Bank coordinates for employees in `client_id = get_user_client_id()`.
    - `employee`: Strictly own bank record (`employee_id = get_user_employee_id()`).
    - `hr_admin`, `client_manager`, `location_manager`: **STRICTLY DENIED (0 rows)**.
  - `INSERT`: `super_admin`, `client_admin`, `payroll_admin` (own `client_id`).
  - `UPDATE`: `super_admin`, `client_admin`, `payroll_admin` (own `client_id`).
  - `DELETE`: `super_admin` only.
- **Intentional Denials:** Completely confidential from operational managers and HR personnel.

---

### Table 12: `attendance_events` (Raw GPS Punch Telemetry)
- **Sensitivity:** High (Immutable biometric/geofenced punch records).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All events.
    - `client_admin`, `hr_admin`, `client_manager`: Events for employees in `client_id = get_user_client_id()`.
    - `location_manager`: Events for employees at assigned worksite.
    - `employee`: Strictly own punch events (`employee_id = get_user_employee_id()`).
  - `INSERT`:
    - `employee`: Own punches only (`employee_id = get_user_employee_id() AND client_id = get_user_client_id()`).
    - Admins: Prohibited from inserting raw biometric events directly (must use regularisations).
  - `UPDATE`: **STRICTLY DENIED** (Blocked by RLS and `guard_immutable_attendance_events()`).
  - `DELETE`: **STRICTLY DENIED** (Blocked by RLS and `guard_immutable_attendance_events()`).
- **Intentional Denials:** Updates and deletions are impossible at the database engine level.

---

### Table 13: `daily_attendance_records` (Aggregated Daily Shift Muster)
- **Sensitivity:** Medium (Shift attendance status, in/out timestamps, total hours worked).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All muster records.
    - `client_admin`, `hr_admin`, `client_manager`: All records in `client_id = get_user_client_id()`.
    - `location_manager`: Records for employees at assigned worksite.
    - `employee`: Strictly own records (`employee_id = get_user_employee_id()`).
  - `INSERT`: System triggers, `client_admin`, `hr_admin`.
  - `UPDATE`: System triggers, `client_admin`, `hr_admin`.
  - `DELETE`: `super_admin` only.
- **Intentional Denials:** Employees cannot modify muster records directly.

---

### Table 14: `attendance_corrections` (Attendance Regularisation Queue)
- **Sensitivity:** Medium (Correction requests, missed punch reasons, manager remarks).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All requests.
    - `client_admin`, `hr_admin`, `client_manager`: All requests in `client_id = get_user_client_id()`.
    - `location_manager`: Requests for staff at assigned worksite.
    - `employee`: Strictly own requests (`employee_id = get_user_employee_id()`).
  - `INSERT`: `employee` (own requests only, `status = 'PENDING'`).
  - `UPDATE` (Review):
    - `client_admin`, `hr_admin`, `client_manager`, `location_manager`: Permitted **ONLY IF** `employee_id <> get_user_employee_id()` (**Anti-Self-Approval Enforcement**).
  - `DELETE`: `employee` (cancellation of own `PENDING` request).
- **Intentional Denials:** Employees cannot approve corrections; managers cannot approve their own corrections.

---

### Table 15: `leave_balances` (Accrual & Entitlement Ledgers)
- **Sensitivity:** Medium (Annual leave allocations, days used, closing balance).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All balances.
    - `client_admin`, `hr_admin`, `payroll_admin`, `client_manager`: Balances in `client_id = get_user_client_id()`.
    - `location_manager`: Balances for staff at assigned worksite.
    - `employee`: Strictly own balances (`employee_id = get_user_employee_id()`).
  - `INSERT`: `super_admin`, `client_admin`, `hr_admin`.
  - `UPDATE`: `super_admin`, `client_admin`, `hr_admin` (Permitted **ONLY IF** `employee_id <> get_user_employee_id()`).
  - `DELETE`: `super_admin` only.
- **Intentional Denials:** Administrators cannot modify their own leave balance rows.

---

### Table 16: `leave_requests` (Leave Applications & Workflow State Machine)
- **Sensitivity:** Medium (Leave dates, reason, medical justifications, review remarks).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All requests.
    - `client_admin`, `hr_admin`, `payroll_admin`, `client_manager`: Requests in `client_id = get_user_client_id()`.
    - `location_manager`: Requests for staff at assigned worksite.
    - `employee`: Strictly own requests (`employee_id = get_user_employee_id()`).
  - `INSERT`: `employee` (own application only; `status = 'PENDING'`, `reviewed_by IS NULL`).
  - `UPDATE` (Employee Cancel): `employee` (own `PENDING` request transitioned to `CANCELLED`).
  - `UPDATE` (Manager Review): `client_admin`, `hr_admin`, `client_manager`, `location_manager` (Permitted **ONLY IF** `employee_id <> get_user_employee_id()`).
  - `DELETE`: Intentionally denied to all roles.
- **Intentional Denials:** Anti-self-approval strictly enforced.

---

### Table 17: `payroll_runs` (Batch Payroll Run Headers)
- **Sensitivity:** High (Aggregate payroll expenditure, run status, legal entity grouping).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Legal Entity Scope:** Evaluated by `legal_entity_id`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All runs.
    - `client_admin`, `payroll_admin`: Runs where `client_id = get_user_client_id()`.
    - `hr_admin`, `client_manager`, `location_manager`, `employee`: **STRICTLY DENIED (0 rows)**.
  - `INSERT`: Stored procedure `generate_payroll_run` (`SECURITY DEFINER`), `client_admin`, `payroll_admin`.
  - `UPDATE`:
    - `client_admin`, `payroll_admin`: Allowed while `status IN ('draft', 'under_review')`.
    - Terminal lock: Stored procedure `lock_payroll_run` (`client_admin` or `super_admin` only).
    - Post-lock update: **STRICTLY DENIED** by `guard_locked_payroll_modification()`.
  - `DELETE`: Allowed while in `draft`; **STRICTLY DENIED** once `locked`.
- **Intentional Denials:** HR Admins, Managers, and Employees have zero access to batch payroll headers.

---

### Table 18: `payroll_items` (Individual Employee Salary Line Items)
- **Sensitivity:** Critical (Basic, HRA, allowances, overtime pay, EPF, ESIC, PT, TDS, net take-home).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All items.
    - `client_admin`, `payroll_admin`: Items in `client_id = get_user_client_id()`.
    - `employee`: Strictly own item (`employee_id = get_user_employee_id()`) **AND ONLY IF** parent run `status IN ('approved', 'locked')`. (Draft calculations remain invisible to employees).
    - `hr_admin`, `client_manager`, `location_manager`: **STRICTLY DENIED (0 rows)**.
  - `INSERT`: Stored procedure `generate_payroll_run`.
  - `UPDATE`: `client_admin`, `payroll_admin` (Authorized overtime and incentive adjustments while parent run is `under_review`).
  - `DELETE`: Prohibited when parent run is `locked` (guarded by `guard_locked_payroll_items()`).
- **Intentional Denials:** Employees cannot see preliminary/in-progress calculations.

---

### Table 19: `payslips` (Published Form XIX Payslip Registry)
- **Sensitivity:** High (Official tax certificates and statutory payslip metadata).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All payslips.
    - `client_admin`, `payroll_admin`, `hr_admin`: Payslips in `client_id = get_user_client_id()`.
    - `employee`: Strictly own payslips (`employee_id = get_user_employee_id() AND is_published = TRUE`).
    - `client_manager`, `location_manager`: **STRICTLY DENIED (0 rows)**.
  - `INSERT`: Stored procedure `lock_payroll_run`.
  - `UPDATE`: `client_admin`, `payroll_admin`.
  - `DELETE`: `super_admin` only.
- **Intentional Denials:** Employees can only see published payslips belonging to their own profile.

---

### Table 20: `audit_logs` (Immutable Security & Governance Ledger)
- **Sensitivity:** Critical (Cryptographic action ledger, timestamps, actors, IP addresses).
- **Tenant Scope:** Evaluated by `client_id = get_user_client_id()`.
- **Policy Rules:**
  - `SELECT`:
    - `super_admin`: All logs across all tenants.
    - `client_admin`: Logs where `client_id = get_user_client_id()`.
    - All other roles (`hr_admin`, `payroll_admin`, `client_manager`, `location_manager`, `employee`): **STRICTLY DENIED (0 rows)**.
  - `INSERT`: Permitted for all authenticated sessions (`WITH CHECK (true)`).
  - `UPDATE`: **STRICTLY DENIED** (Guarded by `guard_immutable_audit_logs()`).
  - `DELETE`: **STRICTLY DENIED** (Guarded by `guard_immutable_audit_logs()`).
- **Intentional Denials:** Audit logs are permanently immutable at the PostgreSQL engine level.
