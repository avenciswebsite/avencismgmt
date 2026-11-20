# AVENCIS WORKFORCE MANAGEMENT
## Document 16 — Suite J: Cross-Module Integration Workflows Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 25  
**Priority Breakdown:** P0: 5 | P1: 10 | P2: 6 | P3: 4  
**Target Module:** Cross-Module Integration, Multi-Entity Workflows, Domino State Changes, Edge-to-Edge Lifecycle  

---

### TC-INT-001: Master End-to-End Enterprise Workflow (Genesis to Payslip)
- **Scenario:** Complete lifecycle: Onboard client -> add entity -> add location -> create policy -> invite admin -> onboard employee -> punch attendance -> apply leave -> approve leave -> finalize muster -> run payroll -> approve run -> download Form XIX payslip.
- **Priority:** P0
- **User Role:** All Personas in Sequence (`super_admin` -> `client_admin` -> `hr_admin` -> `employee` -> `department_manager` -> `payroll_admin`)
- **Target URL / View:** Cross-Application Full Journey
- **Preconditions:** Clean staging test instance.
- **Test Data:** Client: "Omega Tech Pvt Ltd", Employee: "Rohan Varma"
- **Execution Steps:**
  1. Super Admin onboards Omega Tech (`TC-CLI-001`).
  2. Client Admin configures Mumbai Location and 09:00 shift policy.
  3. HR Admin onboards Rohan Varma (`EMP-OMG-001`, CTC ₹40,000).
  4. Rohan logs in, punches in/out inside geofence for 20 days.
  5. Rohan applies for 2 days Casual Leave; Department Manager approves.
  6. Payroll Admin verifies 22 payable days, finalizes attendance muster.
  7. Payroll Admin calculates draft payroll; Client Admin approves and locks batch.
  8. Rohan logs in to ESS portal and downloads Form XIX printable payslip.
- **Expected Result (UI):** Every phase completes cleanly with zero errors; payslip accurately reflects 22 payable days and ₹40,000 monthly gross prorated math.
- **Database Verification:** Records linked across `clients -> employees -> attendance_events -> daily_attendance_records -> leave_requests -> payroll_runs -> payroll_items -> payslips`.
- **Audit Verification:** Full chain of audit logs present for each lifecycle event.
- **Cleanup / Teardown:** Handled in master test cleanup script.
- **Status:** NOT RUN

---

### TC-INT-002: Employee Transfer Domino Effect (Location Shift & Routing)
- **Scenario:** Transferring employee from Pune to Mumbai immediately updates geofence coordinates and re-routes regularisations to Mumbai manager.
- **Priority:** P0
- **User Role:** `hr_admin` & `location_manager`
- **Target URL / View:** `/employees` -> `/attendance`
- **Preconditions:** Rahul Sharma assigned to Pune Plant 1.
- **Test Data:** Transfer to: Mumbai Head Office
- **Execution Steps:**
  1. HR Admin transfers Rahul to Mumbai Head Office.
  2. Rahul attempts to punch in from Pune coordinates -> verify rejection.
  3. Rahul punches from Mumbai coordinates -> verify acceptance.
  4. Rahul submits attendance regularisation.
- **Expected Result (UI):** Pune Manager no longer sees Rahul in team directory. Mumbai Manager receives the regularisation request.
- **Database Verification:** `employees.work_location_id` updated; `attendance_events.work_location_id` records Mumbai; `get_manager_team()` reflects new assignment.
- **Audit Verification:** Audit log records `EMPLOYEE_TRANSFERRED`.
- **Cleanup / Teardown:** Revert location to Pune.
- **Status:** NOT RUN

---

