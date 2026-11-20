# AVENCIS WORKFORCE MANAGEMENT (WFM)
## SEED DATA MANUAL EXECUTION & VERIFICATION RUNBOOK

**Project:** Avencis Workforce Management (WFM)  
**Database:** PostgreSQL 15+ / Supabase Cloud  
**Target Environment:** Project `mlopgvkvzhwhkbewhefb`  
**Files:**  
- Seed Script: [`supabase/seed.sql`](file:///c:/Avencis%20Management/supabase/seed.sql)  
- Verification Script: [`supabase/verification/SEED_DATA_VERIFICATION.sql`](file:///c:/Avencis%20Management/supabase/verification/SEED_DATA_VERIFICATION.sql)  
**Prerequisites:** All 10 SQL migrations already executed and verified (197/197 checks passed).  
**Status:** **AWAITING USER EXECUTION APPROVAL**

---

## 1. Safety & Idempotency Rules

Before executing, review these core safety guarantees:

> [!IMPORTANT]
> - **DO NOT EXECUTE UNTIL EXPLICITLY APPROVED.**
> - The seed script is **non-destructive**. It does not drop, truncate, or alter any database table or schema.
> - The seed script is **100% idempotent**. Every `INSERT` statement is paired with an `ON CONFLICT (...) DO UPDATE` clause. If executed multiple times, it updates records in place without duplicating data or creating orphan foreign keys.
> - The seed script operates inside a single atomic transaction block (`BEGIN; ... COMMIT;`). If any single constraint fails, the entire transaction rolls back cleanly with zero partial changes.

---

## 2. Step-by-Step Execution Instructions

### Step 1: Open Supabase SQL Editor
1. Log in to the [Supabase Cloud Dashboard](https://supabase.com/dashboard).
2. Select your project (`mlopgvkvzhwhkbewhefb`).
3. Click the **SQL Editor** tab in the left-hand navigation menu.
4. Click **+ New Query**.

### Step 2: Copy and Paste `supabase/seed.sql`
1. Open [`supabase/seed.sql`](file:///c:/Avencis%20Management/supabase/seed.sql) in your editor.
2. Copy the entire contents of the file.
3. Paste the SQL script into the Supabase SQL Editor.
4. Click the green **Run** button (or press `Ctrl + Enter`).
5. Confirm the query executes successfully:
   ```text
   Success. No rows returned.
   ```

---

## 3. Post-Execution Verification Instructions

Immediately after running `seed.sql`, verify that all demonstration entities were correctly created and linked:

### Step 1: Copy and Run the Verification Script
1. In the Supabase SQL Editor, open a new query tab.
2. Open [`supabase/verification/SEED_DATA_VERIFICATION.sql`](file:///c:/Avencis%20Management/supabase/verification/SEED_DATA_VERIFICATION.sql).
3. Copy its entire contents and paste into the SQL Editor.
4. Click **Run**.

### Step 2: Expected Output (10 / 10 Checks Passed)

The verification script executes 10 comprehensive catalog and relational integrity checks, returning a summary table:

| Category | Item Name | Expected Value | Status | Details |
|---|---|---|:---:|---|
| **00. SEED DATA SUMMARY** | **TOTAL SEED DATA SCORE** | **100% PASS on all seed verification checks** | **PASS** | **PASSED: 10 \| FAILED: 0. Clean demonstration data state confirmed.** |
| 01. CLIENT ORGANISATIONS | Demonstration Clients Count | 3 demonstration clients (Suman, Maha, Apex) | **PASS** | Codes found: DEMO-APEX, DEMO-MAHA, DEMO-SUMAN |
| 02. LEGAL ENTITIES | Demonstration Legal Entities Count | 3 legal entities linked to Suman, Maha, and Apex | **PASS** | Suman Technologies Pvt Ltd, Maha India Logistics, Apex Precision |
| 03. WORK LOCATIONS | Demonstration Work Locations Count | 4 work locations (Pune, Mumbai, Chakan, Nagpur) | **PASS** | 4 geofenced locations verified |
| 04. DEPARTMENTS | Demonstration Departments Count | 7 departments (3 Suman, 3 Maha, 1 Apex) | **PASS** | 7 departments across 3 clients verified |
| 05. CLIENT POLICIES | Client Operational Policies Count | 3 client policies (2 configured, 1 unconfigured) | **PASS** | Suman (Divisor 30), Maha (Divisor 26), Apex (unconfigured) |
| 06. EMPLOYEES DIRECTORY | Demonstration Employees Count | 8 demonstration employees (5 Suman, 3 Maha) | **PASS** | All 8 staff records created |
| 07. EMPLOYMENT ARRANGEMENTS | Employment Arrangement Diversity | At least 3 arrangements | **PASS** | DIRECT_PERMANENT, DIRECT_CONTRACT, DEPUTED_STAFFING |
| 08. INTEGRITY & RELATIONSHIPS | Employee Foreign Key Linkages | 0 orphaned employee foreign keys | **PASS** | All 8 employees strictly linked |
| 09. INTEGRITY & RELATIONSHIPS | Department Head Assignments | At least 2 departments have designated heads | **PASS** | Operations and Fleet heads assigned |
| 10. SAFETY & IDENTIFIERS | Demonstration Marker Compliance | 100% of seeded employees have DEMO-* codes | **PASS** | Synthetic PANs and identifiers confirmed |

---

## 4. Troubleshooting & Known Resolution

### Error 22003: `numeric field overflow`
- **Symptom:** `A field with precision 4, scale 2 must round to an absolute value less than 10^2.`
- **Root Cause:** In `client_policies`, `overtime_rate` is defined as `NUMERIC(4,2)` (maximum allowable value `99.99`). The original mock data specified a flat hourly rate of `₹120.00/hr` for Maha India Logistics, which exceeds 2 integer digits ($10^2$).
- **Resolution Applied:** Maha's demonstration overtime rate in `supabase/seed.sql` has been adjusted to `75.00` (₹75.00/hr), strictly conforming to `NUMERIC(4,2)`.

---

## 5. Rollback & Cleanup Runbook (Optional)

If you ever wish to remove all demonstration seed data without touching real database tables, schema objects, or migrations, execute this safe cleanup script in the Supabase SQL Editor:

```sql
BEGIN;

-- Remove department head foreign keys first to allow employee deletion
UPDATE public.departments
SET head_employee_id = NULL
WHERE code LIKE 'DEMO_%';

-- Delete demonstration employees
DELETE FROM public.employees
WHERE employee_code LIKE 'DEMO-%';

-- Delete demonstration policies
DELETE FROM public.client_policies
WHERE client_id IN (SELECT id FROM public.clients WHERE code LIKE 'DEMO-%');

-- Delete demonstration departments
DELETE FROM public.departments
WHERE client_id IN (SELECT id FROM public.clients WHERE code LIKE 'DEMO-%');

-- Delete demonstration work locations
DELETE FROM public.work_locations
WHERE client_id IN (SELECT id FROM public.clients WHERE code LIKE 'DEMO-%');

-- Delete demonstration legal entities
DELETE FROM public.client_legal_entities
WHERE client_id IN (SELECT id FROM public.clients WHERE code LIKE 'DEMO-%');

-- Delete demonstration clients
DELETE FROM public.clients
WHERE code LIKE 'DEMO-%';

COMMIT;
```

> [!NOTE]
> Because every demonstration record is identified by `DEMO-%`, this cleanup script selectively purges only test records and will never touch genuine production records.

---

*Runbook authored and saved in `docs/SEED_DATA_EXECUTION_GUIDE.md`.*
