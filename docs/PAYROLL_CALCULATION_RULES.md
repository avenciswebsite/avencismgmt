# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E: PAYROLL MANAGEMENT
## PAYROLL CALCULATION RULES & STATUTORY FORMULAS (REVISED)

> **Document:** `docs/PAYROLL_CALCULATION_RULES.md`  
> **Status:** AUTHORITATIVE MATHEMATICAL & ALGORITHMIC SPECIFICATION (REVISED POST-REVIEW)  
> **Milestone:** 2.4E (Payroll Management)  
> **Jurisdiction:** Indian Labor Laws, Payment of Wages Act, EPF/ESIC/PT Statutes  

---

## 1. CALENDAR DAYS, MUSTER INGESTION & PRORATION MECHANICS

### 1.1 Calendar Period Boundaries
For any given payroll batch with `period_month` $M \in [1, 12]$ and `period_year` $Y \in [2020, 2100]$:
$$D_{\text{cal}} = \text{Date}(Y, M, 0).\text{getDate}() \quad (D_{\text{cal}} \in \{28, 29, 30, 31\})$$

### 1.2 Upstream Attendance Muster Resolution (9-Status Taxonomy)
For each employee $i$, the calculation engine queries `daily_attendance_records` for dates between $Y-M-01$ and $Y-M-D_{\text{cal}}$:

| Muster Status | Classification | Paid Day Weight | Unpaid Day Weight | Notes |
| :--- | :--- | :---: | :---: | :--- |
| `PRESENT` | Full Day Worked | $1.0$ | $0.0$ | Verified biometric punch or approved regularisation |
| `ON_DUTY` | Official Outdoor Duty | $1.0$ | $0.0$ | Approved client field assignment |
| `WEEKLY_OFF` | Scheduled Rest Day | $1.0$ | $0.0$ | Configured weekly off (e.g. Sunday) |
| `HOLIDAY` | Declared Public Holiday | $1.0$ | $0.0$ | Public or client holiday |
| `PAID_LEAVE` | Approved Paid Leave | $1.0$ | $0.0$ | Deducted from PL, CL, SL, or COMP_OFF balance |
| `HALF_DAY` | Partial Work / Half Leave | $0.5$ | $0.5$ | Authorized half-day attendance or approved half-day leave |
| `UNPAID_LEAVE` | Approved LWP | $0.0$ | $1.0$ | Leave Without Pay (deducted from wages) |
| `ABSENT` | Unexcused Absence | $0.0$ | $1.0$ | Unpaid absence |
| `LATE` | Late Arrival | $1.0$ | $0.0$ | **Zero automatic wage deduction** (Punctuality metric only) |

$$\text{Total Unpaid Days } (U_i) = N_{\text{unpaid\_leave}} + N_{\text{absent}} + (0.5 \times N_{\text{half\_day}})$$

$$\text{Effective Paid Days } (P_i) = \max(0, D_{\text{cal}} - U_i)$$

---

## 2. MID-PERIOD JOINING & EXIT PRORATION

### 2.1 Mid-Month Joining
If employee's `joining_date` $T_{\text{join}}$ falls within the period month:
1. Days prior to joining are inactive:
   $$D_{\text{eligible}} = D_{\text{cal}} - (\text{Day}(T_{\text{join}}) - 1)$$
2. Paid days are bounded by eligibility:
   $$P_i = \max(0, \min(D_{\text{eligible}} - U_i, D_{\text{eligible}}))$$

### 2.2 Mid-Month Exit / Resignation
If employee's exit date $T_{\text{exit}}$ falls within the period month:
1. Days following exit are inactive:
   $$D_{\text{eligible}} = \text{Day}(T_{\text{exit}})$$
2. Paid days are capped:
   $$P_i = \max(0, \min(D_{\text{eligible}} - U_i, D_{\text{eligible}}))$$

---

## 3. EARNINGS PRORATION & COMPONENT FORMULAS

Let $\text{Div}$ be the effective divisor resolved from `client_policies.salary_divisor`:
- If `'26'`, $\text{Div} = 26$.
- If `'30'`, $\text{Div} = 30$.
- If `'calendar_days'`, $\text{Div} = D_{\text{cal}}$.

$$\text{Proration Ratio } (R_i) = \min\left(1.0, \frac{P_i}{\text{Div}}\right)$$

