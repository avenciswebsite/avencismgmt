# AVENCIS WORKFORCE MANAGEMENT
## Document 14 — Suite F: Leave Management & Statutory Holidays Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 30  
**Priority Breakdown:** P0: 9 | P1: 13 | P2: 6 | P3: 2  
**Target Module:** Leave Types, Allocations, Applications, Multi-Level Approvals, Muster Roll Sync, LWP Integration  

---

### TC-LEV-001: Leave Application with Sufficient Balance (Happy Path)
- **Scenario:** Employee applies for 2 days of Casual Leave with 10 days remaining in balance.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal/leaves` -> "Apply Leave"
- **Preconditions:** Rahul Sharma has 10 days Casual Leave allocated in `leave_allocations`.
- **Test Data:** Leave Type: "Casual Leave (CL)", Start: "2026-11-20", End: "2026-11-21", Reason: "Personal family event"
- **Execution Steps:**
  1. Log in to ESS Portal as Rahul Sharma.
  2. Click "Apply Leave", select Casual Leave, set dates Nov 20 to Nov 21 (2 days).
  3. Enter reason and click "Submit Application".
- **Expected Result (UI):** Toast "Leave request submitted successfully". Request appears in table with yellow badge "PENDING". Balance displays "Available: 8 (2 pending approval)".
- **Database Verification:** `SELECT * FROM public.leave_requests WHERE employee_id = (SELECT id FROM public.employees WHERE employee_code = 'EMP-ACM-001') AND status = 'PENDING';` (Returns 1 row, total_days = 2.0).
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'LEAVE_REQUESTED';`
- **Cleanup / Teardown:** Handled in test teardown.
- **Status:** NOT RUN

---

### TC-LEV-002: Insufficient Leave Balance Block
- **Scenario:** System blocks leave application when requested days exceed available quota.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Rahul has 1 day Sick Leave remaining.
- **Test Data:** Leave Type: "Sick Leave (SL)", Start: "2026-11-20", End: "2026-11-23" (4 days)
- **Execution Steps:**
  1. Select Sick Leave, choose 4 days duration.
  2. Click "Submit Application".
- **Expected Result (UI):** Error alert: "Insufficient leave balance. You have 1 day available, but requested 4 days. Would you like to apply for Loss of Pay (LWP) instead?" Submission blocked.
- **Database Verification:** Zero rows inserted into `leave_requests`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-003: Half-Day Leave Application (First Half)
- **Scenario:** Employee applies for a half-day leave for morning hours (0.5 day deduction).
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Employee has available balance.
- **Test Data:** Leave Type: Casual Leave, Date: "2026-11-25", Is Half-Day: True, Half-Day Type: "First Half (Morning)"
- **Execution Steps:**
  1. Toggle "Half-Day" switch.
  2. Select "First Half", select date Nov 25.
  3. Submit.
- **Expected Result (UI):** Request created with "Duration: 0.5 Day (First Half)".
- **Database Verification:** `SELECT total_days, is_half_day FROM public.leave_requests WHERE employee_id = [id] ORDER BY created_at DESC LIMIT 1;` (total_days = 0.50, is_half_day = true).
- **Audit Verification:** Audit log records `LEAVE_REQUESTED`.
- **Cleanup / Teardown:** Clear request.
- **Status:** NOT RUN

---

### TC-LEV-004: Inverted Date Selection Validation (End Date Before Start Date)
- **Scenario:** System blocks submitting leave where end date precedes start date.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Modal open.
- **Test Data:** Start: "2026-11-25", End: "2026-11-20"
- **Execution Steps:**
  1. Set Start Date: Nov 25, End Date: Nov 20.
  2. Attempt to submit.
