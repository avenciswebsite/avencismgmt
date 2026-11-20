# AVENCIS WORKFORCE MANAGEMENT
## Document 13 — Suites D & E: Attendance Tracking, Geofencing & Policies Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 35 (Suite D: 15 Scenarios | Suite E: 20 Scenarios)  
**Priority Breakdown:** P0: 13 | P1: 15 | P2: 6 | P3: 1  
**Target Module:** Work Locations, Geofencing, Shifts, Attendance Policies, Punches, Exceptions, Regularisations  

---

## PART 1 — SUITE D: Work Locations, Geofencing & Shift Policies (15 Scenarios)

### TC-ATT-001: Standard Shift Attendance Policy Creation
- **Scenario:** Client Admin creates standard 9-hour corporate attendance policy with 15-minute grace period.
- **Priority:** P0
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** `/settings/attendance-policies`
- **Preconditions:** Client Acme Corp active.
- **Test Data:** Policy Name: "Acme General Corporate Shift", Start: "09:00", End: "18:00", Grace: 15 min, Half-Day: 4.0 hrs, Full-Day: 8.0 hrs, OT Mode: "Authorized Only"
- **Execution Steps:**
  1. Navigate to `/settings/attendance-policies` -> "Add Policy".
  2. Input Shift Times (09:00 - 18:00), Grace Period (15), Minimum Half-Day (4h), Full-Day (8h).
  3. Select Overtime Mode "Authorized Only".
  4. Save Policy.
- **Expected Result (UI):** Policy appears in table with "Active" badge and shift summary.
- **Database Verification:** `SELECT * FROM public.attendance_policies WHERE policy_name = 'Acme General Corporate Shift';`
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'ATTENDANCE_POLICY_CREATED';`
- **Cleanup / Teardown:** Handled in suite teardown.
- **Status:** NOT RUN

---

### TC-ATT-002: Factory Early Morning Shift Policy Creation
- **Scenario:** Creating rotating plant shift policy (06:00 - 14:00) with strict 10-minute grace period.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/attendance-policies`
- **Preconditions:** Client active.
- **Test Data:** Policy Name: "Pune Plant Shift A", Start: "06:00", End: "14:00", Grace: 10 min, Half-Day: 4.0 hrs, Full-Day: 8.0 hrs
- **Execution Steps:**
  1. Click "Add Policy", enter Plant Shift A parameters.
  2. Save.
- **Expected Result (UI):** Plant Shift A created successfully.
- **Database Verification:** `SELECT shift_start_time, grace_period_minutes FROM public.attendance_policies WHERE policy_name = 'Pune Plant Shift A';`
- **Audit Verification:** Audit log records `ATTENDANCE_POLICY_CREATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-003: Overtime Policy Enforcement (Authorized Overtime Only)
- **Scenario:** Verifying system rejects raw unapproved attendance hours as payable overtime.
- **Priority:** P0
- **User Role:** Automated Policy Engine / `payroll_admin`
- **Target URL / View:** `/attendance/summary`
- **Preconditions:** Employee clocked 10.5 hours (2.5h beyond 8h shift) but has no manager authorization.
- **Test Data:** Employee: Rahul Sharma, Raw Hours: 10.5h
- **Execution Steps:**
  1. View Attendance Summary for the day.
  2. Check Payable Overtime Hours.
- **Expected Result (UI):** Display shows: "Logged Hours: 10.5h | Regular Hours: 8.0h | Authorized OT: 0.0h | Status: Pending Authorization".
- **Database Verification:** `overtime_hours` in `daily_attendance_records` remains 0.00 until approved.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-004: Weekly Off Configuration (Saturday / Sunday Rules)
- **Scenario:** Defining weekly rest days (e.g., 2nd & 4th Saturday off, all Sundays off).
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/attendance-policies`
- **Preconditions:** Policy open for edit.
- **Test Data:** Weekly Offs: Sunday (All), Saturday (2nd and 4th)
- **Execution Steps:**
  1. In Policy configuration, check "All Sundays" and select "2nd & 4th Saturday".
  2. Save Policy.
