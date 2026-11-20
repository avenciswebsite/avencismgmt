# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE MANAGEMENT SECURITY & GOVERNANCE REVIEW

**Document Version:** 1.0.0  
**Milestone:** 2.4D  
**Focus:** Multitenancy Isolation, Corporate Governance, Anti-Self-Approval, and RLS Boundaries  

---

### 1. Security Architecture Principles

Leave management involves employee entitlements, confidential health justifications (for Sick Leave), and operational time-off approvals that directly impact payroll calculation. The system enforces four layers of defense:

1. **Authentication Layer:** Supabase JWT session restoration via `AuthContext.tsx`.
2. **Tenant Scoping Layer:** `WorkspaceContext.tsx` ensuring users are bound to their authorized client organization (`currentClient.id`).
3. **Service Layer Authorization:** `leaveService.ts` verifying `callerScope` against role boundaries and peer boundaries.
4. **Database Row-Level Security (RLS):** Supabase PostgreSQL policies enforcing tenancy and user identity at the database layer.

---

### 2. Corporate Governance: Anti-Self-Approval Rule

#### The Threat:
In workforce applications, managers often have permission to approve team leave requests. If a manager applies for leave, an unconstrained approval UI could allow the manager to approve their own application, bypassing oversight, balance deductions, or project coverage requirements.

#### The Avencis WFM Solution:
The Anti-Self-Approval restriction is implemented in depth:
1. **Frontend UI Guard (`LeaveManagement.tsx`):**
   ```tsx
   const isOwnRequest = Boolean(user?.employeeId && empId === user.employeeId);
   // ...
   {isOwnRequest ? (
     <div className="... cursor-not-allowed opacity-75">
       <ShieldAlert className="w-3 h-3 text-secondary" />
       <span>Self-Approval Prohibited</span>
     </div>
   ) : (
     <button onClick={() => setDecisionModal({ id: req.id, action: 'APPROVED', empId })}>
       Approve
     </button>
   )}
   ```
2. **Service Layer Enforcement (`leaveService.ts`):**
   ```typescript
   if (decision.reviewerEmployeeId && decision.reviewerEmployeeId === existing.employeeId) {
     return errorResponse(
       createPermissionError('Corporate Governance Violation: Employees are prohibited from approving their own leave requests.')
     );
   }
   if (callerScope?.employeeId && callerScope.employeeId === existing.employeeId) {
     return errorResponse(
       createPermissionError('Corporate Governance Violation: Employees are prohibited from approving their own leave requests.')
     );
   }
   ```
3. **Outcome:** A manager who applies for leave must have their application reviewed by a superior (Client Admin, HR Admin, or Super Admin). Self-approval is strictly prohibited.

---

### 3. Peer Isolation & Privacy Boundaries

- **Sick Leave Reason Privacy:** Medical details and sensitive leave reasons are accessible only to the applicant, their reporting manager, HR administrators, and Client Admins.
- **Peer Balance Obfuscation:** Employees cannot query the leave balances or history of their colleagues. Calling `getLeaveBalances(peerEmpId)` with `role === 'employee'` returns HTTP 403 (`PERMISSION_ERROR`).
- **Peer Application List Scoping:** Calling `getLeaveRequests({ clientId })` as an employee automatically scopes the query to `filter.employeeId = callerScope.employeeId`, excluding peer rows.

---

### 4. Cross-Tenant Isolation

- Cross-tenant requests are blocked at the service layer:
  $$\text{callerScope.clientId} \ne \text{payload.clientId} \implies \text{HTTP 403 Forbidden}$$
- Non-Super Admins attempting to submit or review leave in a client workspace outside their assignment are immediately denied.
- PostgREST unauthenticated queries return 0 rows under PostgreSQL Row-Level Security policies.

---

### 5. Balance Tamper Protection

- Leave balance updates (`used += totalDays`, `closing = max(0, opening + credited - used)`) are executed strictly within the transaction boundaries of `reviewLeaveRequest()` upon managerial approval.
- Direct frontend edits to `leave_balances` are prohibited.
- `public.leave_balances` table has `CHECK` constraints ensuring non-negative values for all balance fields.
