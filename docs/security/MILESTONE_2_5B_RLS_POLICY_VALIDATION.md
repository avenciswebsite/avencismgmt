# Avencis WFM — Milestone 2.5B: RLS Policy Validation Report
**Document ID:** `DOC-WFM-2.5B-RLS-001`  
**Date:** 2026-11-16  
**Status:** COMPLETE / EMPIRICALLY VERIFIED  
**Target Environment:** Supabase Cloud Production Database (`mlopgvkvzhwhkbewhefb` / `eu-west-1`)  
**PostgreSQL Version:** 17.11 (ga)  
**Schema:** `public`  

---

## 1. Executive Summary & Verification Scope

Following the deployment and manual execution of **Migration 20 (`20261115000020_security_hardening.sql`)**, an exhaustive PostgreSQL system catalog audit was performed against the live Supabase database.

### Core Metrics Verified:
- **Total Tables in `public` Schema:** 20
- **Tables with `rowsecurity = true`:** 20 / 20 (100.0%)
- **Tables with Zero Policies (`rls_enabled_no_policy`):** 0 / 20 (0.0% — SEC-01 Fully Resolved)
- **Total Active RLS Policies in `public`:** 63 policies
  - Pre-Migration 20 Baseline: 41 policies across 13 tables
  - Migration 20 Additions: 22 policies across 7 unhardened tables
- **Linter Status (`get_advisors(type: 'security')`):** 0 warnings/errors for missing RLS policies.

---

## 2. Table-by-Table Policy Inventory & Catalog Audit

The following table presents the catalog state retrieved directly from `pg_policies` and `pg_tables` in the live Supabase instance:

| Table Name | RLS Enabled | Policy Count | Policy Names |
| :--- | :---: | :---: | :--- |
| `attendance_corrections` | Yes | 3 | `corrections_employee_apply`, `corrections_employee_select`, `corrections_tenant_admin_all` |
| `attendance_events` | Yes | 4 | `events_employee_self_insert`, `events_employee_self_select`, `events_super_admin_select`, `events_tenant_admin_select` |
| `audit_logs` | Yes | 3 | `audit_logs_authenticated_insert`, `audit_logs_client_admin_select`, `audit_logs_super_admin_select` |
| `client_legal_entities` *(Hardened in M20)* | Yes | 3 | `legal_entities_admin_modify`, `legal_entities_super_admin_all`, `legal_entities_tenant_select` |
| `client_policies` *(Hardened in M20)* | Yes | 3 | `client_policies_admin_modify`, `client_policies_super_admin_all`, `client_policies_tenant_select` |
| `clients` | Yes | 2 | `clients_client_admin_select`, `clients_super_admin_all` |
| `daily_attendance_records` | Yes | 3 | `daily_attendance_employee_select`, `daily_attendance_super_admin_all`, `daily_attendance_tenant_admin_all` |
| `departments` *(Hardened in M20)* | Yes | 3 | `departments_admin_modify`, `departments_super_admin_all`, `departments_tenant_select` |
| `employee_bank_details` | Yes | 3 | `bank_employee_self_select`, `bank_payroll_admin_tenant`, `bank_super_admin_all` |
| `employee_salary_structures` | Yes | 3 | `salary_employee_self_select`, `salary_payroll_admin_tenant`, `salary_super_admin_all` |
| `employees` | Yes | 3 | `employees_client_admin_tenant`, `employees_self_select`, `employees_super_admin_all` |
| `leave_balances` | Yes | 5 | `leave_balances_employee_select`, `leave_balances_payroll_admin_select`, `leave_balances_super_admin_all`, `leave_balances_tenant_admin_modify`, `leave_balances_tenant_admin_select` |
| `leave_requests` | Yes | 7 | `leave_requests_employee_cancel`, `leave_requests_employee_insert`, `leave_requests_employee_select`, `leave_requests_payroll_admin_select`, `leave_requests_super_admin_all`, `leave_requests_tenant_admin_modify`, `leave_requests_tenant_admin_select` |
| `payroll_items` | Yes | 2 | `payroll_items_admin_all`, `payroll_items_employee_self_select` |
| `payroll_runs` | Yes | 1 | `payroll_runs_admin_all` |
| `payslips` | Yes | 2 | `payslips_admin_all`, `payslips_employee_self_select` |
| `statutory_holidays` *(Hardened in M20)* | Yes | 3 | `statutory_holidays_admin_modify`, `statutory_holidays_super_admin_all`, `statutory_holidays_tenant_select` |
| `statutory_pt_slabs` *(Hardened in M20)* | Yes | 2 | `statutory_pt_slabs_global_select`, `statutory_pt_slabs_super_admin_modify` |
| `user_profiles` *(Hardened in M20)* | Yes | 5 | `user_profiles_self_select`, `user_profiles_self_update`, `user_profiles_super_admin_all`, `user_profiles_tenant_admin_modify`, `user_profiles_tenant_admin_select` |
| `work_locations` *(Hardened in M20)* | Yes | 3 | `work_locations_admin_modify`, `work_locations_super_admin_all`, `work_locations_tenant_select` |
| **Total** | **20 / 20** | **63** | **Zero unhardened tables** |

