# Avencis Workforce Management (Module 01)
# Implementation Readiness Assessment & Prerequisites Checklist

---

**Document Reference:** `docs/IMPLEMENTATION_READINESS.md`  
**Assessment Date:** 03 November 2026  
**Auditor System:** Antigravity Master Pre-Implementation Verification System  
**Verdict:** 🟡 **CONDITIONALLY READY (Prerequisites Pending Executive Sign-Off)**  

---

## 1. Readiness Scorecard

| Assessment Dimension | Readiness Score | Evaluation / Current State |
| :--- | :---: | :--- |
| **Visual Design & Assets** | **100% / Ready** | All 29 Stitch screens exported, cataloged, and verified with 84 valid assets. |
| **Design System & Tokens** | **100% / Ready** | Complete Material 3 token palette, Tailwind configs, and Google Fonts validated. |
| **Functional Coverage** | **90% / Ready** | 16 of 18 requirements domains fully supported by high-fidelity screen workflows. |
| **Technical Architecture** | **85% / Pending Decisions** | Multi-entity, PostgreSQL schemas, and RLS policies mapped out; 1 schema model pending. |
| **Policy Formalization** | **70% / Action Required** | Overtime, late mark penalties, night shifts, and GPS spoofing rules need sign-off. |
| **Application Codebase** | **0% / Not Started** | Strict freeze observed; zero lines of application code authored prior to approval. |

---

## 2. Readiness Verdict

### **Verdict: CONDITIONALLY READY**

The project is in an exceptional state of design and visual preparation. However, in accordance with disciplined software engineering standards:

> [!CAUTION]
> **Implementation should NOT commence until the Product Owner resolves the 5 functional and architectural prerequisites listed below.**
> Beginning database migrations or payroll calculations without resolving whether external client payrolls are supported (GAP-01) risks costly schema refactoring later.

---

## 3. Mandatory Prerequisites Checklist (Before Sprint 01)

| # | Prerequisite Item | Impact Level | Owner | Required Action / Decision |
|---|---|---|---|---|
| **P-01** | **Direct Client Payroll Decision (GAP-01)** | **BLOCKER (Critical)** | Product Owner | Confirm: Will the tool manage employees who are legally on the client's direct payroll, or only employees on Avencis payroll? *(See Section 4.1)* |
| **P-02** | **Mobile Breakpoint Approval (GAP-02)** | **High** | UI/UX Lead | Approve the proposed $390\text{px}$ mobile viewport layout for field worker check-in derived from screen `03-daily-attendance-gps`. |
| **P-03** | **GPS Security & Spoofing Policy (GAP-03)** | **High** | Tech Lead | Confirm whether server-side IP geolocation anomaly detection is enabled to flag mock GPS locations. |
| **P-04** | **Overtime & Late Mark Rules (GAP-04, 05)** | **Medium** | HR / Finance | Confirm whether Overtime uses a $1.5\times$ wage multiplier vs Comp-Off credit, and if 3 late marks equal 0.5-day Loss of Pay. |
| **P-05** | **Overnight Shift Calendar Allocation (GAP-06)** | **Medium** | Operations | Confirm that overnight shifts spanning midnight associate the paid day with the shift start date. |

---

## 4. Proposed Implementation Roadmap (Post-Approval)

Once the prerequisites above are signed off, execution should proceed in three distinct engineering phases:

### Phase 1: Foundation, Multi-Entity Master & Attendance (Sprint 01 - 02)
1. Initialize repository with Next.js 14 (App Router), Tailwind CSS, and TypeScript.
2. Establish PostgreSQL database with Supabase RLS policies for `legal_entities`, `clients`, `work_locations`, `departments`, and `employee_master`.
3. Implement `05-enterprise-login` (Auth & Session management).
4. Implement Application Shell (`07-application-shell`) with role-based navigation.
5. Implement Employee Master Directory (`01-employees-directory`, `11-add-employee`, `13`, `14`).
6. Implement Mobile Check-in/out (`03-daily-attendance-gps`), Geofencing validation, and Command Center (`01-attendance-command-dashboard`).
7. Implement Attendance Regularisation Queue (`04-attendance-regularisations`).

### Phase 2: Leave Ledger & Month-End Paid-Days Engine (Sprint 03)
1. Implement Leave Categories (`leave_types`) and Accrual Ledgers (`leave_balances`).
2. Implement Leave Application & Approval Register (`02-leave-application-register`, `05-leave-management-dashboard`).
3. Deploy automated monthly leave accrual cron worker (2 days/month credit).
4. Implement Month-End Attendance Reconciler (Calculating Paid Days vs Unpaid Days without double-counting weekly offs and public holidays).

### Phase 3: Payroll Engine, Statutory Compliance & Payslips (Sprint 04 - 05)
1. Implement Compensation Blueprint (`salary_structures`) with configurable divisor (26/30/calendar days).
2. Implement Statutory Calculation Rules (PF, ESIC, PT, TDS).
3. Implement Guided Payroll Run Wizard (`06-payroll-guided-processing`, `03-payroll-management-dashboard`).
4. Implement Two-Stage Approval Gate (HR preparation -> Super Admin authorization and locking).
5. Implement Payslip Management & PDF Generation (`07-payslip-management`, `08-individual-payslip-preview`).
6. Implement Reporting & Security Audit Ledgers (`10-reports-analytics`, `12-attendance-leave-reports`, `13-security-audit-logs`).

---

## 5. Audit Sign-Off Status

- **Pre-Implementation Audit Completed:** ✅ **YES**
- **All 29 Screens Verified:** ✅ **YES**
- **Zero Modifications to Source Code Made:** ✅ **CONFIRMED**
- **Awaiting User Approval:** ✅ **STOPPING AS MANDATED**
