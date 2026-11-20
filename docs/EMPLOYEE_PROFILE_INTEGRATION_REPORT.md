# Avencis WFM — Employee Profile Integration Report
## Milestone 2.4B: Tabbed Dossier, Sensitive Data Protection & Live Service Architecture

---

### 1. Executive Summary

The **Employee Profile View** (`src/app/workspace/EmployeeProfileView.tsx`) provides a comprehensive 5-tab dossier for active staff members. It has been connected to `employeeService.ts`, `policyService.ts`, and `leaveService.ts` with strict fail-closed role boundaries for confidential remuneration and banking coordinates.

All 29 approved Stitch screen visual invariants (typography, spacing, borders, colors, and badge dimensions) have been preserved without alteration.

---

### 2. Architecture & File Locations

| Layer | File Path | Scope & Responsibility |
| :--- | :--- | :--- |
| **Profile UI** | [`src/app/workspace/EmployeeProfileView.tsx`](file:///c:/Avencis%20Management/src/app/workspace/EmployeeProfileView.tsx) | 5-tab employee profile, hero header, sensitive data alerts |
| **Domain Service** | [`src/services/employeeService.ts`](file:///c:/Avencis%20Management/src/services/employeeService.ts) | Profile lookup, salary structure fetch, bank details fetch |
| **Leave Service** | [`src/services/leaveService.ts`](file:///c:/Avencis%20Management/src/services/leaveService.ts) | Live leave balances retrieval (`getLeaveBalances`) |
| **Policy Service** | [`src/services/policyService.ts`](file:///c:/Avencis%20Management/src/services/policyService.ts) | Work location geofence and department resolution |
| **Routing** | [`src/App.tsx`](file:///c:/Avencis%20Management/src/App.tsx) | Parameterized routes (`/workspace/:clientId/employees/:employeeId`) |

---

### 3. Detailed Tab Implementation & Field Mappings

#### Tab 1: Overview & Position
- **Organizational Placement:**
  - `employment_arrangement`: Formatted display (`DIRECT_PERMANENT`, `DIRECT_CONTRACT`, `DEPUTED_STAFFING`, `INTERN`).
  - `work_location_id`: Resolved to `WorkLocationRow.name` (e.g. Suman HQ — Pune Technology Park).
  - `department_id`: Resolved to `DepartmentRow.name` (e.g. Software Engineering).
  - `legal_entity_id`: Resolved to `LegalEntityRow.legal_name` (e.g. Suman Technologies Private Limited).
- **Work Schedule & Geofencing:**
  - Shift timing display: General Morning (09:00 AM – 06:00 PM).
  - Geofence validation status: Strict enforcement with dynamic radius (`loc.radius_meters`m).
  - Punch verification mode: GPS Coordinates + Device Fingerprint.

#### Tab 2: Salary & Remuneration Structure (Sensitive Financial Data)
- **Role Permission Gate:**
  - **Authorized (`super_admin`, `client_admin`, `payroll_admin`, or self-service employee for own record):**
    - Fixed Monthly Base CTC: `₹{salaryStructure.fixed_monthly_base}`.
    - Variable Target Incentive: `₹{salaryStructure.variable_incentives}`.
    - Other Special / Travel / Meal Allowances: `₹{salaryStructure.special_allowances}`.
    - Bank Name: `bankDetails.bank_name`.
    - Account Number: `bankDetails.account_number`.
    - IFSC Code: `bankDetails.ifsc_code`.
    - Verification Status: Penny Drop Verified / Registered.
  - **Unauthorized (`hr_admin`, `client_manager`, `location_manager`, or peer employee):**
    - The service returns `403 Forbidden` (`PERMISSION_ERROR`).
    - The UI renders a dedicated, fail-closed security notice:
      > [!CAUTION]
      > **Confidential Financial Information**
      > Access to compensation CTC structures and bank disbursement coordinates is strictly restricted to Super Admin, Client Admin, Payroll Admin, or the authenticated employee themselves. Enforced by Row Level Security & Service Governance.
    - No exception is thrown, preventing UI crashes while guaranteeing zero financial data leakage.

#### Tab 3: Statutory & KYC Identifiers
- Permanent Account Number: `employee.pan_number` (10-character alphanumeric).
- Aadhaar UID: `employee.aadhaar_number` (masked or formatted 12-digit UID).
- PAN-Aadhaar Linkage Status: Verified.
- Universal Account Number (UAN): `employee.uan_number` (or 'NOT ASSIGNED').
- ESIC Insurance Number: `employee.esic_number` (or statutory exemption notice).
- Form 11 PF Declaration: Filed on record indicator.

#### Tab 4: Leave Balances
- Live integration with `leaveService.getLeaveBalances(employeeId)`.
- Cards rendered per leave type (`PL`, `CL`, `SL`):
  - Annual Cycle Label (e.g. 2026 Cycle).
  - Opening Balance (`lb.opening`).
  - Used Days (`lb.used`).
  - Closing Available Balance (`lb.closing`).
- Clear fallback banner when no annual balances have been credited yet.

#### Tab 5: Document Dossier
- Displays compliance dossier: Signed Employment Contract, Aadhaar Copy, PAN Copy, Bank Cheque Proof, and Form 11 Declaration.
- Verification status tags (`VERIFIED`).

---

### 4. Cross-Tenant & Self-Service Isolation Verification

1. **Cross-Tenant Prevention:**
   If a Client Admin assigned to Client A navigates directly to an employee profile belonging to Client B, `employeeService.getEmployeeById` checks `callerScope.clientId !== emp.client_id` and rejects with `PERMISSION_ERROR` (403), displaying an "Unable to Access Profile — Cross-tenant access forbidden" banner.
2. **Peer Isolation:**
   If an Employee user (`role: 'employee'`) attempts to navigate to another employee's profile ID, the service verifies `callerScope.employeeId !== id` and returns `PERMISSION_ERROR` (403), completely blocking unauthorized peer dossier inspection.
