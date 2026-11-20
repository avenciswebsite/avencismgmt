# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4D: LEAVE MANAGEMENT PRE-IMPLEMENTATION AUDIT

**Author:** Antigravity Integration Agent  
**Date:** 2026-11-14  
**Status:** AUDIT COMPLETE — READY FOR IMPLEMENTATION  
**Next Step:** Implement Service Enhancements & UI Integrations  

---

### 1. Overview & Objective

This audit examines the existing Leave Management codebase, database schemas, Row-Level Security (RLS) policies, domain services, and UI components across Avencis WFM prior to executing Milestone 2.4D.

The scope of Milestone 2.4D is to connect:
1. **Manager & HR Leave Dashboard (`src/app/workspace/LeaveManagement.tsx`)**
2. **Employee Leave Portal (`src/app/portal/EmployeePortal.tsx` — Tab: `leaves`)**
3. **Leave Entitlement & Approval Service (`src/services/leaveService.ts`)**
4. **Attendance Integration (Recognizing approved leaves in daily attendance)**

All work must strictly adhere to the project rules: Zero UI drift, no schema alterations, no service-role exposure, and strict anti-self-approval enforcement.

---

### 2. Approved Stitch Screen Reference Mapping

| Module Component | Route | Stitch Screen Reference | Screen ID | Verified Elements |
|---|---|---|---|---|
| **Manager Leave Dashboard** | `/workspace/:clientId/leaves`<br>`/workspace/leaves` | Screen `05-leave-management-dashboard` (Batch 02) | `d22afe6263f149ffbbe5f339f451faa1` | Monthly credit badges, carry-forward cap, pending requests review cards, decision modal, historical leave register table. |
| **Leave Application Register** | `/workspace/:clientId/leave/applications` | Screen `02-leave-application-register` (Batch 02) | `1ad3c83327e94a218b586619534d6f0f` | Status pills, leave type chips, duration calculation, manager remarks. |
| **Employee Leave Portal** | `/portal/leave`<br>`/portal/leaves` | Screen `02-leave-application-register` (Mobile Drawer) | `1ad3c83327e94a218b586619534d6f0f` | Balance summary cards (PL, CL, SL), leave request form (type, start, end, reason), personal request history table. |
| **Attendance & Leave Reports** | `/workspace/:clientId/attendance/reports` | Screen `12-attendance-leave-reports` (Batch 02) | `5fccb2c4d9744010b8e66a891cdcf9f4` | Daily attendance matrix mapping approved leaves (`PAID_LEAVE`). |

---

### 3. Physical Database Schema & Constraints

