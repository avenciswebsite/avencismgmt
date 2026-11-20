# AVENCIS WFM — MILESTONE 2.5A
# SECURITY AUDIT FINDING REVALIDATION & ARCHITECTURAL RECONCILIATION

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Phase:** Milestone 2.5A — Remediation Planning & Migration 20 Preparation  
**Revalidation Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Security Verification Engine  
**Target Environment:** Supabase Cloud (`avencismgmt` / `mlopgvkvzhwhkbewhefb.supabase.co`)  
**Verified Database Engine:** **PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit**  

---

## 1. Executive Summary & Version Reconciliation

This document independently revalidates and reconciles the five primary findings reported during Milestone 2.4F (`SEC-01` through `SEC-05`). Every finding has been re-examined against live PostgreSQL system catalogs (`pg_class`, `pg_tables`, `pg_proc`, `pg_policies`, `pg_constraint`, `pg_trigger`), Supabase GoTrue authentication architecture, existing migrations 01 through 19, and the application authorization services (`src/services/authService.ts`, `src/services/policyService.ts`, `AuthContext.tsx`).

### PostgreSQL Server Version Reconciliation:
- **Historical Discrepancy:** The Milestone 2.4F database audit document (`WFM_DATABASE_RLS_AUDIT.md`) contained an erroneous header referencing `PostgreSQL 15.8 (Ubuntu 15.8-1.pgdg22.04+1)`.
- **Revalidated Server Version:** Direct catalog query output from `SELECT version();` recorded in live session logs confirms the exact database engine is:
  ```
  PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
  ```
- **Architectural Consequence:** PostgreSQL 17 provides enhanced JSONB indexing, robust RLS query planner optimizations, and stricter transaction boundary enforcement. All proposed SQL in Migration 20 has been designed and syntax-checked specifically for PostgreSQL 17 compatibility.

---

## 2. Revalidation of SEC-01: Seven Tables with RLS Enabled but Zero Policies

### 2.1. The Finding
In Milestone 2.4F, Supabase Security Advisors reported `rls_enabled_no_policy` on seven tables:
1. `client_legal_entities`
2. `work_locations`
3. `departments`
4. `client_policies`
5. `statutory_holidays`
6. `statutory_pt_slabs`
7. `user_profiles`

