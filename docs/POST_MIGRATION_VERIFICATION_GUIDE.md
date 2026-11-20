# AVENCIS WORKFORCE MANAGEMENT (WFM)
## POST-MIGRATION DATABASE VERIFICATION GUIDE

**Target:** Supabase Cloud SQL Editor  
**Script:** [`supabase/verification/POST_MIGRATION_VERIFICATION.sql`](file:///c:/Avencis%20Management/supabase/verification/POST_MIGRATION_VERIFICATION.sql)  
**Safety Classification:** 100% READ-ONLY (Zero DDL, Zero DML, Zero State Mutations)  
**Status:** **AUTHORITATIVE OPERATIONAL RUNBOOK**  

---

## 1. How to Execute the Script in Supabase

1. Open your web browser and navigate to your **Supabase Project Dashboard**:
   `https://supabase.com/dashboard/project/mlopgvkvzhwhkbewhefb`
2. In the left navigation menu, click on the **SQL Editor** icon (`>_`).
3. Click **New Query** (or the `+` button) to open a fresh SQL worksheet.
4. Open the verification file [`supabase/verification/POST_MIGRATION_VERIFICATION.sql`](file:///c:/Avencis%20Management/supabase/verification/POST_MIGRATION_VERIFICATION.sql) and copy its entire contents.
5. Paste the SQL code into the Supabase query editor window.
6. Click the green **Run** button (or press `Ctrl + Enter` / `Cmd + Enter`).
7. The query will execute in approximately 1 to 2 seconds and render a comprehensive, sortable diagnostic table in the **Results** panel.

---

## 2. Understanding the Diagnostic Results

The script performs over **140 automated system catalog checks** and returns a single, unified, interactive report with the following columns:

| Column Header | Meaning & Purpose |
|---|---|
| `category` | High-level architectural domain (e.g. `00. MIGRATIONS ROLLUP`, `02. TABLES (20 CORE)`, `08. RLS POLICIES`, etc.). |
| `item_name` | Name of the database object being inspected (table, constraint, index, function, trigger, or policy). |
| `test_type` | Specific structural or security check being evaluated. |
| `status` | **PASS**, **FAIL**, or **WARNING**. |
| `expected_value` | Target specification as declared in the 10 migration files. |
| `actual_value` | Actual live state detected inside PostgreSQL `information_schema` and `pg_catalog`. |
| `details` | Human-readable explanation with exact diagnostic guidance. |

---

## 3. Interpreting Result Statuses

### `PASS` (Green)
* **Meaning:** The expected database object exists, has the correct column count, constraint definition, execution permissions, or RLS attachment matching the authoritative schema.
* **Action:** No action required.

### `FAIL` (Red)
* **Meaning:** The expected object is completely missing, or a critical security prerequisite (like RLS on sensitive workforce tables or post-Oct 30 Data API grants) is not met.
* **Action:** Refer to the `details` column and execute the specific migration file or statement indicated.

### `WARNING` (Yellow)
* **Meaning:** The object exists, but has a non-critical discrepancy (e.g., fewer columns than expected or missing `SECURITY DEFINER` on a helper function).
* **Action:** Review the `details` message to determine whether schema adjustment is required.

---

## 4. Section-by-Section Breakdown

```
00. MASTER AUDIT SUMMARY     --> Single row aggregate health score (Total checks, Pass/Fail count)
00. MIGRATIONS ROLLUP        --> Status rollup for each of the 10 migrations individually (PASS / PARTIAL / FAIL)
01. EXTENSIONS               --> Verifies uuid-ossp and pgcrypto
02. TABLES (20 CORE)         --> Verifies existence of all 20 tables & minimum column counts
03. PRIMARY KEYS             --> Confirms valid primary key on every table
04. FOREIGN KEYS             --> Verifies relational referential integrity (cascades & restrictions)
05. UNIQUE CONSTRAINTS       --> Checks code, PAN, period, and composite uniqueness rules
06. INDEXES                  --> Checks 26+ performance indexes on foreign keys and filters
07. RLS STATUS               --> Confirms Row Level Security is active on all 17 sensitive tables
08. RLS POLICIES             --> Checks all 33 tenant and role-based policies
09. FUNCTIONS                --> Checks RBAC helpers and trigger functions
10. TRIGGERS                 --> Checks locked payroll guards and telemetry immutability
11. DATA API GRANTS          --> Validates Post-October 30 Supabase PostgREST access grants
12. SEED DATA                --> Verifies standard Maharashtra Professional Tax schedules
```

---

## 5. Troubleshooting & Remediation Guide

If any check reports `FAIL`, use the table below to remediate the issue immediately:

| Failure Symptom | Probable Cause | Exact Remediation Action |
|---|---|---|
| **`public.user_profiles` or helper functions missing** | Migration 03 failed due to `auth` schema permission error. | Run the updated [`supabase/migrations/20261103000003_auth_profiles_and_rbac.sql`](file:///c:/Avencis%20Management/supabase/migrations/20261103000003_auth_profiles_and_rbac.sql) which creates functions in `public.` instead of `auth.`. |
| **`RLS DISABLED (SECURITY RISK)` on a table** | Migration 09 did not execute for that table. | Re-run [`supabase/migrations/20261103000009_row_level_security_policies.sql`](file:///c:/Avencis%20Management/supabase/migrations/20261103000009_row_level_security_policies.sql). |
| **Missing trigger (e.g. `trg_guard_payroll_run_lock`)** | Migration 10 did not execute. | Run [`supabase/migrations/20261103000010_database_triggers_and_guards.sql`](file:///c:/Avencis%20Management/supabase/migrations/20261103000010_database_triggers_and_guards.sql). |
| **`CRITICAL: Lacks Post-Oct 30 Data API grants`** | Tables were created without explicit `GRANT` statements. | Execute the `GRANT SELECT ON ... TO anon; GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated;` statements from the respective migration. |
| **Missing foreign key constraint** | Table was created out of dependency order. | Execute migrations in strict numerical order (`01` through `10`). |
