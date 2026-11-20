# AVENCIS WORKFORCE MANAGEMENT
## Document 12 — Suite C: Employee Master & Lifecycle Management Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 25  
**Priority Breakdown:** P0: 9 | P1: 11 | P2: 4 | P3: 1  
**Target Module:** 4-Step Onboarding Wizard, Employee Master, Salary Structures, Transfers, Terminations  

---

### TC-EMP-001: 4-Step Employee Onboarding Wizard (Complete Happy Path)
- **Scenario:** HR Admin completes full 4-step onboarding wizard with statutory validation.
- **Priority:** P0
- **User Role:** `hr_admin` (`hr.acme@avencis.test`)
- **Target URL / View:** `/employees` -> "Add Employee"
- **Preconditions:** Client Acme Corp active; legal entities, locations, and departments exist.
- **Test Data:**
  - *Step 1 (Personal):* First Name: "Kavita", Last Name: "Rane", DOB: "1994-08-15", Gender: "Female", Email: "kavita.rane@acme.test", Phone: "+919123456789", PAN: "ABCDE1234F", Aadhaar: "123456789012"
  - *Step 2 (Employment):* Code: "EMP-ACM-010", Entity: "Acme Manufacturing", Location: "Pune Plant 1", Dept: "Plant Operations", Designation: "Shift Engineer", Joining Date: "2026-11-01"
  - *Step 3 (Salary):* Basic: ₹25,000, HRA: ₹10,000, Special: ₹10,000 (Gross: ₹45,000)
  - *Step 4 (Bank/Statutory):* Bank: HDFC Bank, Acc: "50100123456789", IFSC: "HDFC0000123", UAN: "101234567890"
- **Execution Steps:**
  1. Click "Add Employee" on `/employees`.
  2. Complete Step 1 -> Click Next.
  3. Complete Step 2 -> Click Next.
  4. Complete Step 3 -> Click Next.
  5. Complete Step 4 -> Click "Submit & Onboard".