### TC-INT-003: Resignation Lifecycle: Cutoff Punches Past LWD
- **Scenario:** Resigned employee with Last Working Day (LWD) of Nov 20 is strictly blocked from punching on Nov 21.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal`
- **Preconditions:** LWD recorded as Nov 20, 2026.
- **Test Data:** Date: Nov 21, 2026
- **Execution Steps:**
  1. Set system date or mock timestamp to Nov 21.
  2. Rahul attempts to click "Punch In".
- **Expected Result (UI):** System blocks punch: "Access Terminated: Last working day was Nov 20, 2026." Button disabled.
- **Database Verification:** Zero rows inserted into `attendance_events` on Nov 21.
- **Audit Verification:** Audit log records `PUNCH_BLOCKED_POST_LWD`.
- **Cleanup / Teardown:** Clear exit date.
- **Status:** NOT RUN

---

### TC-INT-004: Unauthorised Absence to Payroll LWP Pipeline
- **Scenario:** Employee absent without leave for 4 days; system marks ABSENT, updates muster, passes 4 LWP days to payroll, and reduces net payout.
- **Priority:** P0
- **User Role:** Automated Cross-Module Pipeline
- **Target URL / View:** `/attendance/muster` -> `/payroll/runs/[id]`
- **Preconditions:** Amit Kumar has 4 unapproved absent days in November (30 days total).
- **Test Data:** Master Gross: ₹18,500. Month Days: 30. Absent: 4. Payable: 26.
- **Execution Steps:**
  1. Consolidate attendance muster.
  2. Initialize November payroll run.
- **Expected Result (UI):**
  - Muster displays 4 red "A" badges.
  - Payroll item shows: Payable Days = 26.0, LWP Days = 4.0.
  - Gross prorated to ₹16,033.33 (`18,500 * 26 / 30`).
- **Database Verification:** `daily_attendance_records` status matches `payroll_items.lwp_days = 4.00`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-005: Salary Hike Statutory Threshold Transition
- **Scenario:** Employee promoted from ₹18,000 to ₹25,000 Gross; ESIC status automatically flips from Covered (0.75%) to Exempt (0.0%).
- **Priority:** P1
- **User Role:** `hr_admin` & `payroll_admin`
- **Target URL / View:** `/employees/[id]` -> `/payroll`
- **Preconditions:** Amit Kumar initially at ₹18,500 Gross (Covered by ESIC).
- **Test Data:** Revised Gross: ₹25,000.00
- **Execution Steps:**
  1. HR / Payroll Admin updates salary structure to ₹25,000.
  2. Calculate subsequent month payroll run.
- **Expected Result (UI):** ESIC deduction column updates from ₹139.00 to ₹0.00 (Exempt). EPF remains active.
- **Database Verification:** `payroll_items.esic_employee = 0.00`, `payroll_items.esic_employer = 0.00`.
- **Audit Verification:** Audit log records `SALARY_STRUCTURE_REVISED`.
- **Cleanup / Teardown:** Revert salary.
- **Status:** NOT RUN

---

### TC-INT-006: User Role Elevation (Employee -> Manager) Live Transition
- **Scenario:** User promoted to `location_manager`; UI immediately unlocks site management tabs without requiring re-registration.
- **Priority:** P1
- **User Role:** `client_admin` & Target User
- **Target URL / View:** `/users` -> Target User Session
- **Preconditions:** Rahul Sharma is standard `employee`.
- **Test Data:** New Role: `location_manager`, Location: Pune Plant 1
- **Execution Steps:**
  1. Client Admin elevates Rahul's role to `location_manager`.
  2. Rahul refreshes browser.
- **Expected Result (UI):** Navigation sidebar expands to display "Team Muster", "Punch Approvals", and "Work Location". ESS portal remains accessible.
- **Database Verification:** `user_roles.role = 'location_manager'`, `user_work_locations` contains Pune Plant.
- **Audit Verification:** Audit log records `ROLE_MODIFIED`.
- **Cleanup / Teardown:** Revert role to `employee`.
- **Status:** NOT RUN

---

### TC-INT-007: Client Suspension Cascade (Immediate Tenant Lockout)
- **Scenario:** Super Admin suspends Acme Corp; all 8 employees and 4 admins immediately receive 403 on next API call.
- **Priority:** P0
- **User Role:** `super_admin` & Active Acme Users
- **Target URL / View:** `/clients` -> Client Sessions
- **Preconditions:** Multiple active sessions logged in.
- **Test Data:** Client: Acme Corp
- **Execution Steps:**
  1. Super Admin suspends Acme Corp.
  2. Active user in Acme attempts to submit attendance punch or load dashboard.
- **Expected Result (UI):** User immediately logged out or intercepted with error: "Tenant Suspended. Contact Avencis Support."
- **Database Verification:** `clients.status = 'suspended'`.
- **Audit Verification:** Audit log records `CLIENT_SUSPENDED`.
- **Cleanup / Teardown:** Reactivate client.
- **Status:** NOT RUN

---

### TC-INT-008: Multi-Entity Independent Payroll Run Isolation
- **Scenario:** Running and locking payroll for "Acme Manufacturing" does not lock or freeze "Acme Logistics" payroll for the same month.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll`
- **Preconditions:** Both entities have draft runs for November 2026.
- **Test Data:** Entity A: Manufacturing (Locked), Entity B: Logistics (Draft)
- **Execution Steps:**
  1. Finalize and lock Manufacturing payroll run.
  2. Open Logistics payroll run and attempt to edit an overtime line item.