### 3.1 Prorated Fixed Salary Components
From `employee_salary_structures` for employee $i$:
$$\text{Payable Basic} = \text{Round}(\text{fixed\_monthly\_base} \times R_i)$$
$$\text{Payable HRA} = \text{Round}(\text{hra} \times R_i)$$
$$\text{Payable Conveyance} = \text{Round}(\text{conveyance} \times R_i)$$
$$\text{Payable Special} = \text{Round}(\text{special\_allowances} \times R_i)$$

$$\text{Prorated Fixed Base} = \text{Payable Basic} + \text{Payable HRA} + \text{Payable Conveyance} + \text{Payable Special}$$

$$\text{Unpaid Leave Deduction} = (\text{fixed\_monthly\_base} + \text{hra} + \text{conveyance} + \text{special\_allowances}) - \text{Prorated Fixed Base}$$

### 3.2 Authorised Overtime & Variable Earnings [REVISED DECISION]
- **No Inferred Overtime:** Payable overtime is **NOT** automatically derived from raw attendance telemetry.
- **Authorised Input:** Approved overtime compensation and performance incentives are entered by the Payroll Admin during the `REVIEW` stage:
  $$\text{Gross Earned} = \text{Prorated Fixed Base} + \text{Authorised Incentives} + \text{Authorised Overtime Pay} + \text{Other Allowances}$$

---

## 4. DEDUCTIONS & STATUTORY RULES

### 4.1 Employee Provident Fund (EPF — 12%) [REVISED DECISION]
- In accordance with corporate governance decisions, EPF rules are configurable per client and employee rather than enforcing a universal cap or universal uncapping:
  - **Standard Statutory Ceiling:** $\text{PF Wage} = \min(\text{Payable Basic}, 15000)$.
  - **Client-Configured Uncapped Basic:** $\text{PF Wage} = \text{Payable Basic}$.
- **Formula:**
  $$\text{EPF Employee} = \begin{cases}
  \text{Round}(\text{PF Wage} \times (\text{pf\_employee\_percent} / 100)) & \text{if } client\_policies.pf\_enabled = \text{true} \\
  0 & \text{otherwise}
  \end{cases}$$

### 4.2 Employees' State Insurance (ESIC — 0.75%)
- Applicable only when employee's monthly gross earned wages $\le ₹21,000$:
  $$\text{ESIC Employee} = \begin{cases}
  \text{Round}(\text{Gross Earned} \times 0.0075) & \text{if } esic\_enabled = \text{true} \text{ and } \text{Gross Earned} \le 21000 \\
  0 & \text{otherwise}
  \end{cases}$$

### 4.3 Professional Tax (PT — State Slabs)
- Jurisdiction resolved by matching `employees.work_location_id` $\rightarrow$ `work_locations.state`:
- Ingests active schedules from `statutory_pt_slabs`:
  - E.g., Maharashtra Standard: Gross $> ₹10,000 \implies ₹200$ (March–January), $₹300$ (February adjustment).

### 4.4 Tax Deducted at Source (TDS — Section 192) [REVISED DECISION]
- **Removal of Arbitrary Flat Placeholder:** Flat ₹1,200 deduction is completely eliminated.
- **Configurable Withholding & Statutory Pathway:**
  1. **Phase 1 Baseline:** TDS deduction is resolved from the employee's active salary structure withholding instruction (`tds_withholding_amount`) or confirmed tax declaration.
  2. **Statutory Validation Pathway:** Automated annual tax liability projection (incorporating New Tax Regime u/s 115BAC slabs, standard deductions, Chapter VI-A investments, and annual true-up) must undergo professional statutory validation before direct automated withholding without administrative review.

---

## 5. NET PAY & ARITHMETIC INVARIANTS

$$\text{Total Deductions} = \text{EPF} + \text{ESIC} + \text{PT} + \text{TDS} + \text{Other Authorised Deductions}$$

$$\text{Calculated Net} = \text{Gross Earned} - \text{Total Deductions}$$

### 5.1 Negative Net Pay Zero-Floor Invariant
- **Rule:** Net salary is strictly floor-bounded:
  $$\text{Net Salary Payable} = \max(0, \text{Calculated Net})$$
- If $\text{Total Deductions} > \text{Gross Earned}$:
  - $\text{Net Salary} = 0.00$.
  - The shortfall is flagged as an `unrecovered_deduction_balance` for carry-forward to the subsequent pay period.

### 5.2 Rounding Standard
- Every earnings and deduction line item is mathematically rounded to the nearest integer Rupee ($\ge 0.50$ rounds up, $< 0.50$ rounds down).
- Net Salary = $\text{Gross Earned} - \text{Total Deductions}$ with zero rounding residuals.
