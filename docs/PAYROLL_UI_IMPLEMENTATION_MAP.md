# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E: PAYROLL MANAGEMENT
## PAYROLL USER INTERFACE AUDIT & STITCH SCREEN IMPLEMENTATION MAP

> **Document:** `docs/PAYROLL_UI_IMPLEMENTATION_MAP.md`  
> **Status:** AUTHORITATIVE UI/STITCH MAPPING  
> **Milestone:** 2.4E (Payroll Management)  
> **Baseline:** Strict Preservation of Approved Stitch Screens (Zero Redesigns)  

---

## 1. APPROVED STITCH SCREENS INVENTORY (PAYROLL DOMAIN)

Across the 29 approved Stitch screens in the Avencis Design System, exactly 5 screens belong directly to the Payroll and Payslip processing domain:

| Stitch ID | Screen Name | Screen Code / Path | Device & Resolution | Mapped React Component | Route in App.tsx |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `395c86334fbc4762b120aa2db036efde` | **Payroll Management Dashboard** | `batch-02/03-payroll-management-dashboard` | Desktop (2560 x 7192) | `PayrollDashboard.tsx` | `/workspace/:clientId/payroll` |
| `b48bf0b9951b4c9e8b8a546fbab4b8a8` | **Payroll Run & Processing** | `batch-01/06-payroll-processing` | Desktop (2560 x 4064) | `PayrollDashboard.tsx` (Run Tab) | `/workspace/payroll` |
| `e90ca6a75bc34ffeb591065e106a9911` | **Payroll Run & Guided Processing** | `batch-02/06-payroll-guided-processing` | Desktop (2560 x 7170) | `PayrollGuidedWizard.tsx` | `/workspace/:clientId/payroll/wizard` |
| `5e0b0a0aa90449ddb33023f1c350668e` | **Payslip Management Dashboard** | `batch-02/07-payslip-management` | Desktop (2560 x 4864) | `PayslipManagement.tsx` | `/workspace/payslips` |
| `c9d381730a8b4f14a07d43267ca1714f` | **Individual Payslip Preview & Template** | `batch-02/08-individual-payslip-preview` | Desktop (3328 x 3252) | `OfficialPayslipView.tsx` | `/workspace/payslips/view/:employeeId` |

---

## 2. COMPONENT-BY-COMPONENT IMPLEMENTATION & WIRING STATUS

### 2.1 `PayrollDashboard.tsx`
- **Location:** `src/app/workspace/PayrollDashboard.tsx`
- **Visual Design:** Strictly mirrors Stitch Screen `395c86334fbc4762b120aa2db036efde`.
- **Current State [EXISTING IMPLEMENTATION]:**
  - Renders KPI cards (Last Processed Period, Monthly Net Payout, Total Headcount).
  - Contains mandatory policy configuration warning banner if `client_policies.is_configured = FALSE`.
  - Lists historical payroll runs.
- **Backend Wiring Status [GAP]:**
  - Currently loads runs from `store.getPayrollRuns(client.id)` in mock store.
  - **Required Wire-up:** Call `payrollService.getPayrollRuns(activeClient.id)` to load live historical runs from Supabase Cloud.

### 2.2 `PayrollGuidedWizard.tsx`
- **Location:** `src/app/workspace/PayrollGuidedWizard.tsx`
- **Visual Design:** Strictly mirrors Stitch Screen `e90ca6a75bc34ffeb591065e106a9911`.
- **Workflow:** 5-step guided execution:
  - Step 1: Scope & Period (Select Month/Year, verify policy readiness).
  - Step 2: Muster & Attendance Finalization (Inspect Paid vs Unpaid days).
  - Step 3: Earnings & Incentives (Review basic, HRA, input variable incentives).
  - Step 4: Statutory Deductions (Inspect PF, ESIC, PT, TDS).
  - Step 5: Executive Sign-off & Lock (Sign-off checkbox and immutable lock).
- **Current State [EXISTING IMPLEMENTATION]:**
  - Steps 1–5 are visually rendered with step progress indicator.
  - Step transitions and calculations are wired to `store.calculatePayrollRun()` and `store.saveAndLockPayrollRun()`.
- **Backend Wiring Status [GAP]:**
  - Must be wired to transactional Supabase RPC `generate_payroll_run` and `lock_payroll_run`.

### 2.3 `PayslipManagement.tsx`
- **Location:** `src/app/workspace/PayslipManagement.tsx`
- **Visual Design:** Strictly mirrors Stitch Screen `5e0b0a0aa90449ddb33023f1c350668e`.
- **Current State [EXISTING IMPLEMENTATION]:**
  - Period selector (Month, Year), search bar, and status filter (`ALL`, `DISPATCHED`, `RENDERED`).
  - Aggregates total disbursed payout.
  - Allows bulk dispatch and navigation to individual payslip preview.
- **Backend Wiring Status [GAP]:**
  - Currently synthesizes mock line items in-memory.
  - **Required Wire-up:** Query `payslips` joined with `payroll_items` via `payrollService.getPayslips()`.

### 2.4 `OfficialPayslipView.tsx`
- **Location:** `src/app/workspace/OfficialPayslipView.tsx`
- **Visual Design:** Strictly mirrors Stitch Screen `c9d381730a8b4f14a07d43267ca1714f` (Form XIX Official Indian Payslip layout).
- **Current State [EXISTING IMPLEMENTATION]:**
  - Features company header, employee demographic information, attendance summary (Days in Month, Paid Days, LWP Days).
  - Two-column financial breakdown: **Earnings** (Basic, HRA, Special Allowance, Incentives) vs. **Deductions** (EPF, ESIC, PT, TDS).
  - Net Pay in numbers and words (Rupees).
  - Bank account details (Masked account number, Bank Name, IFSC).
  - Print stylesheet configured for standard A4 landscape/portrait printing (`print:hidden` action bar).
- **Backend Wiring Status [GAP]:**
  - Currently computes mock ratios on the fly (`basic = payableBase * 0.5`).
  - **Required Wire-up:** Load authentic `payroll_items` and `employee_salary_structures` from live backend.

### 2.5 `EmployeePortal.tsx` (Payslips Tab)
- **Location:** `src/app/portal/EmployeePortal.tsx`
- **Current State [EXISTING IMPLEMENTATION]:**
  - Portal has tab navigation: Profile, Attendance, Leaves, Payslips.
  - Payslips tab lists past payslips and allows download.
- **Backend Wiring Status [GAP]:**
  - Query `payslips` filtered by `employee_id = currentEmployee.id AND is_published = TRUE`.

---

## 3. UI STATE HANDLING SPECIFICATION

For all 5 screens, the following strict state handling guidelines must be observed:

| State | Implementation Requirement |
| :--- | :--- |
| **Loading State** | Skeleton loaders matching the card and table dimensions; never layout-shift. |
| **Error State** | Structured alert banner with retry button; never crash the page or display raw stack traces. |
| **Empty State** | Descriptive illustration and call-to-action button (e.g., "No payroll runs found for 2026. Start Guided Payroll Run"). |
| **Policy Unconfigured State** | Full-page safety gate blocking payroll execution until client policies are configured. |
| **Responsive Behaviour** | Desktop-first optimization conforming to Stitch layout; mobile drawer navigation and horizontal scrolling tables on small viewports. |
