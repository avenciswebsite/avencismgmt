# AVENCIS WORKFORCE MANAGEMENT
## Document 21 — Master Test Execution Tracker & Defect Log

**Status:** Ready for Execution  
**Total Scenarios:** 245  
**Current Progress:** Passed: 0 | Failed: 0 | Blocked: 0 | Not Run: 245 (0.0% Complete)  
**Target Application:** Avencis Workforce Management (WFM)  

---

## 1. Executive Testing Progress Scorecard

| Metric | Count | Percentage |
| :--- | :--- | :--- |
| **Total Test Scenarios** | **245** | **100.0%** |
| Passed (`PASS`) | 0 | 0.0% |
| Failed (`FAIL`) | 0 | 0.0% |
| Blocked (`BLOCKED`) | 0 | 0.0% |
| Not Run (`NOT RUN`) | 245 | 100.0% |

### Progress by Priority
| Priority Level | Total | Pass | Fail | Blocked | Not Run |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0 (Critical / Blocker)** | 82 | 0 | 0 | 0 | 82 |
| **P1 (High / Core)** | 104 | 0 | 0 | 0 | 104 |
| **P2 (Medium / Edge Cases)**| 45 | 0 | 0 | 0 | 45 |
| **P3 (Low / Polish)** | 14 | 0 | 0 | 0 | 14 |

---

## 2. Tester Instructions for Tracker Maintenance

1. **Execution Protocol:** Work through the test suites sequentially (Suite A -> Suite B -> Suite C -> Suite D/E -> Suite F -> Suite G -> Suite J -> Suite H -> Suite I).
2. **Recording Results:**
   - Change Status from `NOT RUN` to `PASS`, `FAIL`, or `BLOCKED`.
   - Enter your name/initials in the **Tester** column and current timestamp in the **Date** column.
   - If a test fails, enter a concise description or issue reference in the **Defect Notes** column.
3. **Database Verification:** Always execute the accompanying read-only SQL verification query specified in Documents 10 through 18 before marking a test as `PASS`.

---

## 3. Comprehensive Master Test Execution Register (245 Scenarios)

### Suite A: Client & Organization Lifecycle (Doc 10 — 25 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-CLI-001 | Clients | Super Admin Client Creation (Happy Path) | P0 | super_admin | | | NOT RUN | |
| TC-CLI-002 | Clients | Duplicate Client Code Validation | P0 | super_admin | | | NOT RUN | |
| TC-CLI-003 | Clients | Update Client Organization Profile | P1 | client_admin | | | NOT RUN | |
| TC-CLI-004 | Legal Entities | Primary Legal Entity Creation | P0 | client_admin | | | NOT RUN | |
| TC-CLI-005 | Legal Entities | Multi-Entity Setup under Single Client | P1 | client_admin | | | NOT RUN | |
| TC-CLI-006 | Locations | Work Location Creation with Circular Geofence | P0 | client_admin | | | NOT RUN | |
| TC-CLI-007 | Locations | Geofence Coordinate Boundary Validation | P2 | client_admin | | | NOT RUN | |
| TC-CLI-008 | Locations | Minimum Geofence Radius Validation | P2 | client_admin | | | NOT RUN | |
| TC-CLI-009 | Departments | Department Hierarchy Creation | P1 | client_admin | | | NOT RUN | |
| TC-CLI-010 | Departments | Assign Department Head Employee | P1 | client_admin | | | NOT RUN | |
| TC-CLI-011 | Locations | Delete Work Location with Active Employees | P0 | client_admin | | | NOT RUN | |
| TC-CLI-012 | Departments | Delete Department (Cascading SET NULL) | P2 | client_admin | | | NOT RUN | |
| TC-CLI-013 | Clients | Super Admin Client Suspension | P0 | super_admin | | | NOT RUN | |
| TC-CLI-014 | Clients | Suspended Client Access Lockout | P0 | client_admin | | | NOT RUN | |
| TC-CLI-015 | Clients | Super Admin Client Reactivation | P1 | super_admin | | | NOT RUN | |
| TC-CLI-016 | Branding | Client Branding Logo Upload | P1 | client_admin | | | NOT RUN | |
| TC-CLI-017 | Locations | Multi-Location Management View | P1 | client_admin | | | NOT RUN | |
| TC-CLI-018 | Security | Cross-Tenant Client Settings Isolation | P0 | client_admin | | | NOT RUN | |
| TC-CLI-019 | Locations | Deactivate Work Location | P1 | client_admin | | | NOT RUN | |
| TC-CLI-020 | Compliance | Statutory Registration Number Formatting | P1 | client_admin | | | NOT RUN | |
| TC-CLI-021 | Admin UI | Client Super Admin Filter Switching | P1 | super_admin | | | NOT RUN | |
| TC-CLI-022 | Security | Prevent Non-Super Admin Access to `/clients` | P0 | client_admin | | | NOT RUN | |
| TC-CLI-023 | Admin UI | Client Search & Filter on Admin Dashboard | P2 | super_admin | | | NOT RUN | |
| TC-CLI-024 | Security | Delete Client with Active Database Dependencies | P0 | super_admin | | | NOT RUN | |
| TC-CLI-025 | Onboarding | Client Setup Wizard Completion State | P3 | client_admin | | | NOT RUN | |

### Suite B: User Account, RBAC & Role Management (Doc 11 — 25 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-USR-001 | Provisioning | Super Admin Provisions Client Admin | P0 | super_admin | | | NOT RUN | |
| TC-USR-002 | Provisioning | Client Admin Provisions HR & Payroll Admins | P0 | client_admin | | | NOT RUN | |
| TC-USR-003 | Security | Privilege Escalation Defense (Client Admin -> Super Admin)| P0 | client_admin | | | NOT RUN | |
| TC-USR-004 | Provisioning | Location Manager Assignment to Specific Sites | P0 | client_admin | | | NOT RUN | |
| TC-USR-005 | Provisioning | Department Manager Assignment to Department | P1 | client_admin | | | NOT RUN | |
| TC-USR-006 | Lifecycle | User Account Deactivation | P0 | client_admin | | | NOT RUN | |
| TC-USR-007 | Lifecycle | Reactivate Deactivated User | P1 | client_admin | | | NOT RUN | |
| TC-USR-008 | Permissions | HR Admin Restricted from CTC Salary Structures | P0 | hr_admin | | | NOT RUN | |
| TC-USR-009 | Permissions | Payroll Admin Restricted from Leave Approval | P1 | payroll_admin | | | NOT RUN | |
| TC-USR-010 | Permissions | Location Manager Restricted from Payroll Runs | P0 | location_manager| | | NOT RUN | |
| TC-USR-011 | Permissions | Employee ESS Scope Isolation | P0 | employee | | | NOT RUN | |
| TC-USR-012 | Roles | Modify User Role (Promotion / Demotion) | P1 | client_admin | | | NOT RUN | |
| TC-USR-013 | Architecture | Location Manager Team Directory via RPC | P0 | location_manager| | | NOT RUN | |
| TC-USR-014 | Permissions | Department Manager Team Scope | P1 | department_manager| | | NOT RUN | |
| TC-USR-015 | Validation | Duplicate User Email Invite Validation | P1 | client_admin | | | NOT RUN | |
| TC-USR-016 | Validation | Invalid Email Format Validation | P2 | client_admin | | | NOT RUN | |
| TC-USR-017 | UI / Filter | User Role Filtering & Search | P2 | client_admin | | | NOT RUN | |
| TC-USR-018 | Super Admin | Super Admin Cross-Tenant User Inspection | P1 | super_admin | | | NOT RUN | |
| TC-USR-019 | Security | Self-Role Demotion Prevention | P1 | client_admin | | | NOT RUN | |
| TC-USR-020 | Lifecycle | Delete User Account (Soft Deactivation vs Hard Delete)| P0 | client_admin | | | NOT RUN | |
| TC-USR-021 | Permissions | Multi-Location Manager Access Switching | P1 | location_manager| | | NOT RUN | |
| TC-USR-022 | UI / Edge | Unassigned Location Manager Fallback | P2 | location_manager| | | NOT RUN | |
| TC-USR-023 | Security | Session Invalidation on Role Change | P1 | client_admin | | | NOT RUN | |
| TC-USR-024 | Audit | Audit Trail on Role Modification | P0 | client_admin | | | NOT RUN | |
| TC-USR-025 | Security | Password Complexity & Policy Enforcement | P3 | client_admin | | | NOT RUN | |

### Suite C: Employee Master & Lifecycle Management (Doc 12 — 25 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-EMP-001 | Onboarding | 4-Step Employee Onboarding Wizard (Happy Path) | P0 | hr_admin | | | NOT RUN | |
| TC-EMP-002 | Validation | Duplicate Employee Code Validation | P0 | hr_admin | | | NOT RUN | |
| TC-EMP-003 | Validation | Duplicate Corporate Email Validation | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-004 | Validation | Invalid PAN Card Number Format | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-005 | Validation | Invalid Aadhaar Number Format (12 Digits) | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-006 | Validation | Mandatory Organizational Hierarchy (Step 2) | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-007 | Validation | Salary Structure Mathematical Consistency (Step 3)| P0 | hr_admin | | | NOT RUN | |
| TC-EMP-008 | Validation | Bank IFSC Code Validation (Step 4) | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-009 | Master | Edit Employee Demographic Details | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-010 | Lifecycle | Employee Location Transfer | P0 | hr_admin | | | NOT RUN | |
| TC-EMP-011 | Lifecycle | Employee Department Transfer & Promotion | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-012 | Compensation| Employee CTC Revision (Payroll Admin Action) | P0 | payroll_admin | | | NOT RUN | |
| TC-EMP-013 | Privacy | Bank Account Details Privacy & Masking | P1 | location_manager| | | NOT RUN | |
| TC-EMP-014 | Lifecycle | Employee Resignation Lifecycle (Notice Period) | P0 | hr_admin | | | NOT RUN | |
| TC-EMP-015 | Lifecycle | Immediate Termination & Account Deactivation | P0 | client_admin | | | NOT RUN | |
| TC-EMP-016 | Security | Block Attendance Punches for Inactive Employee | P0 | employee | | | NOT RUN | |
| TC-EMP-017 | Lifecycle | Rehire / Reactivate Former Employee | P2 | hr_admin | | | NOT RUN | |
| TC-EMP-018 | UI / Filter | Employee Directory Search & Multi-Field Filtering | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-019 | Security | Cross-Tenant Employee Directory Isolation | P0 | hr_admin | | | NOT RUN | |
| TC-EMP-020 | Integration | Employee Leave Allocation Initialization | P0 | System | | | NOT RUN | |
| TC-EMP-021 | Bulk Import | Bulk Employee CSV Import Validation | P2 | hr_admin | | | NOT RUN | |
| TC-EMP-022 | Export | Export Employee Master to CSV | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-023 | Edge Case | Mid-Month Joiner Flag & Pro-Rata Configuration | P1 | hr_admin | | | NOT RUN | |
| TC-EMP-024 | Integrity | Delete Employee with Attendance History (FK Restrict)| P0 | hr_admin | | | NOT RUN | |
| TC-EMP-025 | Profile | Employee Profile Picture Upload | P3 | hr_admin | | | NOT RUN | |

### Suites D & E: Attendance Tracking, Geofencing & Policies (Doc 13 — 35 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-ATT-001 | Policies | Standard Shift Attendance Policy Creation | P0 | client_admin | | | NOT RUN | |
| TC-ATT-002 | Policies | Factory Early Morning Shift Policy Creation | P1 | client_admin | | | NOT RUN | |
| TC-ATT-003 | Policies | Overtime Policy Enforcement (Authorized Only) | P0 | payroll_admin | | | NOT RUN | |
| TC-ATT-004 | Policies | Weekly Off Configuration (Saturday / Sunday Rules)| P1 | client_admin | | | NOT RUN | |
| TC-ATT-005 | Geofencing | Geofence Validation: Mobile Punch Inside Radius | P0 | employee | | | NOT RUN | |
| TC-ATT-006 | Geofencing | Geofence Violation: Mobile Punch Outside Radius | P0 | employee | | | NOT RUN | |
| TC-ATT-007 | Geofencing | Multiple Work Locations Geofence Resolution | P1 | employee | | | NOT RUN | |
| TC-ATT-008 | Policies | Policy Assignment: Link Policy to Location | P1 | client_admin | | | NOT RUN | |
| TC-ATT-009 | Rules | Half-Day Cutoff Threshold Enforcement (< 4 hrs) | P1 | System | | | NOT RUN | |
| TC-ATT-010 | Rules | Half-Day Attendance Status (4 to 8 Hours) | P1 | System | | | NOT RUN | |
| TC-ATT-011 | Rules | Shift Full-Day Status (>= 8.0 Hours) | P0 | System | | | NOT RUN | |
| TC-ATT-012 | Rules | Grace Period Arrival (Within 15 Minutes) | P1 | employee | | | NOT RUN | |
| TC-ATT-013 | Rules | Late Arrival Beyond Grace Period | P1 | employee | | | NOT RUN | |
| TC-ATT-014 | Policies | Edit Existing Attendance Policy | P2 | client_admin | | | NOT RUN | |
| TC-ATT-015 | Policies | Delete Attendance Policy with Active Locations | P1 | client_admin | | | NOT RUN | |
| TC-ATT-016 | Punches | Duplicate Punch Anti-Bounce Guard (< 60 Seconds)| P1 | employee | | | NOT RUN | |
| TC-ATT-017 | Punches | Same-Day Punch-Out without Prior Punch-In | P1 | employee | | | NOT RUN | |
| TC-ATT-018 | Punches | Second Punch-Out in Same Day (Updates Last Exit) | P1 | employee | | | NOT RUN | |
| TC-ATT-019 | Immutability| Reject UPDATE on `attendance_events` (Trigger Guard)| P0 | Direct SQL | | | NOT RUN | |
| TC-ATT-020 | Immutability| Reject DELETE on `attendance_events` (Trigger Guard)| P0 | Direct SQL | | | NOT RUN | |
| TC-ATT-021 | Regularisation| Employee Submits Missed Punch Regularisation | P0 | employee | | | NOT RUN | |
| TC-ATT-022 | Regularisation| Location Manager Approves Attendance Regularisation| P0 | location_manager| | | NOT RUN | |
| TC-ATT-023 | Regularisation| Location Manager Rejects Attendance Regularisation| P1 | location_manager| | | NOT RUN | |
| TC-ATT-024 | Security | Anti-Self-Approval Defense for Regularisations | P0 | location_manager| | | NOT RUN | |
| TC-ATT-025 | Security | Cross-Location Regularisation Approval Prevention | P0 | location_manager| | | NOT RUN | |
| TC-ATT-026 | Automated | Automatic Daily Absence Marking (Nightly Job) | P0 | System | | | NOT RUN | |
| TC-ATT-027 | Automated | Statutory Holiday Auto-Population in Muster Roll | P1 | System | | | NOT RUN | |
| TC-ATT-028 | Overtime | Punch on Statutory Holiday (Holiday OT Eligibility)| P1 | employee | | | NOT RUN | |
| TC-ATT-029 | Muster Roll | Monthly Muster Roll Matrix Grid Rendering | P1 | hr_admin | | | NOT RUN | |
| TC-ATT-030 | UI / Filter | Filter Muster Roll by Work Location | P2 | hr_admin | | | NOT RUN | |
| TC-ATT-031 | Export | Export Monthly Attendance Muster to CSV | P1 | hr_admin | | | NOT RUN | |
| TC-ATT-032 | Overtime | Authorized Overtime Hours Entry by Supervisor | P0 | location_manager| | | NOT RUN | |
| TC-ATT-033 | Overtime | Reject Overtime Authorization | P1 | location_manager| | | NOT RUN | |
| TC-ATT-034 | Validation | Future Date Punch Prevention | P1 | employee | | | NOT RUN | |
| TC-ATT-035 | Analytics | Attendance Dashboard Real-Time Metrics | P2 | client_admin | | | NOT RUN | |

### Suite F: Leave Management & Statutory Holidays (Doc 14 — 30 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-LEV-001 | Leave | Leave Application with Sufficient Balance | P0 | employee | | | NOT RUN | |
| TC-LEV-002 | Validation | Insufficient Leave Balance Block | P0 | employee | | | NOT RUN | |
| TC-LEV-003 | Leave | Half-Day Leave Application (First Half) | P1 | employee | | | NOT RUN | |
| TC-LEV-004 | Validation | Inverted Date Selection Validation (End < Start) | P1 | employee | | | NOT RUN | |
| TC-LEV-005 | Validation | Overlapping Leave Request Validation | P0 | employee | | | NOT RUN | |
| TC-LEV-006 | Rules | Applying on Weekly Off / Statutory Holiday | P1 | employee | | | NOT RUN | |
| TC-LEV-007 | Approval | Department Manager Leave Approval | P0 | department_manager| | | NOT RUN | |
| TC-LEV-008 | Balances | Atomic Balance Deduction Upon Approval | P0 | System | | | NOT RUN | |
| TC-LEV-009 | Muster Sync | Daily Attendance Muster Roll Sync (`ON_LEAVE`) | P0 | System | | | NOT RUN | |
| TC-LEV-010 | Approval | Department Manager Leave Rejection | P0 | department_manager| | | NOT RUN | |
| TC-LEV-011 | Balances | Zero Balance Deduction on Rejected Leave | P0 | System | | | NOT RUN | |
| TC-LEV-012 | Lifecycle | Employee Cancels Pending Leave Request | P1 | employee | | | NOT RUN | |
| TC-LEV-013 | Lifecycle | HR Admin Revokes Approved Leave (Restoration) | P0 | hr_admin | | | NOT RUN | |
| TC-LEV-014 | Security | Anti-Self-Approval Defense for Leave Requests | P0 | department_manager| | | NOT RUN | |
| TC-LEV-015 | LWP | Loss of Pay (LWP) Leave Application | P1 | employee | | | NOT RUN | |
| TC-LEV-016 | Integration | LWP Days Integration with Payroll Engine | P0 | System | | | NOT RUN | |
| TC-LEV-017 | Admin | Create New Leave Type with Custom Rules | P1 | client_admin | | | NOT RUN | |
| TC-LEV-018 | Balances | Annual Leave Quota Rollover / Carry-Forward | P2 | hr_admin | | | NOT RUN | |
| TC-LEV-019 | Balances | Pro-Rata Leave Quota for Mid-Year Joiner | P1 | System | | | NOT RUN | |
| TC-LEV-020 | Holidays | Statutory Holiday Calendar Setup (Maharashtra) | P1 | hr_admin | | | NOT RUN | |
| TC-LEV-021 | Holidays | Multi-Location Holiday Exceptions | P2 | hr_admin | | | NOT RUN | |
| TC-LEV-022 | Security | Cross-Tenant Leave Request Isolation | P0 | client_admin | | | NOT RUN | |
| TC-LEV-023 | Audit | Leave Balance History & Audit Ledger | P2 | hr_admin | | | NOT RUN | |
| TC-LEV-024 | Validation | Medical Certificate for Extended Sick Leave (>2d)| P2 | employee | | | NOT RUN | |
| TC-LEV-025 | Admin | Bulk Leave Allocation Adjustment | P2 | hr_admin | | | NOT RUN | |
| TC-LEV-026 | Rules | Leave Application on Past Date (Backdated Leave) | P1 | employee | | | NOT RUN | |
| TC-LEV-027 | Rules | Block Backdated Leave Exceeding 48 Hours | P1 | employee | | | NOT RUN | |
| TC-LEV-028 | Export | Export Leave Summary Report to CSV | P1 | hr_admin | | | NOT RUN | |
| TC-LEV-029 | Rules | Sandwich Leave Rule Evaluation | P3 | hr_admin | | | NOT RUN | |
| TC-LEV-030 | Integrity | Leave Cancellation After Payroll Cutoff Locking | P0 | hr_admin | | | NOT RUN | |

### Suite G: Payroll Engine, Statutory Deductions & Form XIX (Doc 15 — 30 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-PAY-001 | Gate | Attendance Finalization Gate (Corrections Block) | P0 | payroll_admin | | | NOT RUN | |
| TC-PAY-002 | Gate | Attendance Finalization Gate (Leaves Block) | P0 | payroll_admin | | | NOT RUN | |
| TC-PAY-003 | Batch | Finalize Muster & Initialize Draft Payroll Run | P0 | payroll_admin | | | NOT RUN | |
| TC-PAY-004 | Calculation | Standard Full-Month Salary Calculation (100% Att)| P0 | System | | | NOT RUN | |
| TC-PAY-005 | Proration | Salary Proration Math — Unpaid LWP Days (25/30) | P0 | System | | | NOT RUN | |
| TC-PAY-006 | Proration | Mid-Month Joiner Salary Proration (Joined Nov 16)| P0 | System | | | NOT RUN | |
| TC-PAY-007 | Proration | Mid-Month Resignation Salary Proration (Exited Nov 20)| P1 | System | | | NOT RUN | |
| TC-PAY-008 | Statutory | EPF Employee Deduction (Standard Ceiling ₹15,000 Cap)| P0 | System | | | NOT RUN | |
| TC-PAY-009 | Statutory | EPF Employee Deduction (Uncapped Actual Basic) | P1 | System | | | NOT RUN | |
| TC-PAY-010 | Statutory | EPF Employer Contribution Split (EPS 8.33% + PF 3.67%)| P0 | System | | | NOT RUN | |
| TC-PAY-011 | Statutory | ESIC Deduction (Applicable: Gross <= ₹21,000) | P0 | System | | | NOT RUN | |
| TC-PAY-012 | Statutory | ESIC Exemption (Gross > ₹21,000) | P0 | System | | | NOT RUN | |
| TC-PAY-013 | Statutory | Professional Tax Slab Calculation (Maharashtra) | P1 | System | | | NOT RUN | |
| TC-PAY-014 | Statutory | Professional Tax February Slab Rule (₹300) | P2 | System | | | NOT RUN | |
| TC-PAY-015 | Statutory | Configurable Tax Withholding (TDS) Calculation | P0 | System | | | NOT RUN | |
| TC-PAY-016 | Overtime | Authorized Overtime Earnings Addition | P0 | payroll_admin | | | NOT RUN | |
| TC-PAY-017 | Adjustments | Manual Incentive / Bonus Addition | P1 | payroll_admin | | | NOT RUN | |
| TC-PAY-018 | Adjustments | Manual Deduction Addition (Loan Recovery) | P1 | payroll_admin | | | NOT RUN | |
| TC-PAY-019 | Math Invariance| Net Salary Mathematical Invariance Test | P0 | System | | | NOT RUN | |
| TC-PAY-020 | Workflow | Submit Payroll Run for Approval (Status: SUBMITTED)| P0 | payroll_admin | | | NOT RUN | |
| TC-PAY-021 | Governance | Segregation of Duties: Client Admin Payroll Approval| P0 | client_admin | | | NOT RUN | |
| TC-PAY-022 | Governance | Client Admin Rejects Submitted Payroll Run | P1 | client_admin | | | NOT RUN | |
| TC-PAY-023 | Freezing | Finalize & Lock Payroll Run (Status: LOCKED) | P0 | client_admin | | | NOT RUN | |
| TC-PAY-024 | Immutability| Reject UPDATE on Locked Payroll Run (Trigger Guard)| P0 | Direct SQL | | | NOT RUN | |
| TC-PAY-025 | Immutability| Reject UPDATE on Locked Payroll Items (Trigger Guard)| P0 | Direct SQL | | | NOT RUN | |
| TC-PAY-026 | Payslips | Automatic Form XIX Printable Payslip Issuance | P0 | System | | | NOT RUN | |
| TC-PAY-027 | Payslips | Form XIX Statutory Printable Layout Compliance | P0 | employee | | | NOT RUN | |
| TC-PAY-028 | Multi-Entity| Multi-Entity Independent Payroll Run Execution | P1 | payroll_admin | | | NOT RUN | |
| TC-PAY-029 | Export | Export Bank Payout NEFT / RTGS File | P1 | payroll_admin | | | NOT RUN | |
| TC-PAY-030 | Security | Cross-Tenant Payroll Data Isolation | P0 | payroll_admin | | | NOT RUN | |

### Suite J: Cross-Module Integration Workflows (Doc 16 — 25 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-INT-001 | Master E2E | Master End-to-End Enterprise Workflow | P0 | All Personas | | | NOT RUN | |
| TC-INT-002 | Transfer | Employee Transfer Domino Effect (Location Shift) | P0 | hr_admin | | | NOT RUN | |
| TC-INT-003 | Exit | Resignation Lifecycle: Cutoff Punches Past LWD | P0 | employee | | | NOT RUN | |
| TC-INT-004 | Absence | Unauthorised Absence to Payroll LWP Pipeline | P0 | System | | | NOT RUN | |
| TC-INT-005 | CTC | Salary Hike Statutory Threshold Transition | P1 | payroll_admin | | | NOT RUN | |
| TC-INT-006 | Roles | User Role Elevation (Employee -> Manager) Live | P1 | client_admin | | | NOT RUN | |
| TC-INT-007 | Suspension | Client Suspension Cascade (Immediate Lockout) | P0 | super_admin | | | NOT RUN | |
| TC-INT-008 | Multi-Entity| Multi-Entity Independent Payroll Isolation | P1 | payroll_admin | | | NOT RUN | |
| TC-INT-009 | Gate | Backdated Leave Approved After Muster Lock Block | P1 | department_manager| | | NOT RUN | |
| TC-INT-010 | Statutory | Form XIX Statutory Register Data Reconciliation | P1 | payroll_admin | | | NOT RUN | |
| TC-INT-011 | Proration | Mid-Month Joiner Leave Quota & Payroll Convergence| P2 | System | | | NOT RUN | |
| TC-INT-012 | Geofence | Punch Outside Geofence Followed by Correction | P1 | employee | | | NOT RUN | |
| TC-INT-013 | Cascade | Department Deletion Reassigns Employees | P2 | client_admin | | | NOT RUN | |
| TC-INT-014 | Security | Cross-Tenant Direct API Barrier Check (All 20 Tables)| P0 | client_admin | | | NOT RUN | |
| TC-INT-015 | Shifts | Overtime Multiplier Transition Across Shifts | P2 | payroll_admin | | | NOT RUN | |
| TC-INT-016 | Lifecycle | Terminated Employee Cannot Receive Leave Allocations| P2 | hr_admin | | | NOT RUN | |
| TC-INT-017 | Roles | Location Manager Demoted While Approvals Pending | P2 | client_admin | | | NOT RUN | |
| TC-INT-018 | FNF | Full & Final Settlement Flag on Payroll Item | P1 | payroll_admin | | | NOT RUN | |
| TC-INT-019 | Context | Client Switcher Preserves Module Filter State | P1 | super_admin | | | NOT RUN | |
| TC-INT-020 | Conflicts | Simultaneous Punch and Leave Conflict Resolution | P2 | hr_admin | | | NOT RUN | |
| TC-INT-021 | Locations | Multi-Location Split-Day Shifts | P3 | employee | | | NOT RUN | |
| TC-INT-022 | Responsive | Mobile Responsive ESS Portal Experience | P1 | employee | | | NOT RUN | |
| TC-INT-023 | Compliance | Historical Audit Trail Export on Investigation | P2 | super_admin | | | NOT RUN | |
| TC-INT-024 | Concurrency | Concurrent Payroll Batch Calculation Lockout | P1 | payroll_admin | | | NOT RUN | |
| TC-INT-025 | Benchmark | End-to-End Test Suite Execution Benchmark | P0 | System | | | NOT RUN | |

### Suite H: Security, Tenancy & Negative Attacks (Doc 17 — 30 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-SEC-001 | Tenancy | Cross-Tenant PostgREST SELECT Tampering | P0 | client_admin | | | NOT RUN | |
| TC-SEC-002 | Tenancy | Cross-Tenant ID Injection on INSERT | P0 | client_admin | | | NOT RUN | |
| TC-SEC-003 | Privacy | ESS Employee Queries Peer Salary Structure | P0 | employee | | | NOT RUN | |
| TC-SEC-004 | Privacy | ESS Employee Queries Peer Payslip | P0 | employee | | | NOT RUN | |
| TC-SEC-005 | Privacy | ESS Employee Queries Peer Daily Attendance | P1 | employee | | | NOT RUN | |
| TC-SEC-006 | Immutability| Reject UPDATE on `audit_logs` (Trigger Guard) | P0 | Direct SQL | | | NOT RUN | |
| TC-SEC-007 | Immutability| Reject DELETE on `audit_logs` (Trigger Guard) | P0 | Direct SQL | | | NOT RUN | |
| TC-SEC-008 | Immutability| Reject UPDATE on Locked Payroll Batch | P0 | Direct SQL | | | NOT RUN | |
| TC-SEC-009 | Immutability| Reject DELETE on Locked Payroll Batch | P0 | Direct SQL | | | NOT RUN | |
| TC-SEC-010 | Escalation | Client Admin Assigns `super_admin` Role | P0 | client_admin | | | NOT RUN | |
| TC-SEC-011 | Permissions | Location Manager Invoking Payroll API | P0 | location_manager| | | NOT RUN | |
| TC-SEC-012 | Auth | Expired JWT Token Handling | P1 | employee | | | NOT RUN | |
| TC-SEC-013 | Auth | Tampered JWT Signature Rejection | P0 | Attacker | | | NOT RUN | |
| TC-SEC-014 | XSS | Stored XSS Injection in Employee Master | P1 | hr_admin | | | NOT RUN | |
| TC-SEC-015 | XSS | Stored XSS Injection in Regularisation Remarks | P1 | employee | | | NOT RUN | |
| TC-SEC-016 | SQLi | Stored Procedure Parameter SQLi Resistance | P0 | location_manager| | | NOT RUN | |
| TC-SEC-017 | Network | CORS Preflight Origin Enforcement | P1 | External | | | NOT RUN | |
| TC-SEC-018 | Boundary | Leap Year February 29 Date Handling | P2 | System | | | NOT RUN | |
| TC-SEC-019 | Statutory | Zero Basic Salary Validation | P1 | hr_admin | | | NOT RUN | |
| TC-SEC-020 | Domain | Negative Component Deduction Resistance | P1 | payroll_admin | | | NOT RUN | |
| TC-SEC-021 | Edge Case | Zero Payable Days Salary Payout (100% LWP) | P0 | System | | | NOT RUN | |
| TC-SEC-022 | Financial | Net Pay Capped at Gross (No Negative Salary) | P1 | payroll_admin | | | NOT RUN | |
| TC-SEC-023 | Concurrency | Concurrent Modification on Same Employee Profile| P2 | hr_admin | | | NOT RUN | |
| TC-SEC-024 | SQLi | PostgREST SQL Injection via Column Filter | P0 | Attacker | | | NOT RUN | |
| TC-SEC-025 | Hardware | Geofence GPS Spoofing Mitigation (Mock Location) | P2 | employee | | | NOT RUN | |
| TC-SEC-026 | Error Leak | Multi-Tenant Data Leak via Error Messages | P1 | client_admin | | | NOT RUN | |
| TC-SEC-027 | Storage | Storage Bucket Path Traversal Defense | P0 | Attacker | | | NOT RUN | |
| TC-SEC-028 | Auth | Brute Force Password Attack Protection | P1 | Attacker | | | NOT RUN | |
| TC-SEC-029 | Concurrency | Rapid Clock-In/Clock-Out Race Condition | P1 | Automated | | | NOT RUN | |
| TC-SEC-030 | Hardening | Database Search Path Pinning Verification | P0 | Auditor | | | NOT RUN | |

### Suite I: Reporting, Analytics & Audit Logging (Doc 18 — 20 Tests)
| Test ID | Module | Scenario Title | Priority | Role | Date | Tester | Status | Defect Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-REP-001 | Audit | Regulatory Audit Log Recording on Mutations | P0 | client_admin | | | NOT RUN | |
| TC-REP-002 | Immutability| Audit Log Immutability Protection | P0 | super_admin | | | NOT RUN | |
| TC-REP-003 | Reports | Monthly Attendance Summary Report Generation | P1 | hr_admin | | | NOT RUN | |
| TC-REP-004 | Export | Monthly Muster Roll Matrix CSV Export | P1 | hr_admin | | | NOT RUN | |
| TC-REP-005 | Statutory | Form XIX Statutory Wage Register Export | P0 | payroll_admin | | | NOT RUN | |
| TC-REP-006 | Statutory | Statutory EPFO ECR File Export | P1 | payroll_admin | | | NOT RUN | |
| TC-REP-007 | Statutory | ESIC Monthly Contribution Statement Export | P1 | payroll_admin | | | NOT RUN | |
| TC-REP-008 | Statutory | Professional Tax Form III Return Export | P1 | payroll_admin | | | NOT RUN | |
| TC-REP-009 | Banking | Corporate Bank NEFT / RTGS Payout Advice Export | P1 | payroll_admin | | | NOT RUN | |
| TC-REP-010 | Reports | Annual Leave Utilization & Balance Liability Report| P1 | hr_admin | | | NOT RUN | |
| TC-REP-011 | Analytics | Executive Dashboard Headcount & Growth Metrics | P2 | client_admin | | | NOT RUN | |
| TC-REP-012 | Analytics | Executive Dashboard Live Attendance Rate Widget | P2 | client_admin | | | NOT RUN | |
| TC-REP-013 | Analytics | Executive Dashboard Monthly Payroll Cost Trend | P2 | client_admin | | | NOT RUN | |
| TC-REP-014 | UI / Filter | Filter Reports by Work Location & Legal Entity | P2 | payroll_admin | | | NOT RUN | |
| TC-REP-015 | Security | Unauthorized Access to Reports Blocked for ESS | P0 | employee | | | NOT RUN | |
| TC-REP-016 | Permissions | Location Manager Restricted to Operational Reports| P1 | location_manager| | | NOT RUN | |
| TC-REP-017 | Super Admin | Super Admin Global Cross-Tenant Reporting | P1 | super_admin | | | NOT RUN | |
| TC-REP-018 | Audit | Audit Log Filter by Actor Email & Action Type | P2 | client_admin | | | NOT RUN | |
| TC-REP-019 | Export | Export Audit Logs to CSV for External SOC 2 Audit| P1 | client_admin | | | NOT RUN | |
| TC-REP-020 | Print | Report Print CSS Layout & Formatting | P3 | client_admin | | | NOT RUN | |
