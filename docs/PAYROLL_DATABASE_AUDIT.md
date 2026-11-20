# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E: PAYROLL MANAGEMENT
## PAYROLL DATABASE AUDIT & SCHEMA INSPECTION REPORT

> **Document:** `docs/PAYROLL_DATABASE_AUDIT.md`  
> **Status:** AUTHORITATIVE DATABASE AUDIT  
> **Target Environment:** Supabase Cloud (`https://mlopgvkvzhwhkbewhefb.supabase.co`)  
> **Applicable Migrations:** Migrations 01–17 + Consolidated Master Baseline  

---

## 1. INVENTORY OF PAYROLL-RELATED TABLES [VERIFIED FACT]

The database catalog contains 14 tables directly involved in the payroll processing lifecycle:

| # | Table Name | Migration Source | Primary Key | Total Columns | RLS Status | Data API Grants |
|---|:---|:---|:---|:---:|:---:|:---|
| 1 | `employees` | 04 | `id` (UUID) | 21 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 2 | `employee_salary_structures` | 04 | `id` (UUID) | 12 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 3 | `employee_bank_details` | 04 | `id` (UUID) | 9 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 4 | `attendance_events` | 05 | `id` (UUID) | 13 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 5 | `daily_attendance_records` | 05, 14, 17 | `id` (UUID) | 13 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 6 | `attendance_corrections` | 05 | `id` (UUID) | 14 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 7 | `leave_balances` | 06, 11, 16 | `id` (UUID) | 10 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 8 | `leave_requests` | 06, 11, 15, 16, 17 | `id` (UUID) | 13 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 9 | `payroll_runs` | 07 | `id` (VARCHAR) | 16 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 10 | `payroll_items` | 07 | `id` (VARCHAR) | 18 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 11 | `payslips` | 07 | `id` (UUID) | 10 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 12 | `statutory_pt_slabs` | 08 | `id` (UUID) | 9 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 13 | `statutory_holidays` | 08 | `id` (UUID) | 8 | ENABLED | SELECT (anon), ALL (auth, service_role) |
| 14 | `audit_logs` | 08, 10 | `id` (VARCHAR) | 12 | ENABLED | SELECT (anon), ALL (auth, service_role) |

---

## 2. DETAILED SCHEMA ANALYSIS OF CORE PAYROLL ENTITIES

### 2.1 `payroll_runs` [VERIFIED FACT]
- **Primary Key:** `id VARCHAR(100)` (Format: `payrun-{clientId}-{periodMonth}-{periodYear}`).
- **Foreign Keys:**
  - `client_id UUID REFERENCES clients(id) ON DELETE CASCADE`
  - `legal_entity_id UUID REFERENCES client_legal_entities(id)`
- **Columns:**
  - `period_month INT CHECK (period_month BETWEEN 1 AND 12)`
  - `period_year INT CHECK (period_year BETWEEN 2020 AND 2100)`
  - `total_employees INT CHECK (total_employees >= 0)`
  - `total_gross NUMERIC(14,2) DEFAULT 0 CHECK (total_gross >= 0)`
  - `total_deductions NUMERIC(14,2) DEFAULT 0 CHECK (total_deductions >= 0)`
  - `total_net NUMERIC(14,2) DEFAULT 0 CHECK (total_net >= 0)`
  - `status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'locked'))`
  - `processed_at TIMESTAMPTZ DEFAULT NOW()`
  - `approved_at TIMESTAMPTZ`
  - `approved_by VARCHAR(150)`
  - `locked_at TIMESTAMPTZ`
  - `locked_by VARCHAR(150)`
  - `policy_snapshot JSONB`
- **Unique Constraint:** `unq_client_period UNIQUE (client_id, period_month, period_year)` (Prevents duplicate runs per client per month).
- **Index:** `idx_payroll_runs_client ON payroll_runs(client_id, period_year, period_month)`

