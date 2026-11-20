# AVENCIS WORKFORCE MANAGEMENT
## Document 09 — Master Test Scenario Catalogue & Execution Blueprint

**Status:** Complete Master Index  
**Date:** 2026-11-16  
**Auditor:** Antigravity Quality Assurance & Testing Engineering  
**Scope:** Master Index of 245 Detailed Manual Test Scenarios, Priority Classifications, and Execution Protocol  

---

## 1. Executive Summary & Test Programme Structure

The Avencis Workforce Management (WFM) master testing programme comprises **245 structured manual test scenarios** organized across **10 functional test suites** and detailed across **9 dedicated execution documents** (`10_*.md` through `18_*.md`).

Every scenario is designed for direct execution by a human tester or automated test runner and includes exact preconditions, test data, step-by-step procedures, UI expected outcomes, database verification queries, audit trail validation, and cleanup steps.

### 1.1 Test Suite Breakdown
| Suite ID | Suite Title | Target Document | Total Scenarios | P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Suite A** | Client & Organization Lifecycle | `10_CLIENT_LIFECYCLE_TESTS.md` | **25** | 8 | 12 | 4 | 1 |
| **Suite B** | User Account, RBAC & Role Management | `11_USER_ROLE_MANAGER_TESTS.md` | **25** | 10 | 10 | 4 | 1 |
| **Suite C** | Employee Master & Lifecycle Management | `12_EMPLOYEE_LIFECYCLE_TESTS.md` | **25** | 9 | 11 | 4 | 1 |
| **Suite D** | Work Locations & Shift Policies | `13_ATTENDANCE_AND_POLICY_TESTS.md` | **15** | 5 | 7 | 3 | 0 |
| **Suite E** | Attendance Tracking, Punches & Corrections | `13_ATTENDANCE_AND_POLICY_TESTS.md` | **20** | 8 | 8 | 3 | 1 |
| **Suite F** | Leave Management & Holidays | `14_LEAVE_MANAGEMENT_TESTS.md` | **30** | 9 | 13 | 6 | 2 |
| **Suite G** | Payroll Engine, Deductions & Form XIX | `15_PAYROLL_TESTS.md` | **30** | 12 | 12 | 5 | 1 |
| **Suite H** | Security, Tenancy & Negative Attacks | `17_SECURITY_NEGATIVE_AND_EDGE_CASE_TESTS.md` | **30** | 12 | 12 | 5 | 1 |
| **Suite I** | Reporting, Analytics & Audit Trails | `18_REPORTING_NOTIFICATION_AUDIT_TESTS.md` | **20** | 4 | 9 | 5 | 2 |
| **Suite J** | Cross-Module End-to-End Workflows | `16_CROSS_MODULE_INTEGRATION_TESTS.md` | **25** | 5 | 10 | 6 | 4 |
| **TOTALS** | **Comprehensive WFM Master Suite** | **All 9 Execution Documents** | **245** | **82** | **104** | **45** | **14** |

---

## 2. Priority Definition & Release Gates

- **P0 (Critical / Blocker - 82 Tests):** Core architectural, authentication, tenant isolation, attendance recording, payroll statutory calculation, and data immutability flows. A single P0 failure halts release deployment.
- **P1 (High - 104 Tests):** Primary user workflows across all 7 roles, standard CRUD operations, policy enforcements, leave balance deductions, and Form XIX payslip rendering. Required for general availability.
- **P2 (Medium - 45 Tests):** Complex edge cases, mid-month transitions, boundary validations, multi-entity exceptions, and secondary navigation paths.
- **P3 (Low - 14 Tests):** Cosmetic UI styling, non-critical validation tooltips, optional filter combinations, and minor visual layout alignments.

---

## 3. Standard Test Scenario Specification Template

Every scenario in Documents 10 through 18 adheres to the following strict, actionable specification:

```
### TEST-ID: [Suite]-[Module]-[Number] — [Brief Title]
- **Scenario:** [Clear functional statement of what is being validated]
- **Priority:** [P0 / P1 / P2 / P3]
- **User Role:** [Actor performing the test e.g. client_admin, hr_admin, employee]
- **Target URL / View:** [Application route e.g. /employees, /attendance, /payroll]
- **Preconditions:** [Required state of database, existing records, or active session]
- **Test Data:** [Exact synthetic values: names, dates, amounts, GPS coordinates]
- **Execution Steps:**
  1. [Action 1 with exact button names and input targets]
  2. [Action 2]
  3. [Action 3]
- **Expected Result (UI):** [Exact visible UI behavior, alert text, table updates, or redirects]
- **Database Verification:** [Read-only SQL query to confirm database state committed or unchanged]
- **Audit Verification:** [SQL query to verify audit_logs entry generated]
- **Cleanup / Teardown:** [Steps or script to revert synthetic test state safely]
- **Status:** NOT RUN
```

---

## 4. Master Test Scenario Catalog Index (Scenarios 001 - 245)

### Suite A: Client & Organization Lifecycle (`10_CLIENT_LIFECYCLE_TESTS.md`)
- `TC-CLI-001` (P0): Super Admin successfully creates a new client organization.
- `TC-CLI-002` (P0): System rejects duplicate client code registration.
- `TC-CLI-003` (P1): Client Admin updates company branding, logo, and address.
- `TC-CLI-004` (P0): Super Admin creates primary legal entity with valid PAN/GSTIN.
- `TC-CLI-005` (P1): Multi-entity creation under single client tenant.
- `TC-CLI-006` (P1): Work location creation with valid circular geofence radius.
- `TC-CLI-007` (P2): Validation of invalid GPS coordinates (latitude > 90 or < -90).
- `TC-CLI-008` (P1): Creating departments and assigning department head employee.
- `TC-CLI-009` (P0): Client Admin attempts to access another client's settings via URL tampering.
- `TC-CLI-010` (P0): Super Admin suspends client account; immediate session lockout.
- `TC-CLI-011` to `TC-CLI-025`: See `10_CLIENT_LIFECYCLE_TESTS.md` for remaining 15 tests.

### Suite B: User Account, RBAC & Role Management (`11_USER_ROLE_MANAGER_TESTS.md`)
- `TC-USR-001` (P0): Super Admin provisions Client Admin user with valid email.
- `TC-USR-002` (P0): Client Admin provisions HR Admin, Payroll Admin, and Managers.
- `TC-USR-003` (P0): Privilege escalation defense: Client Admin cannot create Super Admin.
- `TC-USR-004` (P0): Super Admin switches operational client context in UI.
- `TC-USR-005` (P1): Assigning Location Manager to multiple physical work locations.
- `TC-USR-006` (P1): Assigning Department Manager to specific department.
- `TC-USR-007` (P1): Deactivating user account blocks subsequent login attempts.
- `TC-USR-008` (P0): Role permission verification for HR Admin (restricted from CTC structures).
- `TC-USR-009` (P0): Role permission verification for Location Manager (restricted from payroll).
- `TC-USR-010` (P0): Role permission verification for Employee (strictly restricted to own ESS).
- `TC-USR-011` to `TC-USR-025`: See `11_USER_ROLE_MANAGER_TESTS.md` for remaining 15 tests.

### Suite C: Employee Master & Lifecycle (`12_EMPLOYEE_LIFECYCLE_TESTS.md`)
- `TC-EMP-001` (P0): Complete 4-step employee onboarding wizard submission.
- `TC-EMP-002` (P1): Step 1 validation: duplicate employee code within same client.
- `TC-EMP-003` (P1): Step 1 validation: invalid PAN format and invalid Aadhaar format.
- `TC-EMP-004` (P1): Step 2 validation: mandatory department and location selection.
- `TC-EMP-005` (P0): Step 3 validation: salary component math (Gross >= Basic + Allowances).
- `TC-EMP-006` (P1): Step 4 validation: bank account number and valid IFSC format.
- `TC-EMP-007` (P1): Editing existing employee profile details.
- `TC-EMP-008` (P1): Transferring employee to new work location and verifying geofence shift.
- `TC-EMP-009` (P1): Promoting employee with updated designation and revised CTC.
- `TC-EMP-010` (P0): Initiating employee resignation and setting Last Working Day.
- `TC-EMP-011` to `TC-EMP-025`: See `12_EMPLOYEE_LIFECYCLE_TESTS.md` for remaining 15 tests.

### Suite D & E: Attendance, Geofencing & Policies (`13_ATTENDANCE_AND_POLICY_TESTS.md`)
- `TC-ATT-001` (P0): Employee punch-in within valid GPS geofence radius.
- `TC-ATT-002` (P0): Geofence violation: punch-in blocked when user is outside radius.
- `TC-ATT-003` (P1): Duplicate punch-in prevention within 60 seconds (anti-bounce).
- `TC-ATT-004` (P0): Normal full-day shift punch-out: status marked PRESENT with 8+ hours.
- `TC-ATT-005` (P1): Shift punch-out with < 4 hours: status marked HALF_DAY.
- `TC-ATT-006` (P1): Arrival within 15-minute grace period: marked ON_TIME.
- `TC-ATT-007` (P1): Arrival past grace period: marked IS_LATE with recorded late minutes.
- `TC-ATT-008` (P0): Employee submits attendance regularisation for missed punch.
- `TC-ATT-009` (P0): Location Manager reviews and approves regularisation request.
- `TC-ATT-010` (P0): Attendance event immutability: trigger blocks direct UPDATE/DELETE.
- `TC-ATT-011` to `TC-ATT-035`: See `13_ATTENDANCE_AND_POLICY_TESTS.md` for remaining 25 tests.

### Suite F: Leave Management & Statutory Holidays (`14_LEAVE_MANAGEMENT_TESTS.md`)
- `TC-LEV-001` (P0): Employee applies for Casual Leave with sufficient balance.
- `TC-LEV-002` (P0): System blocks leave application when balance is insufficient.
- `TC-LEV-003` (P1): Employee applies for Half-Day leave (First Half / Second Half).
- `TC-LEV-004` (P1): System rejects leave application with end date prior to start date.
- `TC-LEV-005` (P1): Overlapping leave request validation (cannot apply on existing leave date).
- `TC-LEV-006` (P0): Department Manager reviews and approves pending leave request.
- `TC-LEV-007` (P0): Approval atomically deducts allocated days and updates daily muster roll.
- `TC-LEV-008` (P1): Employee cancels pending leave request before manager action.
- `TC-LEV-009` (P1): HR Admin revokes approved leave; balance automatically restored.
- `TC-LEV-010` (P0): Unapproved absence days convert to LWP in monthly summary.
- `TC-LEV-011` to `TC-LEV-030`: See `14_LEAVE_MANAGEMENT_TESTS.md` for remaining 20 tests.

### Suite G: Payroll Engine, Deductions & Form XIX (`15_PAYROLL_TESTS.md`)
- `TC-PAY-001` (P0): Payroll run blocked if attendance period is unfinalized.
- `TC-PAY-002` (P0): Payroll run initialization for specific Client, Entity, Month, Year.
- `TC-PAY-003` (P0): Gross salary proration based on payable days (26/30/calendar day divisor).
- `TC-PAY-004` (P0): Mid-month joiner salary calculation with partial payable days.
- `TC-PAY-005` (P0): Statutory EPF calculation (12% of Basic capped at ₹1,800 or uncapped).
- `TC-PAY-006` (P0): Statutory ESIC calculation (0.75% employee deduction if Gross <= ₹21,000).
- `TC-PAY-007` (P1): Professional Tax (PT) slab calculation based on state rules.
- `TC-PAY-008` (P1): Entering authorized overtime hours and calculating OT earnings.
- `TC-PAY-009` (P0): Segregation of Duties: Client Admin approves draft payroll run.
- `TC-PAY-010` (P0): Locking payroll run: trigger permanently freezes records against edits.
- `TC-PAY-011` (P0): Form XIX printable payslip generation for employee.
- `TC-PAY-012` to `TC-PAY-030`: See `15_PAYROLL_TESTS.md` for remaining 19 tests.

### Suite H: Security, Tenancy & Negative Attacks (`17_SECURITY_NEGATIVE_AND_EDGE_CASE_TESTS.md`)
- `TC-SEC-001` (P0): Cross-tenant PostgREST query tampering: Client A querying Client B data.
- `TC-SEC-002` (P0): Cross-tenant ID injection on INSERT: Client A inserting into Client B.
- `TC-SEC-003` (P0): ESS peer horizontal privacy: Employee A querying Employee B payslip.
- `TC-SEC-004` (P0): Direct UPDATE on locked payroll run rejected by PostgreSQL trigger.
- `TC-SEC-005` (P0): Direct DELETE on `audit_logs` rejected by PostgreSQL trigger.
- `TC-SEC-006` (P1): Session expiry: expired JWT automatically redirects to login.
- `TC-SEC-007` (P1): Tampered JWT signature immediately rejected with 401 Unauthorized.
- `TC-SEC-008` (P1): Privilege escalation via user_roles mutation rejected by RLS.
- `TC-SEC-009` (P2): SQL injection attempt via RPC parameters safely neutralized.
- `TC-SEC-010` (P2): Cross-Site Scripting (XSS) payload in employee name sanitized in UI.
- `TC-SEC-011` to `TC-SEC-030`: See `17_SECURITY_NEGATIVE_AND_EDGE_CASE_TESTS.md` for remaining 20 tests.

### Suite I: Reporting, Analytics & Audit Trails (`18_REPORTING_NOTIFICATION_AUDIT_TESTS.md`)
- `TC-REP-001` (P0): Audit log immutability: all CRUD actions record user_id, action, timestamp.
- `TC-REP-002` (P1): Monthly Attendance Muster CSV export matches daily records exactly.
- `TC-REP-003` (P1): Payroll Summary Register export reflects finalized locked figures.
- `TC-REP-004` (P1): Form XIX Statutory Wage Register export compliant with Indian Labour Laws.
- `TC-REP-005` (P2): Filter reports by legal entity and department.
- `TC-REP-006` to `TC-REP-020`: See `18_REPORTING_NOTIFICATION_AUDIT_TESTS.md` for remaining 15 tests.

### Suite J: Cross-Module Integration Workflows (`16_CROSS_MODULE_INTEGRATION_TESTS.md`)
- `TC-INT-001` (P0): Full Enterprise Workflow: Onboard Client -> Add Entity -> Provision Admin -> Onboard Employee -> Punch Attendance -> Apply Leave -> Finalize Muster -> Run Payroll -> Download Form XIX Payslip.
- `TC-INT-002` (P0): Employee Transfer Impact: Location change immediately updates geofence validation and manager routing.
- `TC-INT-003` (P1): Resignation Workflow: Exit date stops attendance punches and triggers FNF status in payroll.
- `TC-INT-004` to `TC-INT-025`: See `16_CROSS_MODULE_INTEGRATION_TESTS.md` for remaining 22 tests.