- **Expected Result (UI):** Toast "Employee Kavita Rane onboarded successfully". Redirects to profile; all 4 tabs populated.
- **Database Verification:**
  - `SELECT * FROM public.employees WHERE employee_code = 'EMP-ACM-010';`
  - `SELECT * FROM public.employee_salary_structures WHERE employee_id = (SELECT id FROM public.employees WHERE employee_code = 'EMP-ACM-010');`
  - `SELECT * FROM public.leave_allocations WHERE employee_id = (SELECT id FROM public.employees WHERE employee_code = 'EMP-ACM-010');` (Default leave quotas initialized).
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'EMPLOYEE_ONBOARDED';`
- **Cleanup / Teardown:** Delete test employee `EMP-ACM-010`.
- **Status:** NOT RUN

---

### TC-EMP-002: Duplicate Employee Code Validation
- **Scenario:** System blocks onboarding when employee code already exists within the tenant.
- **Priority:** P0
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Step 2
- **Preconditions:** Code `EMP-ACM-001` already assigned to Rahul Sharma.
- **Test Data:** Employee Code: `EMP-ACM-001`
- **Execution Steps:**
  1. Fill Step 1 and proceed to Step 2.
  2. Enter Code `EMP-ACM-001` and click Next.
- **Expected Result (UI):** Error alert: "Employee code 'EMP-ACM-001' is already in use for this organization."
- **Database Verification:** Unique constraint `uq_employee_client_code` prevents duplicate.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-003: Duplicate Corporate Email Validation
- **Scenario:** System blocks duplicate corporate email registration within client.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Step 1
- **Preconditions:** Email `emp.rahul@avencis.test` exists.
- **Test Data:** Work Email: `emp.rahul@avencis.test`
- **Execution Steps:**
  1. Enter `emp.rahul@avencis.test` in Step 1.
  2. Click Next.
- **Expected Result (UI):** Form validation error: "An employee with this work email already exists."
- **Database Verification:** Unique constraint `uq_employee_client_email` blocks duplicate.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-004: Invalid PAN Card Number Format
- **Scenario:** Enforcing standard Indian PAN structure (5 uppercase letters, 4 digits, 1 uppercase letter).
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Step 1
- **Preconditions:** Step 1 open.
- **Test Data:** Malformed PAN: `12345ABCDE` or `abcde1234f`
- **Execution Steps:**
  1. Enter `12345ABCDE` in PAN field.
  2. Attempt to proceed.
- **Expected Result (UI):** Validation flag: "Invalid PAN format. Example: ABCDE1234F".
- **Database Verification:** Client validation prevents commit.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-005: Invalid Aadhaar Number Format (12 Digits)
- **Scenario:** Validating that Aadhaar requires exactly 12 numeric digits.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Step 1
- **Preconditions:** Step 1 open.
- **Test Data:** Aadhaar: `12345` (5 digits) or `12345678901A` (alphanumeric)
- **Execution Steps:**
  1. Enter `12345` in Aadhaar.
- **Expected Result (UI):** Validation message: "Aadhaar number must be exactly 12 numeric digits".
- **Database Verification:** Prevented.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-006: Mandatory Organizational Hierarchy (Step 2)
- **Scenario:** Onboarding blocked if Location, Department, or Legal Entity is unassigned.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Step 2
- **Preconditions:** Step 2 open.
- **Test Data:** Missing Location and Department.
- **Execution Steps:**
  1. Leave Location and Department dropdowns unselected.
  2. Click Next.
- **Expected Result (UI):** Required field warnings on Work Location, Department, and Legal Entity.
- **Database Verification:** NOT NULL constraints on `work_location_id` and `legal_entity_id`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-007: Salary Structure Mathematical Consistency (Step 3)
- **Scenario:** Gross salary must equal or exceed Basic + Allowances; Basic must be >= 0.
- **Priority:** P0
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Step 3
- **Preconditions:** Step 3 open.
- **Test Data:** Basic: ₹30,000, Gross: ₹20,000 (Gross less than Basic)
- **Execution Steps:**
  1. Input Basic: 30,000, Gross: 20,000.
  2. Attempt to proceed.
- **Expected Result (UI):** Error banner: "Gross salary cannot be less than Basic Salary."
- **Database Verification:** Check constraint `chk_salary_gross_positive` prevents commit.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-008: Bank IFSC Code Validation (Step 4)
- **Scenario:** Validating Indian IFSC code structure (4 letters, digit 0, 6 alphanumeric).
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Step 4
- **Preconditions:** Step 4 open.
- **Test Data:** Invalid IFSC: `HDFC123`
- **Execution Steps:**
  1. Input IFSC: `HDFC123`.
- **Expected Result (UI):** Validation flag: "Invalid IFSC code format. Standard: ABCD0123456".
- **Database Verification:** Blocked.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-009: Edit Employee Demographic Details
- **Scenario:** Updating phone number, personal email, and residential address.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees/[id]` -> Edit Profile
- **Preconditions:** Employee Rahul Sharma exists.
- **Test Data:** New Phone: "+919888877777", Address: "Flat 402, Green Woods, Pune"
- **Execution Steps:**
  1. Open Rahul's profile, click Edit.
  2. Update Phone and Address.
  3. Save Changes.
- **Expected Result (UI):** Profile updates immediately with success toast.
- **Database Verification:** `SELECT phone, address FROM public.employees WHERE employee_code = 'EMP-ACM-001';`
- **Audit Verification:** Audit log records `EMPLOYEE_UPDATED`.
- **Cleanup / Teardown:** Revert to baseline.
- **Status:** NOT RUN

---

