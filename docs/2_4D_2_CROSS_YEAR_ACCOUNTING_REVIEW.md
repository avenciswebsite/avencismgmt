# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4D.2 CROSS-YEAR LEAVE ACCOUNTING ARCHITECTURAL REVIEW

**Document Version:** 1.0.0  
**Date:** November 15, 2026  
**Auditor / Engineering Lead:** Antigravity Engineering (Google DeepMind)  
**Milestone:** 2.4D.2 Pre-Deployment SQL Security & Data Integrity Review  
**Status:** **ARCHITECTURAL REVIEW & REMEDIATION SPECIFICATION**  

---

### 1. The Cross-Year Accounting Dilemma

In enterprise HR and statutory payroll systems, leave entitlements (`PL`, `CL`, `SL`, `COMP_OFF`) are allocated on an annual calendar-year basis (`year INT`). Each employee possesses independent ledger rows in `leave_balances` for each year:

$$\text{Balance Ledger Identity: } \quad \text{closing}_{e, t, y} = \text{opening}_{e, t, y} + \text{credited}_{e, t, y} - \text{used}_{e, t, y}$$

When an employee applies for leave that spans across the calendar year boundary (e.g. from late December into early January):
- A portion of the working leave days falls in Year $Y$.
- The remaining working leave days fall in Year $Y+1$.

#### The Flaw in Migration 12 & Service Fallback:
In the previously staged Migration 12 (`review_leave_request_atomic`):
```sql
-- FLAWED IMPLEMENTATION IN MIGRATION 12:
v_year := EXTRACT(YEAR FROM v_req.start_date)::INT;

SELECT * INTO v_bal
FROM public.leave_balances
WHERE employee_id = v_req.employee_id
  AND leave_type = v_req.leave_type
  AND year = v_year
FOR UPDATE;

-- All total_days debited against start_date year:
v_new_used := v_bal.used + v_req.total_days;
v_new_closing := v_bal.opening + v_bal.credited - v_new_used;
```

#### Consequences of the Flaw:
1. **Balance Distortion:** Year $Y$ is charged for leave days taken in Year $Y+1$, artificially depleting Year $Y$ entitlement and potentially causing false balance exhaustion.
2. **Untouched Future Balance:** Year $Y+1$ balance is never validated or debited, allowing employees to take free leave in the new year without reducing their new year entitlement.
3. **Carry-Forward Corruption:** At year-end carry-forward processing, closing balances for Year $Y$ are inaccurate, distorting statutory encashment and rollover limits.
4. **False Balance Rejection:** An employee with 2 days left in 2026 and 10 days in 2027 applying for a 4-day leave (2 days in 2026, 2 days in 2027) would be rejected with `INSUFFICIENT_BALANCE` because the system tried to debit all 4 days against the 2026 balance!

---

### 2. Authoritative PostgreSQL Cross-Year Engine (Migration 15)

