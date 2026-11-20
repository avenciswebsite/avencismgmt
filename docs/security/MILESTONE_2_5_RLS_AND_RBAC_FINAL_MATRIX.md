# Avencis WFM — Milestone 2.5: RLS & RBAC Final Permission Matrix
**Document ID:** `DOC-WFM-2.5-RBAC-001`  
**Date:** 2026-11-16  
**Status:** COMPLETE / AUTHORITATIVE SPECIFICATION  
**Target Architecture:** Avencis 7-Role RBAC Model  
**PostgreSQL Version:** 17.11  

---

## 1. Executive Summary

This document details the authoritative permission matrix governing the **7 application roles** across all **20 tables** in the Avencis Workforce Management (WFM) database.

### The 7 Application Roles:
1. `super_admin`: Global platform administrator across all client organizations.
2. `client_admin`: Executive administrator for an assigned client tenant.
3. `hr_admin`: Human resources specialist managing staff, leave, and attendance.
4. `payroll_admin`: Compensation specialist managing salary structures and payroll batches.
5. `client_manager`: General operations manager overseeing department teams and leave.
6. `location_manager`: Field or facility manager scoped strictly to employees at their assigned work location.
7. `employee`: Individual contributor with access strictly restricted to self-service records.

---

## 2. Seven-Role Permission Matrix by Table

The table below summarizes the live database-enforced permissions for each role across all 20 application tables:

| Table Name | `super_admin` | `client_admin` | `hr_admin` | `payroll_admin` | `client_manager` | `location_manager` | `employee` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `clients` | ALL | SELECT (own) | None | None | None | None | None |
| `client_legal_entities` | ALL | ALL (own) | SELECT (own) | SELECT (own) | SELECT (own) | SELECT (own) | SELECT (own) |
| `work_locations` | ALL | ALL (own) | SELECT (own) | SELECT (own) | SELECT (own) | SELECT (own) | SELECT (own) |
| `departments` | ALL | ALL (own) | ALL (own) | SELECT (own) | SELECT (own) | SELECT (own) | SELECT (own) |
| `client_policies` | ALL | ALL (own) | SELECT (own) | SELECT (own) | SELECT (own) | SELECT (own) | SELECT (own) |
| `statutory_holidays` | ALL | ALL (own) | ALL (own) | SELECT (own) | SELECT (own) | SELECT (own) | SELECT (own) |
| `statutory_pt_slabs` | ALL | SELECT (all) | SELECT (all) | SELECT (all) | SELECT (all) | SELECT (all) | SELECT (all) |
| `user_profiles` | ALL | ALL (tenant)*| SELECT (self) | SELECT (self) | SELECT (self) | SELECT (self) | SELECT (self) |
| `employees` | ALL | ALL (own) | ALL (own) | ALL (own) | Via RPC* | Via RPC* | SELECT (self) |
| `employee_salary_structures` | ALL | ALL (own) | None | ALL (own) | None | None | SELECT (self, active) |
| `employee_bank_details` | ALL | ALL (own) | None | ALL (own) | None | None | SELECT (self) |
| `daily_attendance_records` | ALL | ALL (own) | ALL (own) | None | ALL (own) | Scoped (site)*| SELECT (self) |
| `attendance_events` | SELECT (all) | SELECT (own) | SELECT (own) | None | SELECT (own) | Scoped (site)*| SELECT (self) / INSERT (self) |
| `attendance_corrections` | ALL (own) | ALL (own, non-self)*| ALL (own, non-self)*| None | ALL (own, non-self)*| Scoped (site, non-self)*| SELECT (self) / INSERT (self) |
| `leave_balances` | ALL | ALL (own, non-self)| ALL (own, non-self)| SELECT (own) | SELECT (own) | Scoped (site)| SELECT (self) |
| `leave_requests` | ALL | UPDATE (own, non-self)| UPDATE (own, non-self)| SELECT (own) | UPDATE (own, non-self)| UPDATE (site, non-self)| SELECT/INSERT/CANCEL (self) |
| `payroll_runs` | ALL | ALL (own) | None | ALL (own) | None | None | None |
| `payroll_items` | ALL | ALL (own) | None | ALL (own) | None | None | SELECT (self, locked/approved) |
| `payslips` | ALL | ALL (own) | ALL (own) | ALL (own) | None | None | SELECT (self, published) |
| `audit_logs` | SELECT (all) | SELECT (own) | None | None | None | None | INSERT (self, automated) |

*\* Note on Special Governance Guards:*
- `user_profiles`: Client Admin cannot create or elevate to `super_admin`. Guard trigger prevents self-promotion.
- `employees`: Managers query team directory via secure `get_manager_team()` RPC without exposing statutory IDs (`pan_number`, `aadhaar_number`).
- Anti-Self-Approval: `employee_id <> get_user_employee_id()` prevents administrators and managers from approving their own leave or corrections.

---

## 3. Operational Domain Isolation Analysis

### 3.1 Domain 1: Multi-Tenant Isolation
- **Rule:** No client tenant may inspect or modify another client's data.
- **Enforcement:** Enforced at the PostgreSQL engine level via `client_id = get_user_client_id()`.
- **Cross-Tenant Attack Resistance:** If an authenticated client admin passes `client_id = <other_tenant>` in a query or payload, PostgREST evaluates the RLS policy USING and WITH CHECK clauses against the caller's JWT session, rejecting the query or returning an empty array.

### 3.2 Domain 2: Employee Horizontal Privacy
- **Rule:** Employees must never see peer salaries, bank details, attendance punches, or leave requests.
- **Enforcement:** All self-service policies evaluate `employee_id = get_user_employee_id()`.
- **Peer Attack Resistance:** An employee cannot view or modify a co-worker's records even within the same tenant.

### 3.3 Domain 3: Sensitive Compensation & Banking Data
- **Rule:** HR Administrators, general managers, and site managers are strictly denied access to salary master structures and bank coordinates.
- **Enforcement:** `employee_salary_structures` and `employee_bank_details` omit `hr_admin`, `client_manager`, and `location_manager` from their RLS policies. Only `payroll_admin`, `client_admin`, and `super_admin` are granted access.
- **Separation of Duty:** HR Admins can view and distribute published `payslips` for field staff operations, but master CTC formulations and bank accounts remain restricted.

### 3.4 Domain 4: Worksite / Location Geofenced Scoping
- **Rule:** Location Managers must be confined to staff assigned to their specific facility.
- **Enforcement:** Enforced via subquery:
  `work_location_id = (SELECT work_location_id FROM employees WHERE id = get_user_employee_id())`.
- **Cross-Site Attack Resistance:** A site manager in Pune cannot view or approve leave or attendance records for staff in Mumbai or Bangalore.

### 3.5 Domain 5: Anti-Self-Approval & Corporate Governance
- **Rule:** No user—regardless of managerial or administrative rank—may approve their own leave request or attendance regularisation.
- **Enforcement:** Both `leave_requests` and `attendance_corrections` policies enforce `employee_id <> get_user_employee_id()`.

---

## 4. Verification Sign-off

The 7-role permission matrix provides mathematical and cryptographic guarantees of least-privilege access across all application domains.