- **Expected Result (UI):** Attendance calendar marks Sundays and designated Saturdays as "WEEK_OFF".
- **Database Verification:** `weekly_offs` JSON column updated in `attendance_policies`.
- **Audit Verification:** Audit log records `POLICY_UPDATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-005: Geofence Validation: Mobile Punch Inside Radius
- **Scenario:** Employee punches in from coordinates exactly 30 meters from location center (Radius: 250m).
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal` -> Punch In
- **Preconditions:** Pune Plant 1 center: (18.5204, 73.8567), Radius: 250m.
- **Test Data:** Current Device GPS: Lat 18.5205, Lng 73.8568 (Distance: ~15 meters)
- **Execution Steps:**
  1. Log in to ESS Portal as Rahul Sharma.
  2. Click "Punch In".
  3. Browser provides device coordinates.
- **Expected Result (UI):** Toast "Punch In Successful at 08:55 AM (Pune Plant 1)". Green checkmark badge displayed.
- **Database Verification:** `SELECT * FROM public.attendance_events WHERE employee_id = (SELECT id FROM public.employees WHERE employee_code = 'EMP-ACM-001') ORDER BY event_time DESC LIMIT 1;` (event_type = 'check_in', status = 'valid').
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Reset test attendance events.
- **Status:** NOT RUN

---

### TC-ATT-006: Geofence Violation: Mobile Punch Outside Radius
- **Scenario:** Employee attempts to punch in from home, 3.5 kilometers away from location center.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal` -> Punch In
- **Preconditions:** Pune Plant 1 radius: 250m.
- **Test Data:** Simulated GPS: Lat 18.5500, Lng 73.8900 (Distance: ~4.5 km)
- **Execution Steps:**
  1. Click "Punch In" while device coordinates are outside radius.
- **Expected Result (UI):** Error modal: "Geofence Violation: You are 4.5 km away from your assigned work location (Pune Plant 1). Punch rejected."
- **Database Verification:** Zero rows inserted in `attendance_events` or event flagged as `out_of_bounds`.
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'GEOFENCE_VIOLATION_REJECTED';`
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-007: Multiple Work Locations Geofence Resolution
- **Scenario:** Employee assigned to Bangalore Hub punches at Bangalore coordinates; Pune coordinates reject.
- **Priority:** P1
- **User Role:** `employee` (Vikram Rao, `EMP-ACM-004`)
- **Target URL / View:** `/portal`
- **Preconditions:** Vikram assigned to Bangalore Hub (Lat 12.9716, Lng 77.5946).
- **Test Data:** Device GPS: Lat 12.9718, Lng 77.5948
- **Execution Steps:**
  1. Vikram clicks Punch In.
- **Expected Result (UI):** Punch accepted for "Bangalore Logistics Center".
- **Database Verification:** `attendance_events` links punch to Bangalore location ID.
- **Audit Verification:** None.
- **Cleanup / Teardown:** Reset punch.
- **Status:** NOT RUN

---

### TC-ATT-008: Policy Assignment: Link Policy to Location
- **Scenario:** Linking "Pune Plant Shift A" policy specifically to "Pune Plant 1" facility.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/work-locations`
- **Preconditions:** Policy and Location exist.
- **Test Data:** Location: Pune Plant 1, Policy: Pune Plant Shift A
- **Execution Steps:**
  1. Edit Pune Plant 1.
  2. Select Default Attendance Policy "Pune Plant Shift A".
  3. Save.
- **Expected Result (UI):** Location card displays "Shift: Pune Plant Shift A (06:00 - 14:00)".
- **Database Verification:** `SELECT attendance_policy_id FROM public.work_locations WHERE location_code = 'LOC-PUN';`
- **Audit Verification:** Audit log records `LOCATION_POLICY_MAPPED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-009: Half-Day Cutoff Threshold Enforcement
- **Scenario:** Employee working 3 hours 45 minutes falls below 4.0-hour half-day threshold.
- **Priority:** P1
- **User Role:** Automated Daily Attendance Engine
- **Target URL / View:** `/attendance/daily-records`
- **Preconditions:** Policy requires 4.0 hours for half-day, 8.0 hours for full-day.
- **Test Data:** Check In: 09:00, Check Out: 12:45 (Total: 3.75 hrs)
- **Execution Steps:**
  1. System processes punch-out at 12:45.
  2. Check daily record status.
- **Expected Result (UI):** Status marked as "SHORT_HOURS / ABSENT" (less than 4 hours).
- **Database Verification:** `SELECT status, total_hours FROM public.daily_attendance_records WHERE employee_id = [id] AND work_date = CURRENT_DATE;` (status != 'HALF_DAY').
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-010: Half-Day Attendance Status (4 to 8 Hours)
- **Scenario:** Employee working 5 hours 15 minutes marked as HALF_DAY.
- **Priority:** P1
- **User Role:** Automated Daily Attendance Engine
- **Target URL / View:** `/attendance/daily-records`
- **Preconditions:** Policy active.
- **Test Data:** Check In: 09:00, Check Out: 14:15 (Total: 5.25 hrs)
- **Execution Steps:**
  1. Process punch-out at 14:15.
- **Expected Result (UI):** Status badge shows yellow "HALF_DAY (5.25 hrs)".
- **Database Verification:** `status = 'HALF_DAY'`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-011: Shift Full-Day Status (>= 8.0 Hours)
- **Scenario:** Employee working 8 hours 30 minutes marked as PRESENT.
- **Priority:** P0
- **User Role:** Automated Daily Attendance Engine
- **Target URL / View:** `/attendance/daily-records`
- **Preconditions:** Check In: 09:00, Check Out: 17:30.
- **Test Data:** Total Duration: 8.5 hrs
- **Execution Steps:**
  1. Process punch-out.
- **Expected Result (UI):** Status badge shows green "PRESENT (8.5 hrs)".
- **Database Verification:** `status = 'PRESENT', total_hours = 8.50`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-012: Grace Period Arrival (Within 15 Minutes)
- **Scenario:** Shift starts at 09:00; employee punches in at 09:12 (within 15m grace).
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal`
- **Preconditions:** Shift 09:00, Grace 15m.
- **Test Data:** Punch Time: 09:12 AM
- **Execution Steps:**
  1. Record check-in at 09:12 AM.
- **Expected Result (UI):** Status marked "PRESENT", Late Flag: `false` ("On Time - In Grace").
- **Database Verification:** `is_late = false, late_minutes = 0`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-013: Late Arrival Beyond Grace Period
- **Scenario:** Shift starts at 09:00; employee punches in at 09:28 (13 minutes past grace).
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal`
- **Preconditions:** Shift 09:00, Grace 15m.
- **Test Data:** Punch Time: 09:28 AM
- **Execution Steps:**
  1. Record check-in at 09:28 AM.
- **Expected Result (UI):** Status badge displays "PRESENT (Late: 28 min)". Orange indicator displayed.
- **Database Verification:** `is_late = true, late_minutes = 28`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-014: Edit Existing Attendance Policy
- **Scenario:** Updating shift end time from 18:00 to 18:30 on general corporate policy.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/attendance-policies`
- **Preconditions:** Policy exists.
- **Test Data:** New End Time: "18:30"
- **Execution Steps:**
  1. Edit Policy, update End Time to 18:30, Save.
- **Expected Result (UI):** Policy table updates shift to 09:00 - 18:30.
- **Database Verification:** `SELECT shift_end_time FROM public.attendance_policies WHERE policy_name = 'Acme General Corporate Shift';` (Returns '18:30:00').
- **Audit Verification:** Audit log records `ATTENDANCE_POLICY_UPDATED`.
- **Cleanup / Teardown:** Revert.
- **Status:** NOT RUN

---

### TC-ATT-015: Delete Attendance Policy with Active Locations
- **Scenario:** System blocks deleting a policy that is currently assigned to active facilities.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/attendance-policies`
- **Preconditions:** Policy assigned to Pune Plant 1.
- **Test Data:** Target Policy: Pune Plant Shift A
- **Execution Steps:**
  1. Attempt to delete policy.
- **Expected Result (UI):** Error banner: "Cannot delete policy: assigned to 1 work location. Reassign location policy first."
- **Database Verification:** Prevented by foreign key `RESTRICT`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

## PART 2 — SUITE E: Attendance Tracking, Punches & Corrections (20 Scenarios)

### TC-ATT-016: Duplicate Punch Anti-Bounce Guard (< 60 Seconds)
- **Scenario:** Rapid double-clicking on "Punch In" does NOT create duplicate punch records.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal`
- **Preconditions:** ESS Portal open.
- **Test Data:** Two punch clicks 2 seconds apart.
- **Execution Steps:**
  1. Click "Punch In".
  2. Immediately click "Punch In" again within 2 seconds.
- **Expected Result (UI):** Button disables immediately on first click ("Processing..."). Only 1 toast appears.
- **Database Verification:** `SELECT COUNT(*) FROM public.attendance_events WHERE employee_id = [id] AND event_time >= NOW() - INTERVAL '1 minute';` (Returns exactly 1).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Clear event.
- **Status:** NOT RUN

---

### TC-ATT-017: Same-Day Punch-Out without Prior Punch-In
- **Scenario:** Employee clicks "Punch Out" when no check-in event exists for the current day.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal`
- **Preconditions:** Zero punch events today.
- **Test Data:** Punch Out action.
- **Execution Steps:**
  1. Attempt to click "Punch Out" (or submit API check_out event).
- **Expected Result (UI):** "Punch Out" button is disabled; only "Punch In" is active. Direct API returns error: "Cannot check out without an active check-in today."
- **Database Verification:** Zero rows committed.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-018: Second Punch-Out in Same Day (Overwrites / Updates Last Exit)
- **Scenario:** Employee punches out for lunch, returns, and punches out again at final shift end.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal`
- **Preconditions:** Employee punched in at 09:00, punched out at 13:00, punched in at 14:00.
- **Test Data:** Final Punch Out at 18:00
- **Execution Steps:**
  1. Record punch out at 18:00.
- **Expected Result (UI):** Daily record updates total hours to reflect net work duration.
- **Database Verification:** `daily_attendance_records.check_out_time` reflects 18:00; `total_hours` calculated correctly.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Reset punches.
- **Status:** NOT RUN

---

### TC-ATT-019: Attendance Immutability Guard: Reject UPDATE on `attendance_events`
- **Scenario:** Directly attempting to update a raw punch timestamp via SQL or API is aborted by trigger.
- **Priority:** P0
- **User Role:** Direct PostgREST / SQL
- **Target URL / View:** PostgreSQL Schema
- **Preconditions:** Raw punch event exists with ID `[event_uuid]`.
- **Test Data:** `UPDATE public.attendance_events SET event_time = NOW() WHERE id = '[event_uuid]';`
- **Execution Steps:**
  1. Execute UPDATE query against `attendance_events`.
- **Expected Result (UI / API):** Error raised: `guard_immutable_attendance_events(): Raw attendance events are immutable. File an attendance correction instead.` Transaction rolled back.
- **Database Verification:** `event_time` remains completely unchanged.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-020: Attendance Immutability Guard: Reject DELETE on `attendance_events`
- **Scenario:** Directly attempting to delete a raw punch event is aborted by trigger.
- **Priority:** P0
- **User Role:** Direct PostgREST / SQL
- **Target URL / View:** PostgreSQL Schema
- **Preconditions:** Punch event exists.
- **Test Data:** `DELETE FROM public.attendance_events WHERE id = '[event_uuid]';`
- **Execution Steps:**
  1. Execute DELETE query against `attendance_events`.
- **Expected Result (UI / API):** Exception raised; delete aborted.
- **Database Verification:** Row still exists.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-021: Employee Submits Missed Punch Regularisation
- **Scenario:** Employee forgot to punch out yesterday; files correction request with reason.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal/regularisations`
- **Preconditions:** Yesterday's record has check-in at 09:00 but NULL check-out.
- **Test Data:** Date: Yesterday, Proposed Check-Out: 18:00, Reason: "Site biometric terminal offline"
- **Execution Steps:**
  1. Open Regularisations tab, click "Request Regularisation".
  2. Select Yesterday, input Out Time 18:00, enter Reason.
  3. Submit.
