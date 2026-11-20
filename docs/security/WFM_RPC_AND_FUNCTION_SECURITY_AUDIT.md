# AVENCIS WFM — MILESTONE 2.4F
# DATABASE RPC & STORED FUNCTION SECURITY AUDIT
## Execution Privileges, Search Path Integrity & Concurrency Control Analysis

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Target Environment:** Supabase Cloud (`avencismgmt` / `mlopgvkvzhwhkbewhefb.supabase.co`)  
**Catalog Extraction Date:** November 15, 2026  
**Auditor:** Antigravity Autonomous Security Verification Engine  

---

## 1. Scope & Catalog Extraction Methodology

This audit evaluates the 13 database functions, procedures, and trigger handlers registered in the `public` schema of the live Avencis WFM PostgreSQL database. 

The audit inspects:
1. **Execution Privileges (`information_schema.routine_privileges`):** Whether functions are callable by unauthenticated anonymous callers (`anon`), global users (`PUBLIC`), or restricted to `authenticated` / `service_role`.
2. **Execution Context (`prosecdef`):** Identification of `SECURITY DEFINER` (executing as table owner `postgres`) versus `SECURITY INVOKER` (executing with caller privileges).
3. **Search Path Hardening (`proconfig`):** Whether `SET search_path` is explicitly fixed to prevent search-path hijacking attacks.
4. **Input Sanitization & Injection Resistance:** Parameter typing and SQL injection prevention.
5. **Concurrency Control:** Use of pessimistic row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions.

---

## 2. Comprehensive Stored Routine Inventory

```
+------------------------------------+-----------+-----------------------------------+------------------------------------+------------------------------+
| Routine Name                       | Sec Mode  | Configured search_path            | Permitted Execution Roles          | Linter Finding               |
+------------------------------------+-----------+-----------------------------------+------------------------------------+------------------------------+
| generate_payroll_run               | DEFINER   | 'public', 'auth', 'pg_temp'       | authenticated, postgres, service   | PASS                         |
| lock_payroll_run                   | DEFINER   | 'public', 'auth', 'pg_temp'       | authenticated, postgres, service   | PASS                         |
| review_leave_request_atomic        | DEFINER   | 'public', 'pg_temp'               | authenticated, postgres, service   | PASS                         |
| get_user_role                      | DEFINER   | NULL (MUTABLE)                    | PUBLIC, anon, auth, postgres, srv  | FAIL (search_path & anon)    |
| get_user_client_id                 | DEFINER   | NULL (MUTABLE)                    | PUBLIC, anon, auth, postgres, srv  | FAIL (search_path & anon)    |
| get_user_employee_id               | DEFINER   | NULL (MUTABLE)                    | PUBLIC, anon, auth, postgres, srv  | FAIL (search_path & anon)    |
| sync_approved_leave_to_muster      | DEFINER   | 'public', 'pg_temp'               | PUBLIC, anon, auth, postgres, srv  | WARN (anon callable trigger) |
| rls_auto_enable                    | DEFINER   | 'pg_catalog'                      | PUBLIC, anon, auth, postgres, srv  | WARN (anon callable trigger) |
| guard_immutable_attendance_events  | INVOKER   | NULL (MUTABLE)                    | PUBLIC, anon, auth, postgres, srv  | WARN (search_path mutable)   |
| guard_immutable_audit_logs         | INVOKER   | NULL (MUTABLE)                    | PUBLIC, anon, auth, postgres, srv  | WARN (search_path mutable)   |
| guard_locked_payroll_modification  | INVOKER   | NULL (MUTABLE)                    | PUBLIC, anon, auth, postgres, srv  | WARN (search_path mutable)   |
| guard_locked_payroll_items         | INVOKER   | NULL (MUTABLE)                    | PUBLIC, anon, auth, postgres, srv  | WARN (search_path mutable)   |
| handle_updated_at                  | INVOKER   | NULL (MUTABLE)                    | PUBLIC, anon, auth, postgres, srv  | WARN (search_path mutable)   |
+------------------------------------+-----------+-----------------------------------+------------------------------------+------------------------------+
```

---

## 3. High-Priority Security Findings

### 3.1. Finding SEC-02: Mutable Function Search Path (`function_search_path_mutable`)
- **Severity:** **HIGH**
- **Affected Functions (8):**
  - `public.get_user_role()`
  - `public.get_user_client_id()`
  - `public.get_user_employee_id()`
  - `public.guard_immutable_attendance_events()`
  - `public.guard_immutable_audit_logs()`
  - `public.guard_locked_payroll_modification()`
  - `public.guard_locked_payroll_items()`
  - `public.handle_updated_at()`
- **Vulnerability Explanation:**  
  When a PostgreSQL function (especially a `SECURITY DEFINER` function) does not explicitly set `search_path`, it inherits the search path of the invoking user session. A malicious user with object creation permissions in any schema on the search path could create malicious shadowing functions or operators, leading to arbitrary code execution with the privileges of the function owner (`postgres`).
- **Remediation:**  
  Add `SET search_path = public, auth, pg_temp;` to all 8 routines in Migration 20.

### 3.2. Finding SEC-03: Excessive Execution Privileges to Anonymous Callers (`anon`)
- **Severity:** **HIGH**
- **Affected Functions (5):**
  - `public.get_user_role()`
  - `public.get_user_client_id()`
  - `public.get_user_employee_id()`
  - `public.sync_approved_leave_to_muster()`
  - `public.rls_auto_enable()`
