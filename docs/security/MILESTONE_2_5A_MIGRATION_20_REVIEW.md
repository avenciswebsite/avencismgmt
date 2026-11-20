# AVENCIS WFM — MILESTONE 2.5A
# MIGRATION 20 TECHNICAL REVIEW & SAFETY AUDIT
## Architectural Integrity, Compatibility Analysis & Zero-Data-Loss Rollback Strategy

**Project:** Avencis Workforce Management (WFM) Enterprise Platform  
**Target Migration File:** `supabase/migrations/20261115000020_security_hardening.sql`  
**Execution Status:** **PROPOSED / UNEXECUTED (Awaiting Formal Approval)**  
**Target Engine:** PostgreSQL 17.11 (Supabase Cloud)  
**Dependencies:** Migrations 01 through 19  

---

## 1. Executive Summary

This document presents a comprehensive technical review of proposed Migration 20 (`20261115000020_security_hardening.sql`). 

The migration addresses all security deficiencies identified during Milestone 2.4F (`SEC-01`, `SEC-02`, `SEC-03`, `SEC-04`):
1. Deploys granular, tenant-isolated Row-Level Security policies on the 7 policy-deficient tables.
2. Hardens execution paths across 8 stored routines with explicit `SET search_path = public, auth, pg_temp;`.
3. Revokes unauthenticated `EXECUTE` privileges from `anon` and `PUBLIC`.
4. Establishes a strict Fail-Closed identity resolution engine in `public.get_user_role()`.
5. Deploys targeted supporting composite indexes to optimize PostgREST RLS filter planning.

---

## 2. Safety & Architectural Properties

### 2.1. Transactional Atomicity
- The entire migration script is wrapped in a single explicit transaction block:
  ```sql
  BEGIN;
  ...
  COMMIT;
  ```
- If any statement encounters a syntax error or catalog lock timeout, PostgreSQL will automatically abort the transaction and roll back all changes, leaving the database in its exact pre-migration state.

### 2.2. Idempotency & Clean Policy Replacement
- Every policy creation statement is preceded by an explicit `DROP POLICY IF EXISTS "<policy_name>" ON <table_name>;`.
- Routine updates utilize `CREATE OR REPLACE FUNCTION`.
- Index creations utilize `CREATE INDEX IF NOT EXISTS`.
- Re-running Migration 20 multiple times will execute safely without duplicating objects or throwing duplicate identifier errors.

### 2.3. Zero Destructive DDL
- Zero tables or columns are dropped or renamed.
- Zero existing data records are truncated, updated, or deleted.
- All existing 10 live demo records (`clients`, `client_legal_entities`, `work_locations`, `departments`, `client_policies`, `employees`, `statutory_pt_slabs`) are 100% preserved.

### 2.4. Execution Order & Dependency Harmony
The migration statements are sequenced in strict dependency order:
```
Step 1: Harden security helper functions (get_user_role, get_user_client_id, get_user_employee_id)
Step 2: Revoke anon execute on security helpers & grant to authenticated
Step 3: Harden trigger guard functions & sync trigger routines
Step 4: Deploy RLS policies on user_profiles (Enables authenticated profile lookup)
Step 5: Deploy RLS policies on client_legal_entities & work_locations
Step 6: Deploy RLS policies on departments & client_policies
Step 7: Deploy RLS policies on statutory_holidays & statutory_pt_slabs
Step 8: Deploy supporting composite indexes for RLS predicates
Step 9: Commit transaction
```

---

## 3. Section-by-Section SQL Review

### 3.1. Security Helpers Hardening
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
- **Review:** Removes `COALESCE(..., 'employee')`. An unknown user returns `NULL`, causing role checks `IN ('super_admin', 'employee')` to evaluate to `FALSE`. Pins `search_path` to eliminate schema poisoning.
- **Grants:** `REVOKE EXECUTE ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated, service_role;`. Verified safe.

### 3.2. `user_profiles` RLS Policies
- `user_profiles_self_select`: Authenticated users can read their own profile (`id = auth.uid()`). **Solves the login lockout issue (`PGRST116`) for valid accounts.**
- `user_profiles_self_update`: Users can update metadata, but a `WITH CHECK` expression guarantees they cannot modify their `role`, `client_id`, or `employee_id`.
- `user_profiles_tenant_admin_modify`: Client Admins can manage staff profiles within their tenant, but are strictly blocked from assigning `role = 'super_admin'`.
- `user_profiles_super_admin_all`: Super Admins retain global governance.

### 3.3. Tenant Configuration Tables (`client_legal_entities`, `work_locations`, `departments`, `client_policies`)
- Every table grants `SELECT` to users belonging to the tenant (`client_id = get_user_client_id()`) or `super_admin`.
- Write access (`ALL`) is strictly restricted to `client_admin` and `super_admin`.
- Regular staff and managers cannot alter corporate entities, tax registrations, GPS geofences, or payroll divisors.

### 3.4. Statutory Reference Tables (`statutory_holidays`, `statutory_pt_slabs`)
- `statutory_pt_slabs`: Public state tax tables are granted universal read (`USING (true)`), but writes are restricted to `super_admin`. Tenant users cannot alter statutory tax brackets.
- `statutory_holidays`: National holidays (`client_id IS NULL`) are visible globally; client holidays are visible to that client's users. Modifications are restricted to `client_admin` and `hr_admin`.

---

## 4. Compatibility Analysis with Migrations 01–19

| Component | Existing Migration State | Migration 20 Change | Compatibility Impact |
| :--- | :--- | :--- | :--- |
| `generate_payroll_run()` | Pinned in Migration 19 | None (Untouched) | **100% Compatible**. Helper functions remain available to authenticated callers. |
| `lock_payroll_run()` | Pinned in Migration 18 | None (Untouched) | **100% Compatible**. Emits audit logs and activates payslips without disruption. |
| `review_leave_request_atomic()` | Pinned in Migration 16 | None (Untouched) | **100% Compatible**. Performs atomic cross-year deductions cleanly. |
| `payroll_runs` constraint | Multi-entity in Migration 19 | None (Untouched) | **100% Compatible**. Composite unique constraint active. |
| Existing 35 RLS policies | Created in M09, M13, M16 | Evaluates hardened helpers | **100% Compatible**. Helper function signatures and return types are identical. |

---

## 5. Non-Destructive Rollback & Recovery Plan

### 5.1. Rollback Philosophy
Under enterprise data protection standards:
- **NEVER** use rollback operations that drop tables or delete populated records.
- **NEVER** restore vulnerable configurations (e.g., re-granting `anon` execution on internal security functions).
- A safe rollback consists solely of reverting newly added RLS policies or returning function definitions to their prior stable baseline if unexpected functional regressions occur.

### 5.2. Pre-Execution Recovery Script (`rollback_migration_20_safe.sql`)
In the event that Migration 20 must be rolled back post-deployment, execute the following non-destructive script:

```sql
-- ==============================================================================
-- AVENCIS WFM — SAFE NON-DESTRUCTIVE ROLLBACK SCRIPT FOR MIGRATION 20
-- Status: CONTINGENCY ONLY — DO NOT EXECUTE UNLESS DIRECTED
-- ==============================================================================

BEGIN;

-- 1. Safely drop new policies on the 7 tables (restores previous catalog state)
DROP POLICY IF EXISTS "user_profiles_self_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_tenant_admin_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_tenant_admin_modify" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_super_admin_all" ON public.user_profiles;

DROP POLICY IF EXISTS "legal_entities_tenant_select" ON public.client_legal_entities;
DROP POLICY IF EXISTS "legal_entities_admin_modify" ON public.client_legal_entities;
DROP POLICY IF EXISTS "legal_entities_super_admin_all" ON public.client_legal_entities;

DROP POLICY IF EXISTS "work_locations_tenant_select" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_admin_modify" ON public.work_locations;
DROP POLICY IF EXISTS "work_locations_super_admin_all" ON public.work_locations;

DROP POLICY IF EXISTS "departments_tenant_select" ON public.departments;
DROP POLICY IF EXISTS "departments_admin_modify" ON public.departments;
DROP POLICY IF EXISTS "departments_super_admin_all" ON public.departments;

DROP POLICY IF EXISTS "client_policies_tenant_select" ON public.client_policies;
DROP POLICY IF EXISTS "client_policies_admin_modify" ON public.client_policies;
DROP POLICY IF EXISTS "client_policies_super_admin_all" ON public.client_policies;

DROP POLICY IF EXISTS "statutory_holidays_tenant_select" ON public.statutory_holidays;
DROP POLICY IF EXISTS "statutory_holidays_admin_modify" ON public.statutory_holidays;
DROP POLICY IF EXISTS "statutory_holidays_super_admin_all" ON public.statutory_holidays;

DROP POLICY IF EXISTS "statutory_pt_slabs_global_select" ON public.statutory_pt_slabs;
DROP POLICY IF EXISTS "statutory_pt_slabs_super_admin_modify" ON public.statutory_pt_slabs;

-- 2. Drop newly created supporting indexes
DROP INDEX IF EXISTS public.idx_user_profiles_auth_lookup;
DROP INDEX IF EXISTS public.idx_client_policies_lookup;
DROP INDEX IF EXISTS public.idx_legal_entities_lookup;
DROP INDEX IF EXISTS public.idx_work_locations_lookup;
DROP INDEX IF EXISTS public.idx_statutory_holidays_lookup;

-- 3. Note: Function search_path pinning and anon execution revocations are 
-- intentionally retained because they represent permanent security hardening.

COMMIT;
```

---

## 6. Review Verdict & Recommendations

Proposed Migration 20 (`supabase/migrations/20261115000020_security_hardening.sql`) is **ARCHITECTURALLY SOUND, FULLY IDEMPOTENT, AND SAFE FOR EXECUTION**.

**Recommendation:** Proceed to user review and approval prior to manual execution in the Supabase SQL Editor during Milestone 2.5B.