### TC-EMP-010: Employee Location Transfer
- **Scenario:** Transferring employee from Pune Plant 1 to Mumbai HQ; updates geofence scope.
- **Priority:** P0
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees/[id]` -> Transfer Modal
- **Preconditions:** Employee currently assigned to Pune.
- **Test Data:** New Location: "Mumbai Head Office", Effective Date: Today
- **Execution Steps:**
  1. Open Transfer modal on Rahul's profile.
  2. Select "Mumbai Head Office".
  3. Confirm transfer.
- **Expected Result (UI):** Profile badge shows "Location: Mumbai Head Office". Pune Location Manager can no longer approve punches.
- **Database Verification:** `SELECT work_location_id FROM public.employees WHERE employee_code = 'EMP-ACM-001';` (Matches Mumbai HQ UUID).
- **Audit Verification:** Audit log records `EMPLOYEE_TRANSFERRED`.
- **Cleanup / Teardown:** Transfer back to Pune Plant 1.
- **Status:** NOT RUN

---

### TC-EMP-011: Employee Department Transfer & Designation Promotion
- **Scenario:** Changing department and updating designation with promotion date.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees/[id]`
- **Preconditions:** Employee active in Operations.
- **Test Data:** New Dept: "Engineering", New Designation: "Senior Operations Lead"
- **Execution Steps:**
  1. Edit employee organizational mapping.
  2. Update Department and Designation.
  3. Save.
- **Expected Result (UI):** Profile updates to "Senior Operations Lead, Engineering".
- **Database Verification:** `SELECT department_id, designation FROM public.employees WHERE employee_code = 'EMP-ACM-001';`
- **Audit Verification:** Audit log records `EMPLOYEE_PROMOTION`.
- **Cleanup / Teardown:** Revert.
- **Status:** NOT RUN

---

### TC-EMP-012: Employee CTC Revision (Payroll Admin Action)
- **Scenario:** Payroll Admin updates salary structure following an annual appraisal.
- **Priority:** P0
- **User Role:** `payroll_admin` (`payroll.acme@avencis.test`)
- **Target URL / View:** `/employees/[id]` -> Salary Tab
- **Preconditions:** Rahul's current Gross is ₹35,000.
- **Test Data:** Revised Basic: ₹24,000, Revised Gross: ₹42,000, Effective Date: First of Month
- **Execution Steps:**
  1. Log in as Payroll Admin.
  2. Open Rahul's Salary tab and click "Revise CTC".
  3. Enter revised amounts and save.
- **Expected Result (UI):** Current salary shows ₹42,000/mo. Revision history logged.
- **Database Verification:** `SELECT gross_salary FROM public.employee_salary_structures WHERE employee_id = (SELECT id FROM public.employees WHERE employee_code = 'EMP-ACM-001');` (Returns 42000.00).
- **Audit Verification:** Audit log records `SALARY_STRUCTURE_REVISED`.
- **Cleanup / Teardown:** Revert to ₹35,000.
- **Status:** NOT RUN

---

### TC-EMP-013: Bank Account Details Privacy & Masking
- **Scenario:** Frontline managers and unauthorized staff see masked bank account numbers.
- **Priority:** P1
- **User Role:** `location_manager` (`mgr.pune@avencis.test`)
- **Target URL / View:** `/employees/[id]`
- **Preconditions:** Employee bank details exist.
- **Test Data:** Account: "50100123456789"
- **Execution Steps:**
  1. Log in as Location Manager and view Rahul's profile.
  2. Inspect Bank Account display.
