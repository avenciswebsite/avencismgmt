# AVENCIS WORKFORCE MANAGEMENT (MODULE 01)
## KNOWN LIMITATIONS & ROADMAP SPECIFICATION — POST-AUDIT RECONCILIATION

**Project:** Avencis ERP / Business Management Platform  
**Stage:** First Working Draft Architectural Boundaries  
**Document Code:** TECH-LIMIT-01  
**Status:** Authoritative Post-Audit Roadmap Reference  

---

### 1. Scope Boundaries (Honoring Master Directive)

In accordance with the Master Implementation Directive:
- **Module Focus:** This implementation covers **Module 01 (Workforce Management: Attendance & Payroll)**.
- **Future ERP Modules Omitted:** Modules such as Inventory, Fleet Telematics, Billing, Procurement, and General Ledger Accounting are intentionally omitted and reserved for future platform phases.

---

### 2. Comprehensive Inventory of Known Limitations

#### 2.1. Backend Database & Row Level Security (RLS)
- **Current Reality:** **No Supabase or PostgreSQL database is connected.** `@supabase/supabase-js` is not installed, no migrations exist, and no server-side API is active.
- **Limitation:** Data is confined to the client-side browser memory heap and `localStorage`. There is no multi-user concurrent synchronization or database-level tenant isolation.
- **Roadmap (Phase 2):** Initialize Supabase, execute migrations from `docs/DATABASE_SCHEMA_DOCUMENTATION.md`, and enforce RLS policies via JWT claims.

#### 2.2. Authentication & Route Authorization Guards
- **Current Reality:** **Authentication is 100% simulated.** Passwords are not verified, sessions are unencrypted in `localStorage`, and the persona switcher directly overrides client state.
- **Limitation:** No server-side route guards exist. Authenticated workers can access `/admin/*` or view another employee's payslip and bank details by altering route parameters.
- **Roadmap (Phase 2):** Implement Supabase Auth and React Router `<AuthGuard />` wrappers.

#### 2.3. Payroll Engine Hardcoded Heuristics & Stubs
- **Current Reality:**
  1. `unpaidDays` evaluates `emp.id.endsWith('05') ? 1 : 0` instead of querying attendance muster records.
  2. `calendarDays` is hardcoded to 30.
  3. Divisor `calendar_days` falls back to 30.
  4. Income Tax TDS is hardcoded flat ₹1,200 for salaries $\ge ₹40,000$.
  5. Professional Tax (PT) is hardcoded flat ₹200 (no state slabs).
  6. Overtime and late penalty rules are completely omitted from payroll math.
- **Roadmap (Phase 2):** Connect payroll proration to actual attendance muster records, implement dynamic calendar days, state PT lookup tables, Section 192 tax slab calculations, and overtime accruals.

#### 2.4. Policy Engine Execution Gap (15 Dormant Domains)
- **Current Reality:** While all 20 domains exist in the schema and UI form, **only 5 domains** (`enforceStrictGeofence`, `salaryDivisor`, `pfEnabled`, `esicEnabled`, `ptEnabled`) are actively evaluated in calculations. The other 15 domains are stored parameters.
- **Roadmap (Phase 2):** Wire overtime multipliers, late grace minutes, leave tenure gates, and monthly accrual loops into the runtime engine.

#### 2.5. Partial LocalStorage Persistence
- **Current Reality:** Seven collections persist in `localStorage`, but `attendanceEvents`, `leaveBalances`, `corrections`, `legalEntities`, and `workLocations` do not persist and revert to initial mock data on page refresh.
- **Roadmap (Phase 2):** Persist all entities to the PostgreSQL database.

#### 2.6. Biometric Hardware Terminal Sync
- **Current Reality:** Simulated via mock records; direct TCP/IP socket listeners for physical biometric hardware are not connected in a frontend web browser context.
- **Roadmap (Phase 2):** Implement a Python/Node.js edge agent sidecar for depot LANs.

#### 2.7. Direct Corporate Banking API (NEFT / RTGS)
- **Current Reality:** Standard corporate banking text batch file formatting is displayed; direct banking webhooks are not executed.
- **Roadmap (Phase 2):** Integrate secure encrypted direct banking APIs with dual-custody authorization.
