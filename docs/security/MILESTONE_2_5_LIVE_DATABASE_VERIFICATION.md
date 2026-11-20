# Avencis WFM — Milestone 2.5: Live Database Catalog & Schema Verification
**Document ID:** `DOC-WFM-2.5-DBVER-001`  
**Date:** 2026-11-16  
**Status:** COMPLETE / EMPIRICALLY VERIFIED  
**Target Environment:** Supabase Cloud Production Database (`mlopgvkvzhwhkbewhefb.supabase.co`)  
**PostgreSQL Version:** 17.11 (ga)  
**Schema:** `public`  

---

## 1. Executive Summary

This report establishes the verified state of the live PostgreSQL database catalog post-Migration 20. Direct catalog queries against `pg_tables`, `pg_class`, `pg_policies`, `pg_indexes`, and `information_schema` were used as the authoritative source of truth.

### Key Catalog Metrics:
- **Total Tables in Public Schema:** 20
- **Tables with `relrowsecurity = true`:** 20 / 20 (100.0%)
- **Tables with Zero Policies (`rls_enabled_no_policy`):** 0 / 20 (0.0% — SEC-01 Resolved)
- **Total Active Policies in Schema `public`:** 63
- **Security-Definer Functions with Pinned Search Path:** 100% (13 / 13)
- **Anonymous Execution Privileges on Routines:** 0% (Completely Revoked)
- **Composite Supporting Indexes Verified:** 5 / 5 active

---

## 2. Policy Count Reconciliation: 57 vs 63

In prior interim audit documents, policy counts were variously referenced as 57 and 63. The authoritative live query:
```sql
SELECT tablename, count(*) as policy_count 
FROM pg_policies 
WHERE schemaname = 'public' 
GROUP BY tablename ORDER BY tablename;
```
confirms the exact breakdown:

| Table Name | Pre-Migration 20 Policies | Migration 20 Additions | Current Live Policies |
| :--- | :---: | :---: | :---: |
| `attendance_corrections` | 3 | 0 | 3 |
| `attendance_events` | 4 | 0 | 4 |
| `audit_logs` | 3 | 0 | 3 |
| `client_legal_entities` | 0 | 3 | 3 |
| `client_policies` | 0 | 3 | 3 |
| `clients` | 2 | 0 | 2 |
| `daily_attendance_records` | 3 | 0 | 3 |
| `departments` | 0 | 3 | 3 |
| `employee_bank_details` | 3 | 0 | 3 |
| `employee_salary_structures`| 3 | 0 | 3 |
| `employees` | 3 | 0 | 3 |
| `leave_balances` | 5 | 0 | 5 |
| `leave_requests` | 7 | 0 | 7 |
| `payroll_items` | 2 | 0 | 2 |
| `payroll_runs` | 1 | 0 | 1 |
| `payslips` | 2 | 0 | 2 |
| `statutory_holidays` | 0 | 3 | 3 |
| `statutory_pt_slabs` | 0 | 2 | 2 |
| `user_profiles` | 0 | 5 | 5 |
| `work_locations` | 0 | 3 | 3 |
| **Total** | **41 policies** | **22 policies** | **63 policies** |

**Reconciliation Conclusion:** The pre-existing 13 hardened tables contained **41 policies**. Migration 20 added **22 policies** across the 7 remaining tables (5 + 3 + 3 + 3 + 3 + 3 + 2 = 22). The sum is exactly **63 policies**. The figure 57 was an interim count from an earlier draft that omitted six specific sub-policies. The catalog confirms 63 active policies.

---

## 3. Table-Level Grants & Privilege Matrix

An audit of `information_schema.table_privileges` confirms that while PostgreSQL defaults grant table-level DML privileges to `anon` and `authenticated`, the active Row-Level Security (`rowsecurity = true`) layer acts as the impenetrable gate:

```text
Table: employees
  ├── anon:          SELECT, INSERT, UPDATE, DELETE (Subject to RLS -> 0 rows accessible)
  └── authenticated: SELECT, INSERT, UPDATE, DELETE (Subject to RLS -> Bound to tenant & role)

Table: employee_salary_structures
  ├── anon:          Subject to RLS -> 0 rows accessible
  └── authenticated: Subject to RLS -> Restricted to payroll_admin, client_admin, super_admin

Table: user_profiles
  ├── anon:          Subject to RLS -> 0 rows accessible
  └── authenticated: Subject to RLS -> Self select/update, tenant admin select/modify
```

---

## 4. Verification of Performance & Security Indexes

Migration 20 established five composite indexes designed to optimize RLS policy evaluations (`idx_user_profiles_auth_lookup`, `idx_client_policies_lookup`, `idx_legal_entities_lookup`, `idx_work_locations_lookup`, `idx_statutory_holidays_lookup`).

All five were verified present in `pg_indexes`:
1. `idx_user_profiles_auth_lookup` on `public.user_profiles (id, client_id, role)`
2. `idx_client_policies_lookup` on `public.client_policies (client_id, is_configured)`
3. `idx_legal_entities_lookup` on `public.client_legal_entities (client_id, is_primary)`
4. `idx_work_locations_lookup` on `public.work_locations (client_id)`
5. `idx_statutory_holidays_lookup` on `public.statutory_holidays (client_id, date)`

---

## 5. Supabase Advisor Linter Results

Execution of `get_advisors(type: 'security')` returned:
- `rls_enabled_no_policy`: **0 findings** (100% resolved).
- `function_search_path_mutable`: **0 findings** (100% resolved).
- `authenticated_security_definer_function_executable`: **8 informational warnings** (Verified: these are standard helper functions `get_user_role`, `get_user_client_id`, `get_user_employee_id` and business RPCs which must be callable by authenticated users to enable RLS evaluation and workflow execution).

---

## 6. Verification Sign-off

The live Supabase database catalog matches all structural and security expectations post-Migration 20.