- **Expected Result (UI):** Toast "Regularisation submitted for manager approval". Status shows "PENDING".
- **Database Verification:** `SELECT * FROM public.attendance_corrections WHERE employee_id = [id] AND status = 'PENDING';`
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'REGULARISATION_REQUESTED';`
- **Cleanup / Teardown:** Reset correction.
- **Status:** NOT RUN

---

### TC-ATT-022: Location Manager Approves Attendance Regularisation
- **Scenario:** Pune Location Manager approves Rahul's pending regularisation request.
- **Priority:** P0
- **User Role:** `location_manager` (`mgr.pune@avencis.test`)
- **Target URL / View:** `/attendance/regularisations`
- **Preconditions:** Pending correction exists for Rahul (Pune Plant).
- **Test Data:** Target Correction ID
- **Execution Steps:**
  1. Log in as Pune Location Manager.
  2. Navigate to Regularisations list.
  3. Click "Approve" on Rahul's request.
- **Expected Result (UI):** Status updates to "APPROVED". Daily attendance record for yesterday recalculates to PRESENT (9.0 hrs).
- **Database Verification:**
  - `attendance_corrections.status = 'APPROVED'`
  - `daily_attendance_records.check_out_time = '18:00:00'`
  - `daily_attendance_records.status = 'PRESENT'`
- **Audit Verification:** Audit log records `REGULARISATION_APPROVED`.
- **Cleanup / Teardown:** Revert.
- **Status:** NOT RUN

---

### TC-ATT-023: Location Manager Rejects Attendance Regularisation
- **Scenario:** Manager rejects correction request due to unverified claim.
- **Priority:** P1
- **User Role:** `location_manager`
- **Target URL / View:** `/attendance/regularisations`
- **Preconditions:** Pending correction exists.
- **Test Data:** Rejection Reason: "No supervisor confirmation of presence"
- **Execution Steps:**
  1. Click "Reject", enter reason, confirm.
- **Expected Result (UI):** Status updates to "REJECTED". Daily attendance record remains MISSED_PUNCH / ABSENT.
- **Database Verification:** `attendance_corrections.status = 'REJECTED'`. Daily record unaltered.
- **Audit Verification:** Audit log records `REGULARISATION_REJECTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-024: Anti-Self-Approval Defense for Regularisations
- **Scenario:** A manager who is also an employee cannot approve their own regularisation request.
- **Priority:** P0
- **User Role:** `location_manager` acting on own employee request
- **Target URL / View:** `/attendance/regularisations`
- **Preconditions:** Pune Manager submits regularisation for themselves.
- **Test Data:** Own regularisation request.
- **Execution Steps:**
  1. View pending approvals list.
  2. Find own regularisation request.
- **Expected Result (UI):** Approve / Reject buttons are disabled on own row with tooltip: "Self-approval is prohibited. Request must be approved by Client Admin or HR." Direct API call returns 403.
- **Database Verification:** Business logic check `approver_id != employee_id`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-025: Cross-Location Regularisation Approval Prevention
- **Scenario:** Pune Location Manager cannot view or approve regularisations for Mumbai employees.
- **Priority:** P0
- **User Role:** `location_manager` (`mgr.pune@avencis.test`)
- **Target URL / View:** Direct PostgREST query on `attendance_corrections`
- **Preconditions:** Sneha Patil (Mumbai) has a pending regularisation.
- **Test Data:** Sneha's Correction UUID
- **Execution Steps:**
  1. Pune Manager sends `PATCH /rest/v1/attendance_corrections?id=eq.[Sneha_Correction_UUID]` with `status: "APPROVED"`.
