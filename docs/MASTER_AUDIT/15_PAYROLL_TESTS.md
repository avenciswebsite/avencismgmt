# AVENCIS WORKFORCE MANAGEMENT
## Document 15 — Suite G: Payroll Engine, Statutory Deductions & Form XIX Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 30  
**Priority Breakdown:** P0: 12 | P1: 12 | P2: 5 | P3: 1  
**Target Module:** Attendance Gate, Proration Math, EPF, ESIC, PT, TDS, Overtime, Segregation of Duties, Form XIX  

---

### TC-PAY-001: Attendance Finalization Prerequisite Gate (Pending Regularisations Block)
- **Scenario:** System blocks payroll initialization if unapproved attendance regularisations exist for the pay period.
- **Priority:** P0
- **User Role:** `payroll_admin` (`payroll.acme@avencis.test`)
- **Target URL / View:** `/payroll/runs/new`
- **Preconditions:** 2 attendance regularisations in status `PENDING` for November 2026.
- **Test Data:** Period: November 2026
- **Execution Steps:**
  1. Navigate to `/payroll` and click "Run Payroll".
  2. Select Legal Entity "Acme Manufacturing Pvt Ltd", Month "November", Year "2026".
  3. Click "Initialize Payroll Run".
- **Expected Result (UI):** Modal error banner: "Pre-condition Failed: 2 pending attendance regularisations must be approved or rejected before finalizing attendance muster." Run creation blocked.
- **Database Verification:** Zero rows inserted into `payroll_runs`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-002: Attendance Finalization Gate (Pending Leave Requests Block)
- **Scenario:** System blocks payroll initialization if unapproved leave requests exist for the pay period.
- **Priority:** P0
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/new`
- **Preconditions:** 1 leave request in status `PENDING` for November 2026.
- **Test Data:** Period: November 2026
- **Execution Steps:**
  1. Attempt to initialize payroll run.
- **Expected Result (UI):** Error banner: "Pre-condition Failed: 1 pending leave request must be resolved before payroll calculation."
- **Database Verification:** Zero rows inserted.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-003: Finalize Attendance Muster & Initialize Draft Payroll Run
- **Scenario:** With all attendance and leave items resolved, attendance is finalized and draft payroll created.
- **Priority:** P0
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/new`
- **Preconditions:** All regularisations and leaves for November 2026 resolved.
- **Test Data:** Client: Acme Corp, Entity: Acme Manufacturing, Month: 11, Year: 2026
- **Execution Steps:**
  1. Click "Finalize Attendance".
  2. Confirm muster lock dialog.
  3. Click "Initialize Payroll Run".
- **Expected Result (UI):** Toast "Attendance muster finalized. Draft payroll initialized." Redirects to `/payroll/runs/[id]` displaying employee items. Status: "DRAFT".
- **Database Verification:**
  - `SELECT status, period_month, period_year FROM public.payroll_runs WHERE client_id = [acme_id] AND period_month = 11 AND period_year = 2026;` (Returns status = 'DRAFT').
  - `SELECT COUNT(*) FROM public.payroll_items WHERE payroll_run_id = [run_id];` (Matches active employee count).
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'PAYROLL_RUN_INITIALIZED';`
- **Cleanup / Teardown:** Handled in suite teardown.
- **Status:** NOT RUN

---

### TC-PAY-004: Standard Full-Month Salary Calculation (100% Attendance)
- **Scenario:** Employee with 30/30 payable days receives 100% of master monthly CTC components.
- **Priority:** P0
- **User Role:** Automated Payroll Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Rahul Sharma (`EMP-ACM-001`): Basic ₹17,500, HRA ₹7,000, Special ₹10,500 (Gross ₹35,000). Full attendance.
- **Test Data:** Payable Days: 30.0 / 30
- **Execution Steps:**
  1. Inspect Rahul Sharma's item in the draft payroll run.
- **Expected Result (UI):** Earned Basic: ₹17,500.00, Earned HRA: ₹7,000.00, Gross Earnings: ₹35,000.00.
- **Database Verification:** `SELECT earned_basic, earned_gross, payable_days FROM public.payroll_items WHERE employee_id = [rahul_id] AND payroll_run_id = [run_id];` (earned_basic = 17500.00, earned_gross = 35000.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-005: Salary Proration Math — Unpaid LWP Days (25/30 Days)
- **Scenario:** Employee with 5 LWP days receives prorated salary based on 25 payable days (30-day divisor).
- **Priority:** P0
- **User Role:** Automated Payroll Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Vikram Rao: Gross ₹45,000 (Basic ₹22,500). 5 LWP days in 30-day month.
- **Test Data:** Formula: `Earned = Component * (25 / 30)`
- **Execution Steps:**
  1. Calculate Vikram's payroll item.
- **Expected Result (UI):**
  - Earned Basic: ₹18,750.00 (`22,500 * 25 / 30`)
  - Earned Gross: ₹37,500.00 (`45,000 * 25 / 30`)
  - LWP Deduction: ₹7,500.00
- **Database Verification:** `SELECT earned_gross, lwp_deduction FROM public.payroll_items WHERE employee_id = [vikram_id];` (earned_gross = 37500.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-006: Mid-Month Joiner Salary Proration (Joined Nov 16)
- **Scenario:** Employee joining on Nov 16 has 15 payable days in 30-day month (50% proration).
- **Priority:** P0
- **User Role:** Automated Payroll Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Sneha Patil: Gross ₹65,000 (Basic ₹32,500). Joining date: 2026-11-16.
- **Test Data:** Payable Days: 15.0 / 30
- **Execution Steps:**
  1. Inspect Sneha's payroll item.
- **Expected Result (UI):**
  - Payable Days: 15.0
  - Earned Basic: ₹16,250.00 (`32,500 * 15 / 30`)
  - Earned Gross: ₹32,500.00 (`65,000 * 15 / 30`)
- **Database Verification:** `SELECT payable_days, earned_gross FROM public.payroll_items WHERE employee_id = [sneha_id];` (payable_days = 15.00, earned_gross = 32500.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-007: Mid-Month Resignation Salary Proration (Exited Nov 20)
- **Scenario:** Employee exiting on Nov 20 has 20 payable days; subsequent days excluded.
- **Priority:** P1
- **User Role:** Automated Payroll Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Rajesh Deshmukh: Gross ₹50,000. Exit date: 2026-11-20.
- **Test Data:** Payable Days: 20.0 / 30
- **Execution Steps:**
  1. Inspect Rajesh's payroll item.
- **Expected Result (UI):** Payable Days: 20.0 | Earned Gross: ₹33,333.33 (`50,000 * 20 / 30`). Flagged as "Final Settlement Item".
- **Database Verification:** `SELECT payable_days, earned_gross FROM public.payroll_items WHERE employee_id = [rajesh_id];` (payable_days = 20.00, earned_gross = 33333.33).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-008: Statutory EPF Employee Deduction (Standard Ceiling ₹15,000 Cap)
- **Scenario:** Employee Basic exceeds ₹15,000; EPF deduction capped at 12% of ₹15,000 = ₹1,800.
- **Priority:** P0
- **User Role:** Statutory Tax Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Rahul Sharma: Earned Basic ₹17,500 (Policy: Standard Capped EPF).
- **Test Data:** Capped Wage: ₹15,000, Rate: 12%
- **Execution Steps:**
  1. Verify EPF Employee deduction line item.
- **Expected Result (UI):** EPF (Employee): ₹1,800.00.
- **Database Verification:** `SELECT epf_employee FROM public.payroll_items WHERE employee_id = [rahul_id];` (Returns 1800.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-009: Statutory EPF Employee Deduction (Uncapped Option on Actual Basic)
- **Scenario:** Client configured for uncapped EPF; deduction is 12% of actual Earned Basic.
- **Priority:** P1
- **User Role:** Statutory Tax Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Client EPF rule: `cap_epf = false`. Earned Basic ₹25,000.
- **Test Data:** Wage: ₹25,000, Rate: 12%
- **Execution Steps:**
  1. Calculate EPF deduction.
- **Expected Result (UI):** EPF (Employee): ₹3,000.00 (`25,000 * 12%`).
- **Database Verification:** `SELECT epf_employee FROM public.payroll_items WHERE employee_id = [id];` (Returns 3000.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-010: Statutory EPF Employer Contribution Split (EPS 8.33% + EPF 3.67%)
- **Scenario:** Verifying employer contribution split between Pension Scheme (EPS) and Provident Fund.
- **Priority:** P0
- **User Role:** Statutory Tax Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Wage base: ₹15,000 (capped).
- **Test Data:** EPS cap: ₹1,250 (`15,000 * 8.33% = 1249.50 -> ₹1,250`), EPF balance: ₹550 (`1,800 - 1,250`).
- **Execution Steps:**
  1. Inspect Employer Contribution breakdown.
- **Expected Result (UI):** Employer EPS: ₹1,250.00, Employer EPF: ₹550.00 (Total Employer PF: ₹1,800.00).
- **Database Verification:** `SELECT epf_employer_eps, epf_employer_pf FROM public.payroll_items WHERE employee_id = [rahul_id];` (eps = 1250.00, pf = 550.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-011: Statutory ESIC Deduction (Applicable: Gross <= ₹21,000)
- **Scenario:** Employee with Gross ₹18,500 is eligible for ESIC; employee pays 0.75%, employer pays 3.25%.
- **Priority:** P0
- **User Role:** Statutory Tax Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Amit Kumar: Gross ₹18,500 (below ₹21,000 threshold).
- **Test Data:** Gross: ₹18,500. Employee Rate: 0.75%, Employer Rate: 3.25%
- **Execution Steps:**
  1. Inspect Amit Kumar's statutory deductions.
- **Expected Result (UI):**
  - ESIC (Employee): ₹138.75 (or rounded to ₹139.00)
  - ESIC (Employer): ₹601.25 (or rounded to ₹602.00)
- **Database Verification:** `SELECT esic_employee, esic_employer FROM public.payroll_items WHERE employee_id = [amit_id];` (esic_employee = 138.75).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-012: Statutory ESIC Exemption (Gross > ₹21,000)
- **Scenario:** Employee with Gross ₹35,000 is legally exempt from ESIC; deduction is ₹0.00.
- **Priority:** P0
- **User Role:** Statutory Tax Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Rahul Sharma: Gross ₹35,000.
- **Test Data:** Gross: ₹35,000 (> ₹21,000 threshold)
- **Execution Steps:**
  1. Inspect Rahul's ESIC line item.
- **Expected Result (UI):** ESIC: ₹0.00 (Exempt).
- **Database Verification:** `SELECT esic_employee, esic_employer FROM public.payroll_items WHERE employee_id = [rahul_id];` (Both 0.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-013: Professional Tax (PT) Slab Calculation (Maharashtra)
- **Scenario:** Gross > ₹10,000 in Maharashtra deducts ₹200/mo (₹300 in February).
- **Priority:** P1
- **User Role:** Statutory Tax Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Month: November (Non-February), Location: Maharashtra (Pune/Mumbai), Gross: ₹35,000.
- **Test Data:** State: Maharashtra, Gross > ₹10,000
- **Execution Steps:**
  1. Inspect Professional Tax line item.
- **Expected Result (UI):** Professional Tax (PT): ₹200.00.
- **Database Verification:** `SELECT professional_tax FROM public.payroll_items WHERE employee_id = [rahul_id];` (Returns 200.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-014: Professional Tax (PT) February Slab Rule (₹300)
- **Scenario:** In February, Maharashtra PT increases to ₹300 to balance annual ₹2,500 statutory cap.
- **Priority:** P2
- **User Role:** Statutory Tax Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Period Month: February (2).
- **Test Data:** Month: February, Gross: ₹35,000
- **Execution Steps:**
  1. Calculate PT for February pay period.
- **Expected Result (UI):** Professional Tax: ₹300.00.
- **Database Verification:** `SELECT professional_tax FROM public.payroll_items WHERE employee_id = [rahul_id];` (Returns 300.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-015: Configurable Tax Withholding (TDS) Calculation
- **Scenario:** TDS calculated via annual income tax regime slab pathway (replacing flat ₹1,200 placeholder).
- **Priority:** P0
- **User Role:** Statutory Tax Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Sneha Patil has declared regime and projected annual tax liability of ₹48,000 (Monthly TDS: ₹4,000).
- **Test Data:** Monthly TDS: ₹4,000.00
- **Execution Steps:**
  1. Verify TDS deduction on Sneha's payroll item.
- **Expected Result (UI):** Income Tax (TDS): ₹4,000.00 (NOT flat ₹1,200).
- **Database Verification:** `SELECT tds_deduction FROM public.payroll_items WHERE employee_id = [sneha_id];` (Returns 4000.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-016: Authorized Overtime Earnings Addition
- **Scenario:** Pooja Nair has 18 hours of authorized overtime; calculated at 1.5x hourly rate.
- **Priority:** P0
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Pooja's Gross: ₹28,000, Working Hours/Month: 200 hrs (Hourly: ₹140.00). OT Multiplier: 1.5x.
- **Test Data:** OT Hours: 18, Rate: `140 * 1.5 = ₹210.00/hr`, Total OT Pay: `18 * 210 = ₹3,780.00`.
- **Execution Steps:**
  1. Inspect Pooja's overtime line item in draft payroll.
- **Expected Result (UI):** Overtime Earnings: ₹3,780.00. Gross Earnings updated from ₹28,000 to ₹31,780.00.
- **Database Verification:** `SELECT overtime_hours, overtime_pay, earned_gross FROM public.payroll_items WHERE employee_id = [pooja_id];` (overtime_pay = 3780.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-017: Manual Incentive / Bonus Addition
- **Scenario:** Payroll Admin adds a performance incentive of ₹5,000 to an employee's draft pay item.
- **Priority:** P1
- **User Role:** `payroll_admin` (`payroll.acme@avencis.test`)
- **Target URL / View:** `/payroll/runs/[id]` -> Edit Item Modal
- **Preconditions:** Draft run open.
- **Test Data:** Employee: Rahul Sharma, Addition: "Performance Incentive", Amount: ₹5,000.00
- **Execution Steps:**
  1. Click "Edit Item" on Rahul's row.
  2. In Additions, enter "Performance Incentive": 5000.
  3. Click "Recalculate & Save".
- **Expected Result (UI):** Toast "Item recalculated". Gross increases to ₹40,000; Net increases accordingly.
- **Database Verification:** `SELECT additions_breakdown, earned_gross, net_salary FROM public.payroll_items WHERE employee_id = [rahul_id];`
- **Audit Verification:** Audit log records `PAYROLL_ITEM_MANUAL_ADJUSTMENT`.
- **Cleanup / Teardown:** Reset adjustment.
- **Status:** NOT RUN

---

### TC-PAY-018: Manual Deduction Addition (Canteen / Loan Recovery)
- **Scenario:** Payroll Admin adds a recurring company loan recovery deduction of ₹2,500.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/[id]` -> Edit Item Modal
- **Preconditions:** Draft run open.
- **Test Data:** Deduction Name: "Loan Recovery", Amount: ₹2,500.00
- **Execution Steps:**
  1. Add deduction ₹2,500 on Rahul's item.
  2. Save.
- **Expected Result (UI):** Total Deductions increases by ₹2,500; Net Salary decreases by ₹2,500.
- **Database Verification:** `SELECT deductions_breakdown, total_deductions, net_salary FROM public.payroll_items WHERE employee_id = [rahul_id];`
- **Audit Verification:** Audit log records `PAYROLL_ITEM_MANUAL_ADJUSTMENT`.
- **Cleanup / Teardown:** Reset.
- **Status:** NOT RUN

---

### TC-PAY-019: Net Salary Mathematical Invariance Test
- **Scenario:** Verifying `Net Salary == Earned Gross - Total Deductions` for all rows.
- **Priority:** P0
- **User Role:** Automated Regression Engine
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Draft run calculated with 8 employee rows.
- **Test Data:** All items in run
- **Execution Steps:**
  1. Run mathematical verification query across all items in batch.
- **Expected Result (UI):** Batch summary cards balance: `Sum(Gross) - Sum(Deductions) == Sum(Net)`.
- **Database Verification:** `SELECT COUNT(*) FROM public.payroll_items WHERE payroll_run_id = [run_id] AND net_salary != (earned_gross - total_deductions);` (Returns exactly 0).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-020: Submit Payroll Run for Approval (Status: SUBMITTED)
- **Scenario:** Payroll Admin submits draft payroll run to Client Admin for sign-off.
- **Priority:** P0
- **User Role:** `payroll_admin` (`payroll.acme@avencis.test`)
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Draft run verified.
- **Test Data:** Target Run ID
- **Execution Steps:**
  1. Click "Submit for Approval".
  2. Enter notes: "November 2026 payroll calculated. All 8 items verified."
  3. Confirm.
- **Expected Result (UI):** Status badge turns yellow "SUBMITTED". Payroll Admin editing controls disabled.
- **Database Verification:** `SELECT status FROM public.payroll_runs WHERE id = [run_id];` (Returns 'SUBMITTED').
- **Audit Verification:** Audit log records `PAYROLL_RUN_SUBMITTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-021: Segregation of Duties: Client Admin Payroll Approval
- **Scenario:** Client Admin reviews and approves submitted payroll run (Payroll Admin cannot self-approve).
- **Priority:** P0
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Run is in `SUBMITTED` status.
- **Test Data:** Target Run ID
- **Execution Steps:**
  1. Log in as Client Admin.
  2. Open submitted payroll run.
  3. Click "Approve Payroll".
- **Expected Result (UI):** Status badge turns blue "APPROVED". "Finalize & Lock" button becomes active.
- **Database Verification:** `SELECT status, approved_by FROM public.payroll_runs WHERE id = [run_id];` (status = 'APPROVED', approved_by = client admin UUID).
- **Audit Verification:** Audit log records `PAYROLL_RUN_APPROVED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-022: Client Admin Rejects Submitted Payroll Run
- **Scenario:** Client Admin rejects submitted run with comments; returns to DRAFT for corrections.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Run in `SUBMITTED` status.
- **Test Data:** Rejection Reason: "Overtime hours for Pooja Nair require revised supervisor timesheet"
- **Execution Steps:**
  1. Click "Reject Payroll", input remarks, confirm.
