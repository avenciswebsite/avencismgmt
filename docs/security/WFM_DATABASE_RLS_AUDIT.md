# AVENCIS WFM — MILESTONE 2.4F
# DATABASE ROW-LEVEL SECURITY (RLS) AUDIT
## Comprehensive PostgreSQL Policy & Tenant Isolation Verification

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Target Environment:** Supabase Cloud (`avencismgmt` / `mlopgvkvzhwhkbewhefb.supabase.co`)  
**Database Engine:** PostgreSQL 15.8 (Ubuntu 15.8-1.pgdg22.04+1)  
**Catalog Extraction Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Security Verification Engine  

---

## 1. Scope & Catalog Extraction Methodology

This audit examines the Row-Level Security (RLS) configuration across all 20 public relational tables in the Avencis WFM Supabase database. The audit was conducted strictly via PostgreSQL system catalog queries against `pg_class`, `pg_tables`, `pg_policies`, and Supabase Security Linter extensions (`get_advisors`), with zero alteration of existing schema, policies, or data records.

### Catalog Extraction Query:
```sql
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

---

## 2. Table-by-Table RLS Status & Policy Inventory

All 20 tables in schema `public` have Row-Level Security explicitly enabled (`relrowsecurity = true`). Force Row Security is disabled (`relforcerowsecurity = false`), meaning table owners and superusers bypass RLS.

```
+----------------------------------------------------------------------------------------------------------------+
| Table Name                   | RLS Enabled | Policies Count | Non-Owner Default | Linter Status                |
+------------------------------+-------------+----------------+-------------------+------------------------------+
| clients                      | YES         | 2              | Evaluates Policy  | PASS                         |
| client_legal_entities        | YES         | 0              | STRICT DENY-ALL   | FAIL (rls_enabled_no_policy) |
| work_locations               | YES         | 0              | STRICT DENY-ALL   | FAIL (rls_enabled_no_policy) |
| departments                  | YES         | 0              | STRICT DENY-ALL   | FAIL (rls_enabled_no_policy) |
| client_policies              | YES         | 0              | STRICT DENY-ALL   | FAIL (rls_enabled_no_policy) |
| statutory_holidays           | YES         | 0              | STRICT DENY-ALL   | FAIL (rls_enabled_no_policy) |
| statutory_pt_slabs           | YES         | 0              | STRICT DENY-ALL   | FAIL (rls_enabled_no_policy) |
| user_profiles                | YES         | 0              | STRICT DENY-ALL   | FAIL (rls_enabled_no_policy) |
| employees                    | YES         | 3              | Evaluates Policy  | PASS                         |
| employee_salary_structures   | YES         | 3              | Evaluates Policy  | PASS                         |
| employee_bank_details        | YES         | 3              | Evaluates Policy  | PASS                         |
| daily_attendance_records     | YES         | 3              | Evaluates Policy  | PASS                         |
| attendance_events            | YES         | 4              | Evaluates Policy  | PASS                         |
| attendance_corrections       | YES         | 3              | Evaluates Policy  | PASS                         |
| leave_balances               | YES         | 5              | Evaluates Policy  | PASS                         |
| leave_requests               | YES         | 7              | Evaluates Policy  | PASS                         |
| payroll_runs                 | YES         | 1              | Evaluates Policy  | PASS                         |
| payroll_items                | YES         | 2              | Evaluates Policy  | PASS                         |
| payslips                     | YES         | 2              | Evaluates Policy  | PASS                         |
| audit_logs                   | YES         | 3              | Evaluates Policy  | PASS                         |
+------------------------------+-------------+----------------+-------------------+------------------------------+
| TOTALS                       | 20 / 20     | 35 policies    | 13 Active / 7 Deficient                          |
+----------------------------------------------------------------------------------------------------------------+
```

---

## 3. Detailed Policy Definitions by Table

### 3.1. `clients`
- **Policy 1: `clients_client_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(id = get_user_client_id())`
  - **Assessment:** Ensures tenant client administrators only view their assigned organization.
- **Policy 2: `clients_super_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`
  - **Assessment:** Full platform oversight for Super Admins.

### 3.2. `employees`
- **Policy 1: `employees_self_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(id = get_user_employee_id())`
  - **Assessment:** Permits employees to view their own profile.
- **Policy 2: `employees_client_admin_tenant`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'payroll_admin'::text])))`
  - **WITH CHECK:** Identical tenant and role predicate.
  - **Assessment:** Tenant administrators manage employees within their organization.
