# AVENCIS WORKFORCE MANAGEMENT (WFM)
## BUSINESS LOGIC VALIDATION REPORT

**Project:** Avencis ERP / Business Management Platform  
**Module:** Workforce Management (WFM) — Attendance & Payroll  
**Scope:** Rigorous mathematical, rule-engine, and policy validation across all core payroll & workforce domain algorithms  
**Status:** Complete Audit & Discrepancy Register  

---

## 1. Executive Summary

This document performs an exhaustive, code-level mathematical and algorithmic audit comparing the implemented business logic in `src/data/store.ts` against the authoritative requirements documented in `Assets/` and `docs/AVENCIS_ORIGINAL_REQUIREMENTS_ANALYSIS.md`.

### Summary Scorecard

| Domain / Calculation | Status in Code | File & Line Reference | Severity / Gap Description |
|---|---|---|---|
| **1. Paid vs Unpaid Days** | **Hardcoded Stub** | `src/data/store.ts:504-505` | `const unpaidDays = emp.id.endsWith('05') ? 1 : 0;` — Does not query attendance muster records or leave requests. |
| **2. Weekly-Off Calculation** | **Omitted in Computation** | `src/data/store.ts:129, 218` | Defined in policy (`weeklyOffDays: ['SUNDAY']`), but completely ignored in daily muster calculation and payroll proration. |
| **3. Public Holiday Handling** | **Not Implemented** | N/A | No holiday calendar model, database table, or store array exists. Holidays are not credited as paid days. |
| **4. Leave Balance Deductions** | **Partially Functional** | `src/data/store.ts:464-470` | In-memory balance decrement works for approved PL/CL/SL, but unpaid leave (LWP) is not connected to payroll deductions. |
| **5. Monthly Leave Accrual** | **Template Value Only** | `src/data/store.ts:136, 225` | `monthlyPaidLeaveAccrual: 2.0` is present in policy object, but no scheduled cron, batch task, or engine applies monthly credits. |
| **6. Salary Divisor Mechanics** | **Partially Functional** | `src/data/store.ts:495, 508` | Divisor logic handles `26` and `30`, but `calendar_days` divisor falls back to hardcoded `30` instead of dynamic month length (28/29/30/31). |
| **7. Overtime Calculation** | **Omitted in Computation** | `src/data/store.ts:122-123` | Policy specifies overtime tracking mode and 1.5x multiplier, but payroll engine calculates ₹0 overtime wages. |
| **8. Statutory Deductions** | **Hybrid (2 Real, 2 Hardcoded)** | `src/data/store.ts:512-515` | EPF (12% up to ₹15k) and ESIC (0.75% for gross $\le$ ₹21k) are mathematically correct. PT (flat ₹200) and TDS (flat ₹1,200) are hardcoded stubs. |
| **9. Overnight & Split Shifts** | **Configuration Flag Only** | `src/data/store.ts:126, 215` | `overnightShiftAttribution: 'shift_start_date'` exists as a metadata string, but punch matching treats all check-ins/outs on the same calendar day. |
| **10. Payroll Locking Rules** | **In-Memory Flag Only** | `src/data/store.ts:567-588` | Changes run status to `'locked'`, but data is in mutable browser memory with no database-level immutability or ledger seal. |

---

## 2. Detailed Technical & Algorithmic Audit

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PAYROLL RECONCILIATION ENGINE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Fixed Base Salary ──► [ Divisor Engine (26 / 30 / Cal) ]                   │
│                                │                                            │
│ Attendance Muster ──► [ Paid Days Reconciliation ] ──► Payable Base Salary │
│ (Present + WO + PH + Approved Paid Leaves)                      │           │
│                                                                 ▼           │
│ + Variable Allowances & Incentives ──────────────────► Gross Earned Salary │
│                                                                 │           │
│                                                                 ▼           │
│ Statutory Deductions Engine:                                                │
│  ├── EPF: 12% capped at ₹15,000 wage ceiling                                │
│  ├── ESIC: 0.75% if gross wages <= ₹21,000/mo                              │
│  ├── PT: State-specific tax slabs (MH: ₹200/mo, ₹300 Feb)                   │
│  └── TDS: Projected annual slab under Sec 192                               │
│                                                                 ▼           │
│                                                        Net Disbursable Payout│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1. Paid Days vs Unpaid Days Calculation

#### Original Requirements Specification
* Total Days in Pay Period = Exact days in the target calendar month ($D_{\text{cal}} \in \{28, 29, 30, 31\}$).
* $\text{Paid Days} = \text{Present Days} + \text{Approved Paid Leaves (PL/CL/SL)} + \text{Weekly Offs} + \text{Paid Holidays} + \text{Approved WFH/Comp-Off}$.
* $\text{Unpaid Days (LOP)} = \text{Unapproved Absences} + \text{Approved Unpaid Leaves (LWP)} + \text{Unregularised Missing Punches}$.
* Formula: $\text{Paid Days} = D_{\text{cal}} - \text{Unpaid Days}$.

#### Implemented Code Verification
Located in `src/data/store.ts`, lines 503–506:
```typescript
// Standard 30 days calculation
const calendarDays = 30;
const unpaidDays = emp.id.endsWith('05') ? 1 : 0; // Vikram Rao has 1 unpaid day
const paidDays = calendarDays - unpaidDays;
```

#### Discrepancies & Flaws:
1. **Hardcoded Employee ID Suffix:** The calculation does not query `this.attendanceRecords` or `this.leaveRequests`. It evaluates whether `emp.id` ends with `'05'`. For all other employees, `unpaidDays` is unconditionally `0`.
2. **Fixed Calendar Month Length:** Every month is assumed to have exactly 30 days. For months with 31 days (January, March, May, July, August, October, December) or February (28/29 days), the calendar day baseline is mathematically incorrect.
3. **No Muster Aggregation:** If an employee has 10 absent days recorded in `attendanceRecords`, the payroll engine ignores them completely and pays full 30 days.

---

### 2.2. Weekly-Off Calculation

#### Original Requirements Specification
* Configurable weekly-off schedules: Standard (Sunday), 5-Day Workweek (Saturday + Sunday), or Rotational Rostering.
* Weekly offs must be credited as paid days provided the employee satisfies sandwich rule / minimum weekly presence criteria.
* Prevention of double-counting when a public holiday or approved leave falls on a scheduled weekly off.

#### Implemented Code Verification
Located in `src/data/store.ts`, lines 129 and 218:
```typescript
weeklyOffDays: ['SUNDAY'],
```
* In `src/types/index.ts`:
```typescript
export interface ClientPolicy {
  ...
  weeklyOffDays: ('SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY')[];
}
```

#### Discrepancies & Flaws:
1. **Zero Runtime Evaluation:** The `weeklyOffDays` array is purely decorative configuration. There is no function in `AppStore` that checks whether a given date falls on Sunday.
2. **Missing Sandwich Policy:** Indian statutory practice commonly dictates that if an employee is absent on Friday and Monday surrounding a weekly off, the weekly off is treated as Loss of Pay (Sandwich Rule). This rule is absent from the engine.

---

### 2.3. Public Holiday Handling

#### Original Requirements Specification
* Multi-calendar support: Ability to define client-specific, entity-specific, and state-specific public holiday lists (e.g. Maharashtra Republic Day, Independence Day, Gandhi Jayanti, Diwali, Maharashtra Day).
* Public holidays must be automatically attributed to employees at matching locations.
* Comp-off generation if an employee punches in on a designated public holiday.

#### Implemented Code Verification
* A workspace search for `holiday` across `src/` yields zero occurrences in `store.ts`, `mockData.ts`, or `types/index.ts`.
* No `PublicHoliday` or `HolidayCalendar` type is declared.

#### Discrepancies & Flaws:
* **Feature Non-Existent:** There is no mechanism to register, view, or compute public holidays in the platform.

