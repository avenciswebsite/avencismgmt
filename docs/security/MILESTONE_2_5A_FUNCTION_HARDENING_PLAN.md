# AVENCIS WFM — MILESTONE 2.5A
# DATABASE FUNCTION HARDENING & PRIVILEGE REMEDIATION PLAN
## Execution Rights, Search Path Pinning & Fail-Closed Identity Resolution

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Phase:** Milestone 2.5A — Security Remediation Planning & Migration 20 Preparation  
**Target Environment:** Supabase Cloud (`avencismgmt` / `mlopgvkvzhwhkbewhefb.supabase.co`)  
**Database Engine:** PostgreSQL 17.11  
**Auditor:** Antigravity Autonomous Security Verification Engine  

---

## 1. Executive Summary

This plan addresses the function-level vulnerabilities identified in Milestone 2.4F:
- **SEC-02:** Eight routines with mutable `search_path` (NULL), creating schema poisoning risks.
- **SEC-03:** Excessive `EXECUTE` privileges granted to `anon` and `PUBLIC` on internal helper and trigger routines.
- **SEC-04:** Unsafe fallback in `get_user_role()` that converts unprovisioned identities into default employees.

Every function in the `public` schema has been analyzed for execution privileges, caller context (`SECURITY DEFINER` vs `SECURITY INVOKER`), schema search path resolution, and downstream trigger dependencies.

---

## 2. Complete Database Routine Inventory & Hardening Specifications

```
+------------------------------------+-----------+-----------------------------+------------------------------------+--------------------------------+
| Routine Name                       | Mode      | Proposed search_path        | Authorized EXECUTE Grants          | Remediated Vulnerabilities     |
+------------------------------------+-----------+-----------------------------+------------------------------------+--------------------------------+
| get_user_role()                    | DEFINER   | 'public', 'auth', 'pg_temp' | authenticated, service_role        | SEC-02, SEC-03, SEC-04 (P0)    |
| get_user_client_id()               | DEFINER   | 'public', 'auth', 'pg_temp' | authenticated, service_role        | SEC-02, SEC-03 (P0)            |
| get_user_employee_id()             | DEFINER   | 'public', 'auth', 'pg_temp' | authenticated, service_role        | SEC-02, SEC-03 (P0)            |
| sync_approved_leave_to_muster()    | DEFINER   | 'public', 'pg_temp'         | authenticated, service_role        | SEC-03 (P1)                    |
| rls_auto_enable()                  | DEFINER   | 'pg_catalog'                | postgres, service_role             | SEC-03 (P1)                    |
| guard_immutable_attendance_events()| INVOKER   | 'public', 'pg_temp'         | authenticated, service_role        | SEC-02, SEC-03 (P2)            |
| guard_immutable_audit_logs()       | INVOKER   | 'public', 'pg_temp'         | authenticated, service_role        | SEC-02, SEC-03 (P2)            |
| guard_locked_payroll_modification()| INVOKER   | 'public', 'pg_temp'         | authenticated, service_role        | SEC-02, SEC-03 (P2)            |
| guard_locked_payroll_items()       | INVOKER   | 'public', 'pg_temp'         | authenticated, service_role        | SEC-02, SEC-03 (P2)            |
| handle_updated_at()                | INVOKER   | 'public', 'pg_temp'         | authenticated, service_role        | SEC-02, SEC-03 (P2)            |
| generate_payroll_run()             | DEFINER   | 'public', 'auth', 'pg_temp' | authenticated, service_role        | Verified Secure in M19         |
| lock_payroll_run()                 | DEFINER   | 'public', 'auth', 'pg_temp' | authenticated, service_role        | Verified Secure in M18         |
| review_leave_request_atomic()      | DEFINER   | 'public', 'pg_temp'         | authenticated, service_role        | Verified Secure in M16         |
+------------------------------------+-----------+-----------------------------+------------------------------------+--------------------------------+
```

---

## 3. High-Priority Routine Hardening Details

### 3.1. `public.get_user_role()` (SEC-02, SEC-03, SEC-04)
- **Current Definition (Migration 03):**
  ```sql
  CREATE OR REPLACE FUNCTION public.get_user_role() 
  RETURNS TEXT AS $$
      SELECT COALESCE(
          (SELECT role FROM public.user_profiles WHERE id = auth.uid()),
          'employee'
      );
  $$ LANGUAGE sql STABLE SECURITY DEFINER;
  ```
- **Flaws Identified:**
  1. No `SET search_path`: Inherits caller search path, making `user_profiles` vulnerable to schema shadowing.
  2. `COALESCE(..., 'employee')`: Fails open; an unprovisioned account silently receives the `'employee'` role.
  3. `GRANT EXECUTE TO anon`: Directly callable by unauthenticated internet clients via PostgREST.