- **Policy 3: `employees_super_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`
  - **Assessment:** Global platform management.

### 3.3. `employee_salary_structures` (Sensitive Compensation)
- **Policy 1: `salary_employee_self_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((employee_id = get_user_employee_id()) AND (is_active = true))`
  - **Assessment:** Restricted to active structure for the authenticated employee.
- **Policy 2: `salary_payroll_admin_tenant`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text])))`
  - **WITH CHECK:** Identical predicate.
  - **Assessment:** Strict role restriction. HR Admins and Client Managers are denied access to sensitive compensation records.
- **Policy 3: `salary_super_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`

### 3.4. `employee_bank_details` (Sensitive Financial PII)
- **Policy 1: `bank_employee_self_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(employee_id = get_user_employee_id())`
- **Policy 2: `bank_payroll_admin_tenant`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text])))`
- **Policy 3: `bank_super_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`

### 3.5. `daily_attendance_records`
- **Policy 1: `daily_attendance_employee_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(employee_id = get_user_employee_id())`
- **Policy 2: `daily_attendance_tenant_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text, 'location_manager'::text])))`
  - **WITH CHECK:** Identical predicate.
- **Policy 3: `daily_attendance_super_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`

### 3.6. `attendance_events` (Raw GPS Telemetry)
- **Policy 1: `events_employee_self_insert`**
  - **Command:** `INSERT`
  - **Roles:** `{authenticated}`
  - **WITH CHECK:** `((employee_id = get_user_employee_id()) AND (client_id = get_user_client_id()))`
  - **Assessment:** Self-service punch insertion strictly scoped to own employee and tenant.
- **Policy 2: `events_employee_self_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(employee_id = get_user_employee_id())`
- **Policy 3: `events_tenant_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text, 'location_manager'::text])))`
- **Policy 4: `events_super_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`
  - **Assessment:** Note that NO UPDATE or DELETE policies exist. Furthermore, BEFORE trigger `trg_guard_attendance_events_immutability` blocks updates/deletions at the database engine level.

### 3.7. `attendance_corrections`
- **Policy 1: `corrections_employee_apply`**
  - **Command:** `INSERT`
  - **Roles:** `{authenticated}`
  - **WITH CHECK:** `((employee_id = get_user_employee_id()) AND (client_id = get_user_client_id()))`
- **Policy 2: `corrections_employee_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(employee_id = get_user_employee_id())`
- **Policy 3: `corrections_tenant_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['super_admin'::text, 'client_admin'::text, 'hr_admin'::text, 'client_manager'::text])))`
  - **WITH CHECK:** Identical predicate.