- **Expected Result (UI):** Validation flag: "End date cannot be earlier than start date." Total days displays 0. Submit button disabled.
- **Database Verification:** Check constraint or validation blocks insert.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-005: Overlapping Leave Request Validation
- **Scenario:** Employee cannot apply for leave on dates where a request already exists.
- **Priority:** P0
- **User Role:** `employee`
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Approved or pending leave exists for Nov 20–21.
- **Test Data:** New Request: Nov 21–22
- **Execution Steps:**
  1. Attempt to apply for Nov 21–22.
- **Expected Result (UI):** Error alert: "You already have an existing leave request covering Nov 21. Overlapping leave requests are not permitted."
- **Database Verification:** Zero duplicate rows created.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-006: Applying on Weekly Off / Statutory Holiday
- **Scenario:** System correctly counts only working days when leave spans a weekend or holiday.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Saturday & Sunday are weekly offs.
- **Test Data:** Start: Friday Nov 20, End: Monday Nov 23 (Span is 4 calendar days, but 2 working days)
- **Execution Steps:**
  1. Select dates Friday to Monday.
- **Expected Result (UI):** System automatically calculates: "Total Working Days: 2 days (Excludes Sat & Sun Weekly Offs)".
- **Database Verification:** `total_days` in `leave_requests` records 2.00.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-007: Department Manager Leave Approval
- **Scenario:** Department Manager reviews and approves Rahul's pending leave request.
- **Priority:** P0
- **User Role:** `department_manager` (`mgr.ops@avencis.test`)
- **Target URL / View:** `/leave-approvals`
- **Preconditions:** Rahul Sharma submitted 2-day leave request.
- **Test Data:** Target Request ID
- **Execution Steps:**
  1. Log in as Operations Department Manager.
  2. Navigate to `/leave-approvals`.
  3. Click "Approve" on Rahul's request.
- **Expected Result (UI):** Status badge turns green "APPROVED". Toast "Leave approved successfully".
- **Database Verification:** `SELECT status, approved_by FROM public.leave_requests WHERE id = '[request_uuid]';` (status = 'APPROVED', approved_by = manager UUID).
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'LEAVE_APPROVED';`
- **Cleanup / Teardown:** Handled in teardown.
- **Status:** NOT RUN

---

### TC-LEV-008: Atomic Balance Deduction Upon Approval
- **Scenario:** Approving a 2-day leave atomically increments `used_days` by 2 in `leave_allocations`.
- **Priority:** P0
- **User Role:** Automated Database Trigger / Service
- **Target URL / View:** `/employees/[id]` -> Leave Balances
- **Preconditions:** Rahul had `used_days = 0`, `allocated_days = 12`.
- **Test Data:** Approved 2-day leave.
- **Execution Steps:**
  1. Query `leave_allocations` immediately following approval.
- **Expected Result (UI):** Balance card displays "Used: 2.0 | Remaining: 10.0".
- **Database Verification:** `SELECT allocated_days, used_days FROM public.leave_allocations WHERE employee_id = [rahul_id] AND leave_type_id = [cl_id];` (used_days = 2.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Reset balance.
- **Status:** NOT RUN

---

### TC-LEV-009: Daily Attendance Muster Roll Sync (`ON_LEAVE`)
- **Scenario:** Approving leave automatically populates `daily_attendance_records` with status `ON_LEAVE`.
- **Priority:** P0
- **User Role:** Automated Leave-Attendance Sync Engine
- **Target URL / View:** `/attendance/muster`
- **Preconditions:** Leave approved for Nov 20 and Nov 21.
- **Test Data:** Dates: Nov 20, Nov 21
- **Execution Steps:**
  1. View Attendance Muster for Rahul on Nov 20 and Nov 21.
- **Expected Result (UI):** Both date cells display purple badge "L (ON_LEAVE)" and count as paid leave days.
- **Database Verification:** `SELECT work_date, status FROM public.daily_attendance_records WHERE employee_id = [rahul_id] AND work_date IN ('2026-11-20', '2026-11-21');` (Both rows status = 'ON_LEAVE').
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-010: Department Manager Leave Rejection
- **Scenario:** Manager rejects leave request with mandatory rejection remarks.
- **Priority:** P0
- **User Role:** `department_manager` (`mgr.ops@avencis.test`)
- **Target URL / View:** `/leave-approvals`
- **Preconditions:** Pending leave request exists.
- **Test Data:** Rejection Reason: "Critical maintenance scheduled on these dates; team attendance required"
- **Execution Steps:**
  1. Click "Reject" on request.
  2. Input mandatory remarks and confirm.
- **Expected Result (UI):** Status updates to red "REJECTED". Remarks displayed on row.
- **Database Verification:** `SELECT status, rejection_reason FROM public.leave_requests WHERE id = '[request_uuid]';` (status = 'REJECTED').
- **Audit Verification:** Audit log records `LEAVE_REJECTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-011: Zero Balance Deduction on Rejected Leave
- **Scenario:** A rejected leave request causes zero deduction in `leave_allocations`.
- **Priority:** P0
- **User Role:** Database Engine
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Leave rejected via TC-LEV-010.
- **Test Data:** Rejected request
- **Execution Steps:**
  1. Inspect employee's leave balance.
