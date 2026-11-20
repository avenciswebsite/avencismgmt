# Avencis Workforce Management (Module 01)
# Final Authoritative Requirements Baseline

---

**Document Reference:** `docs/FINAL_REQUIREMENTS_BASELINE.md`  
**Baseline Date:** 03 November 2026  
**Authority:** Master Implementation Directive & Confirmed Business Model  
**Module:** Module 01 — Workforce Management (WFM)  
**Parent Platform:** Avencis ERP / Business Management Platform  

---

## 1. Confirmed Operating & Business Model

### 1.1 Payroll Responsibility Model
1. **Client-Only Payroll:** The platform processes payroll **exclusively for client organisations**.
2. **Avencis Provider Role:** Avencis operates solely as the management service provider and platform administrator.
3. **No Default Avencis Employer:** Avencis is **never** the default employer in the current deployment. Every employee belongs to an onboarded client organisation and that client's specific legal/payroll entity.
4. **Multi-Entity per Client:** Each client organisation may have one or more registered legal entities (corporate name, PAN, GSTIN, PF establishment code, ESIC registration, state PT registrations).
5. **Separation of Concerns:** Payroll calculation, statutory compliance, salary disbursement, and payslips are legally and operationally branded and attributed to the respective client legal entity.

### 1.2 Multi-Client Multi-Tenancy
The application hosts multiple independent client organisations (e.g., **Suman**, **Maha India**, and future enterprise clients) within a unified multi-tenant architecture.

* **Tenant Boundary:** Each client possesses completely isolated:
  * Employee Master Database
  * Legal & Payroll Entities
  * Work Locations & Geofences
  * Departments & Designations
  * Attendance & Shift Rules
  * Leave Policies & Ledgers
  * Overtime & Late-Arrival Policies
  * Salary Structures & Payroll Runs
  * Payslip Archives
  * Client Administrator Accounts & User Permissions
* **Zero Data Leakage:** Under no circumstances may data belonging to one client be viewable or modifiable by another client.

---

## 2. Client-Specific Policy Engine (Zero Employee-Level Overrides)

**Foundational Rule:** All operational, attendance, leave, and payroll policies are configured strictly at the **CLIENT LEVEL**.

* All employees assigned to a client inherit that client's active policy set.
* There are **no individual employee-level policy overrides** in the current implementation.
* The configuration engine allows Avencis Super Administrators to customize the 20 policy domains below independently for each client.

### 2.1 The 20 Mandatory Client-Level Policy Areas

| # | Policy Area | Description & Enforcement |
|---|---|---|
| **01** | **Overtime Calculation Method** | Calculation formula: Hourly Multiplier ($N \times \text{Base Wage}$), Flat Hourly Rate ($\text{Amount/hr}$), or Comp-Off Accrual. |
| **02** | **Overtime Rate / Multiplier** | Specific rate (e.g., $1.5\times$, $2.0\times$) or flat currency unit. |
| **03** | **Late-Arrival Grace Window** | Allowable delay threshold after shift start time (e.g., 10 minutes, 15 minutes, or 0 minutes). |
| **04** | **Late-Arrival Penalty Rules** | Consequence progression (e.g., 3 late marks = 0.5-day Loss of Pay, or debit against Casual Leave). |
| **05** | **Overnight Shift Handling** | Allocation rule for shifts spanning midnight: Paid day attributed to **Shift Start Date** vs **Shift End Date**. |
| **06** | **Shift Durations & Hours** | Full-day standard working hours (e.g., 8.0 hrs, 9.0 hrs) and half-day thresholds (e.g., 4.5 hrs). |
| **07** | **Weekly Off Schedules** | Designated weekly off days (e.g., Sunday, Saturday + Sunday, or rotational 6-day week). |
| **08** | **Attendance Requirements** | Single punch vs double punch (Check-in and Check-out mandatory) and break logging. |
| **09** | **GPS Verification Policy** | Geolocation capture requirement (Mandatory for punch vs optional field log). |
| **10** | **Selfie Verification Policy** | Visual photo capture toggle: Mandatory selfie on check-in vs disabled. |
| **11** | **Geofencing Verification** | Strict radial geofence enforcement: Block out-of-bounds punch vs log as exception for review. |
| **12** | **Leave Types Supported** | Permitted leave categories for client (PL/EL, CL, SL, LWP, Comp-Off, Maternity, Bereavement). |
| **13** | **Leave Eligibility Rules** | Probation eligibility, minimum service tenure before leave applications permitted. |
| **14** | **Leave Accrual Frequency** | Automated monthly credit (e.g., 1.75 or 2.0 days/month) credited on 1st of calendar month. |
| **15** | **Leave Carry-Forward Rules** | Year-end rollover permission, maximum accumulation ceiling (e.g., 30 days cap), and lapsing rules. |
| **16** | **Leave Encashment Terms** | Encashment eligibility at separation or annual fiscal cycle, maximum encashable days. |
| **17** | **Paid vs Unpaid Treatment** | Salary deduction formulas for Loss of Pay (LWP) and unapproved absenteeism. |
| **18** | **Payroll Calculation Divisor** | Working day divisor policy: Fixed 26 days, Fixed 30 days, or Actual Calendar Days in month. |
| **19** | **Salary Component Structure** | Client-specific allowance packages (Basic, HRA, Conveyance, Medical, Special, Performance Incentive). |
| **20** | **Statutory Configurations** | PF Applicability (Yes/No, Employee %, Employer %), ESIC Applicability, PT Slabs, and TDS. |

### 2.2 Unconfigured Policy Handling & Payroll Gating
* **No Invented Defaults:** If a client policy remains unconfigured by the administrator, the system clearly marks it as `UNCONFIGURED` in the UI.
* **Payroll Execution Gate:** The payroll engine strictly **blocks payroll finalisation** if a mandatory calculation policy (such as salary divisor or statutory status) is unconfigured, displaying actionable validation errors to the administrator.

---

## 3. User Roles and Access Control Matrix

| Capability / Resource | Avencis Super Admin | Client Administrator | Field Employee |
| :--- | :---: | :---: | :---: |
| **Platform Scope** | **Global (All Clients)** | **Single Client Scoped** | **Individual Self Only** |
| Client Directory & Onboarding | Full Create / Edit / View | Denied | Denied |
| Client Workspace Switcher | Yes (Global Bar) | Denied (Locked to Tenant) | Denied |
| Client Policy Configuration | Full Create / Edit | Read-Only (or Permitted Edit) | Denied |
| Employee Directory & Add | All Clients | Own Client Only | Denied |
| Attendance Command Center | All Clients | Own Client Only | Denied |
| Personal Mobile Check-In/Out | Simulated / Testing | Simulated / Testing | **Yes (Primary View)** |
| Attendance Regularisation Queue | Approve / Reject Global | Approve / Reject Client | Submit Request Only |
| Leave Applications Review | Full Approval Queue | Client Approval Queue | Apply / Cancel Own |
| Leave Balance Statements | All Clients | Own Client Team | Own Balance Only |
| Payroll Guided Run & Lock | Full Execution & Approval | View / Draft (If permitted) | Denied |
| Payslip Generation & Reissue | Full Global Control | View Client Payslips | Download Personal PDF |
| Security Audit Logs | Full Forensics Ledger | Scoped Tenant Activity | Denied |

---

## 4. Master Navigation & Workspace Architecture

### 4.1 Avencis Master Dashboard (`/admin`)
* Central command center for Avencis leadership.
* Displays global workforce aggregations, total active clients, cross-client attendance rates, pending approvals, and upcoming payroll processing deadlines.
* Features the **Global Client Workspace Switcher** allowing instant context switching into any onboarded client without re-authenticating.

### 4.2 Client Workspace (`/clients/:clientId`)
* Contextual workspace representing the selected client (e.g., Suman or Maha India).
* All sub-routes (`/employees`, `/attendance`, `/leave`, `/payroll`, `/settings`) dynamically filter data, policies, and actions exclusively to the active `clientId`.
* Persistent banner displays the current client identity, with a one-click return to the Master Dashboard.

### 4.3 Employee Self-Service Portal (`/portal` & `/portal/check-in`)
* Mobile-responsive personal workspace for staff.
* Optimized for mobile web browsers ($390\times 844\text{px}$) featuring live GPS punch button, current shift countdown, leave balance cards, and payslip download history.
