# AVENCIS WORKFORCE MANAGEMENT
## Document 07 — Add, Change, and Remove Architecture Register

**Status:** Complete Register  
**Date:** 2026-11-16  
**Auditor:** Antigravity Engineering & Product Management  
**Scope:** Functional Additions, Architectural Changes, and Codebase Removals  

---

## 1. Executive Summary

This register serves as the formal backlog and architectural change log for Avencis Workforce Management (WFM) transitioning from Milestone 2.5 hardening to production commercial readiness.

All entries are categorized into three distinct registers:
1. **ADD Register:** Net-new features and missing technical capabilities required for production.
2. **CHANGE Register:** Existing implementations requiring functional enhancement, refactoring, or bug remediation.
3. **REMOVE Register:** Dead code, redundant mock structures, and deprecated files earmarked for safe deletion.

---

## 2. ADD Register (Net-New Capabilities Required)

| Item ID | Target Module | Proposed Feature / Capability | Priority | Rationale & Business Impact | Technical Implementation Pathway |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADD-01** | Auth / Identity | **Self-Service Password Reset & Forgot Password** | **P0 (Critical)** | Currently, password changes require manual admin intervention. Users cannot recover locked accounts. | Integrate Supabase Auth `resetPasswordForEmail()` with custom redirect URL to `/reset-password` view. |
| **ADD-02** | Employee Master | **Direct `manager_id` Foreign Key on `employees`** | **P0 (Critical)** | Reporting hierarchy currently relies solely on `departments.head_employee_id`. Cross-functional reporting is blocked. | Add `manager_id UUID REFERENCES employees(id) ON DELETE SET NULL` to `employees` table in Migration 21. |
| **ADD-03** | Document Vault | **Storage Bucket & Document Upload Interface** | **P1 (High)** | Employee identity docs (Aadhaar, PAN, certificates) cannot currently be uploaded or verified. | Provision `employee-documents` bucket in Supabase Storage with tenant-partitioned RLS policies and UI uploader. |
| **ADD-04** | Attendance | **Location-Specific Attendance Policy Assignment** | **P1 (High)** | Policies currently apply globally across a client. Multi-shift factories or field offices require separate rules. | Add `policy_id` column to `work_locations` or create `policy_location_assignments` mapping table. |
| **ADD-05** | Notifications | **Automated Transactional Email / Push Alerts** | **P1 (High)** | Managers are not alerted when leaves or regularisations are submitted; employees unaware of approvals. | Implement Supabase Database Webhooks / Edge Functions triggering Resend/SendGrid transactional email templates. |
| **ADD-06** | Attendance | **Polygon Geofencing Support** | **P2 (Medium)** | Current system supports circular radius only. Irregular industrial complexes need polygon boundaries. | Integrate GeoJSON or PostgreSQL PostGIS `ST_Contains()` for complex facility boundaries. |
| **ADD-07** | Payroll | **Statutory ECR (PF) & Return File Exporters** | **P1 (High)** | Payroll teams require EPFO ECR text format and ESIC monthly contribution Excel exports for compliance. | Implement client-side or Edge Function formatter generating EPFO Electronic Challan Return text files. |

---

## 3. CHANGE Register (Functional Modifications & Refactoring)

| Item ID | Target Module | Existing Implementation | Proposed Modification | Priority | Rationale & Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CHG-01** | Team Management | `employees` table queried directly via PostgREST by Location Managers. | Switch to calling `get_manager_team()` RPC in `store.ts` and `employeeService.ts`. | **P0 (Critical)** | **DISC-01:** RLS returns empty array to non-admins on direct query. Manager dashboard shows 0 employees without this fix. |
| **CHG-02** | Attendance Corrections | `attendance_corrections` RLS permits only Client Admin & Super Admin to approve. | Apply Migration 21 policy granting Location Managers approval rights for their assigned site employees. | **P0 (Critical)** | **DISC-02:** Site supervisors cannot approve punch regularisations despite being operationally responsible. |
| **CHG-03** | Daily Attendance | Location Managers have tenant-wide read on `daily_attendance_records`. | Scope Location Manager SELECT policy strictly to employees in their assigned `work_locations`. | **P1 (High)** | **DISC-03:** Enforces strict least-privilege boundary across branches of the same client. |
| **CHG-04** | Salary CTC Entry | Wizard requires manual entry of each component (Basic, HRA, Allowance). | Provide an "Auto-Calculate from Annual CTC" button using standard Indian statutory split (40% Basic, 20% HRA, etc.). | **P2 (Medium)** | Reduces HR onboarding time and prevents mathematical entry errors in statutory thresholds. |
| **CHG-05** | Form XIX Payslips | Payslip printable view prints inline on page without strict page-break CSS. | Add `@media print` rules, `@page { size: A4 portrait; margin: 15mm; }`, and explicit page-break boundaries. | **P2 (Medium)** | Ensures generated payslips render cleanly as single-page physical documents across all printer drivers. |
| **CHG-06** | Client Switcher | Super Admin client switcher updates local store without resetting cached module filters. | Implement full cache invalidation and store reset when Super Admin switches tenant context. | **P1 (High)** | Prevents UI cross-contamination where data from Client A temporarily lingers in views when switching to Client B. |

---

## 4. REMOVE Register (Dead Code, Legacy Mocks & Redundancies)

| Item ID | Target File / Asset | Description & Current State | Priority | Safe Deletion Verification |
| :--- | :--- | :--- | :--- | :--- |
| **REM-01** | `src/utils/mockData.ts` (partial) | Static hardcoded mock employee records used during initial UI design. | **P2 (Medium)** | Retain only minimal fallback for disconnected development; remove mock arrays that duplicate Supabase schema. |
| **REM-02** | Unused Vitest configuration | Residual comments or scripts referencing vitest where standalone `scripts/*.ts` are used. | **P2 (Medium)** | Standardize `package.json` test script to invoke `scripts/runAllTests.ts`. |
| **REM-03** | Legacy console debugging | Verbose `console.log()` statements across `payrollService.ts` and `authService.ts`. | **P2 (Medium)** | Replace with unified structured logger or strip in production build to prevent sensitive object leakage in browser console. |
| **REM-04** | `scripts/testServices.ts` unflagged mode | Standalone runner without `--env-file=.env` defaults. | **P3 (Low)** | Ensure all npm script targets in `package.json` explicitly include `--env-file=.env`. |

---

## 5. Architectural Implementation Phasing

```mermaid
flowchart LR
    subgraph Phase 1: Security & Governance [Immediate Migration 21]
        CHG-01[CHG-01: Manager Team RPC]
        CHG-02[CHG-02: Correction RLS]
        CHG-03[CHG-03: Daily Attendance Scoping]
        ADD-02[ADD-02: manager_id FK]
    end

    subgraph Phase 2: User Experience & Self-Service [Milestone 2.6]
        ADD-01[ADD-01: Password Reset]
        ADD-03[ADD-03: Storage Documents]
        CHG-04[CHG-04: CTC Auto-Split]
        CHG-05[CHG-05: Print CSS]
    end

    subgraph Phase 3: Statutory & Enterprise [Milestone 2.7]
        ADD-05[ADD-05: Transactional Alerts]
        ADD-07[ADD-07: ECR File Exporters]
        ADD-06[ADD-06: Polygon Geofences]
        REM-01[REM-01/03: Code Cleanup]
    end

    Phase 1 --> Phase 2 --> Phase 3
```
