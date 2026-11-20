# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE TRANSACTION INTEGRITY & CONCURRENCY REPORT

**Document Version:** 1.0.0  
**Milestone:** 2.4D Verification Gate  
**Target File:** `src/services/leaveService.ts` (`reviewLeaveRequest`)  
**Database Tables:** `public.leave_requests`, `public.leave_balances`, `public.audit_logs`  

---

### 1. Architectural Flaw in Current Implementation

In `src/services/leaveService.ts` (lines 393–464), managerial leave approval is implemented as a client-side sequence of uncoordinated Supabase PostgREST HTTP queries:

```typescript
// 1. Fetch request (HTTP GET)
const { data: request } = await supabase.from('leave_requests').select('*').eq('id', id).single();

// 2. Validate state in client JS
if (request.status === 'APPROVED') return errorResponse(...);

// 3. Update request to APPROVED (HTTP PATCH)
const { data: updated } = await supabase.from('leave_requests').update({
  status: decision.status,
  reviewed_by: decision.reviewerId,
  reviewed_at: new Date().toISOString(),
  manager_remarks: decision.remarks || null,
}).eq('id', id).select().single();

// 4. Fetch leave balance (HTTP GET)
const { data: balance } = await supabase.from('leave_balances').select('*')
  .eq('employee_id', request.employee_id).eq('leave_type', request.leave_type).eq('year', year).maybeSingle();

// 5. Update leave balance in JS calculation (HTTP PATCH)
const newUsed = Number(balance.used) + Number(request.total_days);
const newClosing = Math.max(0, Number(balance.opening) + Number(balance.credited) - newUsed);
await supabase.from('leave_balances').update({
  used: newUsed,
  closing: newClosing,
  updated_at: new Date().toISOString(),
}).eq('id', balance.id);
```

### 2. Transaction Invariant Evaluation

The table below examines the 8 critical operations required during leave approval and evaluates whether they occur within a single atomic PostgreSQL transaction boundary:

| Operation | In Current Implementation? | Atomic Within 1 DB Transaction? | Failure Mode / Vulnerability |
|---|:---:|:---:|---|
| **1. Verify request is still PENDING** | Partial (Client JS check) | **NO** | `UPDATE` does not include `.eq('status', 'PENDING')`. Concurrent requests overwrite status. |
| **2. Verify reviewer is authorized** | Partial (Client JS check) | **NO** | Authorization is evaluated in TypeScript; database RLS does not enforce reviewer role hierarchy. |
| **3. Enforce anti-self-approval** | Client JS check only | **NO** | No database CHECK constraint or trigger prevents `reviewed_by == employee_id`. |
| **4. Verify available leave balance** | **MISSING** | **NO** | `reviewLeaveRequest` has zero balance check; `newClosing = Math.max(0, ...)` silently overdraws. |
| **5. Update request status to APPROVED** | Separate HTTP PATCH | **NO** | If network drops or balance update fails, request is committed as APPROVED. |
| **6. Deduct approved leave from balance** | Separate HTTP PATCH | **NO** | Balance updated after request is already committed. Vulnerable to race conditions. |
| **7. Record reviewer & timestamp** | Included in request update | **NO** | Client-supplied timestamp rather than `NOW()`. Overwritten on duplicate approvals. |
| **8. Record relevant audit information** | **MISSING** in live mode | **NO** | No row inserted into `public.audit_logs` in live Supabase mode. |

---

### 3. Concurrency & Failure Mode Scenarios

#### Scenario A: Two Managers Approving the Same Request Simultaneously
- **Workflow:** Manager A and Manager B both view request `lr-101` in PENDING status and click "Approve" at the same instant.
- **Trace:**
  1. Both requests fetch `request` with `status = 'PENDING'`.
  2. Both update `leave_requests` to `APPROVED`.
  3. Both read `leave_balances` with `used = 1.0, closing = 5.0`.
  4. Manager A writes `used = 3.0, closing = 3.0`.
  5. Manager B reads or overwrites `used = 3.0` (or `used = 5.0` if serialized).
  6. **Defect:** Double deduction from employee balance, or corrupted reviewer audit trails.

#### Scenario B: Two Requests Consuming the Same Balance Simultaneously
- **Setup:** Employee has `closing = 2.0` Casual Leave days.
- **Action:** Employee submits Request 1 (2.0 days) and Request 2 (2.0 days).
- **Consequence:** Both requests pass submission because balance is 2.0. When Manager 1 approves Request 1, `used` increases by 2.0 (`closing = 0`). When Manager 2 approves Request 2, `reviewLeaveRequest()` does not re-check available balance! It executes `newClosing = Math.max(0, 5 + 0 - 4) = 1.0` or clamps to `0`.
- **Defect:** Employee receives 4 days of paid leave when entitlement was only 2 days.

#### Scenario C: Partial Failure — Balance Update Fails
- **Action:** Step 3 (`UPDATE leave_requests`) succeeds. Step 5 (`UPDATE leave_balances`) fails due to:
  - Network disconnect.
  - Supabase client timeout.
  - PostgreSQL error `42501 (insufficient_privilege)` when approved by a Client Manager (excluded from `leave_balances_tenant_admin_all`).
- **Defect:** Request is permanently marked `APPROVED` in the database. The balance was **never deducted**.
- **Retry Hazard:** If the manager attempts to re-approve the request, Step 2 aborts because `request.status === 'APPROVED'`. The balance is lost to accounting permanently.

#### Scenario D: Duplicate Approval Attempts
- An impatient manager double-clicks "Approve" on a slow network connection.
- Without database-level idempotency or optimistic locking, multiple deduction commands are queued to PostgREST.

---

### 4. Proposed Solution: Transactional PostgreSQL RPC Function

To guarantee ACID compliance, anti-self-approval, balance solvency, and audit immutability, all eight operations must execute within a single PostgreSQL stored procedure wrapped in `BEGIN ... EXCEPTION ... COMMIT` with `FOR UPDATE` row locking.

> [!IMPORTANT]
> **GOVERNANCE NOTICE: DO NOT EXECUTE WITHOUT APPROVAL**  
> Under Strict Rule 1 & Section 3 of Milestone 2.4D instructions, the proposed SQL below is documented for architectural review and explicit stakeholder approval. It has NOT been applied to the live database.

```sql
-- ==============================================================================
-- PROPOSED MIGRATION: 20261114000001_atomic_leave_approval_rpc.sql
-- Status: PENDING EXPLICIT APPROVAL (DO NOT EXECUTE)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.approve_leave_request_atomic(
    p_request_id UUID,
    p_reviewer_user_id UUID,
    p_manager_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_bal RECORD;
    v_reviewer_emp_id UUID;
    v_reviewer_role TEXT;
    v_reviewer_client_id UUID;
    v_year INT;
    v_new_used NUMERIC(4,1);
    v_new_closing NUMERIC(4,1);
BEGIN
    -- 1. Identify Reviewer Identity & Tenancy
    SELECT role, client_id, employee_id 
    INTO v_reviewer_role, v_reviewer_client_id, v_reviewer_emp_id
    FROM public.user_profiles
    WHERE id = p_reviewer_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AUTH_ERROR: Reviewer profile % not found.', p_reviewer_user_id;
    END IF;

    -- 2. Verify Reviewer Role Authority
    IF v_reviewer_role NOT IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager', 'location_manager') THEN
        RAISE EXCEPTION 'PERMISSION_ERROR: Role % is not authorized to approve leave.', v_reviewer_role;
    END IF;

    -- 3. Lock Leave Request Row (Pessimistic Concurrency Guard)
    SELECT * INTO v_req
    FROM public.leave_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Leave request % does not exist.', p_request_id;
    END IF;

    -- 4. Tenancy Scoping
    IF v_reviewer_role <> 'super_admin' AND v_req.client_id <> v_reviewer_client_id THEN
        RAISE EXCEPTION 'PERMISSION_ERROR: Cross-tenant leave approval is forbidden.';
    END IF;

    -- 5. Anti-Self-Approval Enforcement
    IF v_reviewer_emp_id IS NOT NULL AND v_reviewer_emp_id = v_req.employee_id THEN
        RAISE EXCEPTION 'GOVERNANCE_VIOLATION: Employees are strictly prohibited from approving their own leave requests.';
    END IF;

    -- 6. State Machine Transition Guard
    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'STATE_ERROR: Leave request is in status %, only PENDING requests can be approved.', v_req.status;
    END IF;

    -- 7. Balance Verification and Atomic Deduction (for PL, CL, SL)
    IF v_req.leave_type IN ('PL', 'CL', 'SL') THEN
        v_year := EXTRACT(YEAR FROM v_req.start_date)::INT;

        -- Lock Balance Row for Employee
        SELECT * INTO v_bal
        FROM public.leave_balances
        WHERE employee_id = v_req.employee_id
          AND leave_type = v_req.leave_type
          AND year = v_year
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'BALANCE_ERROR: No % leave ledger exists for employee in year %.', v_req.leave_type, v_year;
        END IF;

        IF v_bal.closing < v_req.total_days THEN
            RAISE EXCEPTION 'BALANCE_EXHAUSTED: Insufficient % balance. Available: %, Requested: %',
                v_req.leave_type, v_bal.closing, v_req.total_days;
        END IF;

        v_new_used := v_bal.used + v_req.total_days;
        v_new_closing := v_bal.opening + v_bal.credited - v_new_used;

        -- Update Balance Ledger
        UPDATE public.leave_balances
        SET used = v_new_used,
            closing = v_new_closing,
            updated_at = NOW()
        WHERE id = v_bal.id;
    END IF;

    -- 8. Update Leave Request Record
    UPDATE public.leave_requests
    SET status = 'APPROVED',
        reviewed_by = p_reviewer_user_id,
        reviewed_at = NOW(),
        manager_remarks = p_manager_remarks
    WHERE id = v_req.id;

    -- 9. Append Immutable Audit Log
    INSERT INTO public.audit_logs (
        client_id,
        user_id,
        action,
        resource,
        resource_id,
        details,
        severity
    ) VALUES (
        v_req.client_id,
        p_reviewer_user_id,
        'LEAVE_APPROVE',
        'leave_requests',
        v_req.id,
        jsonb_build_object(
            'employee_id', v_req.employee_id,
            'leave_type', v_req.leave_type,
            'total_days', v_req.total_days,
            'new_closing_balance', v_new_closing
        ),
        'INFO'
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_req.id,
        'status', 'APPROVED',
        'deducted_days', v_req.total_days,
        'remaining_balance', v_new_closing
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_leave_request_atomic(UUID, UUID, TEXT) TO authenticated;
```

---

### 5. Verification Checklist & Current Status

| Verification Criterion | Live Status | Evidence / Recommendation |
|---|:---:|---|
| Single Transaction Boundary | **FAIL** | Implemented as 2 separate PostgREST queries in `leaveService.ts` lines 423-462. |
| Pessimistic Row Locking (`FOR UPDATE`) | **NOT IMPLEMENTED** | Neither `leave_requests` nor `leave_balances` locked during approval. |
| Re-check Balance Solvency at Review | **FAIL** | Missing from service layer; overdrawing silently clamps to zero. |
| Anti-Self-Approval in Database | **NOT IMPLEMENTED** | Enforced only in frontend service layer, easily bypassed via direct API call. |
| Atomic Audit Ledger Integration | **NOT IMPLEMENTED** | Live Supabase execution produces zero `audit_logs` entries. |
| Proposed Transactional Function SQL | **REQUIRES APPROVAL** | Complete SQL drafted above; awaiting stakeholder sign-off prior to execution. |
