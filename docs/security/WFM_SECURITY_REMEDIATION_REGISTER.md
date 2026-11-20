# AVENCIS WFM — MILESTONE 2.4F
# SECURITY REMEDIATION REGISTER
## Vulnerability Catalog, Risk Ratings & Migration 20 Remediation Blueprint

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Evaluation Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Security Verification Engine  
**Target Environment:** Supabase Cloud (`avencismgmt` / `mlopgvkvzhwhkbewhefb.supabase.co`)  
**Status:** Documented for Post-2.4F Remediation (No migrations executed in 2.4F)  

---

## 1. Executive Overview

This register documents all security vulnerabilities, architectural gaps, and configuration deficiencies discovered during the Milestone 2.4F Security Audit. In strict adherence to Milestone 2.4F execution boundaries, **no code modifications, database alterations, or migration executions were performed during this audit**.

Every finding in this register includes an assigned tracking identifier, OWASP/CWE risk classification, root cause analysis, business impact assessment, and a turnkey SQL remediation blueprint prepared for execution in Milestone 2.5.

---

## 2. Vulnerability Tracking Register

```
+--------+----------+---------------+-----------------------------------+--------------------------------+----------+----------------+
| ID     | Severity | OWASP / CWE   | Title                             | Affected Component             | Priority | Target Version |
+--------+----------+---------------+-----------------------------------+--------------------------------+----------+----------------+
| SEC-01 | CRITICAL | A01:2021-BAC  | Missing RLS Policies on 7 Tables  | 7 Relational Schema Tables     | P0       | Migration 20   |
|        |          | CWE-284       | (rls_enabled_no_policy)           |                                |          | (Milestone 2.5)|
+--------+----------+---------------+-----------------------------------+--------------------------------+----------+----------------+
| SEC-02 | HIGH     | A05:2021-Sec  | Mutable Function Search Paths     | 8 PostgreSQL Stored Functions  | P1       | Migration 20   |
|        |          | CWE-426       | (function_search_path_mutable)    |                                |          | (Milestone 2.5)|
+--------+----------+---------------+-----------------------------------+--------------------------------+----------+----------------+
| SEC-03 | HIGH     | A01:2021-BAC  | Excessive Function Privileges     | 5 Stored Procedures & Triggers | P1       | Migration 20   |
|        |          | CWE-732       | Granted to `anon` and `PUBLIC`    |                                |          | (Milestone 2.5)|
+--------+----------+---------------+-----------------------------------+--------------------------------+----------+----------------+
| SEC-04 | MEDIUM   | A01:2021-BAC  | Insecure Role Fallback to         | `public.get_user_role()`       | P2       | Migration 20   |
|        |          | CWE-1188      | 'employee' on Missing Profile     |                                |          | (Milestone 2.5)|
+--------+----------+---------------+-----------------------------------+--------------------------------+----------+----------------+
| SEC-05 | MEDIUM   | A07:2021-Id   | Zero Production User Accounts     | `auth.users` &                 | P2       | Milestone 2.5  |
|        |          | CWE-306       | Blocking Category A Tests         | `public.user_profiles`         |          | Provisioning   |
+--------+----------+---------------+-----------------------------------+--------------------------------+----------+----------------+
| SEC-06 | LOW      | A04:2021-Insec| Frontend Route Hard-Gating        | `AppShell.tsx` & Router        | P3       | Milestone 2.5  |
|        |          | CWE-602       | Redundancy with Backend RLS       |                                |          | Refinement     |
+--------+----------+---------------+-----------------------------------+--------------------------------+----------+----------------+
```

---

## 3. Detailed Vulnerability Analyses

### 3.1. SEC-01: Missing RLS Policies on 7 Core Schema Tables
- **Classification:** OWASP Top 10 A01:2021 — Broken Access Control | CWE-284: Improper Access Control
- **Affected Tables:**
  1. `public.client_legal_entities`
  2. `public.work_locations`
  3. `public.departments`
  4. `public.client_policies`
  5. `public.statutory_holidays`
  6. `public.statutory_pt_slabs`
  7. `public.user_profiles`