- **Expected Result (UI):** Status reverts to "REJECTED / DRAFT". Editing controls re-enabled for Payroll Admin.
- **Database Verification:** `status = 'DRAFT'`.
- **Audit Verification:** Audit log records `PAYROLL_RUN_REJECTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-023: Finalize & Lock Payroll Run (Status: LOCKED)
- **Scenario:** Client Admin executes final lock; triggers database immutability freeze.
- **Priority:** P0
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Run is in `APPROVED` status.
- **Test Data:** Target Run ID
- **Execution Steps:**
  1. Click "Finalize & Lock Payroll".
  2. Read high-severity warning: "This action is permanent and legally binding. Wage items cannot be altered once locked."
  3. Type "CONFIRM" and click Lock.
- **Expected Result (UI):** Status badge turns black/green "LOCKED". Lock icon appears next to batch.
- **Database Verification:** `SELECT status, locked_at, locked_by FROM public.payroll_runs WHERE id = [run_id];` (status = 'LOCKED', locked_at is not null).
- **Audit Verification:** Audit log records `PAYROLL_RUN_LOCKED`.
- **Cleanup / Teardown:** None (Locked runs remain locked).
- **Status:** NOT RUN

---

### TC-PAY-024: Database Immutability Trigger: Reject UPDATE on Locked Payroll Run
- **Scenario:** Trigger `guard_locked_payroll_modification()` blocks direct SQL update on locked run.
- **Priority:** P0
- **User Role:** Direct SQL / API
- **Target URL / View:** PostgreSQL Schema
- **Preconditions:** Run status is `LOCKED`.
- **Test Data:** `UPDATE public.payroll_runs SET total_net_salary = 999999 WHERE id = '[locked_run_id]';`
- **Execution Steps:**
  1. Attempt to execute UPDATE query on locked payroll run.
- **Expected Result (UI / API):** PostgreSQL raises exception: `Payroll run [id] is locked and cannot be modified or deleted.` Transaction rolled back.
- **Database Verification:** `total_net_salary` remains unchanged.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-025: Database Immutability Trigger: Reject UPDATE on Locked Payroll Items
- **Scenario:** Trigger `guard_locked_payroll_items()` blocks direct update on child items of locked run.
- **Priority:** P0
- **User Role:** Direct SQL / API
- **Target URL / View:** PostgreSQL Schema
- **Preconditions:** Parent run is `LOCKED`.
- **Test Data:** `UPDATE public.payroll_items SET net_salary = 0 WHERE payroll_run_id = '[locked_run_id]';`
- **Execution Steps:**
  1. Attempt to execute UPDATE query on child items.
- **Expected Result (UI / API):** PostgreSQL raises exception: `Cannot modify payroll items for locked payroll run.` Rollback enforced.
- **Database Verification:** Child rows remain unchanged.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-026: Automatic Form XIX Printable Payslip Issuance
- **Scenario:** Locking payroll automatically generates formal payslip records in `payslips` table.
- **Priority:** P0
- **User Role:** Automated Service / Trigger
- **Target URL / View:** `/employees/[id]` -> Payslips
- **Preconditions:** Run locked via TC-PAY-023.
- **Test Data:** November 2026 Batch
- **Execution Steps:**
  1. Query `payslips` table for Rahul Sharma.
- **Expected Result (UI):** "November 2026 Payslip" card appears in Rahul's ESS profile with "View / Print Form XIX" button.
- **Database Verification:** `SELECT * FROM public.payslips WHERE employee_id = [rahul_id] AND payroll_run_id = [run_id];` (Returns 1 row).
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'PAYSLIPS_ISSUED';`
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-027: Form XIX Statutory Printable Layout Compliance
- **Scenario:** Viewing Form XIX printable payslip displays company details, statutory numbers, and wage components.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal/payslips/[id]`
- **Preconditions:** November payslip issued.
- **Test Data:** Rahul Sharma Payslip
- **Execution Steps:**
  1. Open payslip and inspect rendered layout.
- **Expected Result (UI):** Renders Form XIX header (Rule 26(2) of Maharashtra Minimum Wages Rules), Company Name, PAN, GSTIN, Employee Code, UAN, ESIC No, Payable Days (30), Basic, HRA, EPF, PT, Net Salary (in figures and words).
- **Database Verification:** Renders verified data.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-028: Multi-Entity Independent Payroll Run Execution
- **Scenario:** Acme Corp runs independent payroll for "Acme Logistics LLP" without affecting "Acme Manufacturing".
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/new`
- **Preconditions:** Legal Entity 2 ("Acme Logistics LLP") exists with 2 assigned employees.
- **Test Data:** Entity: Acme Logistics LLP, Month: November 2026
- **Execution Steps:**
  1. Select Acme Logistics LLP and create run.
