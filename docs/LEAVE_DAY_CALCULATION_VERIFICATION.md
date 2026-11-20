# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE-DAY CALCULATION & WORKING-CALENDAR VERIFICATION

**Document Version:** 1.0.0  
**Milestone:** 2.4D Verification Gate  
**Target Files:** `src/app/portal/EmployeePortal.tsx`, `src/services/leaveService.ts`, `src/services/policyService.ts`  
**Database Tables:** `public.client_policies`, `public.statutory_holidays`, `public.leave_requests`  

---

### 1. Verification of the Current Calculation Mechanism

In `docs/LEAVE_APPLICATION_WORKFLOW.md` (Step 1), the leave calculation formula is stated as:
$$\text{totalDays} = (\text{endDate} - \text{startDate}) + 1$$

Technical code inspection confirmed that this calendar-day counting is actively executed in `src/app/portal/EmployeePortal.tsx` (lines 250–253):
```typescript
const start = new Date(startDate);
const end = new Date(endDate);
const diffTime = end.getTime() - start.getTime();
const days = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
```
In `src/services/leaveService.ts` (lines 104–106), the service layer simply checks:
```typescript
if (payload.totalDays <= 0) {
  return errorResponse(createValidationError('Total Days must be greater than zero.', 'totalDays'));
}
```
**Conclusion:** The application relies entirely on naive inclusive calendar-day math. It does not perform any working-day, holiday, weekly off, or policy-aware calculations.

---

### 2. Scenario-by-Scenario Evaluation

The table below evaluates the 9 scenarios specified in the milestone requirements:

| Scenario | Supported in Code? | Supported in Schema? | Actual Behavior in Current Application | Defect / Limitation Classification |
|---|:---:|:---:|---|---|
| **1. Saturdays and Sundays** | **NO** | N/A | Included in `totalDays`. A Friday–Monday leave counts as 4 days deducted from balance instead of 2. | **NOT IMPLEMENTED** |
| **2. Client-Specific Weekly Offs** | **NO** | Partial (`client_policies.weekly_off_days`) | `weekly_off_days` exists in database, but `leaveService` never queries or applies it. | **NOT IMPLEMENTED** |
| **3. Configured Public & Company Holidays** | **NO** | Partial (`statutory_holidays`) | `statutory_holidays` exists in migration 08, but is completely ignored during leave submission. | **NOT IMPLEMENTED** |
| **4. Employee-Specific Working Calendars** | **NO** | **NO** | No schema table exists for individual employee shift rosters or rotating shifts. | **NOT IMPLEMENTED** |
| **5. Half-Day Leave** | **NO** | Partial (`NUMERIC(4,1)`) | Schema supports 0.5, but UI only offers date pickers yielding integer days $\ge 1$. | **NOT IMPLEMENTED** |
| **6. Consecutive Leave Spanning Weekends** | **NO** | N/A | Saturday and Sunday are debited against employee leave entitlement. | **NOT IMPLEMENTED** |
| **7. Policy Differences Across Clients** | **NO** | Partial (`client_policies`) | `min_service_days_for_leave` and `leave_types_supported` are not verified in `submitLeaveRequest`. | **NOT IMPLEMENTED** |
| **8. Spanning Two Calendar/Financial Years** | **NO** | **NO** | `leaveService` line 201 derives year from `startDate`. All days are debited from first year. | **FAIL (Defect)** |
| **9. Partial-Day Leave (Hours/Quarter-Day)** | **NO** | **NO** | Schema is day-based `NUMERIC(4,1)`; fractional hour leave is unsupported. | **NOT IMPLEMENTED** |

---

### 3. Detailed Technical Analysis of Deficiencies

#### Deficiency 1: Penalization of Non-Working Days (Weekends & Holidays)
- **The Issue:** In Indian statutory employment compliance (e.g. Maharashtra Shops and Establishments Act, Factories Act), employees are entitled to statutory weekly rest days (Weekly Offs) and National/Festival Holidays without forfeiture of accrued Privilege or Casual Leave, unless a specific "Sandwich Policy" is formally configured.
- **Current Behavior:** An employee taking leave from Thursday to Tuesday (6 calendar days) with Saturday and Sunday as weekly offs will have **6 full days debited** from their Privilege Leave balance instead of 4 working days.