- **Expected Result (UI):** Logistics run remains in editable DRAFT status; edit succeeds. Manufacturing run displays immutable LOCKED badge.
- **Database Verification:**
  - Run A: `status = 'LOCKED'`.
  - Run B: `status = 'DRAFT'`.
- **Audit Verification:** Separate audit log entries per run ID.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-009: Backdated Leave Approved After Attendance Finalization Gate
- **Scenario:** System blocks approving a backdated leave request once the target month's attendance muster is locked.
- **Priority:** P1
- **User Role:** `department_manager` (`mgr.ops@avencis.test`)
- **Target URL / View:** `/leave-approvals`
- **Preconditions:** Attendance muster for October 2026 is locked.
- **Test Data:** Leave request dated October 28.
- **Execution Steps:**
  1. Manager attempts to click "Approve" on October leave request.
- **Expected Result (UI):** Error banner: "Cannot approve leave: Attendance period October 2026 is finalized and locked. Submit a payroll adjustment request instead."
- **Database Verification:** `leave_requests.status` remains `PENDING`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-010: Form XIX Statutory Register Data Reconciliation
- **Scenario:** Form XIX Statutory Wage Register export perfectly reconciles with individual employee payslip printouts.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/reports/statutory-wage-register`
- **Preconditions:** Locked payroll run with 8 employees.
- **Test Data:** November 2026 Batch
- **Execution Steps:**
  1. Generate Form XIX Statutory Wage Register (Excel/CSV).
  2. Compare totals against sum of individual Form XIX payslips.
- **Expected Result (UI):** Total Basic, Total Allowances, Total PF, Total PT, and Net Wages reconcile down to ₹0.00 variance.
- **Database Verification:** `SUM(payroll_items.net_salary) == payroll_runs.total_net_salary`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-011: Mid-Month Joiner Leave Quota & Payroll Convergence
- **Scenario:** Sneha Patil joins Nov 16: receives prorated leave quota (1.5 CL instead of 12) and prorated salary (15 payable days).
- **Priority:** P2
- **User Role:** Automated System
- **Target URL / View:** `/employees/[id]` & `/payroll`
- **Preconditions:** Onboarding date: Nov 16.
- **Test Data:** Sneha Patil
- **Execution Steps:**
  1. Verify leave allocation balance.
  2. Verify payroll run payable days.
- **Expected Result (UI):** Leave allocation displays 1.5 days. Payroll displays 15 payable days.
- **Database Verification:** Coordinated proration across both modules.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-012: Punch Outside Geofence Followed by Correction Approval
- **Scenario:** Worker punches out of bounds (rejected) -> files regularisation with manager -> manager approves -> attendance marked PRESENT -> full pay in payroll.
- **Priority:** P1
- **User Role:** `employee` -> `location_manager` -> `payroll_admin`
- **Target URL / View:** `/portal` -> `/attendance` -> `/payroll`
- **Preconditions:** Worker was genuinely at offsite client meeting.
- **Test Data:** Punch rejected at 09:00.
- **Execution Steps:**
  1. Punch fails geofence check.
  2. Employee files regularisation: "Client meeting at vendor site".
  3. Location Manager approves.
  4. Daily record updates to PRESENT.
  5. Month-end payroll credits full payable day without LWP deduction.
- **Expected Result (UI):** Complete lifecycle resolves without manual payroll deduction.
- **Database Verification:** `attendance_corrections.status = 'APPROVED'`, `payroll_items.payable_days` includes the day.
- **Audit Verification:** Audit logs record both regularisation and approval.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-013: Department Deletion Reassigns Employees to Unassigned
- **Scenario:** Deleting "Supply Chain" department safely updates employee profiles to "Unassigned" without breaking attendance or payroll runs.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/departments`
- **Preconditions:** Supply Chain department exists with Vikram Rao assigned.
- **Test Data:** Department: Supply Chain
- **Execution Steps:**
  1. Delete Supply Chain department.
  2. Check Vikram Rao's profile.
  3. Check draft payroll run.
- **Expected Result (UI):** Department deleted; Vikram shows "Department: Unassigned". Payroll items still generate normally.
- **Database Verification:** `employees.department_id IS NULL`; foreign key cascade did NOT delete employee.
- **Audit Verification:** Audit log records `DEPARTMENT_DELETED`.
- **Cleanup / Teardown:** Reassign Vikram to Operations.
- **Status:** NOT RUN

---

### TC-INT-014: Cross-Tenant Direct API Barrier Check
- **Scenario:** Testing end-to-end multi-tenant isolation by chaining PostgREST requests across all 20 tables with mismatched `client_id`.
- **Priority:** P0
- **User Role:** `client_admin` (Attacker simulation)
- **Target URL / View:** PostgREST API
- **Preconditions:** Authenticated as Acme Admin.
- **Test Data:** Globex Client UUID
- **Execution Steps:**
  1. Loop through all 20 REST endpoints passing `client_id=eq.[Globex_UUID]`.