- **Expected Result (UI / API):** HTTP 403 Forbidden or returns 0 rows updated (RLS policy scoping).
- **Database Verification:** Sneha's correction remains `PENDING`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-026: Automatic Daily Absence Marking (Nightly Job)
- **Scenario:** Nightly job marks employees with 0 punches and no approved leave as ABSENT.
- **Priority:** P0
- **User Role:** Automated System Scheduler
- **Target URL / View:** `/attendance/muster`
- **Preconditions:** Amit Kumar had no punches today and no leave request.
- **Test Data:** Date: Today
- **Execution Steps:**
  1. Trigger end-of-day muster consolidation job.
  2. Inspect Amit Kumar's daily record.
- **Expected Result (UI):** Muster roll displays red "A (ABSENT)" for Amit.
- **Database Verification:** `SELECT status FROM public.daily_attendance_records WHERE employee_id = (SELECT id FROM public.employees WHERE employee_code = 'EMP-ACM-003') AND work_date = CURRENT_DATE;` (Returns 'ABSENT').
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-027: Statutory Holiday Auto-Population in Muster Roll
- **Scenario:** Scheduled statutory holiday (e.g. Republic Day) auto-marks all employees as HOLIDAY.
- **Priority:** P1
- **User Role:** Automated System Engine
- **Target URL / View:** `/attendance/muster`
- **Preconditions:** Holiday calendar has January 26 configured as "Republic Day".
- **Test Data:** Date: January 26
- **Execution Steps:**
  1. View muster roll for January 26.
- **Expected Result (UI):** All employees display blue "H (HOLIDAY)" badge; marked as paid holiday.
- **Database Verification:** `daily_attendance_records.status = 'HOLIDAY'`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-028: Punch on Statutory Holiday (Holiday Overtime Eligibility)
- **Scenario:** Employee punches in and works 8 hours on a designated statutory holiday.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal`
- **Preconditions:** Today is a configured holiday.
- **Test Data:** Punches at 09:00 and 17:00.
- **Execution Steps:**
  1. Employee punches in and out on holiday.
- **Expected Result (UI):** Status displays "HOLIDAY_WORKED (8.0 hrs)". Flagged for Holiday Overtime compensation.
- **Database Verification:** `daily_attendance_records.status = 'HOLIDAY_WORKED'`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-029: Monthly Muster Roll Matrix Grid Rendering
- **Scenario:** Monthly muster grid displays all 30/31 days with color-coded status badges for all employees.
- **Priority:** P1
- **User Role:** `hr_admin` (`hr.acme@avencis.test`)
- **Target URL / View:** `/attendance/muster`
- **Preconditions:** 8 employees have attendance records for November 2026.
- **Test Data:** Month: November 2026
- **Execution Steps:**
  1. Navigate to `/attendance/muster`, select Month: November 2026.
- **Expected Result (UI):** Grid renders employee rows against day columns (1 to 30) with P, A, HD, L, H, WO badges and summary totals.
- **Database Verification:** Aggregates match count of records in `daily_attendance_records`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-030: Filter Muster Roll by Work Location
- **Scenario:** Filtering monthly muster roll to display only Pune Plant 1 workers.
- **Priority:** P2
- **User Role:** `hr_admin`
- **Target URL / View:** `/attendance/muster`
- **Preconditions:** Multi-location records exist.
- **Test Data:** Filter: "Pune Plant 1"
- **Execution Steps:**
  1. Select Location dropdown -> "Pune Plant 1".
- **Expected Result (UI):** Grid filters immediately to show only the 5 Pune employees.
- **Database Verification:** UI state filtering.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Reset filter.
- **Status:** NOT RUN

---

### TC-ATT-031: Export Monthly Attendance Muster to CSV
- **Scenario:** HR Admin exports monthly muster roll matrix to CSV.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/attendance/muster`
- **Preconditions:** Muster populated.
- **Test Data:** Export command
- **Execution Steps:**
  1. Click "Export Muster CSV".
  2. Inspect downloaded file.