- **Expected Result (UI):** Bank Account displays masked format: `•••• •••• •••• 6789` or bank tab hidden.
- **Database Verification:** Verified via UI presentation layer.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-014: Employee Resignation Lifecycle (Initiation & Notice Period)
- **Scenario:** HR Admin records employee resignation and schedules Last Working Day (LWD).
- **Priority:** P0
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees/[id]` -> Exit Management
- **Preconditions:** Employee active.
- **Test Data:** Exit Type: "Resignation", Resignation Date: Today, LWD: 30 days from today, Reason: "Career Growth"
- **Execution Steps:**
  1. Open Exit Management modal.
  2. Fill exit details and confirm.
- **Expected Result (UI):** Employee badge shows "Serving Notice Period" with LWD countdown banner.
- **Database Verification:** `SELECT status, exit_date FROM public.employees WHERE employee_code = 'EMP-ACM-001';` (Status remains active until LWD, exit_date recorded).
- **Audit Verification:** Audit log records `RESIGNATION_LOGGED`.
- **Cleanup / Teardown:** Clear exit date and status.
- **Status:** NOT RUN

---

### TC-EMP-015: Immediate Termination & Account Deactivation
- **Scenario:** Terminating an employee for cause with immediate access revocation.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/employees/[id]` -> Terminate
- **Preconditions:** Employee active.
- **Test Data:** Target: Rajesh Deshmukh (`EMP-ACM-006`), Type: "Termination", Date: Today
- **Execution Steps:**
  1. Open Terminate dialog, enter reason "Disciplinary Action", confirm.
- **Expected Result (UI):** Status turns red "Terminated / Inactive".
- **Database Verification:** `SELECT status, is_active FROM public.employees WHERE employee_code = 'EMP-ACM-006';` (status = 'terminated', is_active = false).
- **Audit Verification:** Audit log records `EMPLOYEE_TERMINATED`.
- **Cleanup / Teardown:** Reset status for testing.
- **Status:** NOT RUN

---

### TC-EMP-016: Block Attendance Punches for Inactive/Terminated Employee
- **Scenario:** Terminated employee cannot log attendance punches.
- **Priority:** P0
- **User Role:** `employee` (Terminated persona)
- **Target URL / View:** `/portal`
- **Preconditions:** Employee status is 'terminated'.
- **Test Data:** Terminated employee.
- **Execution Steps:**
  1. Attempt to submit punch via ESS or direct API `POST /rest/v1/attendance_events`.
- **Expected Result (UI):** System blocks punch: "Account inactive: Attendance logging disabled." API returns 403.
- **Database Verification:** Zero new rows in `attendance_events`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-017: Rehire / Reactivate Former Employee
- **Scenario:** Reactivating a former employee with new joining date.
- **Priority:** P2
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> Inactive Filter
- **Preconditions:** Former employee in inactive state.
- **Test Data:** Target: `EMP-ACM-006`, New Joining Date: Today
- **Execution Steps:**
  1. Filter by Inactive employees, find record.
  2. Click "Rehire Employee", enter new joining date, confirm.
- **Expected Result (UI):** Status returns to green "Active"; attendance logging re-enabled.
- **Database Verification:** `status = 'active', is_active = true`.
- **Audit Verification:** Audit log records `EMPLOYEE_REHIRED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-018: Employee Directory Search & Multi-Field Filtering
- **Scenario:** Searching employee list by code, name, designation, department, and location.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees`
- **Preconditions:** 8+ employees exist.
- **Test Data:** Search: "Rahul", Department Filter: "Operations"
- **Execution Steps:**
  1. Apply Department filter "Plant Operations".
  2. Type "Rahul" in search bar.
- **Expected Result (UI):** Exactly 1 matching employee card/row returned.
- **Database Verification:** UI state filtering.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Reset filters.
- **Status:** NOT RUN

---

### TC-EMP-019: Cross-Tenant Employee Directory Isolation
- **Scenario:** Acme HR Admin cannot view Globex Logistics employees.
- **Priority:** P0
- **User Role:** `hr_admin` (`hr.acme@avencis.test`)
- **Target URL / View:** Direct PostgREST query: `/rest/v1/employees?client_id=eq.[Globex_UUID]`
- **Preconditions:** Both tenants have employees.
- **Test Data:** Globex Client UUID
- **Execution Steps:**
  1. Execute REST GET query with Globex client ID.
