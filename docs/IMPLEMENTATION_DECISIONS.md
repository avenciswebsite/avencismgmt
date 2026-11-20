# Avencis Workforce Management (Module 01)
# Implementation Decisions Log

---

**Document Reference:** `docs/IMPLEMENTATION_DECISIONS.md`  
**Date:** 03 November 2026  
**Status:** **AUTHORITATIVE & RATIFIED**  
**Governing Directives:** Master Implementation Directive (Parts 1 - 20)  

---

## 1. Confirmed Architectural Decisions

### Decision 01: Technology Stack Selection
* **Confirmed Stack:** **React 18 + TypeScript + Vite + Tailwind CSS + Supabase / PostgreSQL**.
* **Rationale:** Aligns with previously agreed upon architecture, matches the embedded Tailwind design system across all 29 Stitch screen exports, and provides high-performance SPA routing and reactive client workspace switching.

### Decision 02: Employer & Payroll Entity Model
* **Confirmed Model:** The platform processes payroll **strictly for client organisations**. Avencis is the management service provider and platform administrator, never the default employer.
* **Schema Implementation:** Each client possesses one or more `client_legal_entities` containing corporate registration details, PAN, GSTIN, PF establishment codes, and ESIC numbers. Every employee is assigned to a specific client legal entity.

### Decision 03: Client-Level Policy Configuration (No Employee Overrides)
* **Confirmed Model:** All 20 operational, attendance, leave, shift, and payroll policy domains are configured at the **CLIENT LEVEL**.
* **Rule:** All employees belonging to a client inherit that client's policy configuration. Employee-level overrides are forbidden.
* **Safety Mechanism:** Unconfigured policies are explicitly flagged as `UNCONFIGURED`. Missing mandatory policies block payroll finalisation with clear validation messaging.

### Decision 04: Three-Tier Role & Workspace Architecture
* **Tier 1 — Avencis Super Administrator:** Global platform access. Uses the **Avencis Master Dashboard** (`/admin`) and the **Global Client Workspace Switcher** to move between clients (e.g., Suman, Maha India) without re-authenticating.
* **Tier 2 — Client Administrator:** Scoped strictly to their assigned organisation (`/workspace/:clientId`). Direct entry, zero cross-client visibility, no global switcher.
* **Tier 3 — Field Employee:** Scoped to individual records (`/portal` and mobile-responsive punch `/portal/check-in`).

### Decision 05: Data Layer Architecture & Demo Seeding
* **Confirmed Pattern:** Dual-mode repository pattern. The application includes a rich in-memory / `localStorage` multi-tenant data layer pre-seeded with complete demonstration clients (**Suman** and **Maha India**), complete legal entities, departments, employees, attendance histories, leave ledgers, and sample payroll runs, with drop-in Supabase PostgreSQL connectivity.

### Decision 06: Phased Implementation Execution
* **Milestone 1:** Core Foundation, Application Shell, Authentication, Client Switcher, Client Onboarding, Employee Directory, Profile KYC.
* **Milestone 2:** Attendance Telemetry, Mobile GPS Punch, Command Center, Attendance Regularisation, Leave Applications, Leave Balances, Client Policy Engine.
* **Milestone 3:** Salary Structures, Guided Payroll Run Wizard, Two-Stage Approvals, Payslip PDF Generation, Reports & Analytics, Security Audit Ledger.