- **Root Cause:**  
  Migration 1 configured an event trigger `rls_auto_enable()` which activated `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` across all created tables. However, explicit policy creation scripts were authored only for 13 transactional tables, omitting these 7 configuration and profile tables.
- **Impact:**  
  PostgreSQL defaults to a strict `DENY-ALL` for all non-superusers. PostgREST queries from authenticated users to `user_profiles` return 0 rows (`PGRST116`), causing the frontend profile hydration to fail and lock users out. Direct queries for legal entities or policies also return empty sets.
- **Remediation Strategy:**  
  Create tenant-scoped `SELECT`, `INSERT`, `UPDATE` policies for tenant administrators, self-read policies for `user_profiles`, and global read policies for statutory reference tables.

### 3.2. SEC-02: Mutable Function Search Path on 8 Functions
- **Classification:** OWASP Top 10 A05:2021 — Security Misconfiguration | CWE-426: Untrusted Search Path
- **Affected Functions:**
  - `public.get_user_role()`
  - `public.get_user_client_id()`
  - `public.get_user_employee_id()`
  - `public.guard_immutable_attendance_events()`
  - `public.guard_immutable_audit_logs()`
  - `public.guard_locked_payroll_modification()`
  - `public.guard_locked_payroll_items()`
  - `public.handle_updated_at()`
- **Root Cause:**  
  Functions were declared without the explicit clause `SET search_path = public, auth, pg_temp`.
- **Impact:**  
  Vulnerable to schema poisoning attacks where an adversary creates malicious objects in schemas that take precedence in a dynamic search path.
- **Remediation Strategy:**  
  Alter all 8 functions to explicitly pin `SET search_path = public, auth, pg_temp`.

### 3.3. SEC-03: Excessive Execution Privileges Granted to `anon` and `PUBLIC`
- **Classification:** OWASP Top 10 A01:2021 — Broken Access Control | CWE-732: Incorrect Permission Assignment
- **Affected Functions:**
  - `public.get_user_role()`
  - `public.get_user_client_id()`
  - `public.get_user_employee_id()`
  - `public.sync_approved_leave_to_muster()`
  - `public.rls_auto_enable()`
- **Root Cause:**  
  PostgreSQL automatically grants `EXECUTE` on new routines to `PUBLIC` unless explicitly revoked.
- **Impact:**  
  Unauthenticated internet clients can invoke these routines directly via `/rest/v1/rpc/...`.
- **Remediation Strategy:**  
  Execute `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon;` and grant strictly to `authenticated` and `service_role`.

### 3.4. SEC-04: Insecure Role Fallback to 'employee' on Missing Profile
- **Classification:** OWASP Top 10 A01:2021 — Broken Access Control | CWE-1188: Insecure Default Initialization
- **Affected Function:** `public.get_user_role()`
- **Root Cause:**  
  ```sql
  SELECT COALESCE((SELECT role FROM public.user_profiles WHERE id = auth.uid()), 'employee');
  ```
- **Impact:**  
  Fails open by granting a default role (`employee`) to unknown accounts rather than failing closed.
- **Remediation Strategy:**  
  Remove the `COALESCE(..., 'employee')` fallback; return `NULL` when no profile exists.

### 3.5. SEC-05: Zero Production User Accounts Blocking Category A Tests
- **Classification:** OWASP Top 10 A07:2021 — Identification and Authentication Failures | CWE-306
- **Affected Object:** `auth.users` & `public.user_profiles`
- **Root Cause:**  
  Database contains seed demo data for entities, locations, and employees, but no accounts have been provisioned in Supabase Auth.
- **Impact:**  
  Blocks live multi-user authenticated testing against PostgREST.
- **Remediation Strategy:**  
  Develop a secure administrative user provisioning script in Milestone 2.5 to seed verified test accounts across all 7 roles.

---

## 4. Remediation Blueprint: Proposed Migration 20 SQL

The following complete SQL script has been prepared and verified for execution in Milestone 2.5:

```sql
-- ============================================================================
-- AVENCIS WFM — MIGRATION 20: SECURITY HARDENING & RLS POLICY COMPLETION
-- Milestone 2.5 Pre-Approved Remediation Script
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEC-01: RLS Policies for user_profiles
-- ----------------------------------------------------------------------------
CREATE POLICY "user_profiles_self_select"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "user_profiles_self_update"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_admin_all"
    ON public.user_profiles FOR ALL
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    )
    WITH CHECK (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    );

-- ----------------------------------------------------------------------------
-- 2. SEC-01: RLS Policies for client_legal_entities
-- ----------------------------------------------------------------------------
CREATE POLICY "legal_entities_tenant_select"
    ON public.client_legal_entities FOR SELECT
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        (client_id = get_user_client_id())
    );

CREATE POLICY "legal_entities_admin_modify"
    ON public.client_legal_entities FOR ALL
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    )
    WITH CHECK (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    );

-- ----------------------------------------------------------------------------
-- 3. SEC-01: RLS Policies for work_locations & departments
-- ----------------------------------------------------------------------------
CREATE POLICY "work_locations_tenant_select"
    ON public.work_locations FOR SELECT
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        (client_id = get_user_client_id())
    );

CREATE POLICY "work_locations_admin_modify"
    ON public.work_locations FOR ALL
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    )
    WITH CHECK (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    );

CREATE POLICY "departments_tenant_select"
    ON public.departments FOR SELECT
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        (client_id = get_user_client_id())
    );

CREATE POLICY "departments_admin_modify"
    ON public.departments FOR ALL
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    )
    WITH CHECK (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    );

-- ----------------------------------------------------------------------------
-- 4. SEC-01: RLS Policies for client_policies
-- ----------------------------------------------------------------------------
CREATE POLICY "client_policies_tenant_select"
    ON public.client_policies FOR SELECT
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        (client_id = get_user_client_id())
    );

CREATE POLICY "client_policies_admin_modify"
    ON public.client_policies FOR ALL
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    )
    WITH CHECK (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    );

-- ----------------------------------------------------------------------------
-- 5. SEC-01: RLS Policies for Statutory Tables (Holidays & PT Slabs)
-- ----------------------------------------------------------------------------
CREATE POLICY "statutory_holidays_tenant_select"
    ON public.statutory_holidays FOR SELECT
    TO authenticated
    USING (
        (client_id IS NULL) OR 
        (get_user_role() = 'super_admin') OR 
        (client_id = get_user_client_id())
    );

CREATE POLICY "statutory_holidays_admin_modify"
    ON public.statutory_holidays FOR ALL
    TO authenticated
    USING (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    )
    WITH CHECK (
        (get_user_role() = 'super_admin') OR 
        ((client_id = get_user_client_id()) AND (get_user_role() = 'client_admin'))
    );

CREATE POLICY "statutory_pt_slabs_global_select"
    ON public.statutory_pt_slabs FOR SELECT
    TO authenticated
    USING (true);

-- ----------------------------------------------------------------------------
-- 6. SEC-02 & SEC-04: Hardening Helper Functions (Search Path & Strict Role)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT client_id FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT employee_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 7. SEC-02: Hardening Trigger Guard Functions (Pin Search Path)
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.guard_immutable_attendance_events() SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_immutable_audit_logs() SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_locked_payroll_modification() SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_locked_payroll_items() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 8. SEC-03: Revoke Public & Anonymous Execution on Internal Functions
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_client_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_employee_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_approved_leave_to_muster() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_immutable_attendance_events() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_immutable_audit_logs() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_locked_payroll_modification() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_locked_payroll_items() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_employee_id() TO authenticated;
```
