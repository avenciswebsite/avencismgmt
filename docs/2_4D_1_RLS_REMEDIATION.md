# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4D.1 ROW LEVEL SECURITY (RLS) REMEDIATION SPECIFICATION

**Document Version:** 1.0.0  
**Date:** November 14, 2026  
**Auditor / Engineering Lead:** Antigravity Engineering (Google DeepMind)  
**Milestone:** 2.4D.1 Database Migration & Integrity Remediation  
**Target Migration:** `supabase/migrations/20261114000013_leave_rls_remediation.sql`  

---

### 1. Executive Summary

Row Level Security in PostgreSQL is the core data boundary in Avencis Workforce Management. During the Milestone 2.4D audit, five distinct RLS vulnerabilities were identified, including a **Critical Privilege Escalation Vector** allowing employees to approve their own leave applications via direct PostgREST calls.

Migration 13 comprehensively restructures RLS policies across `public.leave_requests` and `public.leave_balances` for all seven system roles.

---

### 2. Comparative Policy Architecture (Before vs. After)

#### Table `public.leave_requests`

| Role | Operation | Legacy Migration 09 Policy | Remediated Migration 13 Policy | Security Effect |
|---|---|---|---|---|
| **Employee** | `SELECT` | Covered under broad `FOR ALL` | `leave_requests_employee_select`: `USING (employee_id = get_user_employee_id())` | Scoped to own rows. |
| **Employee** | `INSERT` | Covered under broad `FOR ALL` | `leave_requests_employee_insert`: `WITH CHECK (employee_id = get_user_employee_id() AND client_id = get_user_client_id() AND status = 'PENDING' AND reviewed_by IS NULL)` | **Neutralizes Self-Approval.** Applications can only be created in `PENDING` state. |
| **Employee** | `UPDATE` | Covered under broad `FOR ALL` (Allowed setting `status = 'APPROVED'`) | `leave_requests_employee_cancel`: `USING (employee_id = get_user_employee_id() AND status = 'PENDING') WITH CHECK (employee_id = get_user_employee_id() AND status = 'CANCELLED' AND reviewed_by IS NULL)` | **Neutralizes Privilege Escalation.** Employees can ONLY cancel their own PENDING requests. All other updates rejected. |
| **Employee** | `DELETE` | Allowed under `FOR ALL` | **REVOKED (No DELETE policy)** | Requests cannot be deleted; cancellation preserves audit trail. |
| **Super Admin** | `ALL` | Checked `client_id = get_user_client_id()` (Failed if NULL) | `leave_requests_super_admin_all`: `USING (get_user_role() = 'super_admin') WITH CHECK (get_user_role() = 'super_admin')` | **Restores Global Oversight.** Super Admins can view/manage across all tenants. |
| **Location Manager** | `SELECT / UPDATE` | **OMITTED (Blocked by RLS)** | Added to `leave_requests_tenant_admin_select` and `leave_requests_tenant_admin_modify` | **Enables Location Authority.** Location Managers can view and manage facility requests. |
| **Client Manager** | `SELECT / UPDATE` | Client Scoped | Client Scoped | Preserved; routine decisions channeled through atomic RPC. |
| **HR / Client Admin** | `SELECT / UPDATE` | Client Scoped | Client Scoped | Preserved. |
| **Payroll Admin** | `SELECT` | **OMITTED (Blocked by RLS)** | `leave_requests_payroll_admin_select`: `USING (client_id = get_user_client_id() AND get_user_role() = 'payroll_admin')` | **Enables Milestone 2.4E Integration.** Payroll can read approved leave data. |

---

#### Table `public.leave_balances`

| Role | Operation | Legacy Migration 09 Policy | Remediated Migration 13 Policy | Security Effect |
|---|---|---|---|---|
| **Employee** | `SELECT` | `employee_id = get_user_employee_id()` | `leave_balances_employee_select`: `USING (employee_id = get_user_employee_id())` | Preserved (Self-service only). |
| **Super Admin** | `ALL` | Checked `client_id = get_user_client_id()` (Failed if NULL) | `leave_balances_super_admin_all`: `USING (get_user_role() = 'super_admin') WITH CHECK (get_user_role() = 'super_admin')` | **Restores Global Oversight.** |
| **Client Manager** | `SELECT` | **OMITTED (Blocked by RLS)** | Included in `leave_balances_tenant_admin_select` | Can inspect subordinate balances. |
| **Location Manager** | `SELECT` | **OMITTED (Blocked by RLS)** | Included in `leave_balances_tenant_admin_select` | Can inspect site employee balances. |
| **Client Admin / HR** | `ALL` | Scoped to client | `leave_balances_tenant_admin_modify`: Manual balance adjustments permitted. | Preserved. Routine approval balance debits occur via `SECURITY DEFINER` RPC. |
| **Payroll Admin** | `SELECT` | **OMITTED (Blocked by RLS)** | `leave_balances_payroll_admin_select`: `USING (client_id = get_user_client_id() AND get_user_role() = 'payroll_admin')` | **Enables Milestone 2.4E Integration.** |

---

### 3. Detailed Security Proofs

#### Proof 1: Neutralization of Employee Self-Approval Attack Vector
- **The Attack:**
  An employee attempts to issue PostgREST request:
  `PATCH /rest/v1/leave_requests?id=eq.<id>` with body `{"status": "APPROVED"}`.
- **Evaluation under Migration 13:**
  1. PostgreSQL inspects available policies on `leave_requests` for role `authenticated` executing `UPDATE`.
  2. The only applicable policy for an employee is `leave_requests_employee_cancel`.
  3. The `WITH CHECK` clause states:
     `employee_id = public.get_user_employee_id() AND status = 'CANCELLED' AND reviewed_by IS NULL`
  4. The attempted update has `status = 'APPROVED'`.
  5. The `WITH CHECK` expression evaluates to `FALSE`.
  6. **Result:** PostgreSQL terminates with error `42501 (new row violates row-level security policy for table "leave_requests")`. The attack is completely neutralized.

#### Proof 2: Elimination of Super Admin Multi-Tenant Block
- **The Failure:**
  Global Super Admin profile has `id = <super_admin_uuid>`, `role = 'super_admin'`, and `client_id = NULL`.
- **Legacy Evaluation:**
  `client_id = public.get_user_client_id()` -> `client_id = NULL` -> `FALSE` for all rows.
- **Evaluation under Migration 13:**
  `public.get_user_role() = 'super_admin'` -> `TRUE`.
  The clause has zero dependency on `client_id`.
- **Result:** Super Admin can access records across all clients.

---

### 4. Verification Queries for Database Administrators

```sql
-- 1. Check all policies on leave_requests
SELECT policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'leave_requests';

-- 2. Verify Employee cannot UPDATE status to APPROVED
-- (Simulated as employee user)
SET ROLE authenticated;
SET request.jwt.claim.sub = '60000000-0000-0000-0000-000000000001';

UPDATE public.leave_requests 
SET status = 'APPROVED' 
WHERE id = '70000000-0000-0000-0000-000000000001';
-- Expected Result: ERROR: new row violates row-level security policy for table "leave_requests"
RESET ROLE;
```