### 2.2. Independent Root Cause Analysis
In Migration 01 (`20261103000001_initial_schema_clients_and_entities.sql`), default schema permissions granted `SELECT` to `anon` and `SELECT, INSERT, UPDATE, DELETE` to `authenticated`. In Migration 09 (`20261103000009_row_level_security_policies.sql`), explicit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` was executed on `client_legal_entities`, `work_locations`, `departments`, and `client_policies`. The remaining tables (`statutory_holidays`, `statutory_pt_slabs`, `user_profiles`) had RLS enabled automatically by the `rls_auto_enable()` event trigger.

However, Migration 09 created policies **only** for `clients`, `employees`, `employee_salary_structures`, `employee_bank_details`, `daily_attendance_records`, `attendance_events`, `attendance_corrections`, `leave_balances`, `leave_requests`, `payroll_runs`, `payroll_items`, `payslips`, and `audit_logs`. The configuration, statutory, and profile tables were inadvertently left with zero permissive policies.

### 2.3. Categorization & Granular Access Requirement Analysis
Under PostgreSQL engine rules, RLS enabled without any permissive policy defaults to a **STRICT DENY-ALL** for all non-superusers. We distinguish the exact requirements for each table rather than applying broad access rules:

```
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
| Table Name                 | Sensitivity Level     | Authenticated Read  | Restricted Write      | Intentional Denials   |
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
| user_profiles              | HIGH (PII, Role data) | Self only           | super_admin,          | Employees cannot edit |
|                            |                       | (id = auth.uid()) & | client_admin (tenant) | roles; No anon read;  |
|                            |                       | tenant admins       |                       | Peer profiles hidden  |
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
| client_policies            | MEDIUM (Pay rules,    | Tenant scoped       | super_admin,          | Employees/managers    |
|                            | formulas, divisors)   | (client_id match)   | client_admin (tenant) | have ZERO write access|
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
| client_legal_entities      | HIGH (PAN, TAN, GSTIN,| Tenant scoped       | super_admin,          | Employees/managers    |
|                            | PF/ESIC reg codes)    | (client_id match)   | client_admin (tenant) | have ZERO write access|
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
| work_locations             | MEDIUM (Worksite GPS  | Tenant scoped       | super_admin,          | Zero write access for |
|                            | coordinates & radius) | (client_id match)   | client_admin (tenant) | staff and managers    |
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
| departments                | LOW (Internal org     | Tenant scoped       | super_admin,          | Zero write access for |
|                            | division codes/names) | (client_id match)   | client_admin, hr_admin| regular employees     |
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
| statutory_holidays         | LOW (Public calendar  | Global national &   | super_admin (global), | Regular employees     |
|                            | & client holidays)    | tenant-scoped       | client_admin (tenant) | cannot alter calendar |
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
| statutory_pt_slabs         | LOW (State-published  | Global read-only    | super_admin only      | Tenant admins & staff |
|                            | tax schedules)        | (true for auth)     | (No tenant writes)    | STRICTLY DENIED writes|
+----------------------------+-----------------------+---------------------+-----------------------+-----------------------+
```

- **Revalidated Severity:** **CRITICAL**.
- **Conclusion:** Confirmed. The lack of policies on `user_profiles` causes PostgREST to return `PGRST116` on login, preventing profile hydration in live production mode. The lack of policies on `client_policies` and `client_legal_entities` prevents live workspace setup. Explicit, tenant-isolated policies must be deployed in Migration 20.

---

## 3. Revalidation of SEC-02: Mutable Function Search Paths

### 3.1. The Finding
Supabase Security Advisors reported `function_search_path_mutable` across eight routines:
1. `public.get_user_role()`
2. `public.get_user_client_id()`
3. `public.get_user_employee_id()`
4. `public.guard_immutable_attendance_events()`
5. `public.guard_immutable_audit_logs()`
6. `public.guard_locked_payroll_modification()`
7. `public.guard_locked_payroll_items()`
8. `public.handle_updated_at()`

### 3.2. Detailed Vulnerability vs. Advisor Noise Analysis
We inspected the actual function definitions, execution contexts (`prosecdef`), and query mechanics to determine true exploitability:

1. **`get_user_role()`, `get_user_client_id()`, `get_user_employee_id()` (GENUINE EXPLOIT RISK):**
   - **Mode:** `SECURITY DEFINER` (Executes with privileges of table owner `postgres`).
   - **Search Path:** `NULL` (Dynamic, inherited from calling session).
   - **Exploitability Analysis:** Because these three functions execute as `postgres` and are invoked inside **every single RLS policy evaluation across all 13 protected tables**, an attacker who can manipulate the session search path or create an object in a pre-positioned temporary schema (`pg_temp`) can shadow the `user_profiles` table or the `=` operator, executing arbitrary code with database superuser privileges.
   - **Severity:** **HIGH**.

2. **Trigger Guard Functions (`guard_immutable_*`, `guard_locked_*`, `handle_updated_at`) (ADVISOR NOISE / LOW RISK):**
   - **Mode:** `SECURITY INVOKER` (`prosecdef: false`).
   - **Body Analysis:**
     - `guard_immutable_attendance_events()` and `guard_immutable_audit_logs()` contain solely `RAISE EXCEPTION`. They query zero tables, execute zero operators, and cannot be poisoned.
     - `guard_locked_payroll_modification()` only checks `IF OLD.status = 'locked' THEN RAISE EXCEPTION`. Zero table queries.
     - `guard_locked_payroll_items()` executes `SELECT status INTO v_status FROM payroll_runs WHERE id = OLD.run_id;`.
     - `handle_updated_at()` executes `NEW.updated_at = NOW(); RETURN NEW;`.
   - **Severity:** **LOW**. While flagged by generic security linters, these functions run with caller privileges and pose negligible threat.
   - **Action:** Regardless of low exploitability, pinning `SET search_path = public, pg_temp;` across all trigger handlers is a zero-risk hardening practice that satisfies security linters.

---

## 4. Revalidation of SEC-03: Excessive Execution Privileges to `anon` and `PUBLIC`

### 4.1. The Finding
Milestone 2.4F identified five functions with `EXECUTE` privileges granted to `anon` and `PUBLIC`:
1. `public.get_user_role()`
2. `public.get_user_client_id()`
3. `public.get_user_employee_id()`
4. `public.sync_approved_leave_to_muster()`
5. `public.rls_auto_enable()`

### 4.2. Detailed Routine Inspection & PostgREST Exposure Analysis

1. **Security Helper Functions (`get_user_role`, `get_user_client_id`, `get_user_employee_id`):**
   - **PostgREST Exposure:** PostgREST automatically exposes every function in `public` taking zero arguments or primitive parameters as an RPC endpoint (`/rest/v1/rpc/get_user_role`).
   - **Finding:** Migration 03 explicitly ran:
     ```sql
     GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, anon, service_role;
     ```
   - **Exploitability:** Unauthenticated network callers can probe these endpoints. While `auth.uid()` evaluates to `NULL` for anonymous sessions, there is zero legitimate reason for `anon` to have execution rights.
   - **Dependencies:** RLS policies evaluate these functions when `authenticated` users execute queries. Revoking `anon` and `PUBLIC` while preserving `authenticated` will NOT break RLS.
   - **Severity:** **HIGH**.

2. **`sync_approved_leave_to_muster()`:**
   - **Routine Type:** Trigger function (`RETURNS trigger`).
   - **PostgREST Exposure:** PostgREST **does not** expose trigger functions as RPC endpoints.
   - **Privilege Mechanics:** In PostgreSQL, functions default to `GRANT EXECUTE TO PUBLIC` upon creation.
   - **Dependencies:** This function is triggered `AFTER INSERT OR UPDATE ON leave_requests`. It executes as `SECURITY DEFINER`. Revoking `PUBLIC` and `anon` while granting `authenticated` and `service_role` is safe and prevents unauthorized direct function calls.
   - **Severity:** **MEDIUM** (Misconfiguration, but not remotely callable via REST).

3. **`rls_auto_enable()`:**
   - **Routine Type:** Event trigger function (`RETURNS event_trigger`).
   - **PostgREST Exposure:** Cannot be called via REST API.
   - **Privilege Mechanics:** Executes only on DDL commands (`ddl_command_end`) initiated by superusers.
   - **Severity:** **LOW**. Revoking `PUBLIC` and `anon` is good hygiene with zero operational side-effects.

---

## 5. Revalidation of SEC-04: Insecure Role Fallback in `get_user_role()`

### 5.1. The Finding
In Migration 03, `get_user_role()` was defined as:
```sql
CREATE OR REPLACE FUNCTION public.get_user_role() 
RETURNS TEXT AS $$
    SELECT COALESCE(
        (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
        'employee'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 5.2. Independent Revalidation & Risk Analysis
- **Root Problem:** If a user account exists in Supabase GoTrue (`auth.users`) but has no profile row in `public.user_profiles`, this function silently grants them the `'employee'` role.
- **Fail-Open vs. Fail-Closed:**
  - While `get_user_client_id()` and `get_user_employee_id()` return `NULL` (preventing access to tenant-scoped rows in most policies), defaulting an unknown identity to `'employee'` is a violation of the **Fail-Closed Principle** (CWE-1188).
  - Any policy with a clause like `OR public.get_user_role() = 'employee'` would evaluate positively for unprovisioned accounts.
- **Frontend Reconciliation:** In `src/context/AuthContext.tsx`, the frontend explicitly checks for profile presence and locks down unprovisioned accounts (`isProfileMissing = true`). The database layer must match this behavior.
- **Proposed Redesign:**
  ```sql
  CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, auth, pg_temp
  AS $$
      SELECT role FROM public.user_profiles WHERE id = auth.uid();
  $$;
  ```
  If no profile exists, this function returns `NULL`. All role checks `IN ('super_admin', 'employee', ...)` will evaluate to `FALSE`, enforcing an absolute database fail-closed boundary.
- **Revalidated Severity:** **HIGH**.

---

## 6. Revalidation of SEC-05: Absence of Provisioned Production Users

### 6.1. The Finding
Milestone 2.4F confirmed that `auth.users` contains **0 rows** and `public.user_profiles` contains **0 rows**. Consequently, Category A (Live End-to-End Authenticated Multi-User Database Testing) was formally classified as **BLOCKED**.

### 6.2. Independent Revalidation
- **Catalog Proof:** Catalog count queries in live session logs confirmed:
  - `auth.users`: 0
  - `public.user_profiles`: 0
  - `clients`: 3
  - `employees`: 8
- **Audit Boundary Compliance:** Milestone 2.4F strictly prohibited creating synthetic users or modifying production data. Therefore, marking Category A tests as BLOCKED was scientifically honest and contractually required.
- **Requirements for Milestone 2.5 Remediation:**
  To unblock Category A testing and establish true multi-tenant validation, Milestone 2.5 must include:
  1. An automated provisioning script utilizing the Supabase Admin API (`supabase.auth.admin.createUser`).
  2. Exactly 10 deterministic test personas spanning all 7 roles across two distinct clients (`client-suman` and `client-maha`), plus one cross-tenant Super Admin and one unprovisioned account.
  3. Real JWT bearer tokens injected into live PostgREST HTTP requests to verify row visibility and mutation boundaries.

---

## 7. Comprehensive Security Remediation Matrix

```
+--------+----------+-------------+-----------------------------------+--------------------+--------------------------------+--------------+-------------------+--------------------+
| ID     | Original | Revalidated | Finding Title                     | Affected Objects   | Proposed Remediation           | Dependencies | Operational Risk  | Verification Method|
|        | Severity | Severity    |                                   |                    |                                |              | of Change         |                    |
+--------+----------+-------------+-----------------------------------+--------------------+--------------------------------+--------------+-------------------+--------------------+
| SEC-01 | CRITICAL | CRITICAL    | 7 Tables with RLS but no policies | 7 schema tables    | Create tenant-scoped SELECT &  | Migrations   | LOW: Resolves     | PostgREST query    |
|        |          |             | (PostgREST Deny-All)              |                    | restricted write policies in   | 01-19        | login blockout &  | returns rows for   |
|        |          |             |                                   |                    | Migration 20                   |              | unlocks setup     | auth personas      |
+--------+----------+-------------+-----------------------------------+--------------------+--------------------------------+--------------+-------------------+--------------------+
| SEC-02 | HIGH     | HIGH (3 fn) | Mutable function search_path      | 8 stored functions | Explicitly set search_path =   | Functions in | ZERO: Pure        | Catalog check      |
|        |          | LOW (5 fn)  | (Poisoning vulnerability)         |                    | public, auth, pg_temp in M20   | Migrations 03| hardening without | proconfig in       |
|        |          |             |                                   |                    |                                | & 10         | logic changes     | pg_proc            |
+--------+----------+-------------+-----------------------------------+--------------------+--------------------------------+--------------+-------------------+--------------------+
| SEC-03 | HIGH     | HIGH (3 fn) | Excessive EXECUTE on functions to | 5 stored routines  | REVOKE EXECUTE FROM PUBLIC,anon| Migrations   | ZERO: Internal    | information_schema |
|        |          | MED (2 fn)  | anon and PUBLIC                   |                    | GRANT TO authenticated in M20  | 03 & 10      | helpers never     | routine_privileges |
|        |          |             |                                   |                    |                                |              | needed by anon    | check              |
+--------+----------+-------------+-----------------------------------+--------------------+--------------------------------+--------------+-------------------+--------------------+
| SEC-04 | MEDIUM   | HIGH        | Unsafe role fallback to 'employee'| get_user_role()    | Remove COALESCE fallback;      | Migration 03 | ZERO: Aligns with | Unprovisioned user |
|        |          |             | on missing profile                |                    | return NULL on missing profile |              | AuthContext       | returns role=NULL, |
|        |          |             |                                   |                    |                                |              | profile gate      | 403 denied         |
+--------+----------+-------------+-----------------------------------+--------------------+--------------------------------+--------------+-------------------+--------------------+
| SEC-05 | MEDIUM   | MEDIUM      | Zero provisioned users in Auth    | auth.users &       | Create automated provisioning  | Migration 20 | LOW: Creates      | Live JWT multi-user|
|        |          |             | blocking Category A testing       | user_profiles      | script in Milestone 2.5B       | applied      | isolated test     | test suite         |
|        |          |             |                                   |                    |                                |              | personas only     | execution          |
+--------+----------+-------------+-----------------------------------+--------------------+--------------------------------+--------------+-------------------+--------------------+
```