- **Expected Result (UI):** Remaining balance remains uncharged (12/12 available).
- **Database Verification:** `used_days` in `leave_allocations` remains 0.00.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-012: Employee Cancels Pending Leave Request
- **Scenario:** Employee cancels their own leave application before manager acts on it.
- **Priority:** P1
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Request is in `PENDING` status.
- **Test Data:** Target Pending Request
- **Execution Steps:**
  1. Click "Cancel Request" on pending leave card.
  2. Confirm modal.
- **Expected Result (UI):** Status updates to "CANCELLED". Pending hold on balance released.
- **Database Verification:** `SELECT status FROM public.leave_requests WHERE id = '[request_uuid]';` (Returns 'CANCELLED').
- **Audit Verification:** Audit log records `LEAVE_CANCELLED_BY_EMPLOYEE`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-013: HR Admin Revokes Approved Leave (Balance Restoration)
- **Scenario:** HR Admin revokes a previously approved leave; automatically recredits the employee balance.
- **Priority:** P0
- **User Role:** `hr_admin` (`hr.acme@avencis.test`)
- **Target URL / View:** `/leaves/all`
- **Preconditions:** Leave was approved; `used_days` was 2.0.
- **Test Data:** Target Approved Leave
- **Execution Steps:**
  1. Open Approved Leaves list as HR Admin.
  2. Click "Revoke Leave", enter reason: "Employee worked shift unexpectedly", confirm.
- **Expected Result (UI):** Status updates to "REVOKED". Employee balance re-credited (+2 days).
- **Database Verification:**
  - `leave_requests.status = 'REVOKED'`
  - `leave_allocations.used_days` decremented back to 0.00
  - `daily_attendance_records` status reverted from `ON_LEAVE` to `PRESENT` or standard schedule
- **Audit Verification:** Audit log records `LEAVE_REVOKED_BY_HR`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-014: Anti-Self-Approval Defense for Leave Requests
- **Scenario:** A manager cannot approve their own submitted leave application.
- **Priority:** P0
- **User Role:** `department_manager` acting on own application
- **Target URL / View:** `/leave-approvals`
- **Preconditions:** Manager submitted leave application for themselves.
- **Test Data:** Own leave request.
- **Execution Steps:**
  1. View `/leave-approvals`.
  2. Locate own request.
- **Expected Result (UI):** Action buttons disabled: "Self-approval prohibited. This request must be approved by HR Admin or Client Admin." Direct API returns 403.
- **Database Verification:** Business logic check enforces `approver_id != employee_id`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-015: Loss of Pay (LWP) Leave Application
- **Scenario:** Employee applies explicitly for Loss of Pay when paid leave balance is exhausted.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Paid balances exhausted.
- **Test Data:** Leave Type: "Loss of Pay (LWP)", Duration: 3 days
- **Execution Steps:**
  1. Select Leave Type "Loss of Pay (LWP)".
  2. Select 3 days and submit.
