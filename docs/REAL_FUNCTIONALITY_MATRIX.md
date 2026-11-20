# AVENCIS WORKFORCE MANAGEMENT (MODULE 01)
## REAL FUNCTIONALITY MATRIX — FIRST WORKING DRAFT

**Audit Date:** 03 November 2026  
**Auditor:** Antigravity Master Technical Audit System  
**Classification Standard:** Strict Operational Reality  

---

### Classification Legend

- **`VERIFIED WORKING`**: Feature operates end-to-end; business logic executes and state mutates predictably.
- **`IMPLEMENTED BUT NOT TESTED`**: Feature code exists and compiles cleanly, but automated integration tests have not executed.
- **`PARTIALLY IMPLEMENTED`**: Core interaction works, but edge cases, calculations, or integrations contain hardcoded stubs or incomplete logic.
- **`UI ONLY`**: Visual controls, forms, or displays exist in React, but no underlying calculation or data engine processes them.
- **`MOCK DATA`**: Interface renders static pre-seeded fixtures; data does not originate from live database queries or user actions.
- **`NOT IMPLEMENTED`**: Architectural capability planned or documented, but zero executable code exists in the codebase.
- **`BLOCKED`**: Feature cannot be executed due to missing infrastructure (e.g. absent backend database or hardware terminal).

---

### Detailed Feature-by-Feature Matrix

| Category | Feature / Workflow | Implemented Component / Function | Operational Reality | Status |
|---|---|---|---|:---:|
| **Auth & Access** | User Login with Credentials | `src/app/auth/LoginView.tsx` | Accepts any password; matches email against `mockData.ts`. No backend verification. | **MOCK DATA** |
| **Auth & Access** | Session Persistence | `src/context/AuthContext.tsx` | Unencrypted JSON written to `localStorage`. Zero cryptographic signature. | **PARTIALLY IMPLEMENTED** |
| **Auth & Access** | Role Switching (Persona Switcher) | `TopNav.tsx`, `LoginView.tsx` | Changes React state and `localStorage`. No server-side session. | **VERIFIED WORKING** |
| **Auth & Access** | Route Protection / Auth Guards | `src/App.tsx` | No route guards. Authenticated employee can access `/admin/dashboard` directly via URL. | **NOT IMPLEMENTED** |
| **Multi-Tenancy** | Client Workspace Switcher | `src/context/WorkspaceContext.tsx` | Filters active client in UI. Super Admin can switch; Client Admin locked in UI. | **VERIFIED WORKING** |
| **Multi-Tenancy** | Database Tenant Isolation (RLS) | N/A | No database exists. All records reside in shared client-side memory. | **BLOCKED** |
| **Organisation** | Client Organisation CRUD | `ClientOnboardWizard.tsx`, `store.createClient` | Saves new client to `localStorage`. Persists across refresh. | **VERIFIED WORKING** |
| **Organisation** | Client Legal Entities Master | `LegalEntitiesView.tsx`, `store.addLegalEntity` | Form creates entity in memory, but **resets to default mock data on refresh**. | **PARTIALLY IMPLEMENTED** |
| **Organisation** | Work Locations & Geofences | `ClientOnboardWizard.tsx`, `store.addLocation` | Sets coordinates and radius in memory, but **resets to default on refresh**. | **PARTIALLY IMPLEMENTED** |
| **Policy Engine** | Policy Form Configuration | `ClientPolicySettings.tsx` | Form updates all 20 domains in `localStorage`. Persists across refresh. | **VERIFIED WORKING** |
| **Policy Engine** | 01. Overtime Method | `store.ts` | Parameter stored, but zero calculation code references it. | **UI ONLY** |
| **Policy Engine** | 02. Overtime Rate Multiplier | `store.ts` | Parameter stored, but zero calculation code references it. | **UI ONLY** |
| **Policy Engine** | 03. Late Grace Minutes | `store.ts` | Parameter stored; punches are not checked against grace window. | **UI ONLY** |
| **Policy Engine** | 04. Late Penalty Rule | `store.ts` | Parameter stored; no automatic half-day or CL deduction triggers. | **UI ONLY** |
| **Policy Engine** | 05. Overnight Shift Attribution | `store.ts` | Parameter stored; check-ins attribution date is not shifted. | **UI ONLY** |
| **Policy Engine** | 06. Standard Working Hours | `store.ts` | Parameter stored; fixed at 9.0h in display only. | **UI ONLY** |
| **Policy Engine** | 07. Half-Day Hours Threshold | `store.ts` | Parameter stored; half-day logic is static in mock seed. | **UI ONLY** |
| **Policy Engine** | 08. Weekly Off Days | `store.ts` | Parameter stored; scheduled shifts do not evaluate off days. | **UI ONLY** |
| **Policy Engine** | 09. Attendance Tracking Mode | `store.ts` | Parameter stored; double vs single punch rules not enforced. | **UI ONLY** |
| **Policy Engine** | 10. Require GPS Telemetry | `store.ts` | Parameter stored; coordinate check is always invoked regardless. | **UI ONLY** |
| **Policy Engine** | 11. Mandatory Selfie Capture | `store.ts` | Parameter stored; no camera interface exists. | **UI ONLY** |
| **Policy Engine** | 12. Enforce Strict Geofence | `store.recordPunch` | Evaluated in punch logging. Flags `isSuspicious = true` if breached. | **VERIFIED WORKING** |
| **Policy Engine** | 13. Supported Leave Types | `store.ts` | Parameter stored; dropdown in form displays hardcoded types. | **UI ONLY** |
| **Policy Engine** | 14. Min Service Days for Leave | `store.ts` | Parameter stored; no tenure validation when applying for leave. | **UI ONLY** |
| **Policy Engine** | 15. Monthly Leave Accrual | `store.ts` | Parameter stored; no automated monthly accrual credit engine. | **UI ONLY** |
| **Policy Engine** | 16. Max Carry-Forward Cap | `store.ts` | Parameter stored; no year-end capping script implemented. | **UI ONLY** |
| **Policy Engine** | 17. Leave Encashment on Exit | `store.ts` | Parameter stored; no encashment payout calculation implemented. | **UI ONLY** |
| **Policy Engine** | 18. Unpaid Leave Deduction Rule | `store.calculatePayrollRun` | Formula deducts prorated base: `fixedSalary - payableBase`. | **PARTIALLY IMPLEMENTED** |
| **Policy Engine** | 19. Salary Calculation Divisor | `store.calculatePayrollRun` | Implements 26 and 30 divisor formulas. Falls back to 30 for calendar. | **VERIFIED WORKING** |
| **Policy Engine** | 20. Statutory Deductions Toggles| `store.calculatePayrollRun` | Evaluates `pfEnabled`, `esicEnabled`, `ptEnabled`, `tdsEnabled`. | **PARTIALLY IMPLEMENTED** |
| **Workforce** | Employee Master Directory | `EmployeeDirectory.tsx`, `store.getEmployees` | Filters by search, department, site. Reads from state. | **VERIFIED WORKING** |
| **Workforce** | Employee Onboarding Wizard | `AddEmployeeWizard.tsx`, `store.addEmployee` | 4-step wizard adds employee to `localStorage`. Persists across refresh. | **VERIFIED WORKING** |
| **Workforce** | Employee Profile & KYC Dossier | `EmployeeProfileView.tsx` | View tabs (Overview, Compensation, Statutory, Leaves, Docs). | **VERIFIED WORKING** |
| **Attendance** | GPS Telemetry & Haversine Math | `store.recordPunch`, `MobilePunchCard.tsx`| Mathematical spherical distance calculation against site coordinates. | **VERIFIED WORKING** |
| **Attendance** | Geofence Boundary Check | `store.recordPunch` | Assigns `WITHIN_GEOFENCE` or `OUT_OF_BOUNDS` accurately based on radius. | **VERIFIED WORKING** |
| **Attendance** | Double-Punch Session Logging | `store.recordPunch` | Records In time and Out time on daily record. | **VERIFIED WORKING** |
| **Attendance** | Raw Event Telemetry Persistence | `store.attendanceEvents` | Events stored in memory only; **lost on browser refresh**. | **PARTIALLY IMPLEMENTED** |
| **Attendance** | Biometric Terminal Sync | N/A | No TCP/IP hardware listener. Simulated via mock records. | **MOCK DATA** |
| **Attendance** | Attendance Command Center | `AttendanceCommandCenter.tsx` | Supervisor presence grid, search, filter, stats. | **VERIFIED WORKING** |
| **Attendance** | Regularisation Request Filing | `EmployeePortal.tsx`, `store.submitCorrection`| Employee submits missed punch date, time, reason. | **VERIFIED WORKING** |
| **Attendance** | Regularisation Review Queue | `AttendanceRegularisations.tsx` | Manager approves/rejects; overlays timestamps on daily record. | **VERIFIED WORKING** |
| **Attendance** | Regularisation Persistence | `store.corrections` | Saved in memory only; **reverts to initial mock on refresh**. | **PARTIALLY IMPLEMENTED** |
| **Leave** | Leave Application Submission | `EmployeePortal.tsx`, `store.submitLeaveRequest`| Validates reason; enters manager review queue. Persists in `localStorage`. | **VERIFIED WORKING** |
| **Leave** | Leave Review & Approval | `LeaveManagement.tsx`, `store.reviewLeaveRequest`| Manager approves/rejects; decrements closing balance in memory. | **VERIFIED WORKING** |
| **Leave** | Leave Balance Ledger Arithmetic | `store.reviewLeaveRequest` | Continuous math: $\text{Closing} = \text{Opening} - \text{Used}$. | **VERIFIED WORKING** |
| **Leave** | Leave Balances Persistence | `store.leaveBalances` | Balances in memory only; **reverts to initial mock on refresh**. | **PARTIALLY IMPLEMENTED** |
| **Leave** | Automated Monthly Accrual | N/A | No cron or monthly scheduled background job running. | **NOT IMPLEMENTED** |
| **Payroll** | Policy Gating Safety Check | `PayrollDashboard.tsx`, `PayrollGuidedWizard` | Blocks payroll execution if client policies are unconfigured. | **VERIFIED WORKING** |
| **Payroll** | Base Proration (26/30 Divisor) | `store.calculatePayrollRun` | $\text{Base} \times (\text{Paid Days} / \text{Divisor})$. | **VERIFIED WORKING** |
| **Payroll** | Unpaid Days Determination | `store.calculatePayrollRun` | **Hardcoded heuristic:** checks `emp.id.endsWith('05')`. Not linked to muster. | **PARTIALLY IMPLEMENTED** |
| **Payroll** | EPF Statutory Deduction | `store.calculatePayrollRun` | $12\%$ of $\min(\text{base}, 15000) = \text{max } ₹1800$. | **VERIFIED WORKING** |
| **Payroll** | ESIC Statutory Deduction | `store.calculatePayrollRun` | $0.75\%$ of gross if base $\le ₹21,000$. | **VERIFIED WORKING** |
| **Payroll** | Professional Tax Deduction | `store.calculatePayrollRun` | Hardcoded flat ₹200. No state slab or February adjustment. | **PARTIALLY IMPLEMENTED** |
| **Payroll** | Income Tax TDS Deduction | `store.calculatePayrollRun` | Hardcoded flat ₹1200 if salary $\ge ₹40,000$. No tax slabs. | **PARTIALLY IMPLEMENTED** |
| **Payroll** | 5-Step Guided Processing Wizard | `PayrollGuidedWizard.tsx` | Step-by-step review, itemised breakdown, totals reconciliation. | **VERIFIED WORKING** |
| **Payroll** | Executive Sign-off & Sealing | `store.saveAndLockPayrollRun` | Sets status to `locked`, creates permanent audit log. Persists in `localStorage`.| **VERIFIED WORKING** |
| **Payslips** | Form XIX Rule 26 A4 Payslip | `OfficialPayslipView.tsx` | Official printable template showing Client Legal Entity, PAN, earnings, deductions.| **VERIFIED WORKING** |
| **Payslips** | Cross-Employee Privacy Guard | `OfficialPayslipView.tsx` | No authorization check. Any user can view another's slip by URL manipulation. | **NOT IMPLEMENTED** |
| **Payslips** | Bulk PDF Archive Export | `PayslipManagement.tsx` | UI trigger shows browser alert; no genuine ZIP generation. | **UI ONLY** |
| **Payslips** | Digital ESS Dispatch | `PayslipManagement.tsx` | Toggles state to DISPATCHED; makes slip visible in employee portal. | **VERIFIED WORKING** |
| **Reports** | Muster & Statutory Reports | `ReportsAnalyticsView.tsx` | Generates interactive tables for Form II, Form XIV, ECR, ESIC, Bank NEFT. | **VERIFIED WORKING** |
| **Reports** | Real XLSX / CSV File Export | `ReportsAnalyticsView.tsx` | Button triggers alert; no actual binary Excel file download generated. | **UI ONLY** |
| **Governance** | Security Audit Logging | `SecurityAuditView.tsx`, `store.logAction` | Immutable append-only log of admin actions. Persists in `localStorage`. | **VERIFIED WORKING** |
| **Mobile ESS** | 390x844 Smartphone Punch Card | `MobilePunchCard.tsx` | Authentic smartphone frame, live clock, GPS coords, punch check-in/out. | **VERIFIED WORKING** |
