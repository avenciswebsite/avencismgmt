# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E: PAYROLL MANAGEMENT
## PAYROLL TESTING & VERIFICATION STRATEGY

> **Document:** `docs/PAYROLL_TEST_STRATEGY.md`  
> **Status:** AUTHORITATIVE TEST PLAN  
> **Milestone:** 2.4E (Payroll Management)  
> **Testing Principle:** Strict Distinction Between Simulated vs. Authenticated Real Database Tests  

---

## 1. TEST TIERING & INTEGRITY PRINCIPLES

In adherence to the strict engineering guidelines, every test case executed during Milestone 2.4E is strictly classified into one of ten architectural test tiers. **No mock test will ever be labelled as a live database test.**

```
+----------------------------------------------------------------------------------------------------+
| TIER 01: Pure Unit Tests (Proration math, divisor ratios, rounding, formula algorithms)           |
| TIER 02: Mock Store / Service Tests (Local lifecycle simulation, localStorage integration)         |
| TIER 03: Static SQL & Catalog Diagnostics (Constraint definition, search path, trigger analysis)   |
| TIER 04: Real Supabase Anonymous-Key Tests (Network connectivity, anon boundary verification)      |
| TIER 05: Real Authenticated JWT Tests (Live Supabase session auth) [STATUS: CONDITIONALLY BLOCKED] |
| TIER 06: Multi-Role RLS Boundary Tests (Super Admin, Client Admin, Payroll Admin, Employee)        |
| TIER 07: Cross-Tenant Isolation Tests (Tenant client_id boundary enforcement)                     |
| TIER 08: End-to-End Calculation Integration (Attendance muster -> Leave LWP -> Payroll items)      |
| TIER 09: Concurrency & Tamper Guard Verification (Duplicate runs, modifying locked batches)        |
| TIER 10: Browser E2E UI Tests (Guided wizard step progression, Form XIX print verification)        |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. DETAILED TEST SPECIFICATIONS BY TIER

### Tier 01: Pure Mathematical Unit Tests
- **Location:** `scripts/testPayrollMath.ts`
- **Execution:** Fast, in-memory, deterministic.
- **Coverage:**
  - 30-day divisor base proration ($P_i / 30$).
  - 26-day divisor base proration ($P_i / 26$).
  - Exact calendar days proration ($P_i / D_{\text{cal}}$).
  - Half-day leave deduction math ($0.5$ unpaid day).
  - Overtime formula calculations (`multiplier` and `flat_rate`).
  - EPF statutory ceiling cap (12% of $\min(\text{Basic}, 15000)$).
  - ESIC wage threshold gate (0.75% applied only if Gross $\le 21000$).
  - Maharashtra PT slab calculations (including February ₹300 spike).
  - Negative net pay zero-floor guard.

### Tier 02: Service Layer Mock Tests
- **Location:** `scripts/testPayrollService.ts`
- **Coverage:**
  - `getPayrollRuns(clientId)` retrieval and year filtering.
  - `getPayrollRunById(runId)` error handling on nonexistent ID.
  - `getPayrollItems(runId)` line item mapping.
  - `calculateProrationDays` boundary validation.
  - `assertPayrollNotLocked` error generation when modifying locked runs.

### Tier 03: Static SQL & Database Catalog Diagnostics
- **Location:** `supabase/verification/AVENCIS_WFM_MASTER_DATABASE_AUDIT.sql`
- **Execution:** Supabase SQL Editor read-only query.
- **Coverage:**
  - Existence of tables `payroll_runs`, `payroll_items`, `payslips`.
  - Check constraints: `status IN ('draft', 'under_review', 'approved', 'locked')`.
  - Check constraints: `unq_client_period UNIQUE (client_id, period_month, period_year)`.
  - Check constraints: `unq_run_employee UNIQUE (run_id, employee_id)`.
  - Check constraints: `unq_emp_payslip_period UNIQUE (employee_id, period_month, period_year, revision_number)`.
  - Trigger existence: `trg_guard_payroll_run_lock`, `trg_guard_payroll_items_lock`.
  - Verification of RLS enabled on all payroll tables.

### Tier 04: Real Supabase Anonymous-Key Tests
- **Location:** `scripts/testPayrollDatabaseLive.ts`
- **Coverage:**
  - Verifies PostgREST HTTP 200 response to `clients`, `payroll_runs`, `payslips`.
  - Verifies that unauthenticated anon caller receives 0 records on `payroll_runs` and `payroll_items`.
  - Verifies that unauthenticated anon caller cannot insert, update, or delete payroll runs.

### Tier 05: Real Authenticated JWT Tests [STATUS: BLOCKED]
- **Current State:**
  - Live Supabase instance contains production-like authentication policies requiring valid `auth.users` accounts with configured JWT claims.
  - **Status:** **BLOCKED.** In accordance with strict guidelines, no mock users will be provisioned in the live production database simply to pass a test.
  - **Fallback:** Tested via in-memory session context and PostgREST schema assertion.

### Tier 06: Multi-Role RLS Boundary Tests
- **Coverage:**
  - Verify `payroll_admin` can read/insert `payroll_runs` for their tenant.
  - Verify `hr_admin` receives 403 / zero rows when querying `payroll_items` or `employee_salary_structures`.
  - Verify `employee` receives only their own row in `payroll_items`, and only after the batch is `approved` or `locked`.
  - Verify `employee` cannot view unpublished payslips (`is_published = FALSE`).

### Tier 07: Cross-Tenant Isolation Tests
- **Coverage:**
  - Client Admin of Client A cannot access `payroll_runs` of Client B.
  - Attempting to pass `client_id = Client B` while authenticated as Client A returns 0 records or error.

### Tier 08: Upstream Integration Tests (Muster -> Leave -> Payroll)
- **Coverage:**
  - Create muster with 20 PRESENT, 2 PAID_LEAVE, 2 UNPAID_LEAVE, 4 WEEKLY_OFF, 2 HOLIDAY (Total 30 days).
  - Verify payroll engine derives: `calendarDays = 30`, `unpaidDays = 2`, `paidDays = 28`.
  - Verify proration ratio = $28 / 30 = 0.9333$.

### Tier 09: Concurrency & Tamper Guard Verification
- **Coverage:**
  - Attempt duplicate payroll generation for same client and period (must be blocked by `unq_client_period`).
  - Attempt to update a payroll run with `status = 'locked'` (must throw `guard_locked_payroll_modification` trigger exception).
  - Attempt to update a payroll item belonging to a locked run (must throw `guard_locked_payroll_items` trigger exception).

### Tier 10: User Interface & Form XIX Print E2E
- **Coverage:**
  - Wizard step progression: Step 1 -> Step 2 -> Step 3 -> Step 4 -> Step 5.
  - Form XIX printable payslip renders all statutory fields without undefined values or NaN artifacts.
  - Action bar is hidden in print media (`@media print`).
