# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4C: ATTENDANCE SECURITY REVIEW

**Author:** Antigravity Integration Agent  
**Date:** 2026-11-14  
**Status:** COMPLETE & AUDITED  

---

### 1. Security Invariants & Compliance Objectives

Milestone 2.4C handles sensitive physical presence telemetry and managerial approval workflows. The implementation satisfies four non-negotiable security requirements:

1. **Append-Only Immutability:** Raw attendance punches cannot be altered, forged, backdated, or deleted.
2. **Multi-Tenant Data Isolation:** Users from Organization A cannot view or manipulate Organization B's attendance records.
3. **Employee Self-Service Scoping:** Employees cannot inspect peer records or execute clock-in/out actions for colleagues.
4. **Corporate Governance Anti-Self-Approval:** Staff members cannot approve their own regularisation requests.

---

### 2. Threat Vector Analysis & Mitigation

| Threat Vector | Severity | Attack Scenario | Defense Implementation |
|---|:---:|---|---|
| **Direct PostgREST Update Attack** | **CRITICAL** | Attacker attempts `PATCH /rest/v1/attendance_events` to alter in-time. | Database trigger `trg_guard_attendance_events_immutability` intercepts `UPDATE` and raises `AUDIT SECURITY VIOLATION`. RLS policy grants `INSERT` only. |
| **Cross-Tenant Telemetry Ingestion** | **HIGH** | Compromised user sends client B's UUID in punch payload. | Service layer checks `callerScope.clientId`. Supabase RLS enforces `client_id = auth.user_profile.client_id`. |
| **Buddy Punching (Punch for Peer)** | **HIGH** | Employee transmits coworker's `employee_id` in punch request. | Service layer strictly enforces: `if (role === 'employee' && employeeId !== payload.employeeId) throw PERMISSION_ERROR`. |
| **Self-Approved Attendance Correction** | **HIGH** | Manager submits correction for missed punch and approves it. | Service layer blocks review if `correction.employee_id === decision.reviewerId`. UI disables Approve button and renders `Self-Approval Prohibited`. |
| **GPS Spoofing / Mock Location** | **MEDIUM** | Employee uses browser DevTools GPS override to simulate presence at work depot. | System treats GPS as a **verification signal**, not absolute legal proof. Out-of-bounds telemetry is flagged `is_suspicious: true` and recorded with accuracy metrics. |
| **Accidental Double Punching** | **LOW** | Employee double-clicks punch button or network lags. | State transition guards reject duplicate `CHECK_IN` or `CHECK_OUT` without active session with structured validation error. |

---

### 3. Database RLS Verification

The live Supabase project enforces the following Row Level Security policies on attendance tables:

1. **`attendance_events`:**
   - `events_employee_self_insert`: Authenticated users can insert their own events (`employee_id = auth_emp_id`).
   - `events_employee_self_select`: Authenticated users can select only their own events.
   - `events_tenant_admin_select`: Client Admins & Managers can select events where `client_id` matches their profile.
   - No `UPDATE` or `DELETE` policies exist. Any modification attempt fails closed.

2. **`daily_attendance_records`:**
   - `muster_employee_self_select`: Staff members can read only their own muster records.
   - `muster_tenant_admin_all`: Client Admins can manage muster records for their client organization.

3. **`attendance_corrections`:**
   - `corrections_employee_self_insert`: Staff can apply for corrections on their own behalf.
   - `corrections_tenant_admin_review`: Reviewers can update pending records only within their tenant organization.