### 2.2 `payroll_items` [VERIFIED FACT]
- **Primary Key:** `id VARCHAR(120)` (Format: `pitem-{employeeId}-{periodMonth}-{periodYear}`).
- **Foreign Keys:**
  - `run_id VARCHAR(100) REFERENCES payroll_runs(id) ON DELETE CASCADE`
  - `client_id UUID REFERENCES clients(id) ON DELETE CASCADE`
  - `employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT`
- **Columns:**
  - `fixed_salary NUMERIC(12,2) CHECK (fixed_salary >= 0)`
  - `incentives NUMERIC(12,2) DEFAULT 0 CHECK (incentives >= 0)`
  - `other_allowances NUMERIC(12,2) DEFAULT 0 CHECK (other_allowances >= 0)`
  - `calendar_days INT CHECK (calendar_days BETWEEN 28 AND 31)`
  - `paid_days NUMERIC(4,1) CHECK (paid_days >= 0)`
  - `unpaid_days NUMERIC(4,1) DEFAULT 0 CHECK (unpaid_days >= 0)`
  - `gross_earned NUMERIC(12,2) CHECK (gross_earned >= 0)`
  - `unpaid_deduction NUMERIC(12,2) DEFAULT 0 CHECK (unpaid_deduction >= 0)`
  - `pf_deduction NUMERIC(12,2) DEFAULT 0 CHECK (pf_deduction >= 0)`
  - `esic_deduction NUMERIC(12,2) DEFAULT 0 CHECK (esic_deduction >= 0)`
  - `pt_deduction NUMERIC(12,2) DEFAULT 0 CHECK (pt_deduction >= 0)`
  - `tds_deduction NUMERIC(12,2) DEFAULT 0 CHECK (tds_deduction >= 0)`
  - `total_deductions NUMERIC(12,2) CHECK (total_deductions >= 0)`
  - `net_salary NUMERIC(12,2) CHECK (net_salary >= 0)`
- **Unique Constraint:** `unq_run_employee UNIQUE (run_id, employee_id)` (Guarantees at most 1 line item per employee per run).
- **Indexes:**
  - `idx_payroll_items_emp ON payroll_items(employee_id)`
  - `idx_payroll_items_run ON payroll_items(run_id)`

### 2.3 `payslips` [VERIFIED FACT]
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Foreign Keys:**
  - `client_id UUID REFERENCES clients(id) ON DELETE CASCADE`
  - `payroll_item_id VARCHAR(120) REFERENCES payroll_items(id) ON DELETE CASCADE`
  - `employee_id UUID REFERENCES employees(id) ON DELETE CASCADE`
- **Columns:**
  - `period_month INT CHECK (period_month BETWEEN 1 AND 12)`
  - `period_year INT CHECK (period_year BETWEEN 2020 AND 2100)`
  - `revision_number INT DEFAULT 1 CHECK (revision_number >= 1)`
  - `storage_pdf_url TEXT`
  - `generated_at TIMESTAMPTZ DEFAULT NOW()`
  - `is_published BOOLEAN DEFAULT FALSE`
- **Unique Constraint:** `unq_emp_payslip_period UNIQUE (employee_id, period_month, period_year, revision_number)`
- **Index:** `idx_payslips_emp_period ON payslips(employee_id, period_year, period_month)`

---

## 3. ROW LEVEL SECURITY (RLS) POLICIES AUDIT

### 3.1 Existing Policies on `payroll_runs` [VERIFIED FACT]
- Policy: `"payroll_runs_admin_all"`
  - `FOR ALL TO authenticated`
  - `USING (get_user_role() = 'super_admin' OR (client_id = get_user_client_id() AND get_user_role() IN ('client_admin', 'payroll_admin')))`
  - `WITH CHECK (...)`
  - **Assessment:** Properly restricts write and read access to Super Admin, Client Admin, and Payroll Admin. Employees, Location Managers, and HR Admins cannot access `payroll_runs`.

### 3.2 Existing Policies on `payroll_items` [VERIFIED FACT]
- Policy 1: `"payroll_items_admin_all"`
  - `FOR ALL TO authenticated`
  - `USING (get_user_role() = 'super_admin' OR (client_id = get_user_client_id() AND get_user_role() IN ('client_admin', 'payroll_admin')))`