---

### 2.4. Leave Balance Deductions

#### Original Requirements Specification
* Leave requests must check available balances before submission.
* Approval by manager or HR administrator must debit the corresponding balance ledger:
  $$\text{Closing Balance} = \text{Opening Balance} + \text{Accrued} - \text{Approved Leaves}$$
* LWP (Leave Without Pay) does not decrement paid balance, but directly increments `unpaidDays` in the payroll muster.

#### Implemented Code Verification
Located in `src/data/store.ts`, lines 458–475:
```typescript
reviewLeaveRequest(id: string, status: 'APPROVED' | 'REJECTED', managerRemarks: string) {
  const req = this.leaveRequests.find(r => r.id === id);
  if (req) {
    req.status = status;
    req.managerRemarks = managerRemarks;

    if (status === 'APPROVED' && req.leaveType !== 'LWP') {
      const bal = this.leaveBalances.find(b => b.employeeId === req.employeeId && b.leaveType === req.leaveType);
      if (bal) {
        bal.used += req.totalDays;
        bal.closing = Math.max(0, bal.closing - req.totalDays);
      }
    }

    this.logAction('LEAVE_REVIEW', 'LeaveRequest', id, `Reviewed leave request: ${status}`);
    this.saveToStorage();
  }
}
```

#### Discrepancies & Flaws:
1. **Balance Deduction Operates Correctly in Memory:** When a PL/CL/SL request is approved, `bal.used` increments and `bal.closing` decrements safely with `Math.max(0, ...)`.
2. **Disconnect from Payroll Engine:** When an `'LWP'` request is approved, it does not debit balances (which is correct), but it is never linked to `calculatePayrollRun`. In `calculatePayrollRun`, `unpaidDays` remains hardcoded to `emp.id.endsWith('05') ? 1 : 0`.
3. **No Negative Balance Guard on Submission:** In `submitLeaveRequest`, there is no validation check verifying whether `requestedDays <= availableBalance`. An employee can apply for 100 days of PL with only 2 days available.

---

### 2.5. Monthly Leave Accrual

#### Original Requirements Specification
* Automated monthly credit of leave quota on the 1st of every calendar month.
* Default: 2.0 days of Paid Leave per month of active service ($24\text{ days/year}$).
* Pro-rata accrual for employees joining mid-month.
* Annual carry-forward caps (e.g. maximum 30 days accumulable).

#### Implemented Code Verification
Located in `src/data/store.ts`, lines 136 and 225:
```typescript
monthlyPaidLeaveAccrual: 2.0,
maxCarryForward: 30,
```

#### Discrepancies & Flaws:
1. **Static Initialisation Only:** When a new employee is onboarded via `addEmployee()`, leave balances are statically seeded with opening: 2, closing: 2:
   ```typescript
   const leaveTypes: ('PL' | 'CL' | 'SL')[] = ['PL', 'CL', 'SL'];
   leaveTypes.forEach(lt => {
     this.leaveBalances.push({
       id: `lb-${newEmp.id}-${lt}`,
       clientId: newEmp.clientId,
       employeeId: newEmp.id,
       leaveType: lt,
       opening: 2,
       credited: 0,
       used: 0,
       closing: 2,
     });
   });
   ```
2. **No Periodic Engine or Scheduler:** There is no scheduled function, database trigger, or manual admin action to trigger "Monthly Accrual Run". The `monthlyPaidLeaveAccrual` value of 2.0 is never evaluated anywhere in executable code.

---

### 2.6. Salary Divisor Mechanics (26 vs 30 vs Actual Calendar Days)

#### Original Requirements Specification
Clients choose from three statutory divisor policies:
1. **26-Day Divisor:** Standard industrial wage practice where weekly offs (4 Sundays) are deducted from 30 days to compute the daily wage rate.
   $$\text{Daily Wage} = \frac{\text{Fixed Base}}{26}$$
2. **30-Day Divisor:** Standard commercial establishment practice.
   $$\text{Daily Wage} = \frac{\text{Fixed Base}}{30}$$