- **Expected Result (UI):** CSV file downloads containing Employee Code, Name, Department, Days 1-30, Total Present, Total Absent, Total Payable Days.
- **Database Verification:** Data aligns with DB records.
- **Audit Verification:** Audit log records `MUSTER_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-032: Authorized Overtime Hours Entry by Supervisor
- **Scenario:** Location Manager explicitly authorizes 4 hours overtime for an employee's extended shift.
- **Priority:** P0
- **User Role:** `location_manager` (`mgr.pune@avencis.test`)
- **Target URL / View:** `/attendance/overtime-approvals`
- **Preconditions:** Pooja Nair worked 12 hours on shift.
- **Test Data:** Employee: Pooja Nair, Authorized OT: 4.0 hours, Reason: "Emergency boiler repair"
- **Execution Steps:**
  1. Open Overtime Approvals tab.
  2. Enter 4.0 hours for Pooja Nair, input justification, click "Authorize".
- **Expected Result (UI):** Toast "Overtime authorized successfully". Row shows "Authorized OT: 4.0 hrs".
- **Database Verification:** `SELECT overtime_hours FROM public.daily_attendance_records WHERE employee_id = (SELECT id FROM public.employees WHERE employee_code = 'EMP-ACM-005') AND work_date = CURRENT_DATE;` (Returns 4.00).
- **Audit Verification:** Audit log records `OVERTIME_AUTHORIZED`.
- **Cleanup / Teardown:** Reset OT hours.
- **Status:** NOT RUN

---

### TC-ATT-033: Reject Overtime Authorization
- **Scenario:** Manager rejects unapproved stay past shift end.
- **Priority:** P1
- **User Role:** `location_manager`
- **Target URL / View:** `/attendance/overtime-approvals`
- **Preconditions:** Extended hours logged without authorization.
- **Test Data:** Action: Reject OT
- **Execution Steps:**
  1. Click "Reject OT", enter reason "Personal stay, no work assigned".
- **Expected Result (UI):** OT authorized hours set to 0.0h; regular 8.0h recorded.
- **Database Verification:** `overtime_hours = 0.00`.
- **Audit Verification:** Audit log records `OVERTIME_REJECTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-034: Future Date Punch Prevention
- **Scenario:** System blocks punching or filing regularisations for future calendar dates.
- **Priority:** P1
- **User Role:** `employee`
- **Target URL / View:** `/portal/regularisations`
- **Preconditions:** Regularisation modal open.
- **Test Data:** Date: Tomorrow
- **Execution Steps:**
  1. Attempt to select tomorrow's date in calendar picker.
- **Expected Result (UI):** Future dates are greyed out and unclickable in the date picker.
- **Database Verification:** Check constraint `chk_punch_no_future` prevents date > CURRENT_DATE.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-ATT-035: Attendance Dashboard Real-Time Metrics
- **Scenario:** Verifying live counts: Total Scheduled, Present Today, Absent, Late Arrivals, On Leave.
- **Priority:** P2
- **User Role:** `client_admin` / `hr_admin`
- **Target URL / View:** `/attendance`
- **Preconditions:** Mix of present, absent, and on-leave employees today.
- **Test Data:** 8 employees total (5 present, 2 absent, 1 on leave)
- **Execution Steps:**
  1. Navigate to `/attendance` dashboard.
- **Expected Result (UI):** Stat cards display: Total: 8, Present: 5 (62.5%), Absent: 2, On Leave: 1.
- **Database Verification:** Matches real-time query on `daily_attendance_records`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN
