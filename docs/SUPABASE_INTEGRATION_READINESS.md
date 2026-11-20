# AVENCIS WORKFORCE MANAGEMENT (MODULE 01)
## SUPABASE INTEGRATION READINESS & BACKEND MATURITY ASSESSMENT

**Audit Date:** November 03, 2026  
**Auditor:** Antigravity Master Technical Audit System  
**Target Platform:** Supabase (PostgreSQL 15+, GoTrue Auth, Storage, Edge Functions)  
**Status:** **TECHNICAL GAP ANALYSIS COMPLETED**

---

## 1. Subsystem Readiness Matrix

| Supabase Subsystem | Current Workspace Status | Implementation Readiness Score | Critical Technical Gap |
|---|:---:|:---:|---|
| **1. Client SDK Configuration** | **NOT INSTALLED** | 0% | `@supabase/supabase-js` missing in `package.json`; no client singleton in `src/lib/`. |
| **2. Environment Variables** | **NOT CONFIGURED** | 0% | No `.env` or `.env.local` files; missing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| **3. Database Schema** | **DOCUMENTED ONLY** | 70% | Target schema fully defined in `docs/DATABASE_SCHEMA_DOCUMENTATION.md`, but 0 `.sql` files created. |
| **4. SQL Migrations** | **NOT CREATED** | 0% | No `supabase/migrations/` directory; no versioned migration scripts. |
| **5. Tables & Relationships** | **ARCHITECTED** | 80% | 11 core tables and foreign key relationships mapped; physical creation pending. |
| **6. Row Level Security (RLS)** | **DOCUMENTED ONLY** | 60% | SQL policy statements drafted in documentation; zero active policies in database. |
| **7. Authentication (GoTrue)** | **NOT INTEGRATED** | 10% | Frontend uses mock `AuthContext`; needs refactoring to `supabase.auth` and JWT custom claims. |
| **8. Edge Functions** | **NOT IMPLEMENTED** | 0% | No `supabase/functions/` directory; needed for payroll locking, geofence audit, and PDF generator. |
| **9. Storage Buckets** | **NOT CONFIGURED** | 0% | Storage buckets (`avatars`, `payslips`, `compliance-docs`) not provisioned. |
| **10. Database Triggers** | **ARCHITECTED** | 40% | Triggers for immutable attendance logs and `updated_at` drafted in documentation. |
| **11. Audit Logging** | **PARTIALLY DESIGNED** | 50% | `this.auditLogs` array in `store.ts` captures events; needs dedicated append-only PostgreSQL table. |
| **12. Multi-Tenant Isolation** | **ARCHITECTED** | 60% | Client-partitioned shared database model designed; needs RLS enforcement via JWT `client_id`. |

---

## 2. Detailed Technical Inspection of Components

### 2.1. Client SDK & Environment Configuration
- **Current State:**
  - `package.json` contains only frontend libraries (`react`, `react-router-dom`, `lucide-react`, `canvas-confetti`).
  - No Supabase client helper (`src/lib/supabaseClient.ts` or similar) exists.
  - No environment file exists to store Supabase project URL or anonymous/service-role keys.
- **Required Implementation:**
  ```bash
  npm install @supabase/supabase-js
  ```
  Create `.env.local`:
  ```ini
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
  ```
  Create `src/lib/supabaseClient.ts`:
  ```typescript
  import { createClient } from '@supabase/supabase-js';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  export const supabase = createClient(supabaseUrl, supabaseAnonKey);
  ```

---