- Policy 2: `"payroll_items_employee_self_select"`
  - `FOR SELECT TO authenticated`
  - `USING (employee_id = get_user_employee_id() AND EXISTS (SELECT 1 FROM payroll_runs r WHERE r.id = run_id AND r.status IN ('approved', 'locked')))`
  - **Assessment:** Protects unapproved runs from employee inspection. An employee can only read their own line item once the batch status reaches `approved` or `locked`.

### 3.3 Existing Policies on `payslips` [VERIFIED FACT]
- Policy 1: `"payslips_admin_all"`
  - `FOR ALL TO authenticated`
  - `USING (get_user_role() = 'super_admin' OR (client_id = get_user_client_id() AND get_user_role() IN ('client_admin', 'payroll_admin', 'hr_admin')))`
- Policy 2: `"payslips_employee_self_select"`
  - `FOR SELECT TO authenticated`
  - `USING (employee_id = get_user_employee_id() AND is_published = TRUE)`
  - **Assessment:** Strict gate: employees cannot see draft or unpublished payslips. HR Admin has access to published and unpublished payslips for distribution.

---

## 4. DATABASE TRIGGERS & TAMPER GUARDS AUDIT

### 4.1 Trigger `trg_guard_payroll_run_lock` [VERIFIED FACT]
- **Target:** `BEFORE UPDATE OR DELETE ON public.payroll_runs`
- **Function:** `public.guard_locked_payroll_modification()`
- **Logic:**
  ```sql
  IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Payroll run % is locked and immutable. Modifications are prohibited.', OLD.id;
  END IF;
  ```
- **Security Assessment:** **EFFECTIVE.** Once a batch transitions to `locked`, no UPDATE or DELETE statement can succeed against the `payroll_runs` table, even if executed by a Super Admin through PostgREST.

### 4.2 Trigger `trg_guard_payroll_items_lock` [VERIFIED FACT]
- **Target:** `BEFORE UPDATE OR DELETE ON public.payroll_items`
- **Function:** `public.guard_locked_payroll_items()`
- **Logic:**
  ```sql
  SELECT status INTO v_status FROM payroll_runs WHERE id = OLD.run_id;
  IF v_status = 'locked' THEN
      RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Payroll items for locked run % cannot be modified or deleted.', OLD.run_id;
  END IF;
  ```
- **Security Assessment:** **EFFECTIVE.** Cascading updates to line items belonging to a locked run are strictly blocked.

---

## 5. DATABASE ARCHITECTURAL GAPS & PROPOSED ENHANCEMENTS

While foundational DDL exists, Milestone 2.4E requires several database additions:

| # | Gap / Defect Identified | Current State | Required Architecture [PROPOSED] | Migration Needed? |
|---|:---|:---|:---|:---:|
| 1 | **No Transactional Payroll Generation RPC** | Frontend currently computes payroll in browser | Dedicated PostgreSQL SECURITY DEFINER RPC `generate_payroll_run(p_client_id, p_month, p_year)` | YES |
| 2 | **No Transactional Approval & Lock RPC** | Frontend calls `store.saveAndLockPayrollRun` | Stored procedure `lock_payroll_run(p_run_id)` asserting review state and generating payslips | YES |
| 3 | **Detailed Earnings Breakdown Missing** | `payroll_items` only has `fixed_salary`, `incentives`, `other_allowances` | Need granular component storage: `basic_pay`, `hra`, `special_allowance`, `overtime_pay` | YES (Additive) |
| 4 | **Employer Statutory Contributions Missing** | `payroll_items` only records employee deductions | Need employer contribution tracking (`pf_employer`, `esic_employer`) for Form XIX / CTC | YES (Additive) |
| 5 | **Missing Unique Constraint on Active Salary** | Multiple active salary rows could exist per employee | Unique index `WHERE is_active = TRUE` on `(employee_id)` | YES (Defensive) |

> [!NOTE]
> All proposed database changes will be compiled into a proposed migration script and presented for explicit approval before any execution.
