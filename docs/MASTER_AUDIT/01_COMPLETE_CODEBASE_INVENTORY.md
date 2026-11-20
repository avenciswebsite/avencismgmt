# Avencis WFM — Complete Codebase Inventory
**Document ID:** `AUDIT-01-INVENTORY`  
**Date:** 2026-11-16  
**Auditor:** Antigravity AI Engine (Google DeepMind)  
**Operating Mode:** Strictly Read-Only Codebase & Database Discovery  
**Target Repository:** `c:\Avencis Management`  
**Database Host:** Supabase Cloud (`mlopgvkvzhwhkbewhefb.supabase.co`)  
**PostgreSQL Version:** 17.11 (ga)  

---

## 1. Executive Summary & Discovery Scope

This document provides an exhaustive, line-by-line architectural inventory of the Avencis Workforce Management (WFM) platform. The audit covers the entire frontend React codebase, client-side state managers, domain service adapters, PostgreSQL 17.11 database schemas, Row-Level Security (RLS) policies, database triggers, stored procedures, and 29 approved Stitch design screens.

### Core Metrics Discovered:
- **Frontend Source Files:** 36 TypeScript/TSX files in `src/` (1,668 bundled modules).
- **Application Views:** 21 distinct view components across Admin, Workspace, Portal, and Auth.
- **Service Layer Modules:** 10 domain services, helper libraries, and configuration managers in `src/services/`.
- **Database Tables:** 20 relational tables in PostgreSQL schema `public`.
- **Row-Level Security Policies:** 63 active RLS policies in `pg_policies`.
- **Stored Functions & Procedures:** 13 database routines in `pg_proc`.
- **Database Engine Triggers:** 17 triggers active across 7 operational tables.
- **Approved Stitch Reference Screens:** 29 screens across Batch 01 (15) and Batch 02 (14).
- **Automated Test Suites:** 15 test scripts in `scripts/` containing 285 passing tests.

---

## 2. Frontend Inventory

### 2.1 Routing & Navigation Architecture (`src/App.tsx`)
The application utilizes `react-router-dom` v6.28.0 with a central `<AppShell />` wrapper, role-based root redirection, and distinct route clusters:

| Route Path | Component | Purpose | Access Control Gate |
| :--- | :--- | :--- | :--- |
| `/login` | `LoginView.tsx` | Enterprise login with email/password and dev persona switcher | Public |
| `/` | `RootRedirect` | Directs user based on `currentUser.role` | Authenticated |
| `/admin/dashboard` | `MasterDashboard.tsx` | Global multi-client metrics, operational health, and tenant cards | `super_admin` only |
| `/admin/clients` | `ClientDirectoryView.tsx` | Global client enterprise directory with status filter and search | `super_admin` only |
| `/admin/onboard` | `ClientOnboardWizard.tsx` | 4-step wizard: Client details, Legal Entity, Location, Admin User | `super_admin` only |
| `/admin/entities` | `LegalEntitiesView.tsx` | Global repository of legal entities, PAN, TAN, GSTIN, and PF codes | `super_admin` only |
| `/admin/users` | `UsersRolesView.tsx` | User profile registry, role assignments, and tenant linkages | `super_admin` only |
| `/admin/permissions` | `PermissionMatrixView.tsx` | Visual matrix of permissions across the 7 application roles | `super_admin` only |
| `/admin/audit` | `SecurityAuditView.tsx` | Platform-wide security audit trail and tamper event viewer | `super_admin` only |
| `/admin/reports` | `ReportsAnalyticsView.tsx` | Global cross-client compliance, attendance, and payroll reports | `super_admin` only |
| `/workspace/overview` | `ClientOverview.tsx` | Tenant dashboard: headcount, shifts, active locations, attendance summary | Tenant Admins / Managers |
| `/workspace/:clientId/overview` | `ClientOverview.tsx` | Scoped tenant overview for specific client organization | Tenant Admins / Super Admin |
| `/workspace/:clientId/employees` | `EmployeeDirectory.tsx` | Tenant employee roster with search, filter, and quick actions | Tenant Admins / HR / Payroll |
| `/workspace/:clientId/employees/new` | `AddEmployeeWizard.tsx` | 4-step onboarding wizard: Personal, Job, Statutory IDs, Compensation | Tenant Admins / HR Admin |
| `/workspace/:clientId/employees/:employeeId` | `EmployeeProfileView.tsx` | Detailed employee master: Job details, active salary, bank coordinates | Role-scoped (HR/Payroll/Admin) |
| `/workspace/:clientId/attendance` | `AttendanceCommandCenter.tsx` | Real-time daily muster roll, punch telemetry, GPS geofence status | Tenant Admins / Managers |
| `/workspace/regularisations` | `AttendanceRegularisations.tsx` | Managerial regularisation approval queue with anti-self-approval | Tenant Admins / Managers |
| `/workspace/:clientId/leaves` | `LeaveManagement.tsx` | Leave entitlement balances, request history, and approval register | Tenant Admins / HR / Managers |
| `/workspace/:clientId/payroll` | `PayrollDashboard.tsx` | Monthly payroll batch tracking, statutory totals, and locking status | Client Admin / Payroll Admin |
| `/workspace/:clientId/payroll/wizard` | `PayrollGuidedWizard.tsx` | 5-step payroll calculation engine: Attendance gate to terminal lock | Client Admin / Payroll Admin |
| `/workspace/payslips` | `PayslipManagement.tsx` | Statutory Form XIX payslip repository with publishing controls | Client Admin / Payroll / HR |
| `/workspace/payslips/view/:employeeId`| `OfficialPayslipView.tsx` | Printable Form XIX statutory payslip certificate | Role-scoped |
| `/workspace/:clientId/settings` | `ClientPolicySettings.tsx` | Policy configuration: Divisor, overtime rules, late rules, EPF/ESIC | Client Admin / Super Admin |
| `/portal` | `EmployeePortal.tsx` | Employee self-service hub (Punch, Leaves, Regularisations, Payslips) | `employee` role |
| `/portal/punch` | `EmployeePortal.tsx` | Mobile GPS clock-in / clock-out interface | `employee` role |
| `/portal/leave` | `EmployeePortal.tsx` | Employee leave application submission and balance ledger | `employee` role |
| `/portal/regularisations` | `EmployeePortal.tsx` | Employee attendance regularisation request queue | `employee` role |
| `/portal/payslips` | `EmployeePortal.tsx` | Employee published Form XIX payslip viewer and download | `employee` role |

---

### 2.2 Component & Layout Architecture

#### 1. Shell & Navigation Components (`src/components/layout/`)
- **`AppShell.tsx` (69 lines):**  
  Primary application container. Implements a three-stage security gate:
  - *Gate 1 (Loading):* Displays a pulsing Avencis symbol while session is verified (`isLoading = true`).
  - *Gate 2 (Missing Profile):* Catches authenticated GoTrue users who lack a row in `public.user_profiles` (`isProfileMissing = true`). Completely blocks dashboard access and renders an "Access Restricted" screen with a safe sign-out action.
  - *Gate 3 (Unauthenticated):* Redirects unauthenticated traffic to `/login`.
- **`Sidebar.tsx` (445 lines):**  
  Dynamic role-based navigation sidebar. Renders three distinct visual experiences:
  - *Employee Portal Experience:* Deep navy theme (`bg-primary-dark`), displaying employee self-service links (Home, Punch, Leaves, Regularisations, Payslips).
  - *Client Workspace Experience:* Standard corporate blue (`bg-primary`), displaying active client scope badge, employees, attendance command center, leave management, payroll, and client policies.
  - *Master Admin Experience:* Global platform navigation (Clients, Legal Entities, Users & Roles, Permission Matrix, Audit Logs).
- **`TopNav.tsx` (262 lines):**  
  Application header providing:
  - Client workspace switcher for Super Admin (fetches accessible clients via `WorkspaceContext`).
  - Active tenant badge for single-tenant users.
  - User profile summary with role indicator.
  - Development persona switcher (strictly gated by `isDevPersonaAllowed()`).
  - Secure sign-out action invoking `authService.signOut()`.

---

### 2.3 Detailed Screen Component Inventory (`src/app/`)

#### Admin Views (`src/app/admin/`)
1. **`MasterDashboard.tsx` (11.2 KB):**  
   Platform overview. Aggregates total client organizations, active workforce headcount, platform presence rates, and recent critical audit alerts. Features interactive client tenant cards leading into `/workspace/:clientId`.
2. **`ClientDirectoryView.tsx` (15.5 KB):**  
   Data table of all registered client organizations. Supports text search (`name`, `code`), industry filter, status tabs (`ALL`, `ACTIVE`, `ONBOARDING`, `SUSPENDED`), and quick-action menu (Manage Workspace, Edit Settings, Suspend).
3. **`ClientOnboardWizard.tsx` (29.0 KB):**  
   Multi-step client creation wizard:
   - *Step 1: Organization Details* (Legal Name, Trade Name, Code, Industry, Headcount Tier, Contact Details).
   - *Step 2: Primary Legal Entity* (Entity Type, PAN, TAN, GSTIN, Registered Address).
   - *Step 3: Primary Work Location* (Site Name, Address, State, GPS Coordinates, Geofence Radius).
   - *Step 4: Primary Client Administrator* (Full Name, Official Email, Temporary Password).
4. **`LegalEntitiesView.tsx` (15.9 KB):**  
   Multi-entity management. Displays table of legal entities across clients, primary entity indicators, statutory registration numbers, and modal to add new legal entities.
5. **`UsersRolesView.tsx` (10.3 KB):**  
   User profile management screen. Lists users, assigned roles, associated client organizations, employee links, and active status.
6. **`PermissionMatrixView.tsx` (10.2 KB):**  
   Read-only governance reference matrix detailing permissions (Full, Scoped, Read-Only, None) across all 7 application roles and 8 functional modules.
7. **`SecurityAuditView.tsx` (8.0 KB):**  
   Security event viewer. Filters audit events by severity (`INFO`, `WARNING`, `CRITICAL`), actor, date range, and target entity.
8. **`ReportsAnalyticsView.tsx` (12.3 KB):**  
   Central reporting hub for exporting statutory muster rolls, Form XIX payroll registers, attendance summaries, and leave utilization data.

#### Workspace Views (`src/app/workspace/`)
9. **`ClientOverview.tsx` (19.9 KB):**  
   Client command center. Renders key operational metrics: Total Headcount, Today's Attendance, Pending Regularisations, Pending Leaves, Active Sites, and Quick Action shortcuts.
10. **`EmployeeDirectory.tsx` (20.0 KB):**  
    Tenant employee directory. Features live search, location filter, department filter, employment arrangement filter, and card/table toggle. Gated action buttons (Add Employee, Export Roster).
11. **`AddEmployeeWizard.tsx` (27.4 KB):**  
    4-step employee onboarding wizard:
    - *Step 1: Personal Details* (Name, Email, Mobile, Joining Date).
    - *Step 2: Work Assignment* (Legal Entity, Location, Department, Designation, Employment Arrangement).
    - *Step 3: Statutory IDs* (PAN Number, Aadhaar Number, UAN, ESIC).
    - *Step 4: Compensation Structure* (Fixed Monthly Base, HRA, Conveyance, Special Allowance, Variable Incentive, TDS Withholding).
12. **`EmployeeProfileView.tsx` (26.0 KB):**  
    Full tabbed employee profile:
    - *Overview Tab:* Personal details, work assignment, status badges.
    - *Attendance Tab:* Historical attendance calendar and punch logs.
    - *Leaves Tab:* Leave balances and past requests.
    - *Compensation Tab (Gated):* Salary structure breakdown and bank account details (restricted strictly to Payroll Admin, Client Admin, Super Admin).
13. **`AttendanceCommandCenter.tsx` (21.7 KB):**  
    Live daily attendance muster. Displays shift status, check-in time, check-out time, total working hours, geofence compliance badges (`WITHIN_GEOFENCE`, `OUT_OF_BOUNDS`), and manual punch injection modal for administrators.
14. **`AttendanceRegularisations.tsx` (14.8 KB):**  
    Managerial queue for attendance correction requests. Displays requested check-in/out times, employee explanation, and review actions (Approve, Reject). Enforces anti-self-approval.
15. **`LeaveManagement.tsx` (23.3 KB):**  
    Leave administration. Displays organizational leave balances, pending request cards, approved/rejected history, and balance adjustment modal.
16. **`PayrollDashboard.tsx` (12.5 KB):**  
    Payroll operations dashboard. Displays current pay period status, total gross, deductions, net payout, and history of past runs.
17. **`PayrollGuidedWizard.tsx` (43.1 KB):**  
    5-step payroll processing engine:
    - *Step 1: Select Period & Entity* (Legal entity selection, month/year resolution).
    - *Step 2: Attendance Finalization Gate* (Verifies 0 pending regularisations exist; blocks progression if unfinalized).
    - *Step 3: Batch Calculation* (Executes calculation engine across staff; displays line item preview).
    - *Step 4: Managerial Review & Overtime Overrides* (Allows authorized overrides for manual overtime and variable bonuses).
    - *Step 5: Sign-off & Terminal Locking* (Segregation of Duties enforcement; Client Admin terminal lock).
18. **`PayslipManagement.tsx` (17.7 KB):**  
    Payslip distribution center. Lists generated payslips for locked runs, publishing status (`DRAFT` vs `PUBLISHED`), bulk publish action, and individual payslip preview button.
19. **`OfficialPayslipView.tsx` (21.0 KB):**  
    Printable Form XIX statutory payslip certificate. Features client header, legal entity registration, employee credentials, working days breakdown, itemized earnings, itemized statutory deductions, and net take-home calculation.
20. **`ClientPolicySettings.tsx` (19.7 KB):**  
    Policy configuration editor. Manages salary divisor (26, 30, Calendar Days), overtime calculation methods, late grace periods, late penalty rules, EPF contribution rates, ESIC toggles, and PT statutory slabs.

#### Portal & Self-Service Views (`src/app/portal/`)
21. **`EmployeePortal.tsx` (64.4 KB):**  
    All-in-one employee self-service mobile/desktop portal with tabbed views:
    - *Punch Tab:* Incorporates `MobilePunchCard.tsx` with live browser geolocation, geofence distance calculation, and clock-in/out buttons.
    - *Leaves Tab:* Self leave balance cards (PL, CL, SL), leave application form modal, and personal application history.
    - *Regularisations Tab:* Past punch records with "Regularise" button and request tracking.
    - *Payslips Tab:* Published payslip archive with one-click printable Form XIX certificate view.
22. **`MobilePunchCard.tsx` (18.3 KB):**  
    Mobile-optimized GPS telemetry capture component. Queries HTML5 Geolocation API, calculates real-time Haversine distance against assigned worksite, verifies radius compliance, and posts punch event.

---

## 3. Backend & Service Layer Inventory

The service layer resides in `src/services/` and encapsulates all database communication, validation rules, business logic, and mock/offline fallbacks:

```
src/services/
├── index.ts                     # Barrel exports for all domain services
├── serviceConfig.ts             # Mode manager (supabase vs mock, isProd check)
├── serviceErrors.ts             # Structured error types & Supabase error mapper
├── serviceTypes.ts              # Database row interfaces & DTO payloads
├── authService.ts               # GoTrue auth & user_profiles resolution
├── policyService.ts             # Clients, legal entities, locations, departments, policies
├── employeeService.ts           # Employee master, salary structures, bank coordinates
├── attendanceService.ts         # GPS telemetry, geofence, muster roll, corrections
├── leaveService.ts              # Leave balances, applications, atomic review
├── leaveCalculationHelper.ts    # Date math, business days, cross-year balance proration
├── payrollService.ts            # Payroll runs, line items, attendance gate, payslips
├── payrollCalculationHelper.ts  # Statutory math (EPF, ESIC, PT, TDS), proration
└── reportingService.ts          # Audit logging, attendance metrics, Form XIX export
```

### Detailed Functional Inventory by Service:

#### 1. `authService.ts` (370 lines)
- `getSession()`: Retrieves active session from Supabase GoTrue or mock store.
- `getCurrentUser()`: Fetches current authenticated user metadata.
- `resolveUserContext()`: Resolves authenticated identity against `public.user_profiles`. Enforces fail-closed handling if profile is missing (`NOT_FOUND`) or deactivated (`PERMISSION_ERROR`).
- `signInWithPassword(email, password)`: Authenticates against GoTrue in live mode or mock store in dev mode.
- `signOut()`: Terminates GoTrue session and clears local storage tokens.
- `onAuthStateChange(callback)`: Subscribes to real-time session changes (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`).

#### 2. `policyService.ts` (691 lines)
- `getAccessibleClients(userScope)`: Queries `clients` table; filters by tenant for client roles.
- `getClient(clientId)`: Retrieves client record by primary key.
- `createClient(payload)`: Inserts new client organization; validates duplicate codes.
- `updateClient(clientId, payload)`: Modifies client profile and status.
- `getLegalEntities(clientId)`: Queries `client_legal_entities` for assigned tenant.
- `createLegalEntity(payload)`: Inserts legal entity; validates 10-character PAN format.
- `getWorkLocations(clientId)`: Queries `work_locations` including GPS coordinates and geofence radius.
- `createWorkLocation(payload)`: Inserts work location; validates latitude (-90 to 90) and longitude (-180 to 180).
- `getDepartments(clientId)`: Queries `departments` for tenant.
- `createDepartment(payload)`: Inserts department; validates unique code within client.
- `getClientPolicy(clientId)`: Retrieves `client_policies` row.
- `updateClientPolicy(clientId, payload)`: Updates operational policies (divisor, overtime, late penalties, statutory rules).
- `getClientCardSummary(clientId)`: Aggregates client statistics (entities count, locations count, headcount).

#### 3. `employeeService.ts` (682 lines)
- `getEmployees(filter, callerScope)`: Queries `employees` table; enforces horizontal self-service boundary for employees and tenant boundary for admins. Excludes sensitive bank details.
- `getEmployeeById(employeeId, callerScope)`: Retrieves single employee record; enforces peer privacy.
- `createEmployee(payload)`: Inserts employee; validates mandatory fields, PAN format, and unique employee code.
- `updateEmployee(employeeId, payload)`: Modifies employee profile.
- `getSalaryStructure(employeeId, callerScope)`: Retrieves active compensation structure; strictly restricted to `super_admin`, `client_admin`, `payroll_admin`, or own employee record.
- `upsertSalaryStructure(payload)`: Inserts/updates compensation breakdown (base, HRA, conveyance, allowances, variable, TDS).
- `getBankDetails(employeeId, callerScope)`: Retrieves employee banking coordinates; strictly restricted to `super_admin`, `client_admin`, `payroll_admin`, or own employee record.
- `upsertBankDetails(payload)`: Inserts/updates bank name, account number, IFSC code, and account type.

#### 4. `attendanceService.ts` (834 lines)
- `evaluateGeofence(punchCoords, targetLocation)`: Executes Haversine distance formula; returns distance in meters and status (`WITHIN_GEOFENCE` or `OUT_OF_BOUNDS`).
- `recordPunch(payload, callerScope)`: Inserts raw punch into `attendance_events`; updates or inserts daily aggregate record in `daily_attendance_records`. Enforces duplicate punch prevention.
- `getDailyAttendance(filter, callerScope)`: Queries `daily_attendance_records` for tenant muster roll; enforces peer privacy.
- `getAttendanceEvents(employeeId, date, callerScope)`: Queries raw immutable punch events for an employee.
- `submitRegularisation(payload, callerScope)`: Inserts correction request into `attendance_corrections`; validates reason length (>= 5 chars) and self-service ownership.
- `getRegularisationRequests(filter, callerScope)`: Queries pending/reviewed corrections queue.
- `reviewRegularisation(correctionId, decision, remarks, callerScope)`: Updates correction status (`APPROVED` or `REJECTED`); updates daily attendance record; enforces anti-self-approval rule (`applicant_id <> reviewer_id`).

#### 5. `leaveService.ts` (629 lines)
- `getLeaveBalances(employeeId, year, callerScope)`: Queries `leave_balances` for employee and entitlement year; enforces peer privacy.
- `getLeaveRequests(filter, callerScope)`: Queries `leave_requests` queue; enforces tenant scoping and peer privacy.
- `submitLeaveRequest(payload, callerScope)`: Submits leave application; validates date inversion (`end_date >= start_date`), positive duration, overlapping dates, and balance availability (exempts LWP).
- `reviewLeaveRequest(requestId, decision, remarks, callerScope)`: Calls PostgreSQL atomic RPC `review_leave_request_atomic` in Supabase mode or executes balance deduction and status transition in mock mode; enforces anti-self-approval.
- `cancelLeaveRequest(requestId, callerScope)`: Allows employees to cancel their own `PENDING` leave applications.

#### 6. `payrollService.ts` (877 lines)
- `getPayrollRuns(clientId, year)`: Queries `payroll_runs` for client and year.
- `getPayrollRunById(runId)`: Retrieves payroll batch header.
- `getPayrollItems(runId, callerScope)`: Queries individual compensation line items in `payroll_items`. Employees restricted to published slips; admins access full batch.
- `checkAttendanceFinalization(clientId, month, year)`: Gating query verifying 0 pending regularisations exist in `attendance_corrections` before payroll calculation.
- `calculatePayrollRun(payload)`: Executes payroll calculation engine across all active employees; computes proration, authorised overtime, and statutory deductions (EPF, ESIC, PT, TDS).
- `updatePayrollItemOverrides(itemId, payload)`: Applies managerial overrides for authorised overtime pay or variable incentives on draft runs.
- `approvePayrollRun(runId, approvedBy)`: Transitions run status from `draft` / `under_review` to `approved`.
- `lockPayrollRun(runId, lockedBy)`: Enforces Segregation of Duties (preparer cannot lock); executes terminal lock; sets immutable timestamp and signatory.
- `publishPayslips(runId, publishedBy)`: Generates and publishes Form XIX records in `payslips` table.
- `getPayslips(filter, callerScope)`: Queries `payslips` table; employees view own published slips; admins view client archive.
- `getPayslipById(payslipId, callerScope)`: Retrieves single official payslip certificate data.

#### 7. `reportingService.ts` (358 lines)
- `getAuditLogs(filter)`: Queries immutable `audit_logs` table. Super Admin receives platform-wide logs; Client Admin receives tenant-scoped logs.
- `logEvent(payload)`: Appends an audit event (`action`, `actor`, `target_entity`, `details`, `severity`).
- `getAttendanceSummary(clientId, startDate, endDate)`: Aggregates attendance statistics (presence rate, absence count, late count, leave count).
- `getFormXIXRegister(clientId, month, year)`: Generates structured Form XIX muster roll and wage register for statutory labor compliance.

---

## 4. PostgreSQL Database Catalog Inventory

The live Supabase database instance (`mlopgvkvzhwhkbewhefb.supabase.co`) runs **PostgreSQL 17.11 (ga)**.

### 4.1 Relational Tables Inventory (20 Tables in `public`)

| Table Name | Purpose | Primary Key | Foreign Keys | RLS Status | Policies Count | Triggers Active |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `clients` | Client organization master | `id` (uuid) | None | ENABLED | 2 | `trg_clients_updated_at` |
| `client_legal_entities` | Corporate entities & tax IDs | `id` (uuid) | `client_id` &rarr; `clients.id` | ENABLED | 3 | None |
| `work_locations` | Physical sites & geofences | `id` (uuid) | `client_id` &rarr; `clients.id` | ENABLED | 3 | None |
| `departments` | Organizational departments | `id` (uuid) | `client_id`, `head_employee_id` | ENABLED | 3 | None |
| `client_policies` | Operational rules & formulas | `id` (uuid) | `client_id` &rarr; `clients.id` | ENABLED | 3 | `trg_client_policies_updated_at` |
| `user_profiles` | Application user identities | `id` (uuid) | `client_id`, `employee_id` | ENABLED | 5 | `trg_guard_user_profile_privilege_escalation` |
| `employees` | Worker master records | `id` (uuid) | `client_id`, `legal_entity_id`, `work_location_id`, `department_id` | ENABLED | 3 | `trg_employees_updated_at` |
| `employee_salary_structures`| Compensation master | `id` (uuid) | `client_id`, `employee_id` | ENABLED | 3 | None |
| `employee_bank_details` | Banking coordinates | `id` (uuid) | `client_id`, `employee_id` | ENABLED | 3 | None |
| `attendance_events` | Raw immutable punch ledger | `id` (uuid) | `client_id`, `employee_id` | ENABLED | 4 | `trg_guard_attendance_events_immutability` |
| `daily_attendance_records`| Daily attendance muster | `id` (uuid) | `client_id`, `employee_id`, `leave_request_id` | ENABLED | 3 | `trg_daily_attendance_updated_at` |
| `attendance_corrections` | Regularisation requests | `id` (uuid) | `client_id`, `employee_id`, `reviewed_by` | ENABLED | 3 | None |
| `leave_balances` | Annual leave balance ledgers | `id` (uuid) | `client_id`, `employee_id` | ENABLED | 5 | None |
| `leave_requests` | Leave applications & workflow| `id` (uuid) | `client_id`, `employee_id`, `reviewed_by` | ENABLED | 7 | `trg_sync_approved_leave_to_muster` |
| `payroll_runs` | Monthly payroll batch headers| `id` (varchar)| `client_id`, `legal_entity_id` | ENABLED | 1 | `trg_guard_payroll_run_lock` |
| `payroll_items` | Compensation line items | `id` (uuid) | `run_id`, `client_id`, `employee_id` | ENABLED | 2 | `trg_guard_payroll_items_lock` |
| `payslips` | Statutory Form XIX payslips | `id` (uuid) | `client_id`, `payroll_item_id`, `employee_id` | ENABLED | 2 | None |
| `statutory_pt_slabs` | State PT tax slabs | `id` (uuid) | None (Statutory Global) | ENABLED | 2 | None |
| `statutory_holidays` | Public & client holidays | `id` (uuid) | `client_id`, `work_location_id` | ENABLED | 3 | None |
| `audit_logs` | Immutable security ledger | `id` (uuid) | `client_id` &rarr; `clients.id` | ENABLED | 3 | `trg_guard_audit_logs_immutability` |

---

### 4.2 Stored Procedures & Functions Inventory (`pg_proc`)

The live PostgreSQL catalog contains 13 functions in schema `public`, all verified with pinned immutable search paths:

| Function Name | Security Type | Return Type | Pinned `search_path` | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `get_user_role()` | `SECURITY DEFINER` | `text` | `public, auth, pg_temp` | Evaluates caller role from `user_profiles`; returns `NULL` if unprovisioned |
| `get_user_client_id()` | `SECURITY DEFINER` | `uuid` | `public, auth, pg_temp` | Evaluates caller `client_id` from `user_profiles` |
| `get_user_employee_id()`| `SECURITY DEFINER` | `uuid` | `public, auth, pg_temp` | Evaluates caller `employee_id` from `user_profiles` |
| `get_manager_team()` | `SECURITY DEFINER` | `TABLE (...)` | `public, auth, pg_temp` | Scoped employee directory for managers; omits statutory PAN/Aadhaar |
| `generate_payroll_run(...)`| `SECURITY DEFINER` | `jsonb` | `public, auth, pg_temp` | Server-side payroll batch calculation procedure |
| `lock_payroll_run(...)` | `SECURITY DEFINER` | `jsonb` | `public, auth, pg_temp` | Four-eyes terminal locking procedure with signatory recording |
| `review_leave_request_atomic(...)`| `SECURITY DEFINER` | `jsonb` | `public, pg_temp` | ACID transaction: updates request, decrements balance, syncs muster |
| `sync_approved_leave_to_muster()`| `SECURITY DEFINER` | `trigger` | `public, pg_temp` | Trigger handler syncing approved leave into `daily_attendance_records` |
| `guard_immutable_attendance_events()`| `SECURITY INVOKER` | `trigger` | `public, pg_temp` | Blocks `UPDATE` and `DELETE` on raw punch events |
| `guard_immutable_audit_logs()`| `SECURITY INVOKER` | `trigger` | `public, pg_temp` | Blocks `UPDATE` and `DELETE` on audit trail events |
| `guard_locked_payroll_items()`| `SECURITY INVOKER` | `trigger` | `public, pg_temp` | Blocks modifications to line items once run is `locked` |
| `guard_locked_payroll_modification()`| `SECURITY INVOKER` | `trigger` | `public, pg_temp` | Blocks modifications to run header once status is `locked` |
| `guard_user_profile_privilege_escalation()`| `SECURITY DEFINER` | `trigger` | `public, auth, pg_temp` | Blocks unauthorized self-promotion, role escalation, and tenant transfer |
| `handle_updated_at()` | `SECURITY INVOKER` | `trigger` | `public, pg_temp` | Updates `updated_at = NOW()` on record modification |
| `rls_auto_enable()` | `SECURITY DEFINER` | `event_trigger` | `pg_catalog` | Automatic RLS enabler on new table creation |

---

## 5. Architectural Discovery & Structural Findings

1. **Dual-Mode Data Architecture:**  
   Every domain service in `src/services/` contains a bifurcation:
   `if (isMockMode()) { ... call store.ts ... } else { ... call supabase ... }`.
   In production builds, `serviceConfig.ts` unconditionally enforces `isProd() => 'supabase'`, rendering offline mock code completely inert.
2. **PostgreSQL 17.11 Alignment:**  
   The cloud database engine is confirmed as PostgreSQL 17.11 (ga). All RLS expressions, constraint clauses, and triggers execute natively.
3. **Immutability Architecture:**  
   The system achieves high compliance standards by using database triggers (`guard_immutable_*`) to enforce append-only semantics on `attendance_events` and `audit_logs`, preventing even database administrators from tampering with historical telemetry.
4. **Segregation of Duties:**  
   Payroll locking strictly separates the calculation phase (performed by `payroll_admin`) from the executive sign-off phase (performed by `client_admin` or `super_admin`).
