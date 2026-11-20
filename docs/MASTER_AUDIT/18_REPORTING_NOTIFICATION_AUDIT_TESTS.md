# AVENCIS WORKFORCE MANAGEMENT
## Document 18 — Suite I: Reporting, Analytics & Audit Logging Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 20  
**Priority Breakdown:** P0: 4 | P1: 9 | P2: 5 | P3: 2  
**Target Module:** Audit Trails, Regulatory Compliance Registers, Analytics Dashboards, Data Exports  

---

### TC-REP-001: Regulatory Audit Log Recording on Master Mutations
- **Scenario:** Every create, update, or role change writes a structured record to `audit_logs`.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/audit-logs`
- **Preconditions:** Client Admin creates an employee or updates an attendance policy.
- **Test Data:** Mutation action
- **Execution Steps:**
  1. Perform any administrative update in the UI.
  2. Navigate to `/audit-logs`.
- **Expected Result (UI):** Table displays top row with timestamp, actor email, action type (e.g. `EMPLOYEE_CREATED`), target ID, and client name.
- **Database Verification:** `SELECT * FROM public.audit_logs WHERE actor_id = auth.uid() ORDER BY created_at DESC LIMIT 1;`
- **Audit Verification:** Audit log entry present and verified.
- **Cleanup / Teardown:** None (Audit logs immutable).
- **Status:** NOT RUN

---

### TC-REP-002: Audit Log Immutability Protection
- **Scenario:** Super Admin or Client Admin cannot delete or edit audit trail entries.
- **Priority:** P0
- **User Role:** `super_admin`
- **Target URL / View:** `/audit-logs`
- **Preconditions:** Audit logs exist.
- **Test Data:** Delete attempt
- **Execution Steps:**
  1. Verify `/audit-logs` UI contains no "Delete", "Clear", or "Edit" buttons.
  2. Attempt direct SQL delete: `DELETE FROM public.audit_logs WHERE id = [id];`.
- **Expected Result (UI / API):** UI has no deletion controls. Direct SQL raises trigger exception: `Audit logs are immutable and cannot be updated or deleted.`
- **Database Verification:** Zero rows deleted; table count intact.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-003: Monthly Attendance Summary Report Generation
- **Scenario:** Generating monthly attendance KPI summary (Present, Absent, Leave, Late Counts) per department.
- **Priority:** P1
- **User Role:** `hr_admin` (`hr.acme@avencis.test`)
- **Target URL / View:** `/reports/attendance-summary`
- **Preconditions:** Attendance recorded for November 2026.
- **Test Data:** Month: November 2026
- **Execution Steps:**
  1. Navigate to Attendance Reports.
  2. Select Month: November 2026, click "Generate Report".
- **Expected Result (UI):** Report displays department-wise aggregates: Plant Operations (88% attendance, 12 lates), Finance (96% attendance, 2 lates).
- **Database Verification:** Aggregates match count of records in `daily_attendance_records`.
- **Audit Verification:** Audit log records `REPORT_GENERATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-004: Monthly Muster Roll Matrix CSV Export
- **Scenario:** Exporting full 30-day attendance muster grid to CSV.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/attendance/muster`
- **Preconditions:** Month attendance finalized.
- **Test Data:** November 2026
- **Execution Steps:**
  1. Click "Export Muster CSV".
  2. Verify CSV headers and data.
- **Expected Result (UI):** CSV downloads with headers: Emp Code, Emp Name, Dept, Location, 1..30, Total Present, Total Absent, Total Leave, Payable Days.
- **Database Verification:** Export data matches live DB rows.
- **Audit Verification:** Audit log records `MUSTER_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-005: Form XIX Statutory Wage Register Export (Rule 26(2))
- **Scenario:** Exporting legal Form XIX Wage Register compliant with Indian Minimum Wages Rules.
- **Priority:** P0
- **User Role:** `payroll_admin` (`payroll.acme@avencis.test`)
- **Target URL / View:** `/reports/form-xix-wage-register`
- **Preconditions:** Locked payroll run for November 2026.
- **Test Data:** Batch: November 2026
- **Execution Steps:**
  1. Open Statutory Reports -> Form XIX Wage Register.
  2. Click "Export Form XIX (Excel/CSV)".
- **Expected Result (UI):** Form downloads containing all statutory columns: Serial No, Employee Name, Father's/Spouse Name, Designation, Minimum Wage Rate, Total Days Worked, Units of Work, Basic, Dearness Allowance, Other Allowances, Gross, Deductions (PF, ESI, PT, Advance), Net Wages Paid, Date of Payment, Signature/Thumb Impression column.
- **Database Verification:** Values match locked `payroll_items`.
- **Audit Verification:** Audit log records `FORM_XIX_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-006: Statutory EPFO Electronic Challan Return (ECR) File Export
- **Scenario:** Generating EPFO ECR format text file for upload to the EPFO Unified Portal.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/reports/epfo-ecr`
- **Preconditions:** Locked payroll run with UAN numbers configured.
- **Test Data:** November 2026 Batch
- **Execution Steps:**
  1. Select EPFO ECR Export.
  2. Download `.txt` file.
- **Expected Result (UI):** Text file downloads adhering to EPFO delimiter `#~#`: `UAN#~#MEMBER_NAME#~#GROSS_WAGES#~#EPF_WAGES#~#EPS_WAGES#~#EDLI_WAGES#~#EE_SHARE#~#EPS_SHARE#~#ER_SHARE#~#NCP_DAYS#~#REFUND_OF_ADVANCE`.
- **Database Verification:** Calculated wage ceilings match EPFO rules.
- **Audit Verification:** Audit log records `ECR_FILE_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-007: ESIC Monthly Contribution Statement Export
- **Scenario:** Generating ESIC monthly contribution Excel sheet for upload to ESIC Portal.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/reports/esic-monthly-return`
- **Preconditions:** Locked payroll run.
- **Test Data:** November 2026 Batch
- **Execution Steps:**
  1. Click "Export ESIC Monthly Return".
- **Expected Result (UI):** Excel file downloads containing: IP Number (10 digits), IP Name, Total Days Worked, Total Monthly Wages, Employee Contribution (0.75%), Employer Contribution (3.25%), Reason Code (if zero wages).
- **Database Verification:** Matches `payroll_items` where `esic_employee > 0`.
- **Audit Verification:** Audit log records `ESIC_STATEMENT_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-008: Professional Tax (PT) Form III Return Export
- **Scenario:** Exporting state-wise Professional Tax deduction summary for PT Challan deposit.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/reports/pt-return`
- **Preconditions:** Locked payroll run.
- **Test Data:** State: Maharashtra
- **Execution Steps:**
  1. Select State: Maharashtra, Period: November 2026.
  2. Click "Export PT Summary".
- **Expected Result (UI):** Summary table displays: Slab 1 (<= ₹7,500: 0 emps), Slab 2 (₹7,501-₹10,000: 0 emps), Slab 3 (> ₹10,000: 8 emps @ ₹200 = ₹1,600). Total PT Payable: ₹1,600.00.
- **Database Verification:** `SELECT SUM(professional_tax) FROM public.payroll_items WHERE payroll_run_id = [id];` (Returns 1600.00).
- **Audit Verification:** Audit log records `PT_REPORT_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-009: Corporate Bank NEFT / RTGS Payout Advice Export
- **Scenario:** Generating bank-format CSV for bulk electronic salary disbursement.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/[id]` -> Bank Advice
- **Preconditions:** Locked payroll run.
- **Test Data:** Payout format: HDFC CMS / Standard Bank CSV
- **Execution Steps:**
  1. Click "Generate Bank Advice".
- **Expected Result (UI):** CSV file downloads containing: Beneficiary Account No, Beneficiary Name, Bank IFSC, Net Amount, Transfer Narration (`SAL NOV 2026`), Debit Account No.
- **Database Verification:** Total transfer sum matches `payroll_runs.total_net_salary`.
- **Audit Verification:** Audit log records `BANK_ADVICE_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-010: Annual Leave Utilization & Balance Liability Report
- **Scenario:** Generating report of all employee leave quotas, days taken, remaining balances, and financial liability.
- **Priority:** P1
- **User Role:** `hr_admin` (`hr.acme@avencis.test`)
- **Target URL / View:** `/reports/leave-balances`
- **Preconditions:** Active leave allocations.
- **Test Data:** Year: 2026
- **Execution Steps:**
  1. Select Year: 2026, click "Generate Report".
- **Expected Result (UI):** Table displays all employees with breakdown: CL, SL, EL, Carried Forward, Taken, Available, Estimated Encashment Value.
- **Database Verification:** Matches `leave_allocations` cross-referenced with `employee_salary_structures`.
- **Audit Verification:** Audit log records `LEAVE_LIABILITY_REPORT_GENERATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-011: Executive Dashboard Headcount & Growth Metrics
- **Scenario:** Real-time KPI widget tracking total active employees, new joiners, exits, and attrition rate.
- **Priority:** P2
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** `/dashboard`
- **Preconditions:** 8 active employees, 1 joiner this month, 1 resignation.
- **Test Data:** Current Month
- **Execution Steps:**
  1. Navigate to `/dashboard`.
- **Expected Result (UI):** Stat cards show: "Total Headcount: 8", "New Hires This Month: 1", "Exits: 1", "Turnover Rate: 12.5%".
- **Database Verification:** Matches real-time `employees` table counts.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-012: Executive Dashboard Live Attendance Rate Widget
- **Scenario:** Real-time dial/gauge displaying today's workforce attendance percentage.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/dashboard`
- **Preconditions:** 6 employees present out of 8 scheduled today.
- **Test Data:** Today's punches
- **Execution Steps:**
  1. Inspect Attendance KPI widget on dashboard.