- **Expected Result (UI):** System accepts request without balance limit check: "LWP Request Submitted (Unpaid Leave)".
- **Database Verification:** `SELECT * FROM public.leave_requests WHERE leave_type_id = (SELECT id FROM public.leave_types WHERE code = 'LWP');`
- **Audit Verification:** Audit log records `LWP_REQUESTED`.
- **Cleanup / Teardown:** Clear request.
- **Status:** NOT RUN

---

### TC-LEV-016: LWP Days Integration with Payroll Engine
- **Scenario:** Approved LWP days directly reduce payable days in monthly payroll calculation.
- **Priority:** P0
- **User Role:** Automated Payroll Integration Engine
- **Target URL / View:** `/payroll/runs/new`
- **Preconditions:** Vikram Rao has 5 approved LWP days in November (30 days total).
- **Test Data:** Employee: Vikram Rao, Month Days: 30, LWP Days: 5
- **Execution Steps:**
  1. Calculate draft payroll for November.
  2. Inspect Vikram's payable days.
- **Expected Result (UI):** Payroll register displays: "Month Days: 30 | LWP Days: 5 | Payable Days: 25.0". Gross salary prorated by 25/30.
- **Database Verification:** `SELECT payable_days, lwp_days FROM public.payroll_items WHERE employee_id = [vikram_id];` (payable_days = 25.00, lwp_days = 5.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-017: Create New Leave Type with Custom Rules
- **Scenario:** Client Admin creates a new leave category "Maternity Leave" (182 days paid).
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/leave-types`
- **Preconditions:** Client active.
- **Test Data:** Name: "Maternity Leave", Code: "ML", Default Quota: 182, Paid: True, Gender Restriction: "Female"
- **Execution Steps:**
  1. Navigate to `/settings/leave-types` -> "Add Leave Type".
  2. Fill parameters and save.
- **Expected Result (UI):** "Maternity Leave" appears in leave types table with active status.
- **Database Verification:** `SELECT * FROM public.leave_types WHERE code = 'ML';`
- **Audit Verification:** Audit log records `LEAVE_TYPE_CREATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-018: Annual Leave Quota Rollover / Carry-Forward
- **Scenario:** Year-end processing carries forward unspent Earned Leave up to statutory cap (30 days).
- **Priority:** P2
- **User Role:** `hr_admin`
- **Target URL / View:** `/settings/leave-rollover`
- **Preconditions:** Employee has 10 unused Earned Leave days at end of calendar year.
- **Test Data:** Employee: Rahul Sharma, Unused EL: 10
- **Execution Steps:**
  1. Trigger Annual Leave Rollover process for new calendar year.
- **Expected Result (UI):** Next year's allocation initialized: "Base: 15 + Carried Forward: 10 = Total: 25 Days".
- **Database Verification:** `SELECT carried_forward_days, allocated_days FROM public.leave_allocations WHERE calendar_year = 2027;`
- **Audit Verification:** Audit log records `LEAVE_ROLLOVER_PROCESSED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-019: Pro-Rata Leave Quota for Mid-Year Joiner
- **Scenario:** Employee joining on July 1 receives half annual quota (6 CL instead of 12).
- **Priority:** P1
- **User Role:** Automated Onboarding Engine
- **Target URL / View:** `/employees/[id]` -> Leave Balances
- **Preconditions:** Employee onboarded with joining date: July 1.
- **Test Data:** Joining Date: 2026-07-01
- **Execution Steps:**
  1. Inspect leave balances on newly onboarded employee.
- **Expected Result (UI):** Casual Leave shows 6 days allocated (prorated for remaining 6 months of year).
- **Database Verification:** `SELECT allocated_days FROM public.leave_allocations WHERE employee_id = [mid_joiner_id] AND leave_type_id = [cl_id];` (Returns 6.00).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-020: Statutory Holiday Calendar Setup (Maharashtra)
- **Scenario:** HR Admin uploads state statutory holiday list for Acme Corp (Mumbai & Pune).
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/settings/holiday-calendars`
- **Preconditions:** Client active.
- **Test Data:** Holiday: "Maharashtra Day", Date: "2026-05-01", Mandatory: True
- **Execution Steps:**
  1. Add Holiday "Maharashtra Day" on May 1, 2026.
  2. Save calendar.
- **Expected Result (UI):** May 1 displayed in corporate calendar as Statutory Holiday.
- **Database Verification:** `SELECT * FROM public.holiday_calendars WHERE holiday_name = 'Maharashtra Day';`
- **Audit Verification:** Audit log records `HOLIDAY_ADDED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-021: Multi-Location Holiday Exceptions
- **Scenario:** Regional holiday configured for Mumbai HQ only; Pune Plant works standard shift.
- **Priority:** P2
- **User Role:** `hr_admin`
- **Target URL / View:** `/settings/holiday-calendars`
- **Preconditions:** Holiday modal open.
- **Test Data:** Holiday: "Ganesh Chaturthi", Scope: Specific Location ("Mumbai HQ")
- **Execution Steps:**
  1. Add holiday and restrict location scope to "Mumbai HQ".
  2. Save.
- **Expected Result (UI):** Holiday calendar shows "Mumbai HQ Only". Pune Plant calendar shows regular workday.
- **Database Verification:** `location_id` column in `holiday_calendars` links specifically to Mumbai HQ.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-022: Cross-Tenant Leave Request Isolation
- **Scenario:** Globex Logistics manager cannot view or act on Acme Corp leave requests.
- **Priority:** P0
- **User Role:** `client_admin` (Globex Logistics)
- **Target URL / View:** Direct PostgREST query on `leave_requests`
- **Preconditions:** Acme has pending leave requests.
- **Test Data:** Acme leave request UUID
- **Execution Steps:**
  1. Authenticate as Globex Admin.
  2. Send `GET /rest/v1/leave_requests?id=eq.[Acme_Leave_UUID]`.
- **Expected Result (UI / API):** HTTP 200 with empty array `[]`.
- **Database Verification:** RLS policy isolates records strictly by client.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-023: Leave Balance History & Audit Ledger
- **Scenario:** Auditing every balance debit, credit, and manual adjustment on an employee account.
- **Priority:** P2
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees/[id]` -> Leave Ledger
- **Preconditions:** Employee has multiple leaves taken and credited.
- **Test Data:** Rahul Sharma
- **Execution Steps:**
  1. Open Leave Ledger tab.
- **Expected Result (UI):** Ledger lists chronological transactions: Initial Credit (+12), Approved Leave (-2), Balance (10), Revocation (+2), etc.
- **Database Verification:** Ledger reconciles with sum of transactions.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-024: Mandatory Medical Certificate for Extended Sick Leave (> 2 Days)
- **Scenario:** Applying for > 2 consecutive sick days requires medical certificate upload.
- **Priority:** P2
- **User Role:** `employee`
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Sick leave application open.
- **Test Data:** Duration: 3 days Sick Leave, Attachment: None
- **Execution Steps:**
  1. Select 3 days Sick Leave without attaching file.
  2. Attempt submit.
- **Expected Result (UI):** Alert: "Medical certificate upload is required for sick leave exceeding 2 consecutive days."
- **Database Verification:** Blocked client-side.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-025: Bulk Leave Allocation Adjustment
- **Scenario:** HR Admin grants an additional 2 days compensatory off to all Plant Operations staff.
- **Priority:** P2
- **User Role:** `hr_admin`
- **Target URL / View:** `/leaves/bulk-adjust`
- **Preconditions:** Plant Operations department selected.
- **Test Data:** Leave Type: "Compensatory Off", Adjustment: +2.0 Days, Reason: "Weekend plant shutdown support"
- **Execution Steps:**
  1. Select Department "Plant Operations", enter +2 days, click "Apply Adjustment".
- **Expected Result (UI):** Toast "5 employee balances adjusted successfully".
- **Database Verification:** `SELECT COUNT(*) FROM public.leave_allocations WHERE allocated_days increased by 2;`
- **Audit Verification:** Audit log records `BULK_LEAVE_ADJUSTMENT`.
- **Cleanup / Teardown:** Revert adjustment.
- **Status:** NOT RUN

---

### TC-LEV-026: Leave Application on Past Date (Backdated Leave)
- **Scenario:** Employee applies for emergency leave for yesterday within allowable 48-hour window.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Date: Yesterday (within 48h).
- **Test Data:** Start: Yesterday, End: Yesterday
- **Execution Steps:**
  1. Select yesterday's date, input emergency reason, submit.
- **Expected Result (UI):** Application accepted with warning flag "Backdated Request (Pending HR Review)".
- **Database Verification:** `leave_requests` row created with `is_backdated = true`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** Clear.
- **Status:** NOT RUN

---

### TC-LEV-027: Block Backdated Leave Exceeding 48 Hours
- **Scenario:** System rejects leave application backdated more than 48 hours without HR override.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal/leaves`
- **Preconditions:** Date: 7 days ago.
- **Test Data:** Date: 7 days ago
- **Execution Steps:**
  1. Attempt to apply for date 7 days in the past.
- **Expected Result (UI):** Error banner: "Backdated leave cannot exceed 48 hours. Please submit an Attendance Regularisation or contact HR."
- **Database Verification:** Submission blocked.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-028: Export Leave Summary Report to CSV
- **Scenario:** HR Admin exports monthly client leave utilization summary.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/leaves/reports`
- **Preconditions:** Leaves taken across month.
- **Test Data:** Export action
- **Execution Steps:**
  1. Click "Export Leave Summary CSV".
- **Expected Result (UI):** CSV downloads with columns: Employee Code, Name, CL Taken, SL Taken, EL Taken, LWP Days, Remaining Balance.
- **Database Verification:** Aggregates align with `leave_requests` and `leave_allocations`.
- **Audit Verification:** Audit log records `LEAVE_REPORT_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-029: Sandwich Leave Rule Evaluation (Leave Bridging Weekends)
- **Scenario:** Verifying system behavior when leave is applied on Friday and Monday (Sandwich Rule).
- **Priority:** P3
- **User Role:** `hr_admin`
- **Target URL / View:** `/settings/leave-types`
- **Preconditions:** Sandwich rule configuration toggle.
- **Test Data:** Leave on Friday & Monday
- **Execution Steps:**
  1. Configure Sandwich Rule = "Count Intervening Weekends as Leave".
  2. Verify Friday-Monday application counts as 4 days instead of 2.
- **Expected Result (UI):** Total days calculated reflects sandwich policy setting.
- **Database Verification:** Documented behavior per client policy.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-LEV-030: Leave Cancellation After Payroll Cutoff Locking
- **Scenario:** System blocks leave cancellation or revocation if the affected pay period is already locked.
- **Priority:** P0
- **User Role:** `hr_admin`
- **Target URL / View:** `/leaves/all`
- **Preconditions:** Payroll run for October 2026 has status `LOCKED`.
- **Test Data:** Leave in October 2026.
- **Execution Steps:**
  1. Attempt to revoke an approved October leave.
- **Expected Result (UI):** Error alert: "Cannot revoke leave: Payroll for October 2026 is locked. Any adjustment must be processed in the subsequent payroll run."
- **Database Verification:** `leave_requests.status` remains `APPROVED`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN
