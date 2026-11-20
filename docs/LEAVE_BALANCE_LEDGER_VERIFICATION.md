# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE BALANCE LEDGER & ENTITLEMENT INVARIANT VERIFICATION

**Document Version:** 1.0.0  
**Milestone:** 2.4D Verification Gate  
**Database Table:** `public.leave_balances`  
**Precision & Scale:** `NUMERIC(4,1)`  

---

### 1. Mathematical Accounting Invariant

The fundamental accounting identity governing leave balances in Avencis Workforce Management is:
$$\mathbf{closing} = \mathbf{opening} + \mathbf{credited} - \mathbf{used}$$

#### Ledger Invariant Verification:
Across all initial seed records and synthetic mock data, the arithmetic relationship was tested in `scripts/verifyMilestone24D.ts` (Test `BAL-01`).
- **Rows Verified:** 8 initial mock balance entries.
- **Result:** $100\%$ consistent. No initial arithmetic discrepancy detected in memory.

---

### 2. Physical Database Schema Invariant Evaluation

In `supabase/migrations/20261103000006_leave_management.sql`:

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

#### Identified Schema Limitations:
1. **Missing Ledger Integrity Check Constraint:**
   - The table enforces `opening >= 0`, `credited >= 0`, `used >= 0`, `closing >= 0`.
   - However, there is **NO database check constraint** enforcing:
     `CHECK (closing = opening + credited - used)`
   - Any direct update or buggy calculation that modifies `used` without updating `closing` (or vice-versa) is accepted silently by PostgreSQL.
2. **Missing Negative Balance Guard against Overdrafts:**
   - In `src/services/leaveService.ts` (line 452), the client calculates:
     `const newClosing = Math.max(0, Number(balance.opening) + Number(balance.credited) - newUsed);`
   - Using `Math.max(0, ...)` masks balance insolvency! If `newUsed > opening + credited`, the equation becomes:
     $$\text{closing} \ne \text{opening} + \text{credited} - \text{used}$$
     Because `closing` is clamped to 0 while `used` continues to grow, corrupting the ledger invariant.

---

### 3. Lifecycle Balance Invariants Audit

| Lifecycle Event | Expected Invariant | Actual Implementation | Verified Result | Status |
|---|---|---|---|:---:|
| **Application Submitted (`PENDING`)** | Zero deduction | In `submitLeaveRequest()`, no balance write occurs | Available balance unchanged | **PASS** |
| **Application Approved (`APPROVED`)** | Deduct exactly once | `reviewLeaveRequest()` adds `totalDays` to `used` and subtracts from `closing` | Deducts exactly once in serial flow; vulnerable under concurrency | **PASS / CONCURRENCY HAZARD** |
| **Application Rejected (`REJECTED`)** | Zero deduction | `reviewLeaveRequest()` skips balance update if status is REJECTED | Available balance untouched | **PASS** |
| **Application Cancelled (`CANCELLED`)** | Zero deduction | `cancelLeaveRequest()` updates only `leave_requests` | Balance untouched | **PASS** |
| **Approved Leave Rescission / Reversal** | Restore exact consumed days | No reversal service method exists in `leaveService.ts` | Cannot cancel approved leaves | **NOT IMPLEMENTED** |

---

### 4. Hardcoded Values & Accrual Engine Inspection

The milestone instructions explicitly require:
> "Inspect whether example monthly credit values are hardcoded anywhere. All client-specific entitlements must come from actual configuration. Do not silently create an accrual engine."

#### Findings:
1. **Hardcoded Initializer in `store.ts`:**
   In `src/data/store.ts` (lines 287–292), when an employee is newly onboarded, mock balances are hardcoded as:
   ```typescript
   leaveType: lt,
   opening: 2,
   credited: 0,
   used: 0,
   closing: 2,
   ```
2. **Monthly Accrual Values:**
   In `src/data/mockData.ts` and `src/context/WorkspaceContext.tsx`, `monthlyPaidLeaveAccrual` is configured per client:
   - Suman Technologies: `2.0` days/month
   - Maha Logistics: `1.75` days/month
   - Zenith Enterprises: `1.5` days/month
3. **Absence of Accrual Engine:**
   - No automated monthly cron, trigger, or scheduled function exists in the codebase to credit monthly accruals into `leave_balances`.
   - Carry-forward and year-end expiry logic are **NOT IMPLEMENTED**.
   - As instructed, no accrual engine has been silently invented.

---

### 5. `COMP_OFF` Schema Compatibility Conflict

In `src/data/mockData.ts` line 709:
```typescript
{ id: 'lb-m-02', clientId: 'client-maha', employeeId: 'emp-maha-01', leaveType: 'COMP_OFF', opening: 1, credited: 1, used: 0, closing: 2 }
```
And `src/types/index.ts` line 210:
```typescript
export interface LeaveBalance {
  leaveType: 'PL' | 'CL' | 'SL' | 'COMP_OFF';
}
```
**Conflict with Migration 06:**
In PostgreSQL table `public.leave_balances`:
```sql
leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('PL', 'CL', 'SL'))
```
The check constraint strictly rejects `'COMP_OFF'`. Any attempt to synchronize or insert compensatory off balances into live Supabase results in a PostgreSQL constraint violation error.

---

### 6. Proposed Database Check Constraint & Reversal Function

> [!IMPORTANT]
> **GOVERNANCE NOTICE: DO NOT EXECUTE WITHOUT APPROVAL**  
> Under Strict Rule 1 of Milestone 2.4D instructions, the proposed SQL below is documented for architectural review and explicit stakeholder approval. It has NOT been applied to the live database.

```sql
-- ==============================================================================
-- PROPOSED MIGRATION: 20261114000004_fix_leave_balances_constraints.sql
-- Status: PENDING EXPLICIT APPROVAL (DO NOT EXECUTE)
-- ==============================================================================

-- 1. Expand leave_type check constraint to include COMP_OFF
ALTER TABLE public.leave_balances
DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;

ALTER TABLE public.leave_balances
ADD CONSTRAINT leave_balances_leave_type_check
CHECK (leave_type IN ('PL', 'CL', 'SL', 'COMP_OFF'));

-- 2. Expand leave_requests leave_type check constraint to include COMP_OFF
ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_leave_type_check
CHECK (leave_type IN ('PL', 'CL', 'SL', 'LWP', 'COMP_OFF'));

-- 3. Enforce Strict Accounting Ledger Invariant
ALTER TABLE public.leave_balances
ADD CONSTRAINT chk_leave_balance_ledger_identity
CHECK (closing = (opening + credited - used));
```
