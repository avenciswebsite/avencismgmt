# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE BALANCE CALCULATION & ACCOUNTING LIFECYCLE REPORT

**Document Version:** 1.0.0  
**Milestone:** 2.4D  
**Database Table:** `public.leave_balances`  
**Precision & Scale:** `NUMERIC(4,1)`  

---

### 1. Mathematical Balance Model & Invariant

Leave balances in Avencis Workforce Management are modeled as an entitlement ledger with fractional-day precision ($0.5\text{d}$ half-day increments supported):

$$\text{closing} = \max\left(0, \text{opening} + \text{credited} - \text{used}\right)$$

Where:
- $\mathbf{opening}$: Carry-forward balance brought forward from the preceding financial/calendar year.
- $\mathbf{credited}$: Accrued leave days allocated throughout the active year based on client operational policy (e.g. $+2.0\text{d}/\text{month}$ for Suman, $+1.75\text{d}/\text{month}$ for Maha).
- $\mathbf{used}$: Total cumulative days consumed by **approved** leave requests during the year.
- $\mathbf{closing}$: Net available balance for new leave applications.

---

### 2. Physical Database Schema Verification

From migration `20261103000006_leave_management.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    opening NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (opening >= 0),
    credited NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (credited >= 0),
    used NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (used >= 0),
    closing NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (closing >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, employee_id, leave_type, year)
);
```

#### Key Constraint Invariants:
1. **Precision & Scale `NUMERIC(4,1)`:** Allows total values up to $999.9\text{d}$ with $0.1\text{d}$ precision.
2. **Non-Negative Constraints:** `CHECK (opening >= 0)`, `CHECK (credited >= 0)`, `CHECK (used >= 0)`, `CHECK (closing >= 0)`. Negative balances are strictly rejected at the database level.
3. **Compound Uniqueness:** `UNIQUE(client_id, employee_id, leave_type, year)` guarantees that an employee cannot have duplicate balance rows for the same category within a single calendar year.

---

### 3. Application Lifecycle Accounting Rules

| Lifecycle Event | Ledger Action | Effect on `used` | Effect on `closing` | Verified Invariant |
|---|---|:---:|:---:|---|
| **Leave Application Submitted (`PENDING`)** | Zero Deduction | $\pm 0$ | $\pm 0$ | Pending applications do not reduce available balance until reviewed. |
| **Leave Application Approved (`APPROVED`)** | Atomic Deduction | $+\text{totalDays}$ | $-\text{totalDays}$ | Balance deducted exactly once upon managerial review. |
| **Leave Application Rejected (`REJECTED`)** | Zero Deduction | $\pm 0$ | $\pm 0$ | Rejected applications do not alter balances. |
| **Leave Application Cancelled (`CANCELLED`)** | Zero Deduction | $\pm 0$ | $\pm 0$ | Withdrawn pending requests do not touch balances. |
| **Leave Application Rescinded / Reversed** | Credit Reversal | $-\text{totalDays}$ | $+\text{totalDays}$ | Reversal restores exact consumed entitlement. |

---

### 4. Category-Specific Entitlement Rules

1. **Privilege Leave (PL):**
   - Accrues monthly (e.g. $2.0\text{d}$ per month).
   - Subject to statutory carry-forward cap configured in `client_policies.max_carry_forward` (e.g. $30\text{d}$).
   - Eligible for encashment if `client_policies.allow_leave_encashment = TRUE`.
2. **Casual Leave (CL):**
   - Lapsed at year-end; cannot be carried forward.
   - Requires available balance check before submission.
3. **Sick Leave (SL):**
   - Medical contingency leave.
   - Requires balance check; doctor certificate required for spans $>2\text{d}$ in policy.
4. **Leave Without Pay (LWP):**
   - **Exempt from Balance Check:** Does not require an active balance row in `public.leave_balances`.
   - Results in payroll paid-day deductions during salary computation.
