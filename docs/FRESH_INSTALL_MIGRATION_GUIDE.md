# AVENCIS WORKFORCE MANAGEMENT (WFM)
## FRESH INSTALL MIGRATION GUIDE & ARCHITECTURAL REFERENCE

> **Target File:** `supabase/migrations/AVENCIS_WFM_COMPLETE_FRESH_INSTALL.sql`  
> **Applicability:** Brand new, empty Supabase project environments (Staging / Production / Disaster Recovery).  
> **Authoritative Version:** Milestone 2.4D.2 Consolidated Baseline  
> **Status:** READY FOR STAGING / NEW ENVIRONMENT PROVISIONING  

---

### ⚠️ CRITICAL WARNING: DO NOT RUN ON EXISTING DATABASES

> [!CAUTION]
> **NEVER execute `AVENCIS_WFM_COMPLETE_FRESH_INSTALL.sql` against an active, existing, or partially migrated database.**
> 
> 1. **Schema Conflicts:** The script contains unconditional `CREATE TABLE` and `CREATE TYPE` statements that will fail or conflict if objects already exist.
> 2. **Constraint & Index Collisions:** Attempting to run this on an existing database will trigger collision errors with existing foreign keys, primary keys, and indexes.
> 3. **Operational Disruption:** If executed against an existing database, it could cause partial failure states or disrupt ongoing transactions.
> 
> **For existing environments (such as your current Supabase instance where Migrations 01–17 have been executed):**  
> Use `supabase/verification/AVENCIS_WFM_MASTER_DATABASE_AUDIT.sql` for validation, and only apply surgical remediation via `supabase/verification/AVENCIS_WFM_MASTER_DATABASE_REPAIR.sql`.

---

## 1. PURPOSE AND ARCHITECTURAL SCOPE

During the incremental development of Milestone 2 (from Milestone 2.1 through 2.4D.2), a total of 17 migrations were authored. In that journey:
- Migrations 12, 13, and 14 introduced early implementations of leave decision RPC, RLS policies, and attendance triggers that had subtle limitations (e.g., single-year balance deduction, missing manager self-approval checks, and overwriting biometric punches).
- Migrations 15, 16, and 17 completely replaced and superseded Migrations 12, 13, and 14 respectively.
- Migration 11 hardened leave balance arithmetic identities and added `COMP_OFF`.

`AVENCIS_WFM_COMPLETE_FRESH_INSTALL.sql` consolidates the entire authoritative database definition into a single, clean, linear DDL script. It completely omits the flawed intermediate steps (12–14) and builds the exact desired production state in optimal topological order.

---

## 2. INVENTORY OF DATABASE OBJECTS CREATED

A fresh execution of `AVENCIS_WFM_COMPLETE_FRESH_INSTALL.sql` provisions:

### A. 20 Core Relational Tables
1. `clients` — Client tenant entity with corporate details and billing contacts.
2. `client_locations` — Geographic branches/sites scoped to clients.
3. `client_departments` — Organizational departments per client.
4. `client_designations` — Job titles and salary grades per client.
5. `client_policies` — Operational policies (work week, grace periods, half-day rules).
6. `client_shift_types` — Shift timings, grace periods, and break rules.
7. `employees` — Core employee master records linked to `auth.users`.
8. `employee_statutory_details` — PF, ESI, PAN, UAN, and tax information.
9. `employee_bank_details` — Bank account details for payroll disbursement.
10. `employee_salary_structures` — Base salary and structured allowance components.
11. `employee_documents` — Uploaded identity and verification documents.
12. `leave_policies` — Client leave accrual and quota policies.
13. `leave_balances` — Annual quota, opening, used, and closing balances per leave type and year.
14. `leave_requests` — Employee leave applications with workflow states.
15. `leave_audit_logs` — Immutable audit trail of every leave workflow event.
16. `daily_attendance_records` — Daily muster records with punches, hours, and status.
17. `biometric_punch_logs` — Raw punch stream from biometric devices and mobile app.
18. `attendance_regularisation_requests` — Employee correction workflows for missed punches.
19. `payroll_runs` — Monthly payroll processing batches.
20. `payslips` — Individual monthly payslips with gross-to-net calculations.

### B. Enumerations & Check Constraints
- **9-Status Attendance Taxonomy:**
  `'PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_DUTY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'`
- **Leave Balance Identity Constraint:**
  `chk_leave_balance_identity`: `closing = opening + accrued - used`
- **Leave Type Taxonomy:**
  `'CASUAL', 'SICK', 'EARNED', 'LWP', 'COMP_OFF'`
- **Leave Decision Statuses:**
  `'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'`