3. **Actual Calendar Days:** Dynamic divisor matching the actual calendar month ($28, 29, 30, \text{ or } 31$).
   $$\text{Daily Wage} = \frac{\text{Fixed Base}}{D_{\text{month}}}$$

#### Implemented Code Verification
Located in `src/data/store.ts`, line 495:
```typescript
const divisor = policy.salaryDivisor === '26' ? 26 : policy.salaryDivisor === '30' ? 30 : 30; // standard calendar
```
and line 508:
```typescript
const payableBase = Math.round((emp.fixedMonthlySalary / divisor) * paidDays);
```

#### Discrepancies & Flaws:
1. **Fallback Ignores Dynamic Month:** Notice the ternary expression:
   `policy.salaryDivisor === '26' ? 26 : policy.salaryDivisor === '30' ? 30 : 30;`
   If the policy specifies `'calendar_days'`, the ternary evaluates to `30`. In a 31-day month (like October 2026), an employee working all 31 days with a 30-day divisor receives:
   $$\text{Payable Base} = \frac{\text{Salary}}{30} \times 30 = \text{Salary}$$
   However, if they took 1 unpaid day in October ($31 - 1 = 30\text{ paid days}$), they would still receive $\frac{30}{30} \times \text{Salary} = 100\%$ of their salary, effectively suffering ₹0 deduction.
2. **26-Day Divisor Boundary Case:** With a 26-day divisor, if `paidDays` is 30 (because calendar days is 30), the formula yields:
   $$\text{Payable Base} = \text{Round}\left(\frac{\text{Fixed Salary}}{26} \times 30\right) = 1.1538 \times \text{Fixed Salary}$$
   This would overpay the employee by 15.38% unless paid days is capped at 26 or weekly offs are deducted from the working days.

---

### 2.7. Overtime Calculation and Policy Enforcement

#### Original Requirements Specification
* Overtime tracked when worked hours exceed `standardWorkingHours` (e.g. 9.0 hours).
* Overtime rate multiplier: 1.0x, 1.25x, 1.5x, or 2.0x hourly rate.
* Hourly rate formula:
  $$\text{Hourly Wage} = \frac{\text{Fixed Monthly Salary}}{\text{Divisor} \times \text{Standard Hours per Day}}$$
* Minimum threshold (e.g. >30 minutes beyond shift before overtime starts).

#### Implemented Code Verification
In `src/data/store.ts`:
* Policy parameters exist:
  ```typescript
  overtimeMethod: 'disabled',
  overtimeRate: 1.0,
  ```
* In `calculatePayrollRun`:
  ```typescript
  const payableBase = Math.round((emp.fixedMonthlySalary / divisor) * paidDays);
  const grossEarned = payableBase + emp.variableIncentive + emp.otherAllowances;
  ```

#### Discrepancies & Flaws:
* **Overtime Wages are ₹0:** The payroll calculation does not accumulate daily overtime hours from `DailyAttendanceRecord` or calculate any overtime wages. Overtime pay is entirely absent from `grossEarned`.

---

### 2.8. Statutory Calculations (PF, ESIC, PT, TDS)

#### Original Requirements Specification

| Deduction | Statutory Ceiling / Threshold | Employee Contribution | Employer Contribution |
|---|---|---|---|
| **EPF** | Capped at ₹15,000 basic wage | 12% of basic (max ₹1,800) | 12% (8.33% EPS + 3.67% EPF) |
| **ESIC** | Threshold: Gross $\le$ ₹21,000/month | 0.75% of Gross Wages | 3.25% of Gross Wages |
| **PT (Maharashtra)** | Gross $\le$ ₹7,500: ₹0; ₹7,501–₹10,000: ₹175; >₹10,000: ₹200 (₹300 in Feb) | State slab rules | N/A (Employee deduction) |
| **TDS** | Section 192 annual projection based on regime | Slab-based deduction | N/A (Withholding tax) |

