# AVENCIS WORKFORCE MANAGEMENT (MODULE 01)
## POST-IMPLEMENTATION AUDIT — FUNCTIONAL VERIFICATION & BACKEND READINESS

**Audit Date:** 03 November 2026  
**Auditor:** Antigravity Master Technical Audit System  
**Audit Target:** First Functional Working Draft Codebase  
**Status:** **AUTHORITATIVE INDEPENDENT AUDIT COMPLETED**

---

### EXECUTIVE SUMMARY

This audit delivers an honest, unvarnished technical assessment of the First Functional Working Draft of the Avencis Workforce Management platform.

#### Key Findings at a Glance:
1. **Frontend UI & Stitch Fidelity:** **HIGH FIDELITY (React 18 + Vite + Tailwind CSS)**. All 29 Stitch screens have corresponding interactive React views, Material 3 design tokens, Google typography (`DM Serif Display` and `Manrope`), and compiling with zero TypeScript errors.
2. **Backend & Database:** **NOT IMPLEMENTED**. There is **no Supabase client installed**, **no PostgreSQL connection**, **no database migrations**, and **no server-side API**.
3. **Authentication & RBAC:** **MOCK / SIMULATED ONLY**. Authentication is a frontend mock selector stored in browser `localStorage`. Role permissions are enforced purely by conditional UI rendering. There is no password hashing, no JWT session verification, and no backend access control.
4. **Tenant Isolation:** **FRONTEND UI FILTERING ONLY**. Client switching is constrained in the React UI, but all mock records reside in the client-side JavaScript memory heap. Any user can access any record by manipulating client-side state or crafting direct route URLs. Database Row Level Security (RLS) is **NOT EXECUTED**.
5. **Data Persistence:** **PARTIAL LOCALSTORAGE ONLY**. Seven datasets persist in `localStorage` (`clients`, `employees`, `policies`, `attendanceRecords`, `leaveRequests`, `payrollRuns`, `auditLogs`). Five critical operational datasets (`attendanceEvents`, `leaveBalances`, `corrections`, `legalEntities`, `workLocations`) **do not persist** and revert to initial mock data on page refresh.
6. **Payroll Engine:** **PARTIALLY IMPLEMENTED WITH HARDCODED STUBS**. The 26/30 divisor arithmetic and gross-to-net deduction structure is coded, but unpaid leave deduction relies on a hardcoded test heuristic (`emp.id.endsWith('05')`), TDS is flat-coded at ₹1,200, PT is flat-coded at ₹200, and overtime policies are never evaluated in calculations.
7. **20 Client Policy Domains:** **5 OF 20 ACTIVELY WIRED INTO LOGIC**. While all 20 domains exist in the schema and UI configuration form, only 5 domains actually impact business calculations. The remaining 15 are stored parameters that are never evaluated by attendance or payroll engines.

---

### 1. AUTHENTICATION & ACCESS CONTROL VERIFICATION

#### 1.1. Real Authentication Provider vs Simulated Switching
- **Finding:** **Authentication is 100% simulated.**
- **Code Inspection (`src/context/AuthContext.tsx`):**
  - No connection to Supabase Auth, Firebase Auth, OAuth2, or custom backend.
  - `login(email, password)` accepts any password and directly sets `currentUser` based on matching email in `mockData.ts`.
  - The Persona Switcher (`admin@avencis.com`, `admin@suman.com`, `admin@mahaindia.com`, `rahul.sharma@suman.com`) directly writes an unencrypted JSON object to `localStorage.setItem('avencis_active_user', ...)`.
- **Session Security:**
  - **Zero cryptographic integrity.** Anyone can open browser Developer Tools -> Application -> LocalStorage and edit `"role": "super_admin"` to immediately grant themselves full administrative privileges.
  - No session expiry, no refresh tokens, no CSRF protection, and no secure HTTP-only cookies.

#### 1.2. Role-Based Access Control (RBAC) Integrity
- **Finding:** **UI-Only Access Control.**
- **Code Inspection (`src/components/layout/Sidebar.tsx` & `AppShell.tsx`):**
  - Navigation links are hidden or shown based on `currentUser.role === 'super_admin'`.
  - However, routes in `src/App.tsx` are **not guarded by route middleware or higher-order auth guards**.
  - **Vulnerability Verified:** An authenticated employee (`rahul.sharma@suman.com`) can type `/admin/dashboard` or `/workspace/payroll/run` directly into the browser URL bar and mount the administrative view without authorization challenge.
  - In `OfficialPayslipView.tsx`, passing any employee ID in the URL (`/workspace/payslips/view/emp-maha-01`) renders the complete salary, PAN, bank account, and earnings of an employee belonging to another client tenant without checking the requesting user's identity or tenant ownership.

---

### 2. DATABASE & PERSISTENCE VERIFICATION

#### 2.1. Supabase & PostgreSQL Investigation
| Check | Status | Verification Detail |
|---|:---:|---|
| `@supabase/supabase-js` in `package.json` | ❌ NOT PRESENT | Only `react`, `react-router-dom`, `lucide-react`, `canvas-confetti` installed. |
| Supabase Client Initialization | ❌ NOT PRESENT | Zero client configuration files or SDK imports exist in `src/`. |
| `.env` or Environment Credentials | ❌ NOT PRESENT | No `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` found. |
| SQL Migrations Folder | ❌ NOT PRESENT | Zero `.sql` migration files exist in the repository. |
| Live PostgreSQL Tables | ❌ NOT PRESENT | No database instance is connected or queried. |
| Server-Side API Endpoints | ❌ NOT PRESENT | Pure client-side SPA architecture with zero network fetch calls. |

#### 2.2. AppStore & LocalStorage Persistence Audit
`AppStore` in `src/data/store.ts` initializes state from `src/data/mockData.ts`.
Inspection of `saveToStorage()` and `loadFromStorage()` revealed an asymmetry:

| Entity Collection | Persists to LocalStorage? | Survives Browser Refresh? | Risk / Impact |
|---|:---:|:---:|---|
| `clients` | ✅ YES | ✅ YES | Onboarded clients remain in memory. |
| `employees` | ✅ YES | ✅ YES | Onboarded employees remain in memory. |
| `policies` | ✅ YES | ✅ YES | Updated policy settings survive refresh. |
| `attendanceRecords` | ✅ YES | ✅ YES | Aggregated daily muster records survive. |
| `leaveRequests` | ✅ YES | ✅ YES | Submitted leave applications survive. |
| `payrollRuns` | ✅ YES | ✅ YES | Locked payroll batches survive. |
| `auditLogs` | ✅ YES | ✅ YES | Logged actions survive. |
| `attendanceEvents` (Raw GPS Events) | ❌ **NO** | ❌ **REVERTS** | **Raw punch telemetry lost on refresh.** |
| `leaveBalances` (Ledger Balances) | ❌ **NO** | ❌ **REVERTS** | **Approved leave deductions reset to defaults.** |
| `corrections` (Regularisation Ledger) | ❌ **NO** | ❌ **REVERTS** | **Pending/reviewed corrections lost on refresh.** |
| `legalEntities` (Employer Master) | ❌ **NO** | ❌ **REVERTS** | **Newly registered legal entities lost on refresh.** |
| `workLocations` (Geofence Sites) | ❌ **NO** | ❌ **REVERTS** | **Newly added sites lost on refresh.** |
| `departments` | ❌ **NO** | ❌ **REVERTS** | **Departments reset to initial mock data.** |

---

### 3. TENANT ISOLATION & RLS AUDIT

#### 3.1. Database Row Level Security (RLS)
- **Status:** **NOT EXECUTED**.
- **Reason:** In accordance with audit requirements, because no live PostgreSQL or Supabase database is connected, live RLS policy tests cannot be executed.
- The SQL policies documented in `docs/DATABASE_SCHEMA_DOCUMENTATION.md` represent **proposed target specifications**, not live running database policies.

#### 3.2. Frontend Tenant Isolation Leakage
1. **Client Administrator Cross-Tenant Access:**
   In `WorkspaceContext.tsx`, `switchClient(clientId)` prevents Client Admins from clicking other clients in the UI switcher:
   ```ts
   if (currentUser.role === 'client_admin' && currentUser.clientId !== clientId) return;
   ```
   However, because all data is co-located in `AppStore` in browser memory, calling `store.getEmployees('client-maha')` from any component or console returns Maha India's employees even when logged in as Suman Admin.
2. **Employee Cross-Record Access:**
   Employees have no server-enforced boundary. Any employee can view payslips, leave records, and attendance of any colleague by changing route parameters.

---

### 4. CLIENT CONFIGURATION & 20 POLICY DOMAINS AUDIT

All 20 policy domains are defined in TypeScript (`src/types/index.ts`) and editable in the UI form (`ClientPolicySettings.tsx`).
However, an exhaustive codebase search revealed that **only 5 domains actually execute logic**:

| Policy Domain | Defined in Schema? | UI Form Control? | Calculation Logic Implemented? | Tested in Codebase? | Operational Status |
|---|:---:|:---:|:---:|:---:|---|
| **01. Overtime Method** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **02. Overtime Rate Multiplier** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **03. Late Grace Minutes** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **04. Late Penalty Rule** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **05. Overnight Shift Attribution** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **06. Standard Working Hours** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **07. Half-Day Hours Threshold** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **08. Weekly Off Days** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **09. Tracking Mode (Single/Double)** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **10. Require GPS** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **11. Require Selfie** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **12. Enforce Strict Geofence** | ✅ | ✅ | ✅ **YES** (Flags suspicious) | ✅ Tested | **VERIFIED WORKING** |
| **13. Supported Leave Types** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **14. Min Service Days for Leave** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **15. Monthly Paid Leave Accrual** | ✅ | ✅ | ❌ **NO** (No accrual loop) | ❌ NO | UI ONLY / DORMANT |
| **16. Max Carry-Forward Cap** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **17. Leave Encashment on Separation** | ✅ | ✅ | ❌ **NO** | ❌ NO | UI ONLY / DORMANT |
| **18. Unpaid Leave Deduction Rule** | ✅ | ✅ | ✅ **YES** (Prorates base) | ✅ Tested | **PARTIALLY IMPLEMENTED** |
| **19. Salary Calculation Divisor** | ✅ | ✅ | ✅ **YES** (26 vs 30) | ✅ Tested | **VERIFIED WORKING** |
| **20. Statutory Deductions (PF/ESIC/PT)** | ✅ | ✅ | ✅ **YES** (Formula deductions) | ✅ Tested | **PARTIALLY IMPLEMENTED** |

**Summary:** 5 domains are wired into calculations (`enforceStrictGeofence`, `salaryDivisor`, `pfEnabled`, `esicEnabled`, `ptEnabled`). The other 15 domains are dormant parameters stored in state without functional engines.

---

### 5. PAYROLL ENGINE & STATUTORY CALCULATIONS AUDIT

Inspection of `calculatePayrollRun` in `src/data/store.ts` revealed serious undocumented assumptions and hardcoded values:

#### 5.1. Hardcoded Values Identified
1. **Unpaid Days Heuristic (`endsWith('05')`):**
   ```ts
   // Line 504 of store.ts:
   const unpaidDays = emp.id.endsWith('05') ? 1 : 0; // Vikram Rao has 1 unpaid day
   ```
   **CRITICAL AUDIT FINDING:** Unpaid days are NOT calculated from the attendance muster or leave records! The code literally inspects the string suffix of the employee's ID. Any employee whose ID ends in `05` gets 1 unpaid day; all other employees get 0 unpaid days.
2. **Hardcoded Calendar Days:**
   `calendarDays = 30` is hardcoded for every month, regardless of whether the pay period is February (28 days) or October (31 days).
3. **Calendar Days Divisor Fallback:**
   If `salaryDivisor === 'calendar_days'`, the code falls back to `30`:
   ```ts
   const divisor = policy.salaryDivisor === '26' ? 26 : policy.salaryDivisor === '30' ? 30 : 30;
   ```
   It does not compute the actual days in the requested `periodMonth`/`periodYear`.
4. **Professional Tax (PT) Flat Rate:**
   Hardcoded flat ₹200. Does not support state-specific slabs (e.g. Karnataka, Gujarat, West Bengal) or the February ₹300 Maharashtra adjustment.
5. **Income Tax TDS Flat Rate:**
   ```ts
   const tdsDeduction = policy.tdsEnabled && emp.fixedMonthlySalary >= 40000 ? 1200 : 0;
   ```
   Hardcoded flat ₹1,200 deduction based on an arbitrary ₹40,000 threshold, rather than income tax slab brackets under Section 192.
6. **ESIC Wage Ceiling Assumption:**
   ESIC is calculated on `payableBase <= 21000`, applying $0.75\%$ employee contribution. This matches the statutory ceiling, but employer contribution ($3.25\%$) is not itemized or ledgered.
7. **EPF Wage Ceiling Assumption:**
   PF applies $12\%$ to $\min(\text{payableBase}, 15000)$. Capping at ₹1,800 is statutorily accurate under the EPS wage ceiling, but does not support clients who compute PF on actual uncapped basic wages.

---

### 6. ATTENDANCE & LEAVE ENGINE AUDIT

| Subsystem | Feature | Implementation Reality | Functional Status |
|---|---|---|:---:|
| **Attendance** | GPS Coordinate Capture | Uses mock coordinates in portal or browser `navigator.geolocation`. | **VERIFIED WORKING** |
| **Attendance** | Haversine Distance Calculation | Spherical distance calculated mathematically against location coordinates. | **VERIFIED WORKING** |
| **Attendance** | Geofence Boundary Check | Flagged as `WITHIN_GEOFENCE` ($\le 150\text{m}$) or `OUT_OF_BOUNDS` ($> 150\text{m}$). | **VERIFIED WORKING** |
| **Attendance** | Attendance Punch Logging | Aggregates daily record check-in/out time. | **VERIFIED WORKING** |
| **Attendance** | Biometric Terminal Sync | No hardware listener. Simulated via mock attendance records. | **MOCK DATA** |
| **Attendance** | Attendance Regularisation | Submit request -> Review in manager queue -> Overlays check-in time. | **VERIFIED WORKING** |
| **Attendance** | Overnight Shift Attribution | Not evaluated in check-in logic. | **NOT IMPLEMENTED** |
| **Leave** | Leave Application Filing | Worker selects type, dates, reason -> Enters review queue. | **VERIFIED WORKING** |
| **Leave** | Leave Review (Approve/Reject) | Manager approves -> Decrements closing balance in memory. | **VERIFIED WORKING** |
| **Leave** | Leave Ledger Calculation | Continuous formula: $\text{Closing} = \text{Opening} + \text{Credited} - \text{Used}$. | **VERIFIED WORKING** |
| **Leave** | Automated Monthly Accrual | No cron or automated accrual engine running. | **NOT IMPLEMENTED** |
| **Leave** | Annual Carry-Forward Cap | No year-end carry-forward script implemented. | **NOT IMPLEMENTED** |
| **Leave** | Leave Encashment on Exit | No encashment settlement calculation implemented. | **NOT IMPLEMENTED** |

---

### 7. STITCH SCREEN IMPLEMENTATION AUDIT

Of the 29 Stitch screens across Batch 01 and Batch 02:
- **12 screens** are fully implemented as dedicated functional React views with interactive controls and responsive styling.
- **9 screens** are implemented as functional tabs, modals, or sub-views within consolidated master pages (e.g., Employee Personal Info is Tab 1 of `EmployeeProfileView.tsx`; Leave Application Register is integrated into `LeaveManagement.tsx`).
- **5 screens** are implemented with mock tabular data and simulated actions (e.g. Reports Library, Bulk ZIP Export).
- **3 screens** are duplicate variations of existing views (e.g. Batch 01 Screen 15 vs Screen 01).

*(See `docs/SCREEN_BY_SCREEN_VERIFICATION.md` for the screen-by-screen audit table.)*

---

### 8. BUILD AND RUNTIME AUDIT

- **Package Installation (`npm install`):** Clean installation of 140 packages. Zero dependency peer conflicts.
- **Production Build (`npm run build`):** Executed `tsc && vite build` in 8.15 seconds. **Zero TypeScript errors.**
- **Runtime Startup (`vite dev` / `vite preview`):** SPA mounts cleanly. Navigation operates smoothly.
- **Console Errors:** None on default routes.
- **Broken Assets:** Zero missing local images or 404 font stylesheets.
- **Form Validation:** Client onboarding and employee onboarding wizards validate mandatory inputs before allowing step progression.

---

### 9. SUMMARY OF GAPS TO PRODUCTION READINESS

To transition Avencis WFM from this functional prototype into an operational enterprise platform:
1. **Install `@supabase/supabase-js`** and implement live PostgreSQL tables with genuine database RLS policies.
2. **Implement Real Authentication:** Replace mock persona switching with Supabase Auth or secure JWT session cookies.
3. **Fix Payroll Proration:** Replace `emp.id.endsWith('05')` with real aggregations of attendance records and approved LWP days.
4. **Implement Missing Policy Logic:** Wire overtime multipliers, late grace minutes, and leave accruals into the computational engine.
5. **Persist All Collections:** Ensure `attendanceEvents`, `leaveBalances`, and `legalEntities` persist to the database rather than resetting on refresh.