### 3.8. `leave_balances`
- **Policy 1: `leave_balances_employee_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(employee_id = get_user_employee_id())`
- **Policy 2: `leave_balances_payroll_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = 'payroll_admin'::text))`
- **Policy 3: `leave_balances_tenant_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND ((get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text])) OR ((get_user_role() = 'location_manager'::text) AND (employee_id IN (SELECT e.id FROM employees e WHERE (e.work_location_id = (SELECT m.work_location_id FROM employees m WHERE (m.id = get_user_employee_id()))))))))`
- **Policy 4: `leave_balances_tenant_admin_modify`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (employee_id <> get_user_employee_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text])))`
  - **WITH CHECK:** Identical predicate.
  - **Assessment:** Strict Anti-Self-Modification: `(employee_id <> get_user_employee_id())` prevents administrators from editing their own leave balances directly.
- **Policy 5: `leave_balances_super_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`

### 3.9. `leave_requests`
- **Policy 1: `leave_requests_employee_insert`**
  - **Command:** `INSERT`
  - **Roles:** `{authenticated}`
  - **WITH CHECK:** `((employee_id = get_user_employee_id()) AND (client_id = get_user_client_id()) AND ((status)::text = 'PENDING'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL))`
  - **Assessment:** Guarantees that employees cannot insert pre-approved requests.
- **Policy 2: `leave_requests_employee_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(employee_id = get_user_employee_id())`
- **Policy 3: `leave_requests_employee_cancel`**
  - **Command:** `UPDATE`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((employee_id = get_user_employee_id()) AND ((status)::text = 'PENDING'::text))`
  - **WITH CHECK:** `((employee_id = get_user_employee_id()) AND ((status)::text = 'CANCELLED'::text) AND (reviewed_by IS NULL))`
  - **Assessment:** Self-service cancellation restricted to own pending applications.
- **Policy 4: `leave_requests_payroll_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = 'payroll_admin'::text))`
- **Policy 5: `leave_requests_tenant_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND ((get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text])) OR ((get_user_role() = 'location_manager'::text) AND (employee_id IN (SELECT e.id FROM employees e WHERE (e.work_location_id = (SELECT m.work_location_id FROM employees m WHERE (m.id = get_user_employee_id()))))))))`
- **Policy 6: `leave_requests_tenant_admin_modify`**
  - **Command:** `UPDATE`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (employee_id <> get_user_employee_id()) AND ((get_user_role() = ANY (ARRAY['client_admin'::text, 'hr_admin'::text, 'client_manager'::text])) OR ((get_user_role() = 'location_manager'::text) AND (employee_id IN (SELECT e.id FROM employees e WHERE (e.work_location_id = (SELECT m.work_location_id FROM employees m WHERE (m.id = get_user_employee_id()))))))))`
  - **WITH CHECK:** Identical predicate.
  - **Assessment:** Strict Anti-Self-Approval: `(employee_id <> get_user_employee_id())` prevents managers from approving or altering their own leave requests.
- **Policy 7: `leave_requests_super_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`

### 3.10. `payroll_runs`
- **Policy 1: `payroll_runs_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((get_user_role() = 'super_admin'::text) OR ((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text]))))`
  - **WITH CHECK:** Identical predicate.
  - **Assessment:** Access is strictly limited to `super_admin`, `client_admin`, and `payroll_admin`. Other roles (HR Admin, Managers, Employees) are completely denied access.

### 3.11. `payroll_items`
- **Policy 1: `payroll_items_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((get_user_role() = 'super_admin'::text) OR ((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text]))))`
  - **WITH CHECK:** null
- **Policy 2: `payroll_items_employee_self_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((employee_id = get_user_employee_id()) AND (EXISTS (SELECT 1 FROM payroll_runs r WHERE (((r.id)::text = (payroll_items.run_id)::text) AND ((r.status)::text = ANY ((ARRAY['approved'::character varying, 'locked'::character varying])::text[]))))))`
  - **Assessment:** Outstanding Isolation: Employees can view their own payroll line items ONLY after the run has been transitioned to `approved` or `locked`. Draft/in-progress calculations remain invisible to employees.

### 3.12. `payslips`
- **Policy 1: `payslips_admin_all`**
  - **Command:** `ALL`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((get_user_role() = 'super_admin'::text) OR ((client_id = get_user_client_id()) AND (get_user_role() = ANY (ARRAY['client_admin'::text, 'payroll_admin'::text, 'hr_admin'::text]))))`
- **Policy 2: `payslips_employee_self_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((employee_id = get_user_employee_id()) AND (is_published = true))`
  - **Assessment:** Employees can only select published payslips belonging to their own employee ID.