- **Expected Result (UI):** Gauge displays "75.0% Attendance Today (6 Present, 1 On Leave, 1 Absent)".
- **Database Verification:** Calculated from `daily_attendance_records`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-013: Executive Dashboard Monthly Payroll Cost Trend
- **Scenario:** 6-month historical chart of total gross payroll cost and statutory liabilities.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/dashboard`
- **Preconditions:** Historical locked payroll runs exist.
- **Test Data:** Last 6 Months
- **Execution Steps:**
  1. Inspect Payroll Trend chart.
- **Expected Result (UI):** Bar/line chart displays monthly total wage cost with tooltips showing Gross, Deductions, and Net payout.
- **Database Verification:** Data matches historical `payroll_runs` rows.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-014: Filter Reports by Work Location & Legal Entity
- **Scenario:** Filtering Form XIX and Attendance reports by specific factory facility.
- **Priority:** P2
- **User Role:** `payroll_admin`
- **Target URL / View:** `/reports`
- **Preconditions:** Multi-location client.
- **Test Data:** Filter: "Pune Plant 1"
- **Execution Steps:**
  1. Select Location filter "Pune Plant 1".
  2. Generate report.
- **Expected Result (UI):** Report filters strictly to Pune Plant employees; excludes Mumbai HQ.
- **Database Verification:** Verified in exported rows.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Reset filter.
- **Status:** NOT RUN

---

### TC-REP-015: Unauthorized Access to Reports Blocked for ESS Employees
- **Scenario:** Standard employee attempts to access `/reports` or export corporate registers.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** Direct URL: `http://localhost:5173/reports`
- **Preconditions:** Logged in as Rahul Sharma.
- **Test Data:** Route navigation
- **Execution Steps:**
  1. Navigate to `/reports` in browser.
- **Expected Result (UI):** Route guard intercepts request: redirects to `/portal` or renders "403 Forbidden: Insufficient Permissions".
- **Database Verification:** N/A.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-016: Location Manager Access Restricted to Operational Reports
- **Scenario:** Location Manager can view site attendance muster, but is blocked from wage registers and financial analytics.
- **Priority:** P1
- **User Role:** `location_manager` (`mgr.pune@avencis.test`)
- **Target URL / View:** `/reports`
- **Preconditions:** Logged in as Pune Location Manager.
- **Test Data:** Navigation to wage reports
- **Execution Steps:**
  1. Verify report navigation.
  2. Attempt to open Form XIX Wage Register.
- **Expected Result (UI):** Wage reports tab hidden. Direct URL navigation displays "Access Denied: Financial reports require Payroll Admin or Client Admin role."
- **Database Verification:** PostgREST RLS prevents reading `payroll_items`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-017: Super Admin Global Cross-Tenant Reporting
- **Scenario:** Super Admin generates aggregate platform report covering all active tenants.
- **Priority:** P1
- **User Role:** `super_admin` (`superadmin@avencis.test`)
- **Target URL / View:** `/admin/reports`
- **Preconditions:** Super Admin authenticated.
- **Test Data:** Global view
- **Execution Steps:**
  1. Open Platform Overview report.
- **Expected Result (UI):** Table displays total active tenants (2), total onboarded employees (10), total monthly platform wage volume.
- **Database Verification:** Super Admin queries bypass tenant RLS restrictions.
- **Audit Verification:** Audit log records `PLATFORM_REPORT_GENERATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-018: Audit Log Filter by Actor Email & Action Type
- **Scenario:** Filtering audit log table to view actions performed by a specific user within date range.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/audit-logs`
- **Preconditions:** Multiple audit entries logged.
- **Test Data:** Filter Actor: `hr.acme@avencis.test`, Action: `EMPLOYEE_UPDATED`
- **Execution Steps:**
  1. Select Actor filter: `hr.acme@avencis.test`.
  2. Select Action: `EMPLOYEE_UPDATED`.
- **Expected Result (UI):** Table filters instantly to show only matching audit log entries.
- **Database Verification:** UI state filtering.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Reset filter.
- **Status:** NOT RUN

---

### TC-REP-019: Export Audit Logs to CSV for External SOC 2 Audit
- **Scenario:** Client Admin exports complete tenant audit trail to CSV for third-party compliance audit.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/audit-logs`
- **Preconditions:** Audit logs exist.
- **Test Data:** Export command
- **Execution Steps:**
  1. Click "Export Audit Logs CSV".
- **Expected Result (UI):** CSV file downloads with complete tamper-proof audit fields: Log ID, Timestamp (UTC), Actor ID, IP Address, Action, Target ID, Metadata Diff.
- **Database Verification:** Export contents match `audit_logs` where `client_id = get_user_client_id()`.
- **Audit Verification:** Export action is itself logged in `audit_logs`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-REP-020: Report Print CSS Layout & Formatting
- **Scenario:** Printing report directly from browser applies `@media print` layout without navigation sidebar.
- **Priority:** P3
- **User Role:** `client_admin`
- **Target URL / View:** `/reports/attendance-summary`
- **Preconditions:** Report open.
- **Test Data:** Print Preview (`Ctrl + P`)
- **Execution Steps:**
  1. Press `Ctrl + P` to trigger print preview.
- **Expected Result (UI):** Print preview hides navigation header and sidebar; formats tables in crisp high-contrast black/white; displays company name and generation timestamp in footer.
- **Database Verification:** N/A.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN
