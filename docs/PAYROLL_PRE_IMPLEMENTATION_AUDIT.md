# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E: PAYROLL MANAGEMENT
## PRE-IMPLEMENTATION AUDIT & BASELINE ASSESSMENT

> **Document:** `docs/PAYROLL_PRE_IMPLEMENTATION_AUDIT.md`  
> **Status:** AUTHORITATIVE AUDIT BASELINE  
> **Milestone:** 2.4E (Payroll Engine and Payslip Processing)  
> **Scope:** Pre-Implementation Architectural Assessment  

---

## 1. EXECUTIVE SUMMARY

Milestone 2.4D (Leave Management & Attendance Integration) has officially completed and achieved a 100% verified green state (51/51 automated catalog checks passed, 0 failures, 0 review items). 

Before implementing **Milestone 2.4E (Payroll Management)**, this audit evaluates the current application architecture, database readiness, upstream dependencies, and user interface alignment against corporate governance and Indian statutory compliance requirements.

### Key Audit Findings:
1. **Frontend Disconnection:** The existing UI screens (`PayrollDashboard.tsx`, `PayrollGuidedWizard.tsx`, `PayslipManagement.tsx`, `OfficialPayslipView.tsx`) currently run entirely against in-memory `localStorage` mock data in `src/data/store.ts`. They do not read or persist data to Supabase Cloud `payroll_runs`, `payroll_items`, or `payslips`.
2. **Service Layer Limitation:** `payrollService.ts` currently provides only read queries (`getPayrollRuns`, `getPayrollRunById`, `getPayrollItems`, `getPayslips`) and an in-memory proration helper (`calculateProrationDays`). It lacks calculation execution, approval workflow, batch locking, and payslip generation methods.
3. **Database Readiness:** The core payroll tables (`payroll_runs`, `payroll_items`, `payslips`, `statutory_pt_slabs`, `statutory_holidays`) exist in Supabase and passed all 51 structural checks. However, database triggers and RPCs for transactional payroll processing have not yet been implemented.
4. **Hardcoded Upstream Placeholders in Mock Layer:** The mock calculation engine in `store.ts` uses arbitrary heuristics (`emp.id.endsWith('05') ? 1 : 0` for unpaid days, flat ₹200 for PT, and flat ₹1,200 for TDS) rather than querying actual attendance records, approved LWP leave requests, or state statutory schedules.

---

## 2. TECHNOLOGY STACK & SYSTEM BASELINE

| Component | Technology | Version / Configuration | Verification Status |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^18.3.1` with Functional Components & Hooks | Verified |
| **Type System** | TypeScript | `^5.6.3` with strict typing enabled | Verified (`tsc --noEmit` clean) |
| **Build Tooling** | Vite | `^5.4.21` with production bundling | Verified (`npm run build` clean) |
| **Styling** | Tailwind CSS | Utility classes conforming to Stitch Design Tokens | Verified |
| **Database** | Supabase PostgreSQL | PostgreSQL 15.x on Supabase Cloud | Verified (Migrations 01–17 active) |
| **Authentication** | Supabase Auth | JWT bearer tokens with custom claims (`user_profiles`) | Verified |
| **Icons & Assets** | Lucide React | Official design system icons | Verified |

---

## 3. AUDIT CLASSIFICATION FRAMEWORK

To prevent assumptions from corrupting engineering planning, all findings in this document and subsequent audit reports are categorized into six explicit classifications:

1. **[VERIFIED FACT]**: Confirmed by direct inspection of repository code, SQL files, or database schema.
2. **[EXISTING IMPLEMENTATION]**: Current operational code running in the codebase today.
3. **[PROPOSED ARCHITECTURE]**: Target design proposed for Milestone 2.4E implementation.
4. **[ASSUMPTION]**: Unverified operational assumption requiring validation.
5. **[UNRESOLVED DECISION]**: Business, legal, or architectural choice requiring stakeholder approval.
6. **[BLOCKER]**: Technical dependency preventing safe execution.

---

## 4. CURRENT PAYROLL FUNCTIONALITY REGISTER

### 4.1 Implemented Features [EXISTING IMPLEMENTATION]
- **Client Divisor Policy Evaluation:** Evaluates client-configured salary divisor (`26`, `30`, or `calendar_days`) for base proration.
- **Base Proration Math:** Prorates monthly fixed base using payable days ratio.
- **Batch Tamper Guard:** Database trigger `trg_guard_payroll_run_lock` and `trg_guard_payroll_items_lock` blocks updates to locked runs.
- **Form XIX Muster Preview:** Visual template rendering basic payslip fields (Basic, HRA, Allowances, PF, ESIC, PT, TDS).
- **Service Layer Read Queries:** PostgREST queries for retrieving historical runs and items.

### 4.2 Gaps & Missing Capabilities [VERIFIED FACT]
- **No Live Backend Calculation:** Zero transactional RPCs exist for executing live payroll runs in Supabase.
- **Disconnected Attendance Ingestion:** Payroll calculations do not aggregate actual daily muster records from `daily_attendance_records`.
- **Disconnected Leave (LWP) Deductions:** Payroll calculations do not query approved `UNPAID_LEAVE` / `LWP` records from `leave_requests`.
- **No Statutory Slab Integration:** Professional Tax is not evaluated against `statutory_pt_slabs` (ignoring work location state and February surcharge).
- **No Formal TDS Engine:** Income tax withholding is an arbitrary placeholder.
- **No Overtime / Late Deduction Integration:** Client policy parameters for overtime (`multiplier`, `flat_rate`) and late penalties (`deduct_half_day_per_3`) are not computed.
- **No Payslip Publication Workflow:** Payslips cannot be batch-generated, marked `is_published = true`, or delivered to employee self-service portal.

---

## 5. REPOSITORY CODE INVENTORY

| File Path | Nature / Responsibility | Current State |
| :--- | :--- | :--- |
| `src/services/payrollService.ts` | Domain service layer for payroll | Read-only queries and client proration helper |
| `src/app/workspace/PayrollDashboard.tsx` | Main payroll dashboard | Consumes mock data from `store.ts` |
| `src/app/workspace/PayrollGuidedWizard.tsx` | 5-step guided payroll execution wizard | Consumes mock data; triggers `store.calculatePayrollRun()` |
| `src/app/workspace/PayslipManagement.tsx` | Client-wide payslip register | Generates synthetic payslips on the fly from mock employees |
| `src/app/workspace/OfficialPayslipView.tsx` | Printable Form XIX individual payslip view | Hardcoded component ratios (50% basic, 30% HRA) |
| `src/app/portal/EmployeePortal.tsx` | Employee self-service portal | Contains payslip tab placeholder |
| `src/data/store.ts` | In-memory mock store and localStorage | Contains mock calculations with hardcoded stubs |
| `src/types/database.types.ts` | TypeScript database entity definitions | Defines `payroll_runs`, `payroll_items`, `payslips` |
| `src/types/index.ts` | Domain model definitions | Defines `PayrollRun`, `PayrollItem`, `Payslip` |

---

## 6. PRE-IMPLEMENTATION READINESS DECISION

> [!IMPORTANT]
> **GATE DECISION: READY FOR AUDIT & PLANNING — BLOCKED FOR IMPLEMENTATION**
> 
> Implementation of Milestone 2.4E must **NOT** begin until:
> 1. Unresolved calculation and statutory rules are formally approved.
> 2. Database migration proposals (RPCs, triggers, indexes) are reviewed.
> 3. Multi-tenant and role scoping rules are documented and approved.