### C. Stored Procedures & Triggers
- `review_leave_request_atomic(p_request_id, p_action, p_rejection_reason)`:
  - Definitive cross-year balance partitioning.
  - Multi-row pessimistic locking (`FOR UPDATE` ordered by `year ASC`).
  - Strict anti-self-approval enforcement (`reviewer_id != employee_id`).
  - Location Manager and Client Admin multi-tenant authorization.
  - Audit logging in `leave_audit_logs`.
- `sync_approved_leave_to_muster()` & `trg_sync_approved_leave_to_muster`:
  - Automatically syncs approved leave dates into `daily_attendance_records`.
  - **Biometric punch protection:** Never overwrites records where actual punches exist (`check_in_time IS NOT NULL`, `check_out_time IS NOT NULL`, or `total_hours > 0`).
  - Never overwrites regularised attendance records (`is_regularised = true`).
  - Sets `PAID_LEAVE` or `UNPAID_LEAVE` depending on whether the leave type is LWP.

### D. Row Level Security (RLS)
- RLS enabled on all 20 tables.
- Hardened policies on `leave_requests` and `leave_balances` preventing unauthorized balance modifications and self-approvals.
- Scope-isolated access for Employees, Managers, Location Managers, Client Admins, and Super Admins.

---

## 3. COMPARISON: INCREMENTAL MIGRATIONS VS. FRESH INSTALL

| Feature / Aspect | Incremental Migrations (01–17) | Consolidated Fresh Install |
| :--- | :--- | :--- |
| **Execution Steps** | 17 separate sequential executions | 1 single execution |
| **Intermediate Artifacts** | Migrations 12–14 created and later superseded | 12–14 completely excluded |
| **Redundant Indexes** | Created duplicate `idx_daily_attendance_leave` | Only creates single optimal `idx_daily_attendance_leave_req` |
| **Catalog Churn** | Multiple `ALTER TABLE`, `DROP CONSTRAINT`, `CREATE OR REPLACE` | Direct initial creation of final schema state |
| **Risk of Interruption** | Network timeout or syntax error in intermediate file | Atomic or single-session deployment |
| **Intended Target** | Live development database undergoing feature evolution | New Staging, UAT, QA, or Production environments |

---

## 4. STEP-BY-STEP FRESH ENVIRONMENT PROVISIONING GUIDE

Follow these steps when spinning up a new staging or production environment:

### Step 1: Create Supabase Project
1. Log in to [Supabase Cloud Console](https://supabase.com/dashboard).
2. Click **New Project**, select your organization, name the project (e.g., `avencis-wfm-staging`), and set a strong database password.
3. Wait for the database provisioning to complete (green status).

### Step 2: Open SQL Editor
1. In the left navigation bar of your Supabase dashboard, click the **SQL Editor** icon (`>_`).
2. Click **+ New query**.
3. Name the query: `00_AVENCIS_FRESH_INSTALL`.

### Step 3: Paste and Execute Fresh Install Script
1. Open `supabase/migrations/AVENCIS_WFM_COMPLETE_FRESH_INSTALL.sql` in your IDE.
2. Copy the entire contents.
3. Paste into the Supabase SQL Editor.
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
5. Confirm output message: `Success. No rows returned` (or transaction completed successfully).

### Step 4: Validate Using Master Database Audit
1. In the SQL Editor, open a new tab (`+ New query`).
2. Name the query: `01_AVENCIS_MASTER_AUDIT`.
3. Copy the entire contents of `supabase/verification/AVENCIS_WFM_MASTER_DATABASE_AUDIT.sql`.
4. Paste and click **Run**.
5. Inspect the diagnostics table:
   - All critical checks should return `PASS`.
   - `active_version` of `review_leave_request_atomic` should report: `MIGRATION 15 (Cross-Year Balance Accounting)`.
   - Attendance statuses constraint check should report: `PASS (9 statuses present)`.
   - Duplicate indexes check should report: `PASS (No duplicate indexes detected)`.

### Step 5: Configure Environment Variables in Web App
1. In Supabase Dashboard, navigate to **Project Settings** -> **API**.
2. Copy:
   - **Project URL** (`VITE_SUPABASE_URL`)
   - **anon / public key** (`VITE_SUPABASE_ANON_KEY`)
3. Update your `.env` or CI/CD secret manager with these values.

---

## 5. SEED DATA PROVISIONING (OPTIONAL)

If initializing a staging or demo environment requiring seed records:
1. Ensure the fresh install has executed and validated with 0 errors.
2. Execute your approved seed data script (refer to `docs/SEED_DATA_EXECUTION_GUIDE.md`).
3. Verify that demo users have corresponding authentication accounts in `auth.users`.

---

## 6. MAINTENANCE & FUTURE MIGRATIONS

When Milestone 2.4E (Payroll Engine) commences:
- Authored migrations will begin at **Migration 18** (`20261115000018_payroll_engine_baseline.sql`).
- Incremental migrations will continue sequentially from 18 onwards.
- Never modify existing migrations 01–17 or the fresh install script retrospectively without explicit architectural change review.
