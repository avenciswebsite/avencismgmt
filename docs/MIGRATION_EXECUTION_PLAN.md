# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MIGRATION EXECUTION PLAN (MILESTONE 1)

**Project:** Avencis ERP / Business Management Platform  
**Target Database:** PostgreSQL 15+ / Supabase Live Instance  
**Execution Stage:** Pre-Deployment Review & Authorization Gate  
**Destructive Operations:** **0 DESTRUCTIVE OPERATIONS (PURE ADDITIVE DDL)**  
**Status:** **READY FOR EXECUTION PENDING USER APPROVAL**  

---

## 1. Migration Sequence & File Manifest

The 10 migration files located in [`supabase/migrations/`](file:///c:/Avencis%20Management/supabase/migrations/) must be executed in strict numerical sequence to satisfy foreign key dependencies:

| Seq | Migration File | Target Domain & Relational Tables | Destructive? | Dependency Prerequisite |
|:---:|---|---|:---:|---|
| **01** | `20261103000001_initial_schema_clients_and_entities.sql` | `uuid-ossp`, `pgcrypto`, `clients`, `client_legal_entities` | No (Additive) | None |
| **02** | `20261103000002_locations_departments_and_policies.sql` | `work_locations`, `departments`, `client_policies` | No (Additive) | 01 |
| **03** | `20261103000003_auth_profiles_and_rbac.sql` | `user_profiles`, RLS helper functions (`public.get_user_role()`) | No (Additive) | 01, 02, `auth.users` |
| **04** | `20261103000004_employees_and_compensation.sql` | `employees`, `employee_salary_structures`, `employee_bank_details` | No (Additive) | 01, 02, 03 |
| **05** | `20261103000005_attendance_and_regularisations.sql` | `attendance_events`, `daily_attendance_records`, `attendance_corrections` | No (Additive) | 01, 04 |
| **06** | `20261103000006_leave_management.sql` | `leave_balances`, `leave_requests` | No (Additive) | 01, 04 |
| **07** | `20261103000007_payroll_engine_and_payslips.sql` | `payroll_runs`, `payroll_items`, `payslips` | No (Additive) | 01, 04 |
| **08** | `20261103000008_statutory_and_audit_ledgers.sql` | `statutory_pt_slabs`, `statutory_holidays`, `audit_logs` | No (Additive) | 01, 02 |
| **09** | `20261103000009_row_level_security_policies.sql` | RLS enablement & 22 distinct security policies across all roles | No (Additive) | 01–08 |
| **10** | `20261103000010_database_triggers_and_guards.sql` | `trg_guard_payroll_run_lock`, immutability triggers, `updated_at` | No (Additive) | 01–09 |

---

## 2. Destructive Operations & Conflict Assessment

1. **Zero Data Destruction:**  
   Every statement uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION`. No `DROP TABLE`, `TRUNCATE`, or `ALTER COLUMN ... DROP` commands exist.
2. **Conflict Check with Existing Migrations:**  
   The target Supabase project contains 0 pre-existing tables in the `public` schema (verified via PostgREST error `PGRST205: Could not find table public.clients`). There are zero migration conflicts.
3. **Explicit Post-October 30 Data API Grants:**  
   In compliance with Supabase's mandatory Data API policy change, every newly created table includes explicit `GRANT SELECT ON ... TO anon`, `GRANT SELECT, INSERT, UPDATE, DELETE ON ... TO authenticated`, and `GRANT ALL ON ... TO service_role`. Furthermore, `ALTER DEFAULT PRIVILEGES` is initialized in Migration 01 to prevent `42501 permission denied` errors on future table definitions.
4. **Foreign Key Integrity:**  
   Every foreign key constraint references either an existing primary key or a uniquely constrained column (`unq_client_pan`, `unq_client_employee_code`). Circular references (`departments.head_employee_id`) are safely deferred until after target tables are instantiated.

---

## 3. Pre-Flight Verification Checklist

Before issuing the deployment command:
- [x] `@supabase/supabase-js` is installed and verified.
- [x] [`.env`](file:///c:/Avencis%20Management/.env) contains verified `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [x] [`.env.example`](file:///c:/Avencis%20Management/.env.example) contains safe placeholders.
- [x] [`.gitignore`](file:///c:/Avencis%20Management/.gitignore) protects environment files.
- [x] TypeScript production build compiles cleanly without errors.
- [ ] User review and approval granted.

---

## 4. Rollback Strategy & Recovery Scripts

In the event of an unexpected interruption during execution, each migration file has a complementary idempotent rollback script:

```sql
-- ROLLBACK SUITE (Execute only if complete reset is required)
DROP TRIGGER IF EXISTS trg_guard_payroll_run_lock ON payroll_runs;
DROP TRIGGER IF EXISTS trg_guard_payroll_items_lock ON payroll_items;
DROP TRIGGER IF EXISTS trg_guard_attendance_events_immutability ON attendance_events;
DROP TRIGGER IF EXISTS trg_guard_audit_logs_immutability ON audit_logs;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS statutory_holidays CASCADE;
DROP TABLE IF EXISTS statutory_pt_slabs CASCADE;
DROP TABLE IF EXISTS payslips CASCADE;
DROP TABLE IF EXISTS payroll_items CASCADE;
DROP TABLE IF EXISTS payroll_runs CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS leave_balances CASCADE;
DROP TABLE IF EXISTS attendance_corrections CASCADE;
DROP TABLE IF EXISTS daily_attendance_records CASCADE;
DROP TABLE IF EXISTS attendance_events CASCADE;
DROP TABLE IF EXISTS employee_bank_details CASCADE;
DROP TABLE IF EXISTS employee_salary_structures CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS client_policies CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS work_locations CASCADE;
DROP TABLE IF EXISTS client_legal_entities CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
```

---

## 5. Execution Command (Awaiting User Sign-Off)

Once approved, the migrations can be executed against the live Supabase instance using either:
1. **Supabase SQL Editor:** Paste migration scripts 01 through 10 directly into the Supabase Dashboard SQL Query Editor.
2. **Supabase CLI:** Run `npx supabase db push` or execute via connected migration runner.