- **Expected Result (UI / API):** Every single endpoint returns HTTP 200 with empty array `[]` (SELECT) or HTTP 403 Forbidden (INSERT/UPDATE/DELETE). Zero data leaked or modified.
- **Database Verification:** PostgreSQL RLS policies evaluate successfully across all 20 tables.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-015: Overtime Multiplier Transition Across Shifts
- **Scenario:** Factory shift overtime (2.0x for night shift) calculates higher payout than general shift overtime (1.5x) for equal hours.
- **Priority:** P2
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Employee A on General Shift (1.5x OT), Employee B on Night Shift (2.0x OT). Both work 10 authorized OT hours.
- **Test Data:** Base Hourly: ₹100.00
- **Execution Steps:**
  1. Compare calculated OT pay between Employee A and B.
- **Expected Result (UI):** Employee A OT Pay: ₹1,500.00. Employee B OT Pay: ₹2,000.00.
- **Database Verification:** `payroll_items.overtime_pay` reflects policy multiplier.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-016: Employee Terminated Mid-Month Cannot Receive Leave Allocations
- **Scenario:** System blocks allocating new leave quotas to an employee who has been terminated.
- **Priority:** P2
- **User Role:** `hr_admin`
- **Target URL / View:** `/leaves/allocations`
- **Preconditions:** Rajesh Deshmukh is terminated.
- **Test Data:** Rajesh Deshmukh
- **Execution Steps:**
  1. Attempt to add leave quota for Rajesh.
- **Expected Result (UI):** Error alert: "Cannot modify leave allocations for terminated or inactive employee."
- **Database Verification:** Zero rows added to `leave_allocations`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-017: Location Manager Demoted While Approvals are Pending
- **Scenario:** Manager demoted to employee while regularisations are pending; requests remain pending and re-route to Client Admin.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/users` -> `/attendance/regularisations`
- **Preconditions:** Pune Manager has 2 pending regularisations; role demoted to employee.
- **Test Data:** Demote Pune Manager.
- **Execution Steps:**
  1. Demote user.
  2. Check regularisation list as Client Admin.
- **Expected Result (UI):** Requests remain pending. Former manager loses access. Client Admin can view and approve the orphaned requests.
- **Database Verification:** `attendance_corrections.status` remains `PENDING`.
- **Audit Verification:** Audit log records `ROLE_MODIFIED`.
- **Cleanup / Teardown:** Restore manager role.
- **Status:** NOT RUN

---

### TC-INT-018: Full & Final (FNF) Settlement Flag on Payroll Item
- **Scenario:** Terminated employee's payroll item is tagged with FNF badge; unspent leave encashment added.
- **Priority:** P1
- **User Role:** `payroll_admin`
- **Target URL / View:** `/payroll/runs/[id]`
- **Preconditions:** Rajesh Deshmukh exited Nov 20 with 5 unspent Earned Leave days.
- **Test Data:** Leave Encashment: 5 days * ₹1,666.67 = ₹8,333.35.
- **Execution Steps:**
  1. Calculate payroll run.
- **Expected Result (UI):** Rajesh's row shows "FNF Settlement". Additions breakdown includes "Leave Encashment: ₹8,333.35".
- **Database Verification:** `payroll_items.is_fnf = true`, `payroll_items.additions_breakdown` contains encashment.
- **Audit Verification:** Audit log records `FNF_ITEM_CALCULATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-019: Client Switcher Preserves Module Filter State
- **Scenario:** Super Admin switches from Acme to Globex and back; module filters (department, location) reset cleanly without state contamination.
- **Priority:** P1
- **User Role:** `super_admin`
- **Target URL / View:** Global Navigation
- **Preconditions:** Logged in as Super Admin.
- **Test Data:** Switch between Acme and Globex.
- **Execution Steps:**
  1. View Acme employees, filter by "Pune Plant 1".
  2. Switch active client to Globex Logistics.
  3. Inspect location dropdown.
- **Expected Result (UI):** Location dropdown immediately updates to Globex locations (Delhi, Gurgaon). Pune Plant is NOT present.
- **Database Verification:** UI state reset.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-020: Simultaneous Punch and Leave on Same Date Conflict Resolution
- **Scenario:** Employee has approved leave on Nov 25 but physically clocks in and works full shift at facility.
- **Priority:** P2
- **User Role:** `employee` & `hr_admin`
- **Target URL / View:** `/attendance/muster`
- **Preconditions:** Approved leave on Nov 25.
- **Test Data:** Check in at 09:00, Check out at 18:00.
- **Execution Steps:**
  1. Employee punches in and out on leave day.
  2. View attendance muster.