- **Vulnerability Explanation:**  
  In PostgreSQL, functions default to `GRANT EXECUTE ON FUNCTION ... TO PUBLIC`. As a result, the Supabase `anon` role can call these functions via PostgREST RPC endpoints (`/rest/v1/rpc/get_user_role`). While `get_user_role()` returns `NULL` or `'employee'` without disclosing secrets, unauthenticated internet callers should not be able to invoke internal database procedures.
- **Remediation:**  
  Execute `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon;` for all internal routines in Migration 20.

### 3.3. Finding SEC-04: Default Role Fallback in `get_user_role()`
- **Severity:** **MEDIUM**
- **Affected Function:** `public.get_user_role()`
- **Source Inspection:**
  ```sql
  SELECT COALESCE((SELECT role FROM public.user_profiles WHERE id = auth.uid()), 'employee');
  ```
- **Vulnerability Explanation:**  
  If an authenticated user has an entry in `auth.users` but no row in `public.user_profiles`, `get_user_role()` defaults to `'employee'`. While their `client_id` and `employee_id` will resolve to `NULL` (blocking access to specific employee records), security best practices require the function to return `NULL` (or throw an exception), failing closed rather than assuming a default role.

---

## 4. Deep-Dive Audit of Mission-Critical Stored Procedures

### 4.1. `generate_payroll_run` (Milestone 2.4E & Migration 19)
- **Signature:** `(p_client_id UUID, p_period_month INT, p_period_year INT, p_legal_entity_id UUID DEFAULT NULL)`
- **Security Mode:** `SECURITY DEFINER`
- **Search Path:** Fixed: `SET search_path TO 'public', 'auth', 'pg_temp'`
- **Privileges:** `REVOKE EXECUTE FROM PUBLIC, anon;` verified. Granted strictly to `authenticated`, `postgres`, `service_role`.
- **Identity & Authorization Checks:**
  1. Calls `auth.uid()`; raises `UNAUTHENTICATED` if NULL.
  2. Resolves caller profile from `public.user_profiles`.
  3. Verifies `caller_role IN ('super_admin', 'client_admin', 'payroll_admin')`; rejects HR Admin, Managers, and Employees.
  4. Enforces cross-tenant protection: `caller_client_id = p_client_id` (unless `super_admin`).
  5. Scopes calculation strictly to `p_legal_entity_id`.
  6. **Attendance Finalization Gate:** Queries `attendance_corrections` joined with `employees` for `legal_entity_id = v_target_legal_entity_id` and `status = 'PENDING'`. Raises `ATTENDANCE_NOT_FINALIZED` if pending regularisations exist.
  7. **Terminal Lock Protection:** Raises `PAYROLL_LOCKED` if existing run has `status = 'locked'`.
- **Injection Resistance:** Completely parameterized; zero dynamic SQL execution.

### 4.2. `lock_payroll_run` (Milestone 2.4E & Migration 18)
- **Signature:** `(p_run_id VARCHAR, p_approved_by VARCHAR DEFAULT NULL)`
- **Security Mode:** `SECURITY DEFINER`
- **Search Path:** Fixed: `SET search_path TO 'public', 'auth', 'pg_temp'`
- **Privileges:** Revoked from `PUBLIC` and `anon`. Granted strictly to `authenticated`.
- **Segregation of Duties Enforcement (Four-Eyes Principle):**
  ```sql
  IF v_caller_role NOT IN ('super_admin', 'client_admin') THEN
      RAISE EXCEPTION 'SEGREGATION_OF_DUTIES_VIOLATION: Role % cannot lock payroll runs. Only Client Admin or Super Admin may execute formal lock sign-off.', v_caller_role;
  END IF;
  ```
- **Concurrency Control:** Executes `SELECT * FROM public.payroll_runs WHERE id = p_run_id FOR UPDATE;` acquiring an exclusive row-level lock before state modification.
- **Form XIX Activation:** Inserts published payslip records into `public.payslips` with `is_published = TRUE`.
- **Immutable Audit Logging:** Directly emits an audit record with `action = 'PAYROLL_LOCK'` and `severity = 'critical'` to `public.audit_logs`.

### 4.3. `review_leave_request_atomic` (Milestone 2.4D & Migration 16)
- **Signature:** `(p_request_id UUID, p_decision VARCHAR, p_manager_remarks TEXT DEFAULT NULL)`
- **Security Mode:** `SECURITY DEFINER`
- **Search Path:** Fixed: `SET search_path TO 'public', 'pg_temp'`
- **Anti-Self-Approval Enforcement:**
  ```sql
  IF v_reviewer.employee_id IS NOT NULL AND v_reviewer.employee_id = v_req.employee_id THEN
      RAISE EXCEPTION 'GOVERNANCE_VIOLATION: Employees are strictly prohibited from reviewing their own leave requests.';
  END IF;
  ```
- **Concurrency Control:** Locks target leave request with `FOR UPDATE` and locks balance rows in `public.leave_balances` with `FOR UPDATE` during year-by-year deduction.
- **Cross-Year Partitioning:** Dynamically groups requested working days by calendar year, excluding weekly offs and statutory holidays, and verifies year-by-year balance solvency before deducting.

---

## 5. Audit Conclusions & Handover Status

1. **Mission-Critical Stored Procedures (`generate_payroll_run`, `lock_payroll_run`, `review_leave_request_atomic`):**
   - Verified **SECURE** and enterprise-compliant.
   - Pinned search paths, strict role checks, pessimistic locking, anti-self-approval, and segregation of duties fully verified in the PostgreSQL engine.
2. **Helper & Trigger Functions:**
   - Require search path pinning and execution privilege revocation in Migration 20.