- **Expected Result (UI):** Batch created containing only the 2 Logistics employees. Manufacturing run remains intact.
- **Database Verification:** `SELECT id, legal_entity_id FROM public.payroll_runs WHERE client_id = [acme_id] AND period_month = 11;` (Returns 2 distinct run rows with different legal entity IDs).
- **Audit Verification:** Audit log records `PAYROLL_RUN_INITIALIZED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-029: Export Bank Payout NEFT / RTGS File
- **Scenario:** Payroll Admin exports bank payment transfer file with account numbers, IFSC, and net amounts.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Locked payroll run.
- **Test Data:** Bank Export
- **Execution Steps:**
  1. Click "Export Bank Advice (CSV)".
  2. Inspect downloaded file.
- **Expected Result (UI):** CSV downloads containing: Beneficiary Name, Account Number, IFSC Code, Net Amount, Reference (e.g. `SAL-NOV26-EMP001`).
- **Database Verification:** Amounts match `net_salary` for all active employees.
- **Audit Verification:** Audit log records `BANK_ADVICE_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-PAY-030: Cross-Tenant Payroll Data Isolation
- **Scenario:** Globex Logistics Payroll Admin cannot view Acme Corp payroll runs or payslips.
- **Priority:** P0
- **User Role:** `payroll_admin` (Globex Logistics)
- **Target URL / View:** Direct PostgREST query on `payroll_runs` and `payslips`
- **Preconditions:** Acme has locked payroll runs.
- **Test Data:** Acme Payroll Run UUID
- **Execution Steps:**
  1. Authenticate as Globex Payroll Admin.
  2. Send `GET /rest/v1/payroll_runs?id=eq.[Acme_Run_UUID]`.
- **Expected Result (UI / API):** HTTP 200 with empty array `[]`.
- **Database Verification:** RLS policy `payroll_admin_tenant` strictly blocks cross-tenant access.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN
