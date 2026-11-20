# AVENCIS WORKFORCE MANAGEMENT (MODULE 01)
## SECURITY, RBAC & MULTI-TENANT ISOLATION AUDIT REPORT

**Audit Date:** November 03, 2026  
**Auditor:** Antigravity Master Technical Audit System  
**Classification:** Critical Security Audit & Vulnerability Assessment  
**Status:** **INDEPENDENT SECURITY AUDIT COMPLETED**

---

## 1. Executive Security Finding

> [!CAUTION]
> **CRITICAL SECURITY ASSESSMENT:**  
> In the current application state, **zero security checks are enforced on the backend**, and **zero cryptographic access controls exist**.  
> All security barriers, role restrictions, and tenant boundaries are **strictly cosmetic and client-side only**.  
> If deployed to a production environment in its current state, **any user with browser access could inspect, alter, or exfiltrate sensitive payroll, salary CTC, PAN, and attendance records across all client tenants**.

---

## 2. In-Depth Investigation of Critical Security Vectors

### Vector 1: Cross-Client Record Access (Tenant Isolation)
- **Question:** *Can a client manager access another client's records?*
- **Verdict:** **YES. VULNERABLE IN RUNTIME.**
- **Evidence & Mechanism:**
  1. In [`WorkspaceContext.tsx`](file:///c:/Avencis%20Management/src/context/WorkspaceContext.tsx#L44-L51), the client switcher visually disables switching to other clients for `client_admin` roles:
     ```typescript
     const switchClient = (clientId: string) => {
       if (currentUser.role === 'client_admin' && currentUser.clientId !== clientId) {
         return; // UI-level guard
       }
       setActiveClientId(clientId);
       localStorage.setItem('avencis_active_client_id', clientId);
     };
     ```
  2. However, **all mock records for all clients are bundled directly into the client-side JavaScript memory heap** via `src/data/mockData.ts` and `src/data/store.ts`.
  3. Any client manager from Suman Technologies (`admin@suman.com`) can simply open DevTools Console and execute:
     ```javascript
     // Exfiltrate all employee records of Maha India Logistics
     window.store.getEmployees('client-maha');
     // Exfiltrate payroll runs of Maha India
     window.store.getPayrollRuns('client-maha');
     ```
  4. Furthermore, by executing `localStorage.setItem('avencis_active_client_id', 'client-maha')` and refreshing the page, the client manager's browser immediately mounts the Maha India workspace with full data visibility.
- **Root Cause:** Absence of database-level Row Level Security (RLS) and lack of a server-side API boundary.

---

### Vector 2: Cross-Employee Payslip & Sensitive Data Access
- **Question:** *Can an employee access another employee's payslip?*
- **Verdict:** **YES. VULNERABLE IN RUNTIME.**
- **Evidence & Mechanism:**
  1. Route [`/workspace/payslips/view/:employeeId`](file:///c:/Avencis%20Management/src/app/workspace/OfficialPayslipView.tsx) accepts an arbitrary `employeeId` parameter in the URL.
  2. In [`OfficialPayslipView.tsx`](file:///c:/Avencis%20Management/src/app/workspace/OfficialPayslipView.tsx#L18-L25):
     ```typescript
     export const OfficialPayslipView: React.FC = () => {
       const { employeeId } = useParams<{ employeeId: string }>();
       const employee = employeeId ? store.getEmployee(employeeId) : undefined;
       ...
     ```
  3. The component **performs zero ownership validation**. It does NOT check whether `currentUser.employeeId === employeeId` or whether `currentUser.role === 'client_admin'`.
  4. If an employee logged in as Anil Kadam (`MI-0203`) manually enters:
     `http://localhost:3000/workspace/payslips/view/emp-suman-01`
     The view immediately renders the full official Form XIX salary slip for Rahul Sharma, exposing his Gross Salary (₹45,000), PAN Number, UAN Number, and Bank Account Details.
- **Root Cause:** Lack of route-level authorization guards and absence of access control checks in component render logic.

---

### Vector 3: Self-Modification of Attendance Records
- **Question:** *Can an employee modify their own attendance records?*
- **Verdict:** **YES (VIA CONSOLE) / BLOCKED (IN STANDARD UI).**
- **Evidence & Mechanism:**
  1. In the normal UI ([`EmployeePortal.tsx`](file:///c:/Avencis%20Management/src/app/portal/EmployeePortal.tsx)), an employee cannot edit historical attendance table rows directly; they are directed to the regularisation form.
  2. However, because `AppStore` is an in-memory singleton object exposed within the JavaScript bundle, an employee can execute in the browser console:
     ```javascript
     // Find today's record and alter punch times
     const record = window.store.attendanceRecords.find(r => r.employeeId === 'emp-maha-02');
     record.checkInTime = '09:00 AM';
     record.checkOutTime = '06:00 PM';
     record.status = 'PRESENT';
     ```
  3. The client state reflects the alteration immediately.
- **Root Cause:** Absence of an immutable database append log (`attendance_events`) with server-side write restrictions.

---

### Vector 4: Unauthorized Payroll Approval & Execution
- **Question:** *Can an unauthorized user approve or lock payroll?*
- **Verdict:** **YES. VULNERABLE IN RUNTIME.**
- **Evidence & Mechanism:**
  1. The 4-step payroll wizard is located at route `/workspace/payroll/run`.
  2. In [`src/App.tsx`](file:///c:/Avencis%20Management/src/App.tsx#L79), the route is declared with zero role restrictions:
     ```typescript
     <Route path="/workspace/payroll/run" element={<PayrollGuidedWizard />} />
     ```
  3. An employee logged in with role `employee` can type `/workspace/payroll/run` into their browser address bar.
  4. The complete administrative payroll processor mounts without an authentication or authorization challenge.
  5. The employee can step through the wizard and click **"Lock & Sign Off October 2026 Payroll"**, triggering `store.lockPayrollRun()` and locking the entire organization's pay cycle.
- **Root Cause:** Zero route middleware protection in React Router.

---

### Vector 5: Route Restriction Bypass via Direct URL Navigation
- **Question:** *Can users bypass role restrictions by manually entering routes?*
- **Verdict:** **YES. 100% OF APPLICATION ROUTES ARE UNPROTECTED.**
- **Evidence & Mechanism:**
  1. Inspection of [`src/App.tsx`](file:///c:/Avencis%20Management/src/App.tsx#L57-L95) reveals that all 32 routes are direct children of `<AppShell />`:
     - `/admin/dashboard`
     - `/admin/clients`
     - `/admin/onboard`
     - `/admin/permissions`
     - `/admin/audit`
     - `/workspace/payroll/run`
     - `/workspace/policies`
  2. None of these routes are wrapped in a `<ProtectedRoute allowedRoles={[...]} />` component.
  3. While `Sidebar.tsx` hides administrative links when `currentUser.role === 'employee'`, this is purely client-side visual suppression. Anyone knowing the route path can bypass the sidebar entirely.
- **Root Cause:** Missing route-level RBAC wrapper components.

---

### Vector 6: Protection of Sensitive Salary, Tax & Bank Details
- **Question:** *Are sensitive salary and bank details protected?*
- **Verdict:** **NO. COMPLETELY EXPOSED IN PLAINTEXT.**
- **Evidence & Mechanism:**
  1. Inspection of [`src/types/index.ts`](file:///c:/Avencis%20Management/src/types/index.ts#L133-L148) and [`src/data/mockData.ts`](file:///c:/Avencis%20Management/src/data/mockData.ts) reveals that employee objects contain:
     - `fixedMonthlySalary`: Plaintext integer
     - `variableIncentive`: Plaintext integer
     - `panNumber`: Plaintext string (e.g. `ABCDE1234F`)
     - `aadhaarNumber`: Plaintext string (e.g. `9876 5432 1098`)
     - `accountNumber`: Plaintext string (e.g. `50100234567890`)
     - `ifscCode`: Plaintext string (e.g. `HDFC0000123`)
     - `uanNumber`: Plaintext string (e.g. `101928374652`)
  2. In a real backend, sensitive fields (PAN, Aadhaar, Bank Details, Base Salary) must be restricted to HR Admins via column-level security or separate encrypted tables.
  3. Currently, all employee objects for all client organizations are preloaded into memory when the application loads.
- **Root Cause:** Absence of field-level access control and lack of database column encryption.

---

### Vector 7: Frontend Hiding vs Server-Side Enforcement
- **Question:** *Are permissions enforced on the backend or only hidden in the frontend?*
- **Verdict:** **100% HIDDEN IN FRONTEND. ZERO SERVER ENFORCEMENT.**
- **Evidence & Mechanism:**
  1. Inspection of network traffic during application usage confirms that **zero HTTP requests are made**.
  2. The application does not communicate with an API server, Supabase, or any backend service.
  3. All permissions are evaluated via React conditional rendering: `{isSuperAdmin && <AdminLinks />}`.
  4. Once code arrives in the browser, all client-side logic is under the control of the client browser environment and can be altered, bypassed, or inspected.
- **Root Cause:** Pure client-side SPA architecture without a backend gateway.

---

## 3. Required Security Remediations for Phase 2

1. **Database Row Level Security (RLS):** Apply mandatory PostgreSQL RLS policies to all tables, filtering rows using `auth.jwt() -> 'app_metadata' ->> 'client_id'`.
2. **Route Guard Middleware:** Wrap all sensitive routes in `src/App.tsx` with `<ProtectedRoute allowedRoles={['super_admin', 'client_admin']} />` that validates user claims and redirects unauthorized users.
3. **Data Transfer Object (DTO) Sanitization:** The backend API must return sanitized employee records for regular employees (excluding other staff salaries, bank accounts, and PANs).
4. **Serverless PDF Generation:** Payslips must be compiled inside an authenticated Edge Function and served via short-lived signed URLs (15-minute expiry) to prevent URL scraping.
5. **Session Cryptography:** Replace `localStorage` authentication with Supabase Auth (GoTrue) using secure, HTTP-only session cookies and signed JWT tokens.