### 2.2. Database Schema & Migration Readiness
- **Current State:**
  The project documentation in [`docs/DATABASE_SCHEMA_DOCUMENTATION.md`](file:///c:/Avencis%20Management/docs/DATABASE_SCHEMA_DOCUMENTATION.md) contains a well-architected SQL schema covering 11 physical tables. However, **no physical `.sql` migration files exist anywhere in the repository**.
- **Prepared Tables (Ready for Migration Conversion):**
  1. `clients` (Top-level subscribing organisations)
  2. `client_legal_entities` (Statutory employer with PAN, TAN, GSTIN, PF/ESIC registration codes)
  3. `client_policies` (20 operational, attendance, leave, and statutory policy parameters)
  4. `work_locations` (Authorized work sites with latitude, longitude, and geofence radius)
  5. `departments` (Organizational divisions)
  6. `employees` (Staff directory with employment status, fixed CTC, allowances, and bank accounts)
  7. `attendance_events` (Immutable raw punch telemetry logs)
  8. `daily_attendance_records` (Aggregated daily attendance ledger)
  9. `leave_balances` (Opening, credited, used, and closing leave entitlements)
  10. `leave_requests` (Employee applications with supervisor approval statuses)
  11. `attendance_corrections` (Missed punch regularisation requests)
  12. `payroll_runs` & `payroll_items` (Pay cycle headers and employee line items)
  13. `security_audit_logs` (Append-only compliance audit trail)
- **Required Migration Structure:**
  Initialize Supabase CLI and create versioned SQL migration files under `supabase/migrations/`:
  - `20261103000001_initial_schema.sql` (Tables, types, foreign keys, unique constraints)
  - `20261103000002_row_level_security.sql` (RLS policies for multi-tenancy)
  - `20261103000003_triggers_and_functions.sql` (Automated `updated_at`, immutable event logs)
  - `20261103000004_seed_demo_data.sql` (Baseline data for Suman Technologies and Maha India)

---

### 2.3. Row Level Security (RLS) Policy Specifications
- **Current State:**
  Zero RLS policies are active because no database is running.
- **Architectural Policy Specifications Prepared:**
  Multi-tenancy requires policies that enforce tenant isolation at the database layer regardless of frontend code:

  ```sql
  -- Enable RLS on all tenant-scoped tables
  ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
  ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE daily_attendance_records ENABLE ROW LEVEL SECURITY;
  ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;

  -- 1. Super Admin: Global access
  CREATE POLICY super_admin_all ON employees
    FOR ALL TO authenticated
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

  -- 2. Client Admin: Scoped strictly to their own client_id
  CREATE POLICY client_admin_tenant ON employees
    FOR ALL TO authenticated
    USING (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'client_admin'
      AND client_id = (auth.jwt() -> 'app_metadata' ->> 'client_id')::uuid
    );

  -- 3. Employee: Scoped strictly to their own record
  CREATE POLICY employee_self_read ON employees
    FOR SELECT TO authenticated
    USING (
      id = (auth.jwt() -> 'app_metadata' ->> 'employee_id')::uuid
    );

  -- 4. Employee: Access only their own attendance events
  CREATE POLICY employee_attendance_self ON attendance_events
    FOR ALL TO authenticated
    USING (
      employee_id = (auth.jwt() -> 'app_metadata' ->> 'employee_id')::uuid
    );

  -- 5. Employee: Access only their own payslips
  CREATE POLICY employee_payslip_self ON payroll_items
    FOR SELECT TO authenticated
    USING (
      employee_id = (auth.jwt() -> 'app_metadata' ->> 'employee_id')::uuid
    );
  ```

---

### 2.4. Authentication (GoTrue) & JWT Claims Mapping
- **Current State:**
  `AuthContext.tsx` stores arbitrary user objects in `localStorage`. There is no JWT token, no password hashing, and no interaction with Supabase Auth.
- **Target Integration Architecture:**
  - When an employee or admin logs in via `supabase.auth.signInWithPassword({ email, password })`, Supabase returns a signed JWT.
  - Custom JWT claims must be injected via a database trigger on `auth.users` or using Supabase custom claims:
    - `app_metadata.role`: `'super_admin' | 'client_admin' | 'employee'`
    - `app_metadata.client_id`: UUID of assigned organization
    - `app_metadata.employee_id`: UUID of linked employee record
  - This allows PostgreSQL RLS to instantly evaluate permissions without additional database queries.

---

### 2.5. Storage Buckets & Edge Functions
- **Current State:**
  - Zero storage buckets exist.
  - Zero Edge Functions exist.
- **Required Storage Buckets:**
  1. `avatars` (Public read, authenticated upload for employee profile headshots)
  2. `payslips` (Private, signed URLs only, for Form XIX PDF salary slips)
  3. `compliance-docs` (Private, client admin only, for legal entity registrations and statutory challans)
- **Required Supabase Edge Functions:**
  1. `generate-payslip-pdf`: Accepts `payroll_item_id`, fetches statutory details, renders PDF via headless engine, saves to `payslips` bucket, and returns an expiring signed URL.
  2. `validate-geofence-punch`: Accepts GPS coordinates and device metadata, verifies coordinate distance on the server, and inserts into `attendance_events`.
  3. `lock-payroll-cycle`: Executes atomic payroll locking, computes statutory batch totals, and freezes monthly records.

---

## 3. Component Migration Readiness Summary

| Application Layer | Ready to Connect? | Refactoring Required |
|---|:---:|---|
| **Frontend UI Screens (29 Screens)** | **YES** | Minimal. Views are already structured to accept props and display tabular data. |
| **React Router (`App.tsx`)** | **YES** | Needs `<ProtectedRoute allowedRoles={[...]}>` wrapper components added. |
| **Context Providers** | **NEEDS WORK** | `AuthContext` and `WorkspaceContext` must replace `localStorage` with `supabase.auth` session listeners. |
| **Data Store (`store.ts`)** | **MAJOR WORK** | Must be refactored from synchronous in-memory array operations to asynchronous Supabase queries (`async / await`). |
| **Backend Database** | **PENDING SETUP** | Needs Supabase project provisioning and execution of SQL migrations. |