In Migration 15 ([`20261115000015_cross_year_atomic_leave_rpc.sql`](file:///c:/Avencis%20Management/supabase/migrations/20261115000015_cross_year_atomic_leave_rpc.sql)), this architectural defect has been corrected inside the database kernel.

#### A. Database-Driven Day & Year Partitioning
The database does not rely on browser-supplied partition data. It authoritatively evaluates every calendar day against client policy and statutory holiday records:

```sql
WITH calendar_series AS (
    SELECT 
        d::date AS cal_date,
        EXTRACT(YEAR FROM d)::INT AS cal_year,
        UPPER(TRIM(TO_CHAR(d, 'FMDAY'))) AS cal_day_name
    FROM generate_series(v_req.start_date::timestamp, v_req.end_date::timestamp, '1 day'::interval) d
),
day_evaluations AS (
    SELECT 
        cs.cal_date,
        cs.cal_year,
        CASE 
            -- 1. Exclude client-configured weekly rest days (e.g. SUNDAY, or SATURDAY/SUNDAY)
            WHEN cs.cal_day_name = ANY(v_weekly_offs) THEN 0.0
            -- 2. Exclude declared statutory / company holidays
            WHEN EXISTS (
                SELECT 1 FROM public.statutory_holidays sh
                WHERE sh.date = cs.cal_date
                  AND (sh.client_id = v_req.client_id OR sh.client_id IS NULL)
                  AND (sh.work_location_id = v_applicant_loc_id OR sh.work_location_id IS NULL)
            ) THEN 0.0
            -- 3. Half-day single date application
            WHEN v_req.start_date = v_req.end_date AND v_req.total_days = 0.5 THEN 0.5
            -- 4. Regular working leave day
            ELSE 1.0
        END AS leave_amount
    FROM calendar_series cs
)
SELECT 
    cal_year AS target_year,
    SUM(leave_amount)::NUMERIC(4,1) AS required_days
FROM day_evaluations
GROUP BY cal_year
HAVING SUM(leave_amount) > 0
ORDER BY cal_year ASC; -- Strictly deterministic locking order
```

---

### 3. Concurrency & Deadlock Prevention Analysis

#### The Dining Philosophers / Multi-Row Deadlock Threat:
Consider two concurrent manager approvals for two employees or requests spanning 2026 and 2027:
- Transaction A locks 2027, then attempts to lock 2026.
- Transaction B locks 2026, then attempts to lock 2027.
- **Result:** PostgreSQL deadlock error (`deadlock detected: Process 12345 waits for ExclusiveLock...`).

#### Deterministic Ordering Solution:
Migration 15 enforces `ORDER BY cal_year ASC`.
Every concurrent transaction accessing multiple balance rows for the same employee or related entities locks rows in identical chronological order ($2025 \to 2026 \to 2027 \to 2028$).
**Mathematical Proof:** Because the resource acquisition graph is strictly monotonic and directed acyclic, circular wait conditions are impossible ($P(\text{Deadlock}) = 0$).

---

### 4. Independent Solvency Verification & Atomic Rollback

For each partitioned year:
1. `SELECT * INTO v_bal FROM public.leave_balances WHERE employee_id = v_req.employee_id AND leave_type = v_req.leave_type AND year = v_year_rec.target_year FOR UPDATE;`
2. If `v_bal.closing < v_year_rec.required_days`:
   ```sql
   RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient % balance for year %. Available: %, Required: %',
       v_req.leave_type, v_year_rec.target_year, v_bal.closing, v_year_rec.required_days;
   ```
3. Because all operations execute within a single PostgreSQL transaction boundary, an exception raised on year $Y+1$ causes PostgreSQL to automatically roll back the deduction made on year $Y$. No partial deductions or orphaned states can occur.

---

### 5. Concrete Verification Test Results

This functionality was tested and validated in [`scripts/testLeaveRemediationPart2.ts`](file:///c:/Avencis%20Management/scripts/testLeaveRemediationPart2.ts):

| Test Case | Scenario | Input | Expected Outcome | Actual Result | Status |
|---|---|---|---|---|:---:|
| **Test 01** | Cross-Year Math | Dec 30 2026 to Jan 03 2027 | 2d in 2026, 2d in 2027 (Sun off) | 2026: 2d, 2027: 2d | **PASS** |
| **Test 02** | Submission | Cross-Year Request | Status `PENDING` | `lr-mwgssehp-f0be9` | **PASS** |
| **Test 03** | Approval | Managerial Approval | Status `APPROVED` | Status `APPROVED` | **PASS** |
| **Test 04** | 2026 Balance | Opening: 5, Credited: 2, Closing: 7 | Used: 0 $\to$ 2, Closing: 7 $\to$ 5 | Used: 2, Closing: 5 | **PASS** |
| **Test 05** | 2027 Balance | Opening: 0, Credited: 5, Closing: 5 | Used: 0 $\to$ 2, Closing: 5 $\to$ 3 | Used: 2, Closing: 3 | **PASS** |

Each year's balance was deducted independently, preserving ledger arithmetic identity across both years.
