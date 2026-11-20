# AVENCIS WORKFORCE MANAGEMENT (WFM)
## ROW LEVEL SECURITY (RLS) & ROLE PERMISSION VERIFICATION REPORT

**Document Version:** 1.0.0  
**Milestone:** 2.4D Verification Gate  
**Baseline Reference:** `docs/LEAVE_APPROVAL_PERMISSION_MATRIX.md`  
**Database File:** `supabase/migrations/20261103000009_row_level_security_policies.sql`  
**Database Tables:** `public.leave_balances`, `public.leave_requests`  

---

### 1. Executive Summary & Verification Context

A rigorous comparative audit was conducted between the approved permission matrix ([LEAVE_APPROVAL_PERMISSION_MATRIX.md](file:///c:/Avencis%20Management/docs/LEAVE_APPROVAL_PERMISSION_MATRIX.md)), the service-layer authorization logic (`src/services/leaveService.ts`), and the physical PostgreSQL Row Level Security (RLS) policies.

#### Live Authentication Notice:
> [!NOTE]
> **AUTHENTICATED TEST ACCOUNTS AVAILABILITY:**  
> The live Supabase Auth catalog currently contains zero provisioned test user passwords in `auth.users`. Direct HTTP calls using `supabase.auth.signInWithPassword()` fail with `Invalid login credentials`. Consequently, live database checks with the anonymous key correctly return 0 rows under RLS. Authenticated role behaviors were analyzed by deep static inspection of PostgreSQL RLS AST rules, simulated role context execution, and service-layer test evaluation.

---

### 2. Comprehensive Role-by-Role Discrepancy Matrix

The table below contrasts the **Expected Matrix Permission**, the **Actual Service-Layer Result**, and the **Actual PostgreSQL RLS Result** across all 7 operational roles:

| Role | Operational Capability | Expected Matrix Permission | Service-Layer Result | Supabase Database RLS Result | Match? | Severity / Status |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Super Admin** | View Cross-Client Leave Requests | All Clients | Allowed (global) | **BLOCKED (0 rows)** | **NO** | **FAIL (Defect)** |
| **Super Admin** | Approve/Reject Leave Requests | Allowed | Allowed | **BLOCKED (42501/0 rows)** | **NO** | **FAIL (Defect)** |
| **Super Admin** | Manage Cross-Client Balances | Allowed | Allowed | **BLOCKED (42501/0 rows)** | **NO** | **FAIL (Defect)** |
| **HR Admin** | View Tenant Leave Requests | Tenant Scope | Tenant Scope | Allowed (`client_id = get_user_client_id()`) | **YES** | **PASS** |
| **HR Admin** | Approve/Reject Leave Requests | Allowed | Allowed | Allowed | **YES** | **PASS** |
| **HR Admin** | View/Adjust Tenant Balances | Allowed | Allowed | Allowed | **YES** | **PASS** |
| **Payroll Admin** | Read Approved Leaves (Payroll) | Read-Only | Blocked (`getLeaveRequests`) | **BLOCKED (0 rows)** | **NO** | **FAIL (Defect)** |
| **Payroll Admin** | Approve/Reject Requests | **No (403)** | Blocked (403) | Blocked (No policy) | **YES** | **PASS** |
| **Payroll Admin** | View Peer Leave Balances | **No (403)** | Allowed in JS (Bug) | Blocked (No policy) | Partial | **FAIL (Defect)** |
| **Client Admin** | View Tenant Leave Requests | Tenant Scope | Tenant Scope | Allowed | **YES** | **PASS** |
| **Client Admin** | Approve/Reject Leave Requests | Allowed | Allowed | Allowed | **YES** | **PASS** |
| **Client Admin** | Adjust Tenant Balances | Allowed | Allowed | Allowed | **YES** | **PASS** |
| **Client Manager** | View Team Leave Requests | Dept Scope | Client Scope (Broad) | Client Scope (Broad) | Partial | **FAIL (Defect)** |
| **Client Manager** | Approve/Reject Subordinate Leave | Allowed | Allowed | Allowed on requests | **YES** | **PASS** |
| **Client Manager** | Update Leave Balances on Approval | Required for deduction | Allowed in JS | **BLOCKED (42501)** | **NO** | **FAIL (Defect)** |
| **Location Manager** | View Location Leave Requests | Location Scope | Client Scope (Broad) | **BLOCKED (0 rows)** | **NO** | **FAIL (Defect)** |
| **Location Manager** | Approve/Reject Location Leave | Allowed | Allowed in JS | **BLOCKED (42501)** | **NO** | **FAIL (Defect)** |
| **Location Manager** | Update Leave Balances on Approval | Required for deduction | Allowed in JS | **BLOCKED (42501)** | **NO** | **FAIL (Defect)** |
| **Employee** | View Own Balances & Requests | Self Only | Self Only | Allowed | **YES** | **PASS** |
| **Employee** | View Peer Balances | **No (403)** | Blocked (403) | Blocked | **YES** | **PASS** |
| **Employee** | Submit Leave Request (Self) | Allowed | Allowed | Allowed | **YES** | **PASS** |
| **Employee** | Cancel Own Pending Request | Allowed | Allowed | Allowed | **YES** | **PASS** |
| **Employee** | Direct Self-Approval Prevention | **STRICTLY BLOCKED** | Blocked in JS | **VULNERABLE (Allowed)** | **NO** | **CRITICAL FAIL** |

---

### 3. Critical Security Gaps & Vulnerabilities Detailed

#### Gap 1: Critical Privilege Escalation Vulnerability (Employee Self-Approval)
- **Vulnerability Location:** Migration `20261103000009_row_level_security_policies.sql`, lines 146–149:
  ```sql
  CREATE POLICY "leave_requests_employee_all" ON leave_requests
  FOR ALL TO authenticated
  USING (employee_id = public.get_user_employee_id())
  WITH CHECK (employee_id = public.get_user_employee_id() AND client_id = public.get_user_client_id());
  ```
- **Attack Vector:**
  The clause `FOR ALL` grants `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions to the employee over their own records.
  Because there is no constraint `CHECK (status = 'PENDING')` or restriction preventing updates to `status`, any authenticated employee can bypass the frontend UI, open a browser developer console, and issue a direct PostgREST command:
  ```javascript
  await supabase.from('leave_requests')
    .update({ status: 'APPROVED' })
    .eq('id', myRequestId);
  ```
  PostgreSQL evaluates `USING (employee_id = public.get_user_employee_id())` as `TRUE` and `WITH CHECK` as `TRUE`. The update succeeds, granting self-approval at the database tier in direct violation of corporate governance rules.

#### Gap 2: Super Admin Multi-Tenant Lockout
- **Vulnerability Location:** Migration 09, lines 141–144 and lines 151–154:
  ```sql
  CREATE POLICY "leave_balances_tenant_admin_all" ON leave_balances
  FOR ALL TO authenticated
  USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin'))
  ```
- **Mechanism of Failure:**
  In a multi-tenant enterprise architecture, global Super Admins have `client_id IS NULL` in `user_profiles` because they are not tethered to a single client tenant.
  When `public.get_user_client_id()` returns `NULL`, the expression `client_id = NULL` evaluates to `NULL` (falsy in SQL boolean logic).
  Consequently, Super Admins cannot SELECT, INSERT, UPDATE, or DELETE any records in `leave_balances` or `leave_requests`.

#### Gap 3: Location Manager Omission
- **Vulnerability Location:** Migration 09, line 153:
  ```sql
  USING (... public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager'))
  ```
- **Mechanism of Failure:**
  `location_manager` is completely omitted from the policy list. A user with `role = 'location_manager'` cannot view or review leave requests for employees assigned to their work site under RLS.

#### Gap 4: Client Manager / Location Manager Balance Update Block
- **Vulnerability Location:** Migration 09, line 143:
  ```sql
  USING (... public.get_user_role() IN ('super_admin', 'client_admin', 'hr_admin'))
  ```
- **Mechanism of Failure:**
  Even though `client_manager` is permitted to update `leave_requests`, they are excluded from `leave_balances`. When a Client Manager approves an application in `leaveService.ts`, Step 4 updates the request, but Step 5 attempting to update `leave_balances` is rejected by PostgreSQL RLS with error `42501 (insufficient_privilege)`.

#### Gap 5: Payroll Admin Complete Blindness
- In Milestone 2.4E, the payroll engine needs to query approved leaves to deduct Unpaid Leave (LWP) and verify payable days.
- Currently, `payroll_admin` has zero SELECT policies on `leave_requests` and `leave_balances`. When the payroll run initiates, it will read 0 leave records under RLS.

---

### 4. Proposed Remediation SQL Migrations

> [!IMPORTANT]
> **GOVERNANCE NOTICE: DO NOT EXECUTE WITHOUT APPROVAL**  
> Under Strict Rule 1 of Milestone 2.4D instructions, the proposed SQL below is documented for architectural review and explicit stakeholder approval. It has NOT been applied to the live database.

```sql
-- ==============================================================================
-- PROPOSED MIGRATION: 20261114000002_fix_leave_rls_policies.sql
-- Status: PENDING EXPLICIT APPROVAL (DO NOT EXECUTE)
-- ==============================================================================

-- 1. Drop Flawed Policies
DROP POLICY IF EXISTS "leave_requests_employee_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_tenant_admin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_balances_tenant_admin_all" ON public.leave_balances;

-- 2. Restrict Employee Leave Requests (Disallow self-approval / status tampering)
-- A. Employee can SELECT own requests
CREATE POLICY "leave_requests_employee_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (employee_id = public.get_user_employee_id());

-- B. Employee can INSERT own requests ONLY in PENDING status
CREATE POLICY "leave_requests_employee_insert" ON public.leave_requests
FOR INSERT TO authenticated
WITH CHECK (
    employee_id = public.get_user_employee_id()
    AND client_id = public.get_user_client_id()
    AND status = 'PENDING'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
);

-- C. Employee can UPDATE (Cancel) ONLY own PENDING requests to CANCELLED
CREATE POLICY "leave_requests_employee_cancel" ON public.leave_requests
FOR UPDATE TO authenticated
USING (
    employee_id = public.get_user_employee_id()
    AND status = 'PENDING'
)
WITH CHECK (
    employee_id = public.get_user_employee_id()
    AND status = 'CANCELLED'
    AND reviewed_by IS NULL
);

-- 3. Super Admin Global Policies (Decoupled from client_id)
CREATE POLICY "leave_requests_super_admin_all" ON public.leave_requests
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin');

CREATE POLICY "leave_balances_super_admin_all" ON public.leave_balances
FOR ALL TO authenticated
USING (public.get_user_role() = 'super_admin');

-- 4. Tenant Administrator & Manager Policies (Including Location Manager)
CREATE POLICY "leave_requests_tenant_admin_all" ON public.leave_requests
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager')
)
WITH CHECK (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager')
);

CREATE POLICY "leave_balances_tenant_admin_all" ON public.leave_balances
FOR ALL TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager')
)
WITH CHECK (
    client_id = public.get_user_client_id()
    AND public.get_user_role() IN ('client_admin', 'hr_admin', 'client_manager', 'location_manager')
);

-- 5. Payroll Admin Read-Only Policies (For Milestone 2.4E Payroll Integration)
CREATE POLICY "leave_requests_payroll_admin_select" ON public.leave_requests
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() = 'payroll_admin'
);

CREATE POLICY "leave_balances_payroll_admin_select" ON public.leave_balances
FOR SELECT TO authenticated
USING (
    client_id = public.get_user_client_id()
    AND public.get_user_role() = 'payroll_admin'
);
```