#### Deficiency 2: Cross-Year Accounting Distortion
- **The Issue:** `public.leave_balances` is partitioned by `(client_id, employee_id, leave_type, year)`.
- **Current Behavior:**
  - An employee applies for leave from `2026-12-29` to `2027-01-04` (7 calendar days).
  - `leaveService.ts` (line 201) executes:
    ```typescript
    const year = new Date(payload.startDate).getFullYear(); // Evaluates to 2026
    ```
  - The balance query checks `year = 2026`.
  - The entire 7 days are deducted from the 2026 ledger.
  - If the employee has only 3 days left in 2026 and 15 days in 2027, the application is rejected for "Insufficient Balance", despite having ample balance in 2027!
  - If approved, 2026 balance is overdrawn while 2027 balance remains un-debited.

#### Deficiency 3: Inability to Apply for Half-Day Leave in UI
- While `NUMERIC(4,1)` allows values like `0.5`, `EmployeePortal.tsx` renders two `<input type="date" />` pickers and computes `Math.max(1, Math.round(diff) + 1)`.
- Employees cannot indicate a First Half or Second Half leave (e.g. for afternoon medical appointments).

---

### 4. Test Cases for Supported Calculations

The test cases below document the expected vs actual outputs across various date combinations:

#### Test Case TC-CALC-01: Standard Mid-Week Leave
- **Input:** Start: `2026-11-10` (Tuesday), End: `2026-11-12` (Thursday)
- **Weekly Offs:** Sunday
- **Expected Working Days:** 3
- **Actual App Result:** 3 days
- **Status:** **PASS**

#### Test Case TC-CALC-02: Leave Spanning Weekend (Fri–Mon)
- **Input:** Start: `2026-11-06` (Friday), End: `2026-11-09` (Monday)
- **Weekly Offs:** Saturday, Sunday
- **Expected Working Days:** 2 (Friday, Monday)
- **Actual App Result:** 4 days (Fri, Sat, Sun, Mon debited)
- **Status:** **FAIL (Defect)**

#### Test Case TC-CALC-03: Leave Spanning Public Holiday
- **Input:** Start: `2026-11-03` (Tue), End: `2026-11-05` (Thu)
- **Public Holiday:** `2026-11-04` (Diwali Holiday in `statutory_holidays`)
- **Expected Working Days:** 2
- **Actual App Result:** 3 days (Holiday debited from paid balance)
- **Status:** **FAIL (Defect)**

#### Test Case TC-CALC-04: Cross-Year Application
- **Input:** Start: `2026-12-30` (Wed), End: `2027-01-03` (Sun)
- **Expected Ledger Action:** 2 days from 2026, 1 working day from 2027 (excluding Jan 2/3 weekend)
- **Actual App Result:** All 5 calendar days charged to 2026
- **Status:** **FAIL (Defect)**

#### Test Case TC-CALC-05: Half-Day Leave Application
- **Input:** Start: `2026-11-10`, Half-Day Toggle: Yes (First Half)
- **Expected Days:** 0.5
- **Actual App Result:** 1.0 day minimum forced by UI formula
- **Status:** **FAIL (Defect)**

---

### 5. Architectural Recommendations & Solutions

To implement compliant working-day calculations without altering the database schema during this verification gate:

#### 1. Code-Level Policy-Aware Calculation Engine
Implement a shared helper function `calculateEffectiveLeaveDays(startDate, endDate, policy, holidays, isHalfDay)`:
1. Iterate each date from `startDate` to `endDate`.
2. Check `date.getDay()` against `policy.weekly_off_days` (e.g. `SUNDAY`, `SATURDAY`). If matching, skip day (unless client policy has `sandwich_rule = true`).
3. Check `date` against client's `statutory_holidays`. If matching, skip day.
4. If `isHalfDay` is true and single-date span, return `0.5`.
5. For cross-year spans, return a breakdown object: `{ year2026: 2, year2027: 1, total: 3 }`.

#### 2. Service Layer Enforcement
Update `leaveService.submitLeaveRequest()` to call this helper and validate balances across both entitlement years if the span crosses December 31.