- **Expected Result (UI):** HTTP 200 with empty array `[]`.
- **Database Verification:** RLS policy `client_admin_tenant` strictly isolates rows.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-020: Employee Leave Allocation Initialization
- **Scenario:** Onboarding an employee automatically seeds default leave quotas in `leave_allocations`.
- **Priority:** P0
- **User Role:** Automated Service / DB Trigger
- **Target URL / View:** `/employees/[id]` -> Leave Balances Tab
- **Preconditions:** Newly onboarded employee.
- **Test Data:** Employee `EMP-ACM-010`
- **Execution Steps:**
  1. Open Leave Balances tab on newly created employee.
- **Expected Result (UI):** Balances display Casual Leave (12), Sick Leave (12), Earned Leave (15).
- **Database Verification:** `SELECT * FROM public.leave_allocations WHERE employee_id = (SELECT id FROM public.employees WHERE employee_code = 'EMP-ACM-010');` (Returns 3 rows).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-021: Bulk Employee CSV Import Validation
- **Scenario:** Validating bulk import file for required columns and format correctness.
- **Priority:** P2
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees` -> "Import Employees"
- **Preconditions:** Valid and invalid CSV templates prepared.
- **Test Data:** `employees_invalid.csv` (Missing PAN on row 3)
- **Execution Steps:**
  1. Upload `employees_invalid.csv`.
  2. Click "Validate File".
- **Expected Result (UI):** Error table identifies row 3: "Missing mandatory PAN field". Import aborted; 0 rows committed.
- **Database Verification:** Zero new records inserted.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-022: Export Employee Master to CSV
- **Scenario:** HR Admin exports sanitized employee roster to CSV.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees`
- **Preconditions:** Employees exist.
- **Test Data:** Export command
- **Execution Steps:**
  1. Click "Export CSV".
  2. Verify downloaded file contents.
- **Expected Result (UI):** CSV file downloads with headers: Code, Name, Email, Dept, Location, Status. Salary CTC is omitted if HR Admin exports.
- **Database Verification:** Data matches active tenant employee rows.
- **Audit Verification:** Audit log records `EMPLOYEE_ROSTER_EXPORTED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-023: Mid-Month Joiner Flag & Pro-Rata Configuration
- **Scenario:** Employee joining on 16th of month correctly records partial month status.
- **Priority:** P1
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees`
- **Preconditions:** Employee onboarded with joining date: 16th.
- **Test Data:** Sneha Patil (`EMP-ACM-002`), Joining Date: 2026-11-16
- **Execution Steps:**
  1. Verify profile reflects joining date 2026-11-16.
- **Expected Result (UI):** Profile displays: "Joined Nov 16, 2026 (Active)".
- **Database Verification:** `SELECT joining_date FROM public.employees WHERE employee_code = 'EMP-ACM-002';`
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-024: Delete Employee with Attendance History (FK Restriction)
- **Scenario:** System blocks deleting an employee who has attendance or payroll history.
- **Priority:** P0
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees/[id]`
- **Preconditions:** Rahul Sharma has punch events.
- **Test Data:** Rahul Sharma
- **Execution Steps:**
  1. Attempt to execute hard delete on Rahul Sharma.
- **Expected Result (UI):** Error alert: "Cannot delete employee: active attendance and muster records exist. Use Termination / Resignation instead."
- **Database Verification:** Foreign key `RESTRICT` on `attendance_events.employee_id` blocks delete.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-EMP-025: Employee Profile Picture Upload
- **Scenario:** Uploading avatar image to employee profile.
- **Priority:** P3
- **User Role:** `hr_admin`
- **Target URL / View:** `/employees/[id]`
- **Preconditions:** Storage bucket active.
- **Test Data:** Image: `avatar.jpg` (JPEG, 120 KB)
- **Execution Steps:**
  1. Click avatar upload on profile.
  2. Select `avatar.jpg` and save.
- **Expected Result (UI):** Profile header updates with new avatar photo.
- **Database Verification:** `SELECT avatar_url FROM public.employees WHERE employee_code = 'EMP-ACM-001';`
- **Audit Verification:** None.
- **Cleanup / Teardown:** Reset avatar.
- **Status:** NOT RUN
