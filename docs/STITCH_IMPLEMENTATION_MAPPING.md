# Avencis Workforce Management (Module 01)
# Stitch Screen Implementation & Route Mapping Matrix

---

**Document Reference:** `docs/STITCH_IMPLEMENTATION_MAPPING.md`  
**Mapping Date:** 03 November 2026  
**Stitch Reference:** 29 Verified Screens (Batches 01 & 02, Project `7110891243283730606`)  
**Target Architecture:** React 18 + TypeScript + Vite + Tailwind CSS  

---

## 1. Master Route & Component Architecture

The 29 exported Stitch screens are systematically mapped to the operational application routing hierarchy:

```
/ (Root Redirect based on User Role & Active Context)
│
├── /login                                  --> Screen 05 (B01) Enterprise Login
│
├── /admin                                  --> Screen 08 (B01) Org Admin Dashboard & Screen 02 (B01) Executive Overview
│   ├── /clients                            --> Screen 12 (B01) Client Directory
│   ├── /clients/onboard                    --> Screen 11 (B01) Onboarding Multi-Step Wizard
│   ├── /entities                           --> Screen 10 (B01) Legal Entities Management
│   ├── /users                              --> Screen 09 (B02) Users & Access Control
│   ├── /permissions                        --> Screen 11 (B02) Enterprise Permission Matrix
│   ├── /audit                              --> Screen 13 (B02) Security Audit Logs & Governance
│   └── /reports                            --> Screen 10 (B02) Reports & Analytics
│
├── /workspace/:clientId                    --> Screen 09 (B01) Organisation Overview (Client Scoped)
│   ├── /employees                          --> Screen 01 (B01) & Screen 15 (B01) Employee Directory
│   ├── /employees/add                      --> Screen 11 (B01) Add New Employee (Client Scoped)
│   ├── /employees/:id                      --> Screen 14 (B01) Overview & Screen 13 (B01) Personal KYC
│   ├── /attendance                         --> Screen 01 (B02) Attendance Command Dashboard
│   ├── /attendance/regularisations         --> Screen 04 (B02) Regularisations & Exception Ledger
│   ├── /attendance/reports                 --> Screen 12 (B02) Attendance & Leave Reports Ledger
│   ├── /leave                              --> Screen 05 (B02) Leave Management Dashboard
│   ├── /leave/applications                 --> Screen 02 (B02) Leave Application Register
│   ├── /payroll                            --> Screen 03 (B02) Payroll Management Dashboard
│   ├── /payroll/process                    --> Screen 06 (B01) & Screen 06 (B02) Guided Payroll Wizard
│   ├── /payroll/payslips                   --> Screen 07 (B02) Payslip Management
│   ├── /payroll/payslips/:id               --> Screen 08 (B02) Individual Official Payslip Preview
│   └── /settings                           --> Screen 14 (B02) Client Policy Configuration & Profile
│
└── /portal (Employee Self-Service)
    ├── /check-in                           --> Screen 03 (B01) Mobile-Optimised Daily GPS Punch Card
    ├── /profile                            --> Screen 04 (B01) User Profile & Notifications Overlay
    ├── /leave                              --> Screen 02 (B02) Mobile Leave Request Drawer & Balances
    └── /payslips                           --> Screen 08 (B02) Mobile Payslip PDF Viewer
```

---

## 2. Screen-by-Screen Implementation Specifications

| Screen ID | Stitch Screen Name | Batch & Folder | Target Route | Target Role | UI Implementation Strategy |
|---|---|---|---|---|---|
| `74b3433a442e4b5387171512fcaad688` | Enterprise Login | B01: `05-enterprise-login` | `/login` | Public / All | Reusable authentication component with email/password, OTP toggle, and demo persona quick-switcher. |
| `fc8c55816aaa4a1d86826e6af994541a` | Organisation Admin Dashboard | B01: `08-organisation-admin-dashboard` | `/admin` | Super Admin | Central command center with global KPIs, multi-client activity cards, and workspace quick-switcher. |
| `d80109c1221c46798fd55593db1275eb` | Executive Workforce Overview | B01: `02-executive-workforce-overview` | `/admin/workforce` | Super Admin | High-level workforce distribution graphs, client breakdown, and presence charts. |
| `a76fd6e70be846359cd572238883e671` | Client Directory | B01: `12-client-directory` | `/admin/clients` | Super Admin | Interactive grid of client organisations (Suman, Maha India), contract terms, headcount, and "Enter Workspace" CTA. |
| `32707b9b27dd4ec6b9134a0e8a2839af` | Legal Entities Management | B01: `10-legal-entities` | `/admin/entities` | Super Admin | Corporate registration cards, statutory numbers (PAN, GSTIN, PF/ESIC establishment codes) per client entity. |
| `015277d5045549818051ece4e5dc2f84` | Organisation Overview | B01: `09-organisation-overview` | `/workspace/:clientId` | Super / Client Admin | Client workspace landing page displaying active branches, workforce headcount, and operational quick links. |
| `4f1d5879d9ac4234afcfa38886e250e0` | Employees & Directory | B01: `01-employees-directory` | `/workspace/:clientId/employees` | Super / Client Admin | Master data table with search, department filtering, status badges, and action dropdowns. |
| `545bff9e19194977901c102bdcd1b348` | Employee Directory (Team View) | B01: `15-employee-directory` | `/workspace/:clientId/team` | Client Supervisor | High-density card/grid view showing team presence and reporting hierarchy without salary details. |
| `54a9c26fab1641fcbb72183c0156cbb4` | Add New Employee | B01: `11-add-employee` | `/workspace/:clientId/employees/new` | Super / Client Admin | 5-step guided wizard: Personal -> Employment & Client -> Compensation -> Bank & Statutory -> Documents. |
| `e16e6a95e8cd470c81eece3434043f36` | Employee Profile: Overview | B01: `14-employee-profile-overview` | `/workspace/:clientId/employees/:id` | Super / Client Admin | Profile header with key metadata, current shift, leave balance pills, and recent attendance log. |
| `b808814eaec44fdfa2d3399ba36debac` | Employee Profile: Personal Info | B01: `13-employee-personal-information` | `/workspace/:clientId/employees/:id/kyc` | Super / Client Admin | Deep KYC profile with identity cards (PAN, Aadhaar), emergency contacts, and bank details. |
| `55b51c7caa4a44299faae4df84964a9f` | Daily Attendance & GPS Verification | B01: `03-daily-attendance-gps` | `/portal/check-in` | Employee | Ergonomic check-in/out punch widget, live GPS coordinates, geofence status pill, and today's shift timeline. |
| `71a0521667a7483f99f281fb4ae88047` | Notifications & User Profile Overlays | B01: `04-notifications-user-profile` | Global Overlay | All Roles | Slide-over notification center with alerts (pending leave, regularisation requests, payroll reminders). |
| `fa1fd6f261104f8d9f5ed56c2382c467` | Application Shell & Architecture | B01: `07-application-shell` | Root Layout | All Roles | Enterprise shell containing collapsible left sidebar, persistent top header, client badge, and profile button. |
| `ec7d8ecc60c7453bbb051582ea9a71b7` | Attendance Overview & Command Dashboard | B02: `01-attendance-command-dashboard` | `/workspace/:clientId/attendance` | Super / Client Admin | Supervisor command dashboard: live present count, late arrivals, missing punches, and location presence map. |
| `5748070f841848ea9afc95304c090b16` | Attendance Regularisations & Exception Ledger | B02: `04-attendance-regularisations` | `/workspace/:clientId/attendance/regularisations` | Super / Client Admin | Exception management queue with Approve/Reject actions, audit comments, and employee justification notes. |
| `5fccb2c4d9744010b8e66a891cdcf9f4` | Attendance & Leave Reports Ledger | B02: `12-attendance-leave-reports` | `/workspace/:clientId/attendance/reports` | Super / Client Admin | Detailed daily and monthly attendance matrix (P, HD, PL, LWP, WO, PH) with CSV export. |
| `d22afe6263f149ffbbe5f339f451faa1` | Leave Management Dashboard | B02: `05-leave-management-dashboard` | `/workspace/:clientId/leave` | Super / Client Admin | Leave balance utilization charts, pending approval count, departmental absence calendar. |
| `1ad3c83327e94a218b586619534d6f0f` | Leave Application Register | B02: `02-leave-application-register` | `/workspace/:clientId/leave/applications` | Super / Client Admin | Application log with leave type badges, date ranges, balance debit preview, and manager decision drawer. |
| `395c86334fbc4762b120aa2db036efde` | Payroll Management Dashboard | B02: `03-payroll-management-dashboard` | `/workspace/:clientId/payroll` | Super / Payroll Admin | Monthly payroll cycle overview, salary disbursement timeline, pending processing alerts, and historical register. |
| `b48bf0b9951b4c9e8b8a546fbab4b8a8` | Payroll Run & Processing | B01: `06-payroll-processing` | `/workspace/:clientId/payroll/runs` | Super / Payroll Admin | Historical payroll run ledger showing pay periods, total gross, deductions, net salary, and lock status. |
| `e90ca6a75bc34ffeb591065e106a9911` | Payroll Run & Guided Processing | B02: `06-payroll-guided-processing` | `/workspace/:clientId/payroll/wizard` | Super / Payroll Admin | 5-step interactive payroll wizard: Attendance Lock -> Leave Deductions -> Incentives -> Statutory -> Final Lock. |
| `5e0b0a0aa90449ddb33023f1c350668e` | Payslip Management Dashboard | B02: `07-payslip-management` | `/workspace/:clientId/payroll/payslips` | Super / Payroll Admin | Batch payslip issuance register with download all, email distribution, and revision increment history. |
| `c9d381730a8b4f14a07d43267ca1714f` | Individual Payslip Preview & Official Template | B02: `08-individual-payslip-preview` | `/workspace/:clientId/payroll/payslips/:id` | All Roles | Printable official salary slip displaying client branding, legal entity registration, earnings, deductions, and net wage. |
| `4dcc6203c6754e36ab749fd86d2a07df` | Users & Access Control Dashboard | B02: `09-users-access-control` | `/admin/users` | Super Admin | Administrator and manager user accounts, client scope tags, invitation modals, and active states. |
| `e0e4d86fb6014df3ab7ebc85e99dd416` | Enterprise Permission Matrix | B02: `11-permission-matrix` | `/admin/permissions` | Super Admin | Matrix of modules vs roles with interactive toggle checkboxes for View, Create, Edit, Delete, Approve, Export. |
| `6e882b45a0684513869d482ced55729a` | Reports & Analytics Dashboard | B02: `10-reports-analytics` | `/workspace/:clientId/reports` | Super / Client Admin | Configurable report generator with pre-built templates for payroll registers, PF/ESIC filings, and attendance. |
| `7a96a9f854444039b29f6e45b401b562` | Security Audit Logs & Governance Ledger | B02: `13-security-audit-logs` | `/admin/audit` | Super Admin | Immutable audit log capturing user actions, timestamps, IP addresses, pre/post states, and security severities. |
| `570ed7d798de485686a608552e94c93a` | Organisation Settings & Profile | B02: `14-organisation-settings` | `/workspace/:clientId/settings` | Super / Client Admin | Client-level configuration center for the 20 policy domains, shift rules, working hours, and fiscal calendar. |

---

## 3. Reusable UI Component Extraction Plan

To prevent monolithic code duplication, key UI patterns from the Stitch screens are extracted into modular components:
1. `AppLayout`: Master application shell hosting `Sidebar`, `TopNav`, `ClientContextBar`, and main viewport.
2. `ClientSwitcher`: Dropdown in the header allowing Super Admins to switch active client workspace instantly.
3. `StatCard`: Standardized metric card displaying title, value, change indicator, and icon.
4. `DataTable`: Paginated data table with sorting, search, column filtering, and action menus.
5. `StatusBadge`: Color-coded pill component supporting states (Active, Inactive, Present, Absent, Pending, Approved, Locked).
6. `Modal` & `SlideOver`: Dialog overlays for forms, confirmations, and notification feeds.
7. `FormWizard`: Step-by-step wizard shell with progress bar and validation used in Onboarding and Payroll Processing.
8. `PayslipTemplate`: Formal corporate document layout ready for print or PDF download.
