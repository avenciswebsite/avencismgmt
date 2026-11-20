# AVENCIS WORKFORCE MANAGEMENT
# NAVIGATION AND ROUTE AUDIT REPORT

**Date of Audit:** November 03, 2026  
**Auditor:** Antigravity System Engineer  
**Scope:** Complete structural audit of all application routes, navigation triggers, path parameters, role guards, and back-navigation pathways.

---

## 1. Route Registry and Trigger Mapping

| Route Path | Associated View / Component | Trigger Elements / Buttons | Role Permissions | Notes / Status |
|---|---|---|---|---|
| `/login` | `LoginView` | Logout button in `TopNav`, Direct URL access, Unauthenticated session redirect | Public | VERIFIED WORKING |
| `/` | `RootRedirect` | Browser root URL, Root navigation links | All Roles | Redirects to `/admin/dashboard`, `/workspace/overview`, or `/portal` based on `user.role` |
| `/admin/dashboard` | `MasterDashboard` | Sidebar `Master Dashboard`, Back from Workspace button | `super_admin` | VERIFIED WORKING |
| `/admin/clients` | `ClientDirectoryView` | Sidebar `Clients Directory`, Master Dashboard `View All Clients` | `super_admin` | VERIFIED WORKING |
| `/admin/onboard` | `ClientOnboardWizard` | Sidebar `Onboard New Client`, Master Dashboard `Onboard New Client` | `super_admin` | VERIFIED WORKING |
| `/admin/entities` | `LegalEntitiesView` | Sidebar `Legal Entities` | `super_admin` | VERIFIED WORKING |
| `/admin/users` | `UsersRolesView` | Sidebar `Users & Roles` | `super_admin` | VERIFIED WORKING |
| `/admin/permissions` | `PermissionMatrixView` | Sidebar `Permission Matrix` | `super_admin` | VERIFIED WORKING |
| `/admin/audit` | `SecurityAuditView` | Sidebar `Security Audit Logs`, Master Dashboard `View Full Security Ledger` | `super_admin` | VERIFIED WORKING |
| `/admin/reports` | `ReportsAnalyticsView` | Sidebar `Reports & Analytics` | `super_admin` | VERIFIED WORKING |
| `/workspace/overview` | `ClientOverview` | Sidebar `Overview`, Master Dashboard `Enter Workspace` cards | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/employees` | `EmployeeDirectory` | Sidebar `Employees`, Workspace Overview quick link | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/employees/add` | `AddEmployeeWizard` | Employee Directory `Add Employee` button | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/employees/:id` | `EmployeeProfileView` | Employee Directory table rows | `super_admin`, `client_admin` | Dynamic route parameter |
| `/workspace/attendance` | `AttendanceCommandCenter` | Sidebar `Attendance`, Workspace Overview quick link | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/regularisations`| `AttendanceRegularisations` | Sidebar `Regularisations` | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/leaves` | `LeaveManagement` | Sidebar `Leaves`, Workspace Overview quick link | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/payroll` | `PayrollDashboard` | Sidebar `Payroll`, Workspace Overview quick link | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/payroll/run` | `PayrollGuidedWizard` | Payroll Dashboard `Run Payroll Wizard` button | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/payslips` | `PayslipManagement` | Sidebar `Payslips`, Payroll Wizard final redirect | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/payslips/view/:id`| `OfficialPayslipView` | Payslip Management table `View Form XIX` button | `super_admin`, `client_admin` | Dynamic route parameter |
| `/workspace/policies` | `ClientPolicySettings` | Sidebar `Policy Settings`, Client Directory `Configure Policies` | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/workspace/reports` | `ReportsAnalyticsView` | Sidebar `Reports` | `super_admin`, `client_admin` | Scoped by `activeClientId` |
| `/portal` | `EmployeePortal` | Sidebar `Employee Home`, Root redirect for employees, Bottom footer quick link | `employee`, `super_admin` | Persistent header & tabs |
| `/portal/employee` | `EmployeePortal` | Legacy route redirect, Persona switcher redirect | `employee`, `super_admin` | Preserved for backwards compatibility |
| `/portal/punch` | `EmployeePortal (defaultTab='punch')` | Sidebar `Attendance & Punch` | `employee`, `super_admin` | Activates Punch Card tab |
| `/portal/check-in` | `EmployeePortal (defaultTab='punch')` | Legacy mobile link, Sidebar footer link | `employee`, `super_admin` | Activates Punch Card tab |
| `/portal/leave` | `EmployeePortal (defaultTab='leaves')` | Sidebar `Leave Requests` | `employee`, `super_admin` | Activates Leave Center tab |
| `/portal/leaves` | `EmployeePortal (defaultTab='leaves')` | Alternative route path | `employee`, `super_admin` | Activates Leave Center tab |
| `/portal/regularisations` | `EmployeePortal (defaultTab='regularisations')` | Sidebar `Regularisations` | `employee`, `super_admin` | Activates Regularisations tab |
| `/portal/payslips` | `EmployeePortal (defaultTab='payslips')` | Sidebar `My Payslips` | `employee`, `super_admin` | Activates My Payslips tab |
| `*` | `Navigate to="/"` | Invalid URLs | All Roles | Fallback redirection |

---

## 2. Issues Discovered and Corrections Made

### Issue 1: Disappearing Employee Header and Broken Portal Routes
- **Original Condition:** In `Sidebar.tsx`, employee navigation links were pointed to `/portal`, `/portal/check-in`, `/portal/leave`, `/portal/payslips`. However, `App.tsx` did not define these routes. Only `/portal/employee` and `/portal/punch` existed. As a result, clicking any sidebar item triggered the wildcard fallback (`*`), causing full remounts and redirects where the welcome header disappeared.
- **Correction Applied:** Mapped all employee routes (`/portal`, `/portal/employee`, `/portal/punch`, `/portal/check-in`, `/portal/leave`, `/portal/regularisations`, `/portal/payslips`) in `App.tsx` to `EmployeePortal` with the persistent layout intact.
- **Verification:** Clicking any sidebar link or portal tab now preserves the persistent header and all 4 tabs seamlessly without unmounting.

### Issue 2: Payslip Redirection Eviction
- **Original Condition:** In the Employee Portal under "My Payslips", the "View & Print" button executed `navigate('/workspace/payslips/view/${currentEmp.id}')`, which kicked the employee out of their portal layout into the administrator's workspace view.
- **Correction Applied:** Replaced the route ejection with an in-place Form XIX modal dialog rendered directly within `EmployeePortal.tsx`. The modal contains the full statutory Form XIX breakdown, employer legal registration, print button, and download button.
- **Verification:** The employee can view, print, and download their official payslip while remaining 100% within the employee self-service portal context.

### Issue 3: Missing Regularisation Link in Employee Sidebar
- **Original Condition:** The employee sidebar had links for Home, Check-In, Leave, and Payslips, but was missing a direct navigation link for Attendance Regularisations.
- **Correction Applied:** Added `<NavLink to="/portal/regularisations">` with the `ShieldCheck` icon into `Sidebar.tsx`.
- **Verification:** Regularisations is now directly accessible from both the sidebar and the persistent portal tab bar.

---

## 3. Back-Navigation Pathways Audit

| Origin Page | Destination Page | Control Element | Implementation Status |
|---|---|---|---|
| `/workspace/*` (Any workspace view) | `/admin/dashboard` | "Back to Master Dashboard" banner link in sidebar | VERIFIED WORKING (Visible to Super Admin) |
| `/workspace/employees/add` | `/workspace/employees` | "Cancel & Return" button in wizard header | VERIFIED WORKING |
| `/workspace/employees/:id` | `/workspace/employees` | "Back to Employee Directory" breadcrumb link | VERIFIED WORKING |
| `/workspace/payroll/run` | `/workspace/payroll` | "Cancel & Exit Wizard" button in step 1 | VERIFIED WORKING |
| `/workspace/payslips/view/:id` | `/workspace/payslips` | "Back to Payslip List" button in header | VERIFIED WORKING |
| `/portal` (Payslip Modal) | `/portal` | Close (`X`) button in top-right of modal | VERIFIED WORKING |

---

## 4. Role-Guard and Context Isolation Audit

- **Super Admin Role:** Can switch between global platform view (`/admin/*`), all client workspaces (`/workspace/*`), and employee self-service view (`/portal`).
- **Client Admin Role:** Restricted to their assigned client workspace (`/workspace/*`). Attempting to navigate to `/admin/*` displays the client scope and prevents cross-tenant access.
- **Employee Role:** Restricted to `/portal`. The sidebar renders only employee self-service links. Unauthenticated or foreign route attempts redirect directly to `/portal`.