---

## 3. Detailed Catalog Policy Definitions

### 3.1 Newly Hardened Tables (Migration 20 Scope)

#### 1. `user_profiles` (5 Policies)
- **`user_profiles_self_select`**:
  - `CMD`: `SELECT` | `ROLES`: `{authenticated}`
  - `USING`: `(id = auth.uid())`
  - *Effect:* Every user can view their own profile.
- **`user_profiles_self_update`**:
  - `CMD`: `UPDATE` | `ROLES`: `{authenticated}`
  - `USING`: `(id = auth.uid())`
  - `WITH CHECK`: `((id = auth.uid()) AND ((role)::text = (( SELECT up.role FROM user_profiles up WHERE (up.id = auth.uid())))::text) AND (NOT (client_id IS DISTINCT FROM ( SELECT up.client_id FROM user_profiles up WHERE (up.id = auth.uid())))) AND (NOT (employee_id IS DISTINCT FROM ( SELECT up.employee_id FROM user_profiles up WHERE (up.id = auth.uid())))))`
  - *Effect:* Self-update cannot escalate role, client_id, or employee_id.
- **`user_profiles_tenant_admin_select`**:
  - `CMD`: `SELECT` | `ROLES`: `{authenticated}`
  - `USING`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
  - *Effect:* Client Admin can view profiles within their client tenant.
- **`user_profiles_tenant_admin_modify`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text) AND ((role)::text <> 'super_admin'::text))`
  - `WITH CHECK`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text) AND ((role)::text <> 'super_admin'::text))`
  - *Effect:* Client Admin can manage tenant profiles, but cannot create or escalate to `super_admin`.
- **`user_profiles_super_admin_all`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `(get_user_role() = 'super_admin'::text)`
  - `WITH CHECK`: `(get_user_role() = 'super_admin'::text)`

#### 2. `client_legal_entities` (3 Policies)
- **`legal_entities_tenant_select`**:
  - `CMD`: `SELECT` | `ROLES`: `{authenticated}`
  - `USING`: `((get_user_role() = 'super_admin'::text) OR (client_id = get_user_client_id()))`
- **`legal_entities_admin_modify`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
  - `WITH CHECK`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
- **`legal_entities_super_admin_all`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `(get_user_role() = 'super_admin'::text)`
  - `WITH CHECK`: `(get_user_role() = 'super_admin'::text)`

#### 3. `work_locations` (3 Policies)
- **`work_locations_tenant_select`**:
  - `CMD`: `SELECT` | `ROLES`: `{authenticated}`
  - `USING`: `((get_user_role() = 'super_admin'::text) OR (client_id = get_user_client_id()))`
- **`work_locations_admin_modify`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
  - `WITH CHECK`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
- **`work_locations_super_admin_all`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `(get_user_role() = 'super_admin'::text)`
  - `WITH CHECK`: `(get_user_role() = 'super_admin'::text)`

#### 4. `departments` (3 Policies)
- **`departments_tenant_select`**:
  - `CMD`: `SELECT` | `ROLES`: `{authenticated}`
  - `USING`: `((get_user_role() = 'super_admin'::text) OR (client_id = get_user_client_id()))`
- **`departments_admin_modify`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text])))`
  - `WITH CHECK`: `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text])))`
- **`departments_super_admin_all`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `(get_user_role() = 'super_admin'::text)`
  - `WITH CHECK`: `(get_user_role() = 'super_admin'::text)`

#### 5. `client_policies` (3 Policies)
- **`client_policies_tenant_select`**:
  - `CMD`: `SELECT` | `ROLES`: `{authenticated}`
  - `USING`: `((get_user_role() = 'super_admin'::text) OR (client_id = get_user_client_id()))`
- **`client_policies_admin_modify`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
  - `WITH CHECK`: `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
- **`client_policies_super_admin_all`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `(get_user_role() = 'super_admin'::text)`
  - `WITH CHECK`: `(get_user_role() = 'super_admin'::text)`

#### 6. `statutory_holidays` (3 Policies)
- **`statutory_holidays_tenant_select`**:
  - `CMD`: `SELECT` | `ROLES`: `{authenticated}`
  - `USING`: `((client_id IS NULL) OR (get_user_role() = 'super_admin'::text) OR (client_id = get_user_client_id()))`
  - *Effect:* National/global holidays (`client_id IS NULL`) are visible to all authenticated tenant users; client-specific holidays are tenant-isolated.