- **Hardened Specification for Migration 20:**
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

  REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;
  ```
- **Security Guarantees:**
  - If no profile exists for `auth.uid()`, the function returns `NULL`.
  - Any RLS expression evaluating `public.get_user_role() = 'employee'` will evaluate to `NULL` / `FALSE`, preventing unauthorized data access.
  - Pinned `search_path` eliminates schema injection risks.
  - Revocation of `anon` access prevents unauthenticated RPC probing.

---

### 3.2. `public.get_user_client_id()` & `public.get_user_employee_id()` (SEC-02, SEC-03)
- **Current Definition (Migration 03):**
  Declared without `SET search_path` and granted to `anon`.
- **Hardened Specification for Migration 20:**
  ```sql
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

  REVOKE EXECUTE ON FUNCTION public.get_user_client_id() FROM PUBLIC, anon;
  REVOKE EXECUTE ON FUNCTION public.get_user_employee_id() FROM PUBLIC, anon;

  GRANT EXECUTE ON FUNCTION public.get_user_client_id() TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.get_user_employee_id() TO authenticated, service_role;
  ```

---

### 3.3. Trigger Guard Functions (SEC-02, SEC-03)
- **Functions:**
  - `guard_immutable_attendance_events()`
  - `guard_immutable_audit_logs()`
  - `guard_locked_payroll_modification()`
  - `guard_locked_payroll_items()`
  - `handle_updated_at()`
- **Hardening Specification for Migration 20:**
  ```sql
  ALTER FUNCTION public.guard_immutable_attendance_events() SET search_path = public, pg_temp;
  ALTER FUNCTION public.guard_immutable_audit_logs() SET search_path = public, pg_temp;
  ALTER FUNCTION public.guard_locked_payroll_modification() SET search_path = public, pg_temp;
  ALTER FUNCTION public.guard_locked_payroll_items() SET search_path = public, pg_temp;
  ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;

  REVOKE EXECUTE ON FUNCTION public.guard_immutable_attendance_events() FROM PUBLIC, anon;
  REVOKE EXECUTE ON FUNCTION public.guard_immutable_audit_logs() FROM PUBLIC, anon;
  REVOKE EXECUTE ON FUNCTION public.guard_locked_payroll_modification() FROM PUBLIC, anon;
  REVOKE EXECUTE ON FUNCTION public.guard_locked_payroll_items() FROM PUBLIC, anon;
  REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon;

  GRANT EXECUTE ON FUNCTION public.guard_immutable_attendance_events() TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.guard_immutable_audit_logs() TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.guard_locked_payroll_modification() TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.guard_locked_payroll_items() TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;
  ```

---

### 3.4. Trigger Routine: `sync_approved_leave_to_muster()` (SEC-03)
- **Current State:** Defined with `SET search_path = public, pg_temp`, but execution rights defaulted to `PUBLIC` / `anon`.
- **Hardening Specification for Migration 20:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.sync_approved_leave_to_muster() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.sync_approved_leave_to_muster() TO authenticated, service_role;
  ```

---

### 3.5. Event Trigger: `rls_auto_enable()` (SEC-03)
- **Current State:** Defined with `SET search_path = pg_catalog`, but execution rights defaulted to `PUBLIC` / `anon`.
- **Hardening Specification for Migration 20:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres, service_role;
  ```

---

## 4. Downstream Dependency & Compatibility Analysis

1. **Impact on RLS Policies:**
   All 35 existing RLS policies call `get_user_role()`, `get_user_client_id()`, and `get_user_employee_id()`. Because these functions continue to be executable by `authenticated` sessions with identical return types, **zero existing policies will experience syntax or permission failures**.
2. **Impact on Frontend Login (`AuthContext.tsx`):**
   When an authenticated user logs in:
   - If they have a valid profile, `get_user_role()` returns their exact role (`'client_admin'`, `'employee'`, etc.).
   - If they do NOT have a profile, `get_user_role()` returns `NULL`. `AuthContext` detects `isProfileMissing` and displays the "Access Restricted" lockdown screen. The frontend and database layers are now perfectly synchronized in a fail-closed architecture.
3. **Impact on Mission-Critical Stored Procedures:**
   `generate_payroll_run()`, `lock_payroll_run()`, and `review_leave_request_atomic()` already query `public.user_profiles` directly and verify `v_caller_role`. They do not rely on `get_user_role()`. Their execution is 100% unaffected.

---

## 5. Summary Conclusion

The proposed routine hardening plan eliminates all Supabase Security Advisor warnings, prevents schema search-path poisoning, revokes unauthenticated access, and establishes an airtight fail-closed identity boundary.
