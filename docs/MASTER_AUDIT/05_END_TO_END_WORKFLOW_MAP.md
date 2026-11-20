# AVENCIS WORKFORCE MANAGEMENT
## Document 05 — End-to-End Workflow Architecture Map

**Status:** Complete Specification  
**Date:** 2026-11-16  
**Auditor:** Antigravity Engineering & Product Architecture Team  
**Scope:** 20 Core Cross-Module Business Workflows, State Transition Models, Actor Responsibilities, and Failure Handling  

---

## Table of Workflows

1. [WF-01: Client Onboarding & Initial Setup](#wf-01-client-onboarding--initial-setup)
2. [WF-02: Client Policy & Calendar Configuration](#wf-02-client-policy--calendar-configuration)
3. [WF-03: Legal Entity & Geofenced Location Management](#wf-03-legal-entity--geofenced-location-management)
4. [WF-04: User Account Provisioning & RBAC Assignment](#wf-04-user-account-provisioning--rbac-assignment)
5. [WF-05: Employee Onboarding 4-Step Lifecycle](#wf-05-employee-onboarding-4-step-lifecycle)
6. [WF-06: Employee Transfer, Promotion & Reassignment](#wf-06-employee-transfer-promotion--reassignment)
7. [WF-07: Resignation, Termination & Offboarding](#wf-07-resignation-termination--offboarding)
8. [WF-08: Daily Attendance Lifecycle (Normal Shift)](#wf-08-daily-attendance-lifecycle-normal-shift)
9. [WF-09: Attendance Exceptions, Grace & Penalties](#wf-09-attendance-exceptions-grace--penalties)
10. [WF-10: Attendance Correction & Regularisation](#wf-10-attendance-correction--regularisation)
11. [WF-11: Policy Assignment & Custom Shift Overrides](#wf-11-policy-assignment--custom-shift-overrides)
12. [WF-12: Leave Application & Multi-Level Approval](#wf-12-leave-application--multi-level-approval)
13. [WF-13: Leave Cancellation & Balance Restoration](#wf-13-leave-cancellation--balance-restoration)
14. [WF-14: Unauthorised Absence & LWP Integration](#wf-14-unauthorised-absence--lwp-integration)
15. [WF-15: Monthly Attendance Finalization Gate](#wf-15-monthly-attendance-finalization-gate)
16. [WF-16: Payroll Batch Initialization & Math Engine](#wf-16-payroll-batch-initialization--math-engine)
17. [WF-17: Payroll Review, Overtime & Statutory Adjustments](#wf-17-payroll-review-overtime--statutory-adjustments)
18. [WF-18: Payroll Approval, Immutability Freeze & Payslips](#wf-18-payroll-approval-immutability-freeze--payslips)
19. [WF-19: Employee Self-Service (ESS) Daily Journey](#wf-19-employee-self-service-ess-daily-journey)
20. [WF-20: Client Suspension & Tenant Lockout](#wf-20-client-suspension--tenant-lockout)

---

### WF-01: Client Onboarding & Initial Setup
**Primary Actor:** `super_admin`  
**Description:** Onboarding a new corporate client enterprise onto the Avencis WFM platform.

```mermaid
flowchart TD
    A[Super Admin navigates to /clients] --> B[Click 'Add Client']
    B --> C[Enter Name, Code, Email, Phone, Address]
    C --> D{Validate Unique Code}
    D -- Duplicate --> C
    D -- Valid --> E[Insert into 'clients' table]
    E --> F[Create Default Legal Entity]
    F --> G[Create Head Office Work Location]
    G --> H[Create Default Departments: Admin, HR, Operations]
    H --> I[Invite / Provision Client Admin User]
    I --> J[Log Super Admin Action in audit_logs]
    J --> K[Client Onboarding Complete]
```

---

### WF-02: Client Policy & Calendar Configuration
**Primary Actor:** `client_admin` / `hr_admin`  
**Description:** Setting up client-wide attendance rules, shifts, holidays, and leave quotas.

```mermaid
flowchart TD
    A[Client Admin navigates to /settings] --> B[Configure Attendance Policy]
    B --> C[Set Shift: 09:00 - 18:00, Grace: 15m, Half-Day: 4h, Full-Day: 8h]
    C --> D[Select Overtime Mode: Authorized Only]
    D --> E[Save to 'attendance_policies']
    E --> F[Navigate to Holiday Calendar]
    F --> G[Upload / Add Statutory & Regional Holidays]
    G --> H[Save to 'holiday_calendars']
    H --> I[Configure Leave Types: Casual 12, Sick 12, Earned 15]
    I --> J[Save to 'leave_types']
```

---

### WF-03: Legal Entity & Geofenced Location Management
**Primary Actor:** `client_admin`  
**Description:** Defining multi-entity structures and physical sites with GPS radius geofencing.

```mermaid
flowchart TD
    A[Client Admin opens /client-setup] --> B[Add Legal Entity: Name, PAN, GSTIN, PF/ESI Codes]
    B --> C[Save to 'legal_entities']
    C --> D[Add Work Location: Name, Address, City]
    D --> E[Enter Latitude, Longitude & Geofence Radius e.g. 150m]
    E --> F[Link Location to Legal Entity]
    F --> G[Save to 'work_locations']
    G --> H[Assign Location Managers via user_work_locations]
```

---

### WF-04: User Account Provisioning & RBAC Assignment
**Primary Actor:** `client_admin` / `super_admin`  
**Description:** Provisioning administrative and operational user logins with explicit role binding.

```mermaid
flowchart TD
    A[Admin opens /users] --> B[Enter Email, Full Name, Select Role]
    B --> C{Check Privilege Escalation}
    C -- Client Admin assigns Super Admin --> D[Reject: 403 Forbidden]
    C -- Valid Role Assignment --> E[Create Supabase Auth User]
    E --> F[Insert Record in 'user_roles' with client_id]
    F --> G{Is Role Location Manager?}
    G -- Yes --> H[Select and Link Work Locations]
    G -- No --> I[Send Activation Email / Set Temporary Password]
    H --> I
    I --> J[User logs in and undergoes role verification]
```

---

### WF-05: Employee Onboarding 4-Step Lifecycle
**Primary Actor:** `hr_admin` / `client_admin`  
**Description:** Complete 4-step wizard for formal worker onboarding with statutory validation.

```mermaid
flowchart TD
    A[HR Admin clicks 'Add Employee'] --> B[Step 1: Personal & Identity]
    B --> C[Enter First/Last Name, DOB, Gender, Aadhaar, PAN]
    C --> D[Step 2: Employment & Hierarchy]
    D --> E[Select Legal Entity, Location, Department, Designation, Joining Date]
    E --> F[Step 3: Salary Structure / CTC]
    F --> G[Enter Monthly Basic, HRA, Special Allowances]
    G --> H[System calculates statutory EPF, ESIC, PT ceilings]
    H --> I[Step 4: Bank & Statutory Numbers]
    I --> J[Enter Bank Name, Account No, IFSC, UAN, ESIC IP]
    J --> K[Submit Wizard]
    K --> L[Atomic Database Transaction: employees + employee_salary_structures + leave_allocations]
    L --> M[Employee Record Activated]
```

---

### WF-06: Employee Transfer, Promotion & Reassignment
**Primary Actor:** `hr_admin`  
**Description:** Moving an employee between branches, departments, or changing salary and grade.

```mermaid
flowchart TD
    A[HR Admin views Employee Profile] --> B[Click 'Edit / Transfer']
    B --> C[Select New Work Location or Department]
    C --> D[Update Effective Date & Designation]
    D --> E[Optional: Update Salary CTC in structures]
    E --> F[Save Changes to 'employees']
    F --> G[System updates active location_id / department_id]
    G --> H[Subsequent punches evaluate against new location geofence]
    H --> I[Audit log entry generated: EMPLOYEE_TRANSFER]
```

---

### WF-07: Resignation, Termination & Offboarding
**Primary Actor:** `hr_admin` / `client_admin`  
**Description:** Orderly exit lifecycle, status deactivation, and payroll severance tagging.

```mermaid
flowchart TD
    A[HR Admin opens Employee Exit Form] --> B[Select Exit Type: Resigned / Terminated / Retired]
    B --> C[Enter Notice Date & Last Working Day LWD]
    C --> D[Set Status to 'inactive']
    D --> E[Revoke Supabase Auth user session]
    E --> F[Lock future attendance logging past LWD]
    F --> G[Flag employee for Full & Final FNF settlement in next payroll run]
    G --> H[Record stored in audit_logs]
```

---

### WF-08: Daily Attendance Lifecycle (Normal Shift)
**Primary Actor:** `employee`  
**Description:** Standard daily punch-in and punch-out flow with geofence validation.

```mermaid
flowchart TD
    A[Employee opens ESS Portal on Mobile / Web] --> B[Click 'Punch In']
    B --> C[Browser captures GPS Lat/Lng]
    C --> D{Geofence Check: Distance <= Location Radius?}
    D -- No (Outside) --> E[Flag as Out-of-Bounds / Block Punch]
    D -- Yes (Inside) --> F[Insert into attendance_events TYPE: check_in]
    F --> G[Create/Update daily_attendance_records: status PRESENT]
    G --> H[Work Day Progresses...]
    H --> I[Employee clicks 'Punch Out']
    I --> J[Insert into attendance_events TYPE: check_out]
    J --> K[Calculate Total Work Hours: check_out - check_in]
    K --> L{Hours >= 8.0?}
    L -- Yes --> M[Record Status: PRESENT, Total Hours Recorded]
    L -- No (<4h) --> N[Record Status: HALF_DAY or SHORT_HOURS]
```

---

### WF-09: Attendance Exceptions, Grace & Penalties
**Primary Actor:** Automated System Engine / `location_manager`  
**Description:** Handling late arrivals, grace periods, and non-punches.

```mermaid
flowchart TD
    A[Employee Punches In at 09:22 AM] --> B[System compares with Shift Start: 09:00 AM]
    B --> C{Late Minutes: 22m. Exceeds Grace: 15m?}
    C -- No (<= 15m) --> D[Status: PRESENT, Flag: ON_TIME]
    C -- Yes (> 15m) --> E[Status: PRESENT, Flag: IS_LATE]
    E --> F{Accumulated Late Marks in Month >= 3?}
    F -- Yes --> G[Trigger Alert / Flag for HR Review]
    F -- No --> H[Record Late Minutes]
    H --> I[Employee may file Attendance Correction]
```

---

### WF-10: Attendance Correction & Regularisation
**Primary Actor:** `employee` & `location_manager`  
**Description:** Remediation of missed punches or technical geofence failures.

```mermaid
flowchart TD
    A[Employee navigates to /regularisations] --> B[Select Date & Correction Type: Missed In/Out]
    B --> C[Enter Actual Times & Justification Reason]
    C --> D[Submit Correction Request]
    D --> E[Status: PENDING in attendance_corrections]
    E --> F[Location Manager receives notification]
    F --> G{Manager Action}
    G -- Reject --> H[Status: REJECTED, Reason Noted, Record Unaltered]
    G -- Approve --> I[Status: APPROVED in attendance_corrections]
    I --> J[Update daily_attendance_records with revised times & status]
    J --> K[Audit Log: ATTENDANCE_REGULARISED]
```

---

### WF-11: Policy Assignment & Custom Shift Overrides
**Primary Actor:** `hr_admin`  
**Description:** Applying non-standard work hours or rotating shift policies.

```mermaid
flowchart TD
    A[HR Admin opens Policy Manager] --> B[Create Policy: Night Shift 22:00 - 06:00]
    B --> C[Define Working Days: Mon-Fri, Sat Half-day]
    C --> D[Assign Policy to Specific Department or Location]
    D --> E[Save to attendance_policies]
    E --> F[Daily Attendance Engine maps employee punches to assigned policy ID]
```

---

### WF-12: Leave Application & Multi-Level Approval
**Primary Actor:** `employee`, `department_manager`, `hr_admin`  
**Description:** Applying for leave with balance deduction and muster sync.

```mermaid
flowchart TD
    A[Employee opens Leave Portal] --> B[Select Leave Type e.g. Casual Leave & Dates]
    B --> C{Sufficient Balance in leave_allocations?}
    C -- No --> D[Error: Insufficient Leave Balance. Option: Apply LWP]
    C -- Yes --> E[Submit Request: Status PENDING in leave_requests]
    E --> F[Manager reviews request]
    F --> G{Manager Decision}
    G -- Reject --> H[Status: REJECTED, Reason Recorded]
    G -- Approve --> I[Status: APPROVED]
    I --> J[Deduct days from leave_allocations]
    J --> K[Populate daily_attendance_records with status ON_LEAVE]
    K --> L[Employee notified of approval]
```

---

### WF-13: Leave Cancellation & Balance Restoration
**Primary Actor:** `employee` / `hr_admin`  
**Description:** Reversing a submitted or approved leave request.

```mermaid
flowchart TD
    A[Employee views My Leaves] --> B{Leave Status?}
    B -- Pending --> C[Click 'Cancel': Status updated to CANCELLED]
    B -- Approved --> D[Request HR Cancellation]
    D --> E[HR Admin verifies leave was un-taken]
    E --> F[HR clicks 'Revoke Leave']
    F --> G[Status set to REVOKED in leave_requests]
    G --> H[Recredit balance to leave_allocations]
    H --> I[Revert daily_attendance_records to standard schedule]
```

---

### WF-14: Unauthorised Absence & LWP Integration
**Primary Actor:** Automated Attendance Job / `hr_admin`  
**Description:** Converting absent days into Loss of Pay (LWP) deductions for payroll.

```mermaid
flowchart TD
    A[Day Concludes without Punch or Approved Leave] --> B[Daily Record marked as ABSENT]
    B --> C[Month-End Attendance Aggregation]
    C --> D[Count Total Absent Days without Leave Cover]
    D --> E[Classify as Unauthorised Absence / LWP]
    E --> F[Calculate Payable Days = Month Days - LWP Days]
    F --> G[Transmit Payable Days to Payroll Engine]
```

---

### WF-15: Monthly Attendance Finalization Gate
**Primary Actor:** `hr_admin` / `payroll_admin`  
**Description:** Mandatory prerequisite verification before payroll calculation can be triggered.

```mermaid
flowchart TD
    A[Payroll Admin navigates to /payroll] --> B[Click 'Run Payroll']
    B --> C{Check 1: Any Pending Attendance Corrections?}
    C -- Yes --> D[Block: 'Resolve 3 pending corrections before finalizing']
    C -- No --> E{Check 2: Any Pending Leave Requests for Period?}
    E -- Yes --> F[Block: 'Resolve 2 pending leave requests before finalizing']
    E -- No --> G[Prompt: 'Finalize Attendance Muster for [Period]?']
    G --> H[User Confirms Finalization]
    H --> I[Muster Locked: No further corrections permitted for period]
    I --> J[Gate Passed: Proceed to Payroll Calculation]
```

---

### WF-16: Payroll Batch Initialization & Math Engine
**Primary Actor:** `payroll_admin`  
**Description:** Generating itemized earnings and statutory deductions per employee.

```mermaid
flowchart TD
    A[Select Client, Legal Entity, Month & Year] --> B[Insert Draft into payroll_runs]
    B --> C[Fetch all Active Employees for Legal Entity]
    C --> D[Loop: For Each Employee]
    D --> E[Read Salary Structure: Basic, HRA, Allowances]
    E --> F[Read Finalized Attendance: Payable Days / Divisor e.g. 30]
    F --> G[Calculate Prorated Gross Earnings]
    G --> H[Statutory Engine: Compute EPF 12%, ESIC 0.75%, Professional Tax]
    H --> I[Calculate Net Salary = Gross - Deductions]
    I --> J[Insert item into payroll_items]
    J --> K[Compute Batch Totals & Update payroll_runs Status: DRAFT]
```

---

### WF-17: Payroll Review, Overtime & Statutory Adjustments
**Primary Actor:** `payroll_admin`  
**Description:** Reviewing draft payroll register and inserting authorized overtime or bonuses.

```mermaid
flowchart TD
    A[Payroll Admin reviews Draft Register] --> B[Select Employee Row]
    B --> C[Enter Authorized Overtime Hours & Approved Rate]
    C --> D[Enter Manual Incentive or Reimbursement Adjustment]
    D --> E[Click 'Recalculate Employee']
    E --> F[System updates Gross, Recomputes Deductions, Updates Net]
    F --> G[Save changes to payroll_items]
    G --> H[Submit Batch for Approval: Status SUBMITTED]
```

---

### WF-18: Payroll Approval, Immutability Freeze & Payslips
**Primary Actor:** `client_admin`  
**Description:** Segregation of duties approval, database-level locking, and Form XIX payslip issuance.

```mermaid
flowchart TD
    A[Client Admin receives Payroll Approval Task] --> B[Review Total Gross, Total Deductions, Net Payout]
    B --> C{Decision}
    C -- Reject --> D[Status set to REJECTED with comments; returns to Payroll Admin]
    C -- Approve --> E[Status set to APPROVED]
    E --> F[Client Admin clicks 'Finalize & Lock Payroll']
    F --> G[Update payroll_runs Status: LOCKED]
    G --> H[Trigger guard_locked_payroll_modification fires: Freeze Active]
    H --> I[Generate Form XIX Payslips for each employee in 'payslips']
    I --> J[Employees notified that payslips are available for download]
```

---

### WF-19: Employee Self-Service (ESS) Daily Journey
**Primary Actor:** `employee`  
**Description:** Full daily interaction flow for an operational front-line employee.

```mermaid
flowchart TD
    A[Employee opens Mobile Browser / App] --> B[Enter Work Email & Password]
    B --> C[Land on ESS Dashboard: Today's Shift, Leave Balances, Announcements]
    C --> D[Tap 'Punch In' -> GPS geofenced check-in]
    D --> E[Review Attendance Calendar & Previous Punches]
    E --> F[Apply for Leave if upcoming absence needed]
    F --> G[At End of Shift: Tap 'Punch Out']
    G --> H[End of Month: View & Download Printable Form XIX Payslip]
```

---

### WF-20: Client Suspension & Tenant Lockout
**Primary Actor:** `super_admin`  
**Description:** Emergency or commercial suspension of a tenant account.

```mermaid
flowchart TD
    A[Super Admin opens /clients] --> B[Select Client -> Click 'Suspend Account']
    B --> C[Enter Suspension Reason e.g. Contract Expiry]
    C --> D[Update clients table: status = 'suspended']
    D --> E[User Roles for tenant flagged as disabled / rejected at login]
    E --> F[Existing active sessions invalidated via Supabase Auth Admin API]
    F --> G[Any subsequent PostgREST call returns 403 Account Suspended]
    G --> H[Audit log records global suspension event]
```