#### Implemented Code Verification
Located in `src/data/store.ts`, lines 512–516:
```typescript
// Statutory deductions
const pfDeduction = policy.pfEnabled ? Math.round(Math.min(payableBase, 15000) * 0.12) : 0;
const esicDeduction = policy.esicEnabled && payableBase <= 21000 ? Math.round(grossEarned * 0.0075) : 0;
const ptDeduction = policy.ptEnabled ? 200 : 0;
const tdsDeduction = policy.tdsEnabled && emp.fixedMonthlySalary >= 40000 ? 1200 : 0;
```

#### Detailed Statutory Component Analysis:

1. **EPF Calculation: Mathematically Correct (Passed)**
   - Formula: $\min(\text{payableBase}, 15000) \times 0.12$.
   - Accurately caps the qualifying wage at ₹15,000 (yielding max ₹1,800).
   - Only deducted if `policy.pfEnabled` is true.

2. **ESIC Calculation: Minor Specification Discrepancy**
   - Formula: `payableBase <= 21000 ? Math.round(grossEarned * 0.0075) : 0`.
   - Statutory ESIC threshold applies to **Gross Wages** ($\le$ ₹21,000), not just `payableBase`. An employee with base ₹20,000 + incentives ₹3,000 has Gross ₹23,000 and should be exempt from ESIC, but under the code's `payableBase <= 21000` condition, they are improperly taxed.

3. **Professional Tax (PT): Hardcoded Flat Value (Fails)**
   - Formula: `policy.ptEnabled ? 200 : 0`.
   - Hardcoded flat ₹200. Does not check state of registration, does not handle the February ₹300 spike, and ignores minimum wage exemption slabs ($<₹7,500$).

4. **TDS Withholding: Hardcoded Flat Value (Fails)**
   - Formula: `policy.tdsEnabled && emp.fixedMonthlySalary >= 40000 ? 1200 : 0`.
   - Flat ₹1,200 deduction for anyone earning $\ge$ ₹40,000. Ignores tax regimes, 80C/80D declarations, standard deduction (₹75,000 under new regime), and annual projection.

---

### 2.9. Overnight Shifts and Split Shifts

#### Original Requirements Specification
* Support for overnight shifts crossing midnight (e.g. 21:00 to 06:00).
* Shift attribution policy:
  - `shift_start_date`: Entire shift, worked hours, and night allowances are attributed to the calendar date when the check-in punch occurred.
  - `shift_end_date`: Attributed to the check-out date.
  - `split_by_midnight`: Hours before 00:00 attributed to Day 1; hours after 00:00 attributed to Day 2.

#### Implemented Code Verification
Located in `src/data/store.ts`, lines 126 and 215:
```typescript
overnightShiftAttribution: 'shift_start_date',
```
In `recordPunch()`, lines 323, 354, 376:
```typescript
const today = new Date().toISOString().split('T')[0];
...
let daily = this.attendanceRecords.find(r => r.employeeId === employeeId && r.date === today);
...
daily.totalHours = 8.5; // Calculated session duration
```

#### Discrepancies & Flaws:
1. **Same-Day Matching Only:** `recordPunch` queries `this.attendanceRecords` strictly where `r.date === today`. If a worker checks in at 22:00 on Nov 2 and checks out at 06:00 on Nov 3, the check-out on Nov 3 will not find the Nov 2 record. It will create a new un-checked-in record for Nov 3 with only a check-out time.
2. **Hardcoded Session Hours:** `daily.totalHours = 8.5` is statically assigned on check-out rather than computed from $(t_{\text{out}} - t_{\text{in}})$.

---

### 2.10. Payroll Approval and Locking Rules

#### Original Requirements Specification
* Two-step authorization: (1) Draft Generation $\to$ (2) Executive Sign-off and Ledger Lock.
* Once locked:
  - The run must become completely immutable.
  - Attendance corrections and backdated leave requests for that calendar month must be permanently rejected by the system.
  - Cryptographic hash or tamper-evident seal recorded in the audit log.
  - Payslips generated from locked runs must reference the immutable ledger snapshot.