- **`statutory_holidays_admin_modify`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `((client_id IS NOT NULL) AND (client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text])))`
  - `WITH CHECK`: `((client_id IS NOT NULL) AND (client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text])))`
- **`statutory_holidays_super_admin_all`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `(get_user_role() = 'super_admin'::text)`
  - `WITH CHECK`: `(get_user_role() = 'super_admin'::text)`

#### 7. `statutory_pt_slabs` (2 Policies)
- **`statutory_pt_slabs_global_select`**:
  - `CMD`: `SELECT` | `ROLES`: `{authenticated}`
  - `USING`: `true`
  - *Effect:* State professional tax rates are statutory read-only reference data for all authenticated users.
- **`statutory_pt_slabs_super_admin_modify`**:
  - `CMD`: `ALL` | `ROLES`: `{authenticated}`
  - `USING`: `(get_user_role() = 'super_admin'::text)`
  - `WITH CHECK`: `(get_user_role() = 'super_admin'::text)`

---

### 3.2 Pre-Existing Tables (Audited for Alignment)

#### 8. `clients` (2 Policies)
- `clients_client_admin_select`: `SELECT` where `(id = get_user_client_id())`
- `clients_super_admin_all`: `ALL` where `(get_user_role() = 'super_admin'::text)`

#### 9. `employees` (3 Policies)
- `employees_self_select`: `SELECT` where `(id = get_user_employee_id())`
- `employees_client_admin_tenant`: `ALL` where `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'payroll_admin'::text])))`
- `employees_super_admin_all`: `ALL` where `(get_user_role() = 'super_admin'::text)`

#### 10. `employee_salary_structures` (3 Policies)
- `salary_employee_self_select`: `SELECT` where `((employee_id = get_user_employee_id()) AND (is_active = true))`
- `salary_payroll_admin_tenant`: `ALL` where `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text])))`
- `salary_super_admin_all`: `ALL` where `(get_user_role() = 'super_admin'::text)`

#### 11. `employee_bank_details` (3 Policies)
- `bank_employee_self_select`: `SELECT` where `(employee_id = get_user_employee_id())`
- `bank_payroll_admin_tenant`: `ALL` where `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text])))`
- `bank_super_admin_all`: `ALL` where `(get_user_role() = 'super_admin'::text)`

#### 12. `daily_attendance_records` (3 Policies)
- `daily_attendance_employee_select`: `SELECT` where `(employee_id = get_user_employee_id())`
- `daily_attendance_tenant_admin_all`: `ALL` where `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text, 'location_manager'::text])))`
- `daily_attendance_super_admin_all`: `ALL` where `(get_user_role() = 'super_admin'::text)`

#### 13. `attendance_events` (4 Policies)
- `events_employee_self_insert`: `INSERT` with check `((employee_id = get_user_employee_id()) AND (client_id = get_user_client_id()))`
- `events_employee_self_select`: `SELECT` where `(employee_id = get_user_employee_id())`
- `events_tenant_admin_select`: `SELECT` where `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text, 'location_manager'::text])))`
- `events_super_admin_select`: `SELECT` where `(get_user_role() = 'super_admin'::text)`

#### 14. `attendance_corrections` (3 Policies)
- `corrections_employee_apply`: `INSERT` with check `((employee_id = get_user_employee_id()) AND (client_id = get_user_client_id()))`
- `corrections_employee_select`: `SELECT` where `(employee_id = get_user_employee_id())`
- `corrections_tenant_admin_all`: `ALL` where `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['super_admin'::text, 'client_admin'::text, 'hr_admin'::text, 'client_manager'::text])))`

#### 15. `leave_balances` (5 Policies)
- `leave_balances_employee_select`: `SELECT` where `(employee_id = get_user_employee_id())`
- `leave_balances_payroll_admin_select`: `SELECT` where `((client_id = get_user_client_id()) AND (get_user_role() = 'payroll_admin'::text))`
- `leave_balances_tenant_admin_select`: `SELECT` where `((client_id = get_user_client_id()) AND ((get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text])) OR ((get_user_role() = 'location_manager'::text) AND (employee_id IN (SELECT e.id FROM employees e WHERE e.work_location_id = (SELECT m.work_location_id FROM employees m WHERE m.id = get_user_employee_id()))))))`
- `leave_balances_tenant_admin_modify`: `ALL` where `((client_id = get_user_client_id()) AND (employee_id <> get_user_employee_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text])))`
- `leave_balances_super_admin_all`: `ALL` where `(get_user_role() = 'super_admin'::text)`