- **Expected Result (UI):** System flags conflict: "Punch Recorded on Approved Leave Day". HR prompt allows converting punch to PRESENT and restoring leave balance.
- **Database Verification:** Documented business rule handling.
- **Audit Verification:** Audit log records conflict resolution.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-021: Multi-Location Split-Day Shifts
- **Scenario:** Employee punches in at Mumbai HQ in morning and punches out at Pune Plant in evening.
- **Priority:** P3
- **User Role:** `employee`
- **Target URL / View:** `/portal`
- **Preconditions:** Employee allowed inter-site travel.
- **Test Data:** Check In: Mumbai HQ, Check Out: Pune Plant 1
- **Execution Steps:**
  1. Record check-in at Mumbai.
  2. Record check-out at Pune 6 hours later.
- **Expected Result (UI):** System accepts check-out: "Inter-Site Punch: Check-in at Mumbai HQ, Check-out at Pune Plant 1 (Duration: 6.0 hrs)".
- **Database Verification:** `attendance_events` captures respective location IDs.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Reset punches.
- **Status:** NOT RUN

---

### TC-INT-022: Mobile Responsive ESS Portal Experience
- **Scenario:** Frontline factory worker uses mobile viewport (375x812) to check in, view shifts, and download payslips.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal` on Mobile Screen Emulation
- **Preconditions:** Mobile viewport configured.
- **Test Data:** iPhone / Android resolution
- **Execution Steps:**
  1. Open ESS portal in mobile resolution.
  2. Test punch button, leave application form, and payslip preview.
- **Expected Result (UI):** Layout adapts cleanly; large touch-friendly punch button; no horizontal scrolling; modals fit screen.
- **Database Verification:** N/A.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-023: Historical Audit Trail Export on Client Investigation
- **Scenario:** Compliance auditor exports complete 6-month tamper-proof audit trail for Acme Corp.
- **Priority:** P2
- **User Role:** `super_admin`
- **Target URL / View:** `/audit-logs`
- **Preconditions:** Hundreds of audited events logged.
- **Test Data:** Client: Acme Corp, Range: Last 6 Months
- **Execution Steps:**
  1. Filter audit logs by Acme Corp.
  2. Click "Export Immutable Audit Log (CSV)".
- **Expected Result (UI):** Export downloads containing sequential log IDs, UTC timestamps, actor emails, IP addresses, action types, and payload changes.
- **Database Verification:** Matches `SELECT * FROM public.audit_logs WHERE client_id = [acme_id] ORDER BY created_at ASC;`.
- **Audit Verification:** Export event itself is logged.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-024: Concurrent Payroll Batch Calculation Lockout
- **Scenario:** Two Payroll Admins attempt to calculate the same payroll batch simultaneously; race condition prevented.
- **Priority:** P1
- **User Role:** `payroll_admin` (Concurrent sessions)
- **Target URL / View:** `/payroll/runs/new`
- **Preconditions:** Two browser sessions open on new run modal for same entity and month.
- **Test Data:** Acme Manufacturing, November 2026
- **Execution Steps:**
  1. Admin 1 clicks "Initialize Run".
  2. Admin 2 clicks "Initialize Run" 1 second later.
- **Expected Result (UI):** Admin 1 creates batch successfully. Admin 2 receives error: "A payroll run for this legal entity and period is already in progress or exists."
- **Database Verification:** Unique constraint `uq_payroll_run_grouping` prevents duplicate run rows.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-INT-025: End-to-End Test Suite Execution Benchmark
- **Scenario:** Running the full regression test runner across all services in staging.
- **Priority:** P0
- **User Role:** Antigravity Test Engine
- **Target URL / View:** CLI Runner (`scripts/testServices.ts`, `testPayroll*.ts`)
- **Preconditions:** Staging database seeded.
- **Test Data:** 11 regression test scripts.
- **Execution Steps:**
  1. Execute `npx tsx --env-file=.env scripts/testServices.ts`.
  2. Execute all 10 remaining domain test scripts.
- **Expected Result (UI / CLI):** Total 285/285 tests pass (100.0%). Zero unhandled exceptions. Zero failed assertions.
- **Database Verification:** Live database responds within normal latency (< 250ms per query).
- **Audit Verification:** Test runner activity logged.
- **Cleanup / Teardown:** Complete test state cleanly reset.
- **Status:** NOT RUN
