# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4C: ATTENDANCE PERMISSION MATRIX

**Author:** Antigravity Integration Agent  
**Date:** 2026-11-14  
**Status:** COMPLETE & VERIFIED  

---

### 1. Attendance Role-Based Access Control (RBAC) Matrix

Avencis WFM implements 7 distinct roles across Super Administration, Client Tenant Administration, and Employee Self-Service. The table below outlines authorized operations for each role:

| Operation | Super Admin | HR Admin | Payroll Admin | Client Admin | Client Manager | Location Manager | Employee (Self) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Record Own Punch (Clock In/Out)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Own Only) |
| **Record Punch for Peers** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (Blocked) |
| **View Own Attendance History** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Own Only) |
| **View Client Attendance Muster** | ✅ (All) | ✅ (Tenant) | ✅ (Tenant) | ✅ (Tenant) | ✅ (Tenant) | ✅ (Location Only) | ❌ (Blocked) |
| **View Raw Telemetry Events** | ✅ (All) | ✅ (Tenant) | ✅ (Tenant) | ✅ (Tenant) | ✅ (Tenant) | ✅ (Location Only) | ❌ (Blocked) |
| **Submit Attendance Regularisation** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Own Only) |
| **Review / Approve Regularisations** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Assigned) | ❌ (Blocked) |
| **Approve Own Regularisation** | ❌ (Rule) | ❌ (Rule) | ❌ (Rule) | ❌ (Rule) | ❌ (Rule) | ❌ (Rule) | ❌ (Rule) |
| **Delete / Overwrite Raw Punches** | ❌ (Trigger)| ❌ (Trigger)| ❌ (Trigger)| ❌ (Trigger)| ❌ (Trigger)| ❌ (Trigger)| ❌ (Trigger)|

---

### 2. Corporate Governance: Anti-Self-Approval Rule

To prevent payroll manipulation and maintain audit compliance under Indian labor regulations, the system strictly enforces the **Anti-Self-Approval Rule**:

> **Rule Invariant:**  
> An employee is prohibited from approving or reviewing their own attendance regularisation request, regardless of administrative seniority or organizational role.

#### Implementation & Enforcement Layers:
1. **Service Layer Guard (`attendanceService.reviewRegularisation`):**
   ```ts
   if (existingCorr.employee_id === decision.reviewerId) {
     return errorResponse(
       createPermissionError('Corporate Governance Violation: Employees cannot approve their own regularisation requests.')
     );
   }
   ```
2. **Frontend UI Enforcement (`AttendanceRegularisations.tsx`):**
   - If `c.employee_id === user.employeeId`, the **Approve** button is disabled and replaced with a `Self-Approval Prohibited` badge.
   - Client-side attempt is trapped with a descriptive notification before dispatching.

---

### 3. Multi-Tenant Cross-Client Isolation

- **Tenant Boundary:** All queries to `attendance_events`, `daily_attendance_records`, and `attendance_corrections` mandate a `client_id` filter.
- **Cross-Tenant Guard:** If a non-super-admin user attempts to query or record attendance for a client outside their authorized `callerScope.clientId`, the service layer immediately raises `PERMISSION_ERROR` (HTTP 403) and terminates execution.
- **Database RLS Policies:**
  - `events_tenant_admin_select`: Filters rows by `client_id = (SELECT client_id FROM user_profiles WHERE id = auth.uid())`.
  - `muster_tenant_admin_select`: Mandates matching `client_id`.
  - `corrections_tenant_admin_select`: Mandates matching `client_id`.