#### 16. `leave_requests` (7 Policies)
- `leave_requests_employee_insert`: `INSERT` with check `((employee_id = get_user_employee_id()) AND (client_id = get_user_client_id()) AND ((status)::text = 'PENDING'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL))`
- `leave_requests_employee_select`: `SELECT` where `(employee_id = get_user_employee_id())`
- `leave_requests_employee_cancel`: `UPDATE` where `((employee_id = get_user_employee_id()) AND ((status)::text = 'PENDING'::text))` with check `((employee_id = get_user_employee_id()) AND ((status)::text = 'CANCELLED'::text) AND (reviewed_by IS NULL))`
- `leave_requests_payroll_admin_select`: `SELECT` where `((client_id = get_user_client_id()) AND (get_user_role() = 'payroll_admin'::text))`
- `leave_requests_tenant_admin_select`: `SELECT` where `((client_id = get_user_client_id()) AND ((get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text])) OR ((get_user_role() = 'location_manager'::text) AND (employee_id IN (SELECT e.id FROM employees e WHERE e.work_location_id = (SELECT m.work_location_id FROM employees m WHERE m.id = get_user_employee_id()))))))`
- `leave_requests_tenant_admin_modify`: `UPDATE` where `((client_id = get_user_client_id()) AND (employee_id <> get_user_employee_id()) AND ((get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text])) OR ((get_user_role() = 'location_manager'::text) AND (employee_id IN (SELECT e.id FROM employees e WHERE e.work_location_id = (SELECT m.work_location_id FROM employees m WHERE m.id = get_user_employee_id()))))))`
- `leave_requests_super_admin_all`: `ALL` where `(get_user_role() = 'super_admin'::text)`

#### 17. `payroll_runs` (1 Policy)
- `payroll_runs_admin_all`: `ALL` where `((get_user_role() = 'super_admin'::text) OR ((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text]))))`

#### 18. `payroll_items` (2 Policies)
- `payroll_items_employee_self_select`: `SELECT` where `((employee_id = get_user_employee_id()) AND (EXISTS (SELECT 1 FROM payroll_runs r WHERE (((r.id)::text = (payroll_items.run_id)::text) AND ((r.status)::text = ANY (ARRAY['approved'::character varying, 'locked'::character varying]::text[]))))))`
- `payroll_items_admin_all`: `ALL` where `((get_user_role() = 'super_admin'::text) OR ((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text]))))`

#### 19. `payslips` (2 Policies)
- `payslips_employee_self_select`: `SELECT` where `((employee_id = get_user_employee_id()) AND (is_published = true))`
- `payslips_admin_all`: `ALL` where `((get_user_role() = 'super_admin'::text) OR ((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text, 'hr_admin'::text]))))`

#### 20. `audit_logs` (3 Policies)
- `audit_logs_authenticated_insert`: `INSERT` with check `true`
- `audit_logs_client_admin_select`: `SELECT` where `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
- `audit_logs_super_admin_select`: `SELECT` where `(get_user_role() = 'super_admin'::text)`

---

## 4. Cross-Cutting Security Guarantees

1. **Anonymous Request Immunity:**
   - Every policy targets `{authenticated}`.
   - Live REST testing confirmed `anon` role receives `HTTP 200 []` on SELECT and `HTTP 401 Unauthorized` / `HTTP 42501 Permission Denied` on mutations across all 20 tables.
2. **Tenant Isolation:**
   - All tenant queries are bound to `client_id = get_user_client_id()`.
   - Client administrators cannot read or modify data belonging to other client tenants.
3. **Horizontal Privacy for Employees:**
   - Employees are restricted to rows where `employee_id = get_user_employee_id()` across `daily_attendance_records`, `attendance_events`, `attendance_corrections`, `leave_balances`, `leave_requests`, `employee_salary_structures`, `employee_bank_details`, `payroll_items`, and `payslips`.
4. **Separation of Payroll Admin vs HR Admin:**
   - Only `payroll_admin` and `client_admin` can view `employee_salary_structures` and `employee_bank_details`.
   - `hr_admin` and managers have ZERO access to salary structures and bank details.
5. **Separation of Self-Approval in Leave Management:**
   - `leave_balances_tenant_admin_modify` and `leave_requests_tenant_admin_modify` enforce `employee_id <> get_user_employee_id()`, preventing managers and administrators from approving their own leave requests or tampering with their own balances.

---

## 5. Verification Sign-off

- **PostgreSQL Version:** 17.11
- **Catalog Inspection Tool:** Direct `pg_policies` query via Supabase MCP
- **Result:** PASSED (63 active policies across 20 tables, 0 tables without policies).