Migration [20261103000006_leave_management.sql](file:///c:/Avencis%20Management/supabase/migrations/20261103000006_leave_management.sql) defines two tables:

#### Table 1: `public.leave_balances`
```sql
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('PL', 'CL', 'SL')),
    year INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
    opening NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (opening >= 0),
    credited NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (credited >= 0),
    used NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (used >= 0),
    closing NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (closing >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_emp_leave_year_type UNIQUE (employee_id, leave_type, year)
);
```
- **Arithmetic Invariant:** $\text{closing} = \max(0, \text{opening} + \text{credited} - \text{used})$.
- **Leave Types Supported:** `'PL'` (Privilege Leave), `'CL'` (Casual Leave), `'SL'` (Sick Leave).
- **Scale:** Precision 4, Scale 1 (max balance 999.9 days, supporting half-days e.g. 0.5d).

#### Table 2: `public.leave_requests`
```sql
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('PL', 'CL', 'SL', 'LWP')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(4,1) NOT NULL CHECK (total_days > 0),
    reason TEXT NOT NULL,
    manager_remarks TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
    ),
    reviewed_by UUID REFERENCES user_profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);
```
- **Constraint Check:** `end_date >= start_date`.
- **Leave Types:** Supports `'PL'`, `'CL'`, `'SL'`, and `'LWP'` (Leave Without Pay).
- **Review Trail:** Records `reviewed_by` (UUID foreign key to `user_profiles`), `reviewed_at` (TIMESTAMPTZ), and `manager_remarks`.

---

### 4. Row Level Security (RLS) Policy Audit

From [20261103000009_row_level_security_policies.sql](file:///c:/Avencis%20Management/supabase/migrations/20261103000009_row_level_security_policies.sql):

1. **`leave_balances` Policies:**
   - `leave_balances_employee_select`: Authenticated employees can `SELECT` only their own balances (`employee_id = public.get_user_employee_id()`).
   - `leave_balances_tenant_admin_all`: Admins (`super_admin`, `client_admin`, `hr_admin`) can read and manage balances within their client organization.
2. **`leave_requests` Policies:**
   - `leave_requests_employee_all`: Authenticated employees can read and submit (`INSERT`) requests for their own employee profile.
   - `leave_requests_tenant_admin_all`: Tenant admins (`super_admin`, `client_admin`, `hr_admin`, `client_manager`) have full access across their client organization.

---

### 5. Existing Service Layer Audit (`leaveService.ts`)

| Service Method | Implemented Status | Gaps Identified |
|---|:---:|---|
| `getLeaveBalances(employeeId, year)` | **EXISTS** | Lacks `callerScope` multi-tenant and peer isolation validation. |
| `submitLeaveRequest(payload)` | **EXISTS** | Lacks overlap detection with existing approved/pending leaves; lacks `callerScope` validation. |
| `getLeaveRequests(filter)` | **EXISTS** | Lacks `callerScope` scoping for employee role (employees must only see their own requests). |
| `reviewLeaveRequest(id, decision)` | **EXISTS** | Anti-self-approval rule enforced in Supabase mode, but needs parity in mock mode; duplicate approval guard needed. |
| `cancelLeaveRequest(id, employeeId)` | **MISSING** | Employees must be able to cancel their own `PENDING` requests before review. |

---

### 6. Identified Gaps & Required Actions

1. **Anti-Self-Approval Enforcement:**
   Corporate governance mandates that no employee (regardless of administrative rank) can approve their own leave application. This must be enforced both in `LeaveManagement.tsx` (Approve button disabled with `Self-Approval Prohibited` badge) and `leaveService.reviewLeaveRequest()`.
2. **Balance Deduction Timing:**
   Leave days must **NOT** be deducted when an application is submitted. Balances are only debited when the request is **APPROVED**. If a request is rejected or cancelled, balances remain untouched.
3. **Attendance Integration:**
   When daily attendance is rendered, days overlapping an approved leave request (`status = 'APPROVED'`) should display as `PAID_LEAVE` (`status = 'PAID_LEAVE'`) with working hours set to standard, preventing false absenteeism.
4. **Cancellation Flow:**
   Add `cancelLeaveRequest()` to allow employees to withdraw pending applications safely.
5. **UI State Lifecycles:**
   Replace static store calls in `LeaveManagement.tsx` and `EmployeePortal.tsx` with asynchronous service calls, complete with loading skeletons, empty states, error banners, and retry actions.

---

### 7. Step-by-Step Implementation Roadmap

- **Step 1:** Enhance `src/services/leaveService.ts` (add `callerScope` scoping, overlap validation, duplicate approval guard, balance deduction logic, and `cancelLeaveRequest`).
- **Step 2:** Refactor `src/app/workspace/LeaveManagement.tsx` to use `leaveService`, `policyService`, `employeeService`, with live KPIs, search, filters, loading states, and anti-self-approval UI guards.
- **Step 3:** Refactor `src/app/portal/EmployeePortal.tsx` (leaves tab) to fetch live balances, personal requests, submit new applications with date range & overlap checks, and allow cancellation.
- **Step 4:** Create comprehensive test suite `scripts/testLeaveManagement.ts` covering all prompt scenarios (A through D).
- **Step 5:** Run TypeScript compilation (`npx tsc --noEmit`), Vite production build (`npm run build`), and the full regression suite (all 6 test scripts).
- **Step 6:** Generate all 10 required documentation deliverables in `docs/`.
