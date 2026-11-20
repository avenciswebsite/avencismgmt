# AVENCIS WORKFORCE MANAGEMENT (MODULE 01)
## MOCK VS REAL FUNCTIONALITY REGISTER & EXECUTION PATH TRACES

**Audit Date:** November 03, 2026  
**Auditor:** Antigravity Master Technical Audit System  
**Scope:** Complete feature-by-feature classification and end-to-end execution path tracing.

---

## 1. Classification Categories

Every feature in the application is strictly classified into one of six categories:
- **Category A — Fully Implemented with Persistent Backend:** Connected to a live PostgreSQL/Supabase database; requests execute over the network; mutations write to disk; RLS enforced. *(Currently 0% of codebase)*
- **Category B — Implemented Using Local / In-Memory State Store:** Handled by `AppStore` in `src/data/store.ts`; operations update client-side JavaScript memory arrays; partial `localStorage` caching; lost on cache clear.
- **Category C — Implemented Using Mock / Demo Data:** Uses fixed prototype records loaded from initial seed arrays; values are simulated for demo purposes.
- **Category D — Frontend Interaction Only:** Interactive UI components (modals, dropdowns, tabs) that toggle local component state without mutating the global store or database.
- **Category E — Not Implemented:** Feature not present in current code.
- **Category F — Blocked by Missing Configuration or External Dependencies:** Cannot function until real external infrastructure (Supabase project, SMS Gateway, IAM server) is provisioned.

---

## 2. Comprehensive Feature Classification Register

| Subsystem | Feature / Capability | Classification | Detailed Execution Reality |
|---|---|:---:|---|
| **Authentication** | Email & Password Sign-in | **Category C** | Compares email against mock users in memory; accepts arbitrary password; writes user object to `localStorage`. Zero backend hash verification. |
| **Authentication** | Mobile Phone & OTP Sign-in | **Category C** | Validates 6-digit numeric input format; accepts demo OTP (`482910`); writes session to `localStorage`. No SMS gateway connected. |
| **Authentication** | Multi-Role Persona Switcher | **Category D** | UI selector that switches `currentUser` in `AuthContext` to Super Admin, Client Admin Suman, Client Admin Maha, or Employee. |
| **Authentication** | Session Persistence & Expiry | **Category C** | Stores serialized user in `localStorage`. Never expires; no JWT token; no refresh token; no cryptographic signature. |
| **Master Admin** | Central Platform Command Center | **Category B** | Aggregates metrics (active workforce, client count, presence rate) by querying in-memory arrays in `store.ts`. |
| **Master Admin** | Client Directory & Live Search | **Category B** | Real-time text search and status filter querying `this.clients` array in `store.ts`. |
| **Master Admin** | 4-Step Client Onboarding Wizard | **Category B** | Form validation advances steps; final step executes `store.createClient()`, pushing new client, entities, and policy to memory. |
| **Master Admin** | Legal Entity Registration | **Category B** | Creation modal accepts CIN, GSTIN, PAN; submits to `store.createLegalEntity()`, appending to in-memory array. |
| **Master Admin** | Users & Roles Directory | **Category B** | Reads users from `store.getUsers()`; role filters operate in memory. Invite user dialog is a frontend mock. |
| **Master Admin** | RBAC Permission Matrix | **Category D** | Toggles module read/write/approve checkboxes in local component state. Not persisted across page reloads. |
| **Master Admin** | Security Audit Trail | **Category B** | Audit log events appended to `this.auditLogs` array in `store.ts`. Search and filter operate in memory. Real CSV export generated. |
| **Master Admin** | Reports & Analytics Engine | **Category B** | Compiles attendance, leave, payroll, and overtime summaries from in-memory arrays. Generates dynamic CSV file download. |
| **Client Workspace**| Workspace Overview Dashboard | **Category B** | Filters metrics by `activeClientId`. Displays headcount, site count, and compliance status from in-memory arrays. |
| **Client Workspace**| Employee Directory & Search | **Category B** | Reads from `store.getEmployees(clientId)`. Substring search and department filters operate on in-memory objects. |
| **Client Workspace**| 3-Step Add Employee Wizard | **Category B** | Form validates inputs; calls `store.createEmployee()`, appending to `this.employees` array and initializing leave balances. |
| **Client Workspace**| Employee Profile Dossier | **Category B** | Fetches employee by URL ID from `this.employees`; displays personal info, attendance history, leave balances, and salary. |
| **Client Workspace**| 20-Domain Policy Engine | **Category B** | Form loads current policy; submit calls `store.updateClientPolicy()`. 5 of 20 domains impact in-memory payroll/attendance logic. |
| **Attendance** | Live Digital Clock & Shift Status | **Category D** | Native JavaScript `setInterval` updating seconds, current date, and active shift window. |
| **Attendance** | GPS Geofence Telemetry Validation | **Category B** | Haversine distance formula calculated client-side in `store.recordPunch()`. Coordinates compared against location radius. |
| **Attendance** | Attendance Check-In / Check-Out | **Category B** | Appends `AttendanceEvent` to in-memory array and updates today's `DailyAttendanceRecord` (`checkInTime`, `status = 'PRESENT'`). |
| **Attendance** | Attendance Regularisation Queue | **Category B** | Supervisor views pending requests; Approve action calls `store.approveCorrection()`, updating attendance record to `PRESENT`. |
| **Leaves** | Leave Application Submission | **Category B** | Employee submits dates and reason; calls `store.submitLeaveRequest()`, adding to in-memory `this.leaveRequests` array. |
| **Leaves** | Leave Approval / Rejection | **Category B** | Supervisor calls `store.approveLeave()`; updates status to `APPROVED` and decrements `closing` days in `this.leaveBalances`. |
| **Leaves** | Annual / Monthly Leave Accrual | **Category E** | Policy specifies 2.0 days/month accrual, but no cron job, background worker, or trigger executes monthly accruals. |
| **Payroll** | October 2026 Pay Cycle Dashboard | **Category B** | Reads payroll run status, gross wages, and deductions from in-memory `this.payrollRuns` array. |
| **Payroll** | 4-Step Guided Payroll Wizard | **Category B** | Steps through LOP audit, gross calculations, statutory deductions, and locking. Arithmetic executes client-side. |
| **Payroll** | Salary Divisor Proration (26/30) | **Category B** | Multiplies base salary by paid days / divisor in JavaScript. Calendar divisor fallback is hardcoded to 30. |
| **Payroll** | Loss of Pay (LOP) Deduction | **Category C** | Unpaid days determination uses hardcoded test stub (`emp.id.endsWith('05') ? 1 : 0`) rather than querying real muster records. |
| **Payroll** | Statutory EPF / ESIC Deductions | **Category B** | Computes 12% EPF (capped at ₹15,000) and 0.75% ESIC (threshold $\le$ ₹21,000) based on client policy flags. |
| **Payroll** | Overtime Pay Calculation | **Category E** | Policy has multiplier (1.5x), but payroll calculation code contains zero overtime pay logic; evaluates to ₹0. |
| **Payroll** | Payroll Final Sign-off & Locking | **Category B** | Updates run status to `LOCKED` in `store.ts` and appends audit event. No server-side read-only lock or payment file created. |
| **Payslips** | Payslip Management Register | **Category B** | Lists monthly payslip items from `this.payrollItems` array. Filter and search operate in memory. |
| **Payslips** | Official Form XIX Payslip Preview | **Category D** | Renders HTML template compliant with Rule 26(2). Computes breakdown on the fly. Triggers browser `window.print()`. |
| **Database** | PostgreSQL Persistence | **Category F** | Schema documented in markdown, but 0 `.sql` migration files exist; no Supabase connection. Blocked by backend provisioning. |
| **Communications**| SMS OTP Dispatch | **Category E** | Third-party SMS delivery gateway (e.g. Twilio/Gupshup) not integrated. |

---

## 3. End-to-End Execution Path Traces

The following traces dissect the exact sequence of events for the five core operational workflows, identifying precisely where client execution terminates.

```
═══════════════════════════════════════════════════════════════════════════════
WORKFLOW 1: ATTENDANCE PUNCH (CHECK-IN)
═══════════════════════════════════════════════════════════════════════════════
[1. User Action]      Employee clicks "Punch In (Check-In)" in EmployeePortal.tsx
                            │
[2. State Update]     `setIsPunching(true)` triggers UI spinner
                            │
[3. GPS Capture]      Reads assigned location coordinates from props/state
                      (NOTE: navigator.geolocation is not invoked; uses fallback)
                            │
[4. Latency Mock]     `setTimeout(..., 500)` simulates network delay
                            │
[5. Store Mutation]   Invokes `store.recordPunch(clientId, empId, 'CHECK_IN', coords)`
                      - Calculates Haversine distance to Depot (returns 0.0m)
                      - Validates distance <= radiusMeters (100m) -> TRUE
                      - Instantiates `AttendanceEvent` object in memory
                      - Pushes event to `this.attendanceEvents` array
                      - Updates `this.attendanceRecords` array:
                          checkInTime = '09:00 AM'
                          status = 'PRESENT'
                      - Appends audit record to `this.auditLogs` array
                            │
┌───────────────────────────┴─────────────────────────────────────────────────┐
│                    🛑 EXECUTION CHAIN STOPS HERE                            │
│                                                                             │
│ ❌ No HTTP request / fetch / WebSocket payload dispatched                   │
│ ❌ No Supabase client call (`supabase.from('attendance_events').insert()`)  │
│ ❌ No PostgreSQL database row created                                       │
│ ❌ No database trigger fired                                                │
│ ❌ No server-side tamper verification or cryptographic audit signature     │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
[6. Local UI Update]  `setIsPunching(false)`
                      `setPunchFeedback({ type: 'success', message: '...' })`
                      Component re-renders from in-memory array.

═══════════════════════════════════════════════════════════════════════════════
WORKFLOW 2: LEAVE APPLICATION & SUPERVISOR APPROVAL
═══════════════════════════════════════════════════════════════════════════════
[1. Application]      Employee selects 'CL', enters dates & reason, clicks Submit
                            │
[2. Store Mutation]   Invokes `store.submitLeaveRequest(newRequestData)`
                      - Creates UUID `lr-${Date.now()}`
                      - Sets `status = 'PENDING'`
                      - Appends to `this.leaveRequests` array in memory
                            │
[3. Supervisor View]  Client Admin opens `/workspace/leaves`
                      - Component mounts, queries `store.getLeaveRequests(clientId)`
                      - Renders pending request in HTML table
                            │
[4. Approval Action]  Admin clicks "Approve" button
                            │
[5. Store Mutation]   Invokes `store.approveLeave(requestId)`
                      - Finds request in `this.leaveRequests`: status = 'APPROVED'
                      - Finds leave balance in `this.leaveBalances`:
                          closing = closing - totalDays
                          used = used + totalDays
                      - Appends audit event: 'LEAVE_APPROVAL'
                            │
┌───────────────────────────┴─────────────────────────────────────────────────┐
│                    🛑 EXECUTION CHAIN STOPS HERE                            │
│                                                                             │
│ ❌ No ACID database transaction executed in PostgreSQL                      │
│ ❌ No Row Level Security (RLS) policy evaluated                             │
│ ❌ No push notification, email, or webhook dispatched to employee           │
│ ❌ No immutable server audit record persisted                               │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
[6. Local UI Update]  Component calls `setFilter()` or triggers state re-render.
                      Table reflects updated status; balance card drops by 1 day.

═══════════════════════════════════════════════════════════════════════════════
WORKFLOW 3: EMPLOYEE ONBOARDING & CREATION
═══════════════════════════════════════════════════════════════════════════════
[1. User Action]      Admin completes 3-step Add Employee Wizard and clicks
                      "Save & Add Employee"
                            │
[2. Form Validation]  Validates required fields (First/Last Name, Email, Code, Salary)
                            │
[3. Store Mutation]   Invokes `store.createEmployee(employeeData)`
                      - Generates local UUID `emp-${Date.now()}`
                      - Appends employee object to `this.employees` array
                      - Generates default `leaveBalances` (PL: 15, CL: 12, SL: 8)
                      - Appends audit event: 'EMPLOYEE_ONBOARDING'
                            │
┌───────────────────────────┴─────────────────────────────────────────────────┐
│                    🛑 EXECUTION CHAIN STOPS HERE                            │
│                                                                             │
│ ❌ No SQL `INSERT INTO employees (...)` executed in database                │
│ ❌ No database constraints (foreign keys, unique email, unique PAN) checked │
│ ❌ No Supabase Auth user created (`auth.users`)                             │
│ ❌ No invitation email or password setup link generated                     │
│ ❌ Employee cannot actually log in with their own credentials               │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
[4. Local UI Update]  Router redirects to `/workspace/employees`.
                      Directory table immediately displays new staff record.

═══════════════════════════════════════════════════════════════════════════════
WORKFLOW 4: PAYROLL PERIOD FINALISATION & LOCKING
═══════════════════════════════════════════════════════════════════════════════
[1. User Action]      Admin completes 4-step Payroll Guided Wizard and clicks
                      "Lock & Sign Off October 2026 Payroll"
                            │
[2. Calculation]      Executes client-side `calculatePayrollRun()` in store.ts:
                      - Iterates through `this.employees`
                      - Uses hardcoded LOP heuristic: `unpaid = emp.id.endsWith('05') ? 1 : 0`
                      - Multiplies base by paidDays / divisor
                      - Calculates EPF (12%), ESIC (0.75%), PT (₹200)
                      - Aggregates batch gross liability and net payout
                            │
[3. Store Mutation]   Invokes `store.lockPayrollRun(clientId, '2026-10')`
                      - Sets `run.status = 'LOCKED'`
                      - Sets `run.lockedAt = new Date().toISOString()`
                      - Sets `run.lockedBy = currentUser.name`
                      - Appends audit event: 'PAYROLL_LOCKED'
                            │
┌───────────────────────────┴─────────────────────────────────────────────────┐
│                    🛑 EXECUTION CHAIN STOPS HERE                            │
│                                                                             │
│ ❌ No server-side immutable lock or read-only database trigger applied       │
│ ❌ No banking payment batch file (NACH / NEFT ASCII format) generated       │
│ ❌ No EPFO ECR (Electronic Challan cum Return) file generated               │
│ ❌ No ESIC monthly contribution return file generated                       │
│ ❌ No immutable cryptographic record sealed in database                      │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
[4. Local UI Update]  Router redirects to `/workspace/payslips`.
                      Dashboard displays "Locked & Audited" badge.

═══════════════════════════════════════════════════════════════════════════════
WORKFLOW 5: STATUTORY PAYSLIP GENERATION & EXPORT
═══════════════════════════════════════════════════════════════════════════════
[1. User Action]      Employee or Admin clicks "View Form XIX Slip"
                            │
[2. Routing / Modal]  Mounts `OfficialPayslipView.tsx` or opens modal in portal
                            │
[3. Calculation]      Evaluates salary math on the fly in component render function:
                      - Basic = 50% of payable base
                      - HRA = 30% of payable base
                      - Special Allowance = remainder
                      - Deductions = PF + ESI + PT
                      - Net Pay = Gross - Deductions
                            │
[4. Template Render]  Renders HTML table matching Form XIX Rule 26(2) layout
                            │
[5. Export Action]    User clicks "Print Form XIX" or "Download PDF"
                            │
┌───────────────────────────┴─────────────────────────────────────────────────┐
│                    🛑 EXECUTION CHAIN STOPS HERE                            │
│                                                                             │
│ ❌ No serverless PDF generation service (Puppeteer/PDFKit) executed         │
│ ❌ No PDF document uploaded to Supabase Storage (`payslips` bucket)         │
│ ❌ No digital signature / corporate seal applied to binary document         │
│ ❌ No expiring signed download URL generated                                │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
[6. Local UI Update]  Browser native `window.print()` dialog opens.
```

---

## 4. Key Takeaways for Technical Leadership

1. **The frontend application is functionally complete as a simulation.** All forms accept inputs, advance steps, validate rules, calculate numbers, update local tables, and display feedback.
2. **The backend application does not yet exist.** There are no databases, no APIs, no auth servers, no storage buckets, and no background workers.
3. **The next development phase must focus 100% on backend infrastructure.** Adding further frontend UI before provisioning the database and auth layers will create technical debt.
