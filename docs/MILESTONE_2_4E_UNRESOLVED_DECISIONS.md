# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E: PAYROLL MANAGEMENT
## REGISTER OF APPROVED DECISIONS & REMAINING STATUTORY MATTERS

> **Document:** `docs/MILESTONE_2_4E_UNRESOLVED_DECISIONS.md`  
> **Status:** AUTHORITATIVE DECISION REGISTER (POST-REVIEW REVISED)  
> **Milestone:** 2.4E (Payroll Management)  
> **Author:** Antigravity Engineering (Google DeepMind)  

---

## 1. APPROVED DECISION REGISTER (INCORPORATED INTO SPECIFICATIONS)

The following seven decisions were formally reviewed and decided by stakeholders on November 15, 2026:

| # | Domain | Decided Rule | Technical Implementation Summary |
|---|:---|:---|:---|
| **01** | **Overtime** | **Manually entered, authorised overtime only.** | Payable overtime is **NOT** inferred from raw attendance hours alone. Overtime hours/amounts are entered by Payroll Admin during the `REVIEW` stage and recorded in `payroll_items.overtime_pay`. |
| **02** | **Late Arrival Penalties** | **No automatic salary deductions.** | No arbitrary 0.5-day wage penalty for late marks. Attendance punctuality metrics remain in Attendance Management. Salary proration applies only to verified unpaid days (`UNPAID_LEAVE`, `ABSENT`) and formal half-days (`HALF_DAY`). |
| **03** | **TDS (Income Tax)** | **Remove flat ₹1,200 placeholder; configurable withholding.** | The hardcoded ₹1,200 placeholder is completely removed. Configurable monthly withholding is resolved from employee salary structures. Full annual tax projection is documented as requiring professional statutory certification. |
| **04** | **Payroll Grouping** | **Separate by Legal Employer & Processing Responsibility.** | Grouping is driven by `client_legal_entities` and processing responsibility (Avencis vs Client), rather than employment arrangement alone. Statutory returns and payslips group by legal entity. |
| **05** | **EPF Calculations** | **Configurable, effective-dated statutory rules.** | Neither universal ₹15,000 cap nor universal uncapped calculation is imposed. Configurable rules support both standard statutory ceiling and opted uncapped basic coverage per client policy and employee structure. |
| **06** | **Payslip Interface** | **Reuse approved Form XIX printable interface initially.** | Immediate activation of the approved Form XIX printable template (`OfficialPayslipView.tsx`) using native browser print engine. Asynchronous PDF storage bucket uploads remain a subsequent enhancement. |
| **07** | **Attendance Finalization** | **Strict blocking gate on unresolved regularisations.** | Payroll approval and locking are strictly prevented if any `PENDING` attendance corrections exist for the billing period. Zero unresolved regularisations required. |

---

## 2. STATUTORY COMPLIANCE & PROFESSIONAL VALIDATION REGISTER

In accordance with strict compliance engineering guidelines, the following statutory validation matters are documented for formal professional sign-off:

### Item 01: Statutory Validation Boundary for Annual TDS Projection
- **Finding:** Calculating automated annual tax withholding under Indian Section 192 requires complex statutory logic:
  1. Evaluating employee regime selection: New Tax Regime (Section 115BAC default) vs. Old Tax Regime.
  2. Ingesting Form 12BB declarations (HRA rent receipts under Sec 10(13A), Chapter VI-A deductions: 80C up to ₹1.5L, 80D health insurance, 80E education loan interest, 80CCD NPS).
  3. Prorating annual taxable income and computing monthly tax installments with marginal relief and 4% Health & Education Cess.
  4. Performing year-end March true-up based on verified proof submissions.
- **Architectural Decision for Milestone 2.4E:**
  - Implement **verified monthly withholding instruction** (`tds_withholding_amount`) on `employee_salary_structures`.
  - Full automated annual tax projection engine requires formal certification by a qualified Indian Chartered Accountant / Tax Counsel before being deployed for automated statutory tax remittances.

### Item 02: State-Specific Professional Tax (PT) Schedular Updates
- **Finding:** While Maharashtra PT slabs are seeded (₹175 for ₹7,501–₹10,000; ₹200 for $> ₹10,000$; ₹300 in February), deployment to work locations in other Indian states (e.g., Karnataka, Gujarat, Tamil Nadu, West Bengal) requires verifying active PT schedules and gender-based exemptions.
- **Action:** Ensure `statutory_pt_slabs` includes validated schedules for all states where active client work locations exist.

### Item 03: ESIC Contribution Period Lock
- **Finding:** Under ESIC statutory rules, if an employee's wage exceeds ₹21,000 *during* an active contribution period (April–September or October–March), they remain covered until the end of that statutory contribution period.
- **Action:** Retain standard monthly wage eligibility checking for Milestone 2.4E, and stage half-yearly contribution period lock for enterprise compliance enhancement.