#### Implemented Code Verification
Located in `src/data/store.ts`, lines 567–588:
```typescript
saveAndLockPayrollRun(run: PayrollRun, approvedBy: string) {
  run.status = 'locked';
  run.approvedAt = new Date().toISOString();
  run.approvedBy = approvedBy;

  const existingIdx = this.payrollRuns.findIndex(r => r.id === run.id);
  if (existingIdx >= 0) {
    this.payrollRuns[existingIdx] = run;
  } else {
    this.payrollRuns.unshift(run);
  }

  this.logAction(
    'PAYROLL_LOCKED', 
    'PayrollRun', 
    run.id, 
    `Authorized and locked payroll for period ${run.periodMonth}/${run.periodYear} (Net: ₹${run.totalNet.toLocaleString('en-IN')})`,
    'critical'
  );
  this.saveToStorage();
}
```

#### Discrepancies & Flaws:
1. **No Immutability Protection:** The run object is marked `run.status = 'locked'`, but nothing in `store.ts` prevents another call to `calculatePayrollRun` or `saveAndLockPayrollRun` from overwriting it.
2. **No Retroactive Attendance Block:** Neither `recordPunch()`, `submitCorrection()`, nor `submitLeaveRequest()` checks whether the target date falls within a locked payroll period. An administrator or employee can submit and approve regularisations for a locked period without any system error.

---

## 3. Discrepancy Action Matrix

The following table prescribes the exact database functions and service logic required in Phase 2 to resolve each verified discrepancy:

| Item | Current Defect | Required Phase 2 Implementation | Target Service / SQL Trigger |
|---|---|---|---|
| **LOP Muster Calculation** | `emp.id.endsWith('05') ? 1 : 0` | Compute unpaid days by counting unapproved absent days from `attendance_records` + approved LWP from `leave_requests`. | `wfm_calculate_monthly_muster(client_id, month, year)` SQL Function |
| **Dynamic Month Divisor** | Always defaults to 30 days | Compute actual month days using `new Date(year, month, 0).getDate()` or Postgres `date_part('day', (date_trunc('month', d) + interval '1 month - 1 day'))`. | Edge Function / Calculation Service |
| **26-Day Divisor Cap** | Can overpay by 15.38% | For 26-day divisor, calculate daily rate as $\frac{\text{Base}}{26}$ and multiply by $\min(\text{Working Days Worked}, 26)$. | Payroll Calculation Engine |
| **Overtime Wages** | Hardcoded ₹0 | Accumulate `sum(total_hours - standard_hours)` for all overtime-eligible days, multiplied by $\frac{\text{Base}}{\text{Divisor} \times \text{StdHours}} \times \text{Rate}$. | Edge Function / Calculation Service |
| **ESIC Threshold** | Checks `payableBase` instead of Gross | Compare `grossEarned <= 21000` before calculating $0.75\%$ employee and $3.25\%$ employer contribution. | Payroll Calculation Engine |
| **State PT Slabs** | Flat ₹200 | Implement state-specific slab lookup table (`pt_slabs(state, gross_min, gross_max, amount, feb_amount)`). | Supabase Table `statutory_pt_slabs` |
| **TDS Withholding** | Flat ₹1,200 | Project annual taxable income, apply standard deduction (₹75,000), compute tax under Section 115BAC, and divide by remaining months. | Edge Function `compute-tds-projection` |
| **Overnight Shifts** | Fails check-out on next day | Look up prior day's unclosed check-in when check-out timestamp is $< 12:00$ PM and policy specifies start-date attribution. | `wfm_process_punch_event` RPC |
| **Period Lock Enforcement** | Corrections permitted on locked runs | Add check in `submitCorrection` and `submitLeaveRequest`: raise exception if target date $\le$ latest `locked` payroll run end date. | Postgres Trigger `guard_locked_payroll_mutation` |