### 3.13. `audit_logs`
- **Policy 1: `audit_logs_authenticated_insert`**
  - **Command:** `INSERT`
  - **Roles:** `{authenticated}`
  - **WITH CHECK:** `true`
  - **Assessment:** Authenticated clients can emit compliance logs.
- **Policy 2: `audit_logs_client_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'::text))`
- **Policy 3: `audit_logs_super_admin_select`**
  - **Command:** `SELECT`
  - **Roles:** `{authenticated}`
  - **USING (qual):** `(get_user_role() = 'super_admin'::text)`
  - **Assessment:** Non-admin roles (Payroll Admin, HR Admin, Managers, Employees) have ZERO read access. Immutability trigger prevents updates/deletions.

---

## 4. The 7 Policy-Deficient Tables (`rls_enabled_no_policy`)

A critical finding identified by Supabase Security Advisors is that 7 tables have Row-Level Security enabled, but **ZERO policies defined in `pg_policies`**:

1. `client_legal_entities`
2. `work_locations`
3. `departments`
4. `client_policies`
5. `statutory_holidays`
6. `statutory_pt_slabs`
7. `user_profiles`

### PostgreSQL Engine Behavior:
Under PostgreSQL security architecture, when RLS is enabled on a table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) without any permissive policies:
- **Table Owner (`postgres`) / Superuser:** Bypasses RLS (`BYPASSRLS` attribute); full read/write access.
- **`SECURITY DEFINER` Functions:** Functions defined with `SECURITY DEFINER` execute with the privileges of their owner (`postgres`), thereby bypassing RLS.
- **PostgREST Authenticated Callers (`authenticated`):** PostgreSQL enforces a strict **DEFAULT DENY-ALL**. Any direct query via PostgREST returns an empty array (`[]`) or `PGRST116` (row not found).

### Impact on Application Architecture:
1. **`user_profiles` Impact:**  
   When a user logs in through Supabase GoTrue, the frontend client calls:
   ```typescript
   supabase.from('user_profiles').select('*').eq('id', userId).single();
   ```
   Because `user_profiles` has 0 policies, PostgREST returns `PGRST116` (Not Found). The frontend `AppShell` detects this and displays the "Access Restricted: User profile missing" screen.
   *(Note: The database RPC functions `get_user_role()`, `get_user_client_id()`, and `get_user_employee_id()` run as `SECURITY DEFINER` and can read `user_profiles`, but direct PostgREST client queries fail).*

2. **`client_policies` & `client_legal_entities` Impact:**  
   When `policyService.getLegalEntities(clientId)` or `policyService.getClientPolicy(clientId)` is executed against live PostgREST, it receives 0 rows, preventing live client policy updates from the UI unless performed via an elevated RPC or service-role backend.

3. **Statutory Reference Tables (`statutory_holidays`, `statutory_pt_slabs`):**  
   These are referenced by the stored functions `generate_payroll_run` and `review_leave_request_atomic`. Because those functions run as `SECURITY DEFINER`, they execute successfully without error. However, if the UI attempts to display a holiday calendar directly from `statutory_holidays`, PostgREST returns 0 rows.

---

## 5. Summary & Remediation Requirements

| Finding ID | Severity | Affected Tables | Root Cause | Target Fix |
| :--- | :---: | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | `client_legal_entities`<br>`work_locations`<br>`departments`<br>`client_policies`<br>`statutory_holidays`<br>`statutory_pt_slabs`<br>`user_profiles` | Initial migrations enabled RLS via `rls_auto_enable()` event trigger but did not generate policy scripts for configuration and profile tables. | Deploy Migration 20 adding tenant-scoped `SELECT`, `INSERT`, `UPDATE` policies for tenant admins, self-read for `user_profiles`, and global read for statutory reference tables. |

---

## 6. Verification Status

- **Database Inspection:** Complete.
- **Catalog Verification:** Verified against live PostgreSQL catalogs (`pg_class`, `pg_tables`, `pg_policies`).
- **Data Tampering:** Strictly ZERO policies added, deleted, or altered during Milestone 2.4F.
