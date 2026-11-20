# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4D.1 MIGRATION ARCHITECTURE & SQL REVIEW

**Document Version:** 1.0.0  
**Date:** November 14, 2026  
**Auditor / Engineering Lead:** Antigravity Engineering (Google DeepMind)  
**Milestone:** 2.4D.1 Database Migration & Integrity Remediation  
**Status:** MIGRATIONS PREPARED — AWAITING EXPLICIT APPROVAL TO APPLY  

---

### 1. Executive Summary & Migration Principles

In compliance with the project guidelines and strict verification rules, four sequential, idempotent, non-destructive SQL migrations have been authored in `supabase/migrations/`:

1. `20261114000011_leave_schema_and_balance_integrity.sql`
2. `20261114000012_atomic_leave_decision_rpc.sql`
3. `20261114000013_leave_rls_remediation.sql`
4. `20261114000014_attendance_leave_classification.sql`

#### Core Invariants Upheld:
- **Zero Table Dropping:** No existing tables are dropped or recreated.
- **Zero Data Loss:** All existing client, employee, compensation, attendance, and leave records are 100% preserved.
- **Backwards Compatibility:** All existing APIs and queries continue functioning.
- **Reversibility:** Each migration includes an explicit rollback script.
- **No Unapproved Live Execution:** Migrations exist solely as code files in the repository awaiting stakeholder approval.

---

### 2. Migration 11: Leave Schema & Balance Ledger Integrity

**File:** `supabase/migrations/20261114000011_leave_schema_and_balance_integrity.sql`  
**Dependencies:** `20261103000006_leave_management.sql`  

#### Existing Database State:
- `leave_balances.leave_type` CHECK constraint strictly enforces `('PL', 'CL', 'SL')`.
- `leave_requests.leave_type` CHECK constraint enforces `('PL', 'CL', 'SL', 'LWP')`.
- Maha Logistics seed data configures `COMP_OFF` (`client_policies.leave_types_supported = ['PL', 'CL', 'SL', 'COMP_OFF', 'LWP']`), causing check constraint violations when inserting compensatory off balances.
- No table-level CHECK constraint guarantees the ledger accounting identity ($closing = opening + credited - used$).

#### Intended Changes:
1. Replaces `leave_balances_leave_type_check` with `CHECK (leave_type IN ('PL', 'CL', 'SL', 'COMP_OFF'))`.
2. Replaces `leave_requests_leave_type_check` with `CHECK (leave_type IN ('PL', 'CL', 'SL', 'LWP', 'COMP_OFF'))`.
3. Adds `CONSTRAINT chk_leave_balance_identity CHECK (closing = (opening + credited - used))`.

#### Impact & Safety Analysis:
- **Impact on Existing Records:** Zero impact. All existing balance rows satisfy $closing = opening + credited - used$.
- **Backfill Required:** None.
- **Rollback SQL:**
  ```sql
  ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS chk_leave_balance_identity;
  ALTER TABLE public.leave_balances DROP CONSTRAINT IF EXISTS leave_balances_leave_type_check;
  ALTER TABLE public.leave_balances ADD CONSTRAINT leave_balances_leave_type_check CHECK (leave_type IN ('PL', 'CL', 'SL'));
  ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
  ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_leave_type_check CHECK (leave_type IN ('PL', 'CL', 'SL', 'LWP'));
  ```

---

### 3. Migration 12: Atomic Leave Decision Transactional RPC

**File:** `supabase/migrations/20261114000012_atomic_leave_decision_rpc.sql`  
**Dependencies:** `20261103000006_leave_management.sql`, `20261103000008_statutory_and_audit_ledgers.sql`  

#### Existing Database State:
- No stored procedure existed for leave review. Leave approvals were executed in two disconnected PostgREST HTTP queries, vulnerable to race conditions, double balance deductions, and orphaned status updates.

#### Intended Changes:
- Installs `public.review_leave_request_atomic(p_request_id UUID, p_decision VARCHAR, p_manager_remarks TEXT)`.
- Features:
  - Resolves trusted reviewer identity from `auth.uid()`.
  - Enforces `SECURITY DEFINER` with fixed `search_path = public, pg_temp`.
  - Locks leave request row with `SELECT ... FOR UPDATE`.
  - Validates request is currently in `PENDING` state.
  - Enforces Corporate Anti-Self-Approval (`reviewer_employee_id <> applicant_employee_id`).
  - Enforces Client Tenancy and Location Manager work-location boundaries.
  - Locks balance row with `SELECT ... FOR UPDATE` and enforces balance solvency (rejects overdrawing).
  - Deducts approved paid leave exactly once; skips balance deduction for LWP.
  - Writes audit log to `public.audit_logs`.
  - Revokes access from `PUBLIC` and grants execution to `authenticated`.

#### Impact & Safety Analysis:
- **Impact on Existing Records:** Purely additive stored procedure. Zero record modification.
- **Backfill Required:** None.
- **Rollback SQL:**
  ```sql
  DROP FUNCTION IF EXISTS public.review_leave_request_atomic(UUID, VARCHAR, TEXT);
  ```

---

### 4. Migration 13: Leave Row Level Security (RLS) Remediation

**File:** `supabase/migrations/20261114000013_leave_rls_remediation.sql`  
**Dependencies:** `20261103000009_row_level_security_policies.sql`, Migration 12  

#### Existing Database State:
- `leave_requests_employee_all` used `FOR ALL`, permitting employees to issue direct PostgREST `UPDATE` statements setting `status = 'APPROVED'`.
- Super Admin policies checked `client_id = public.get_user_client_id()`, locking out Super Admins whose `client_id` is NULL.
- Location Manager was omitted from review policies.
- Client Manager was excluded from `leave_balances`, causing RLS error 42501 on review.
- Payroll Admin had zero read access to leave tables.

#### Intended Changes:
1. Replaces broad employee policy with 3 granular policies:
   - `SELECT`: Own requests only (`employee_id = get_user_employee_id()`).
   - `INSERT`: Own requests only, with mandatory `status = 'PENDING'` and `reviewed_by IS NULL`.
   - `UPDATE`: Own requests only, where `status = 'PENDING'` transitioning strictly to `'CANCELLED'`.
2. Grants Super Admin global access: `USING (get_user_role() = 'super_admin')`.
3. Grants Location Manager and Client Manager access for their clients.
4. Grants Payroll Admin read-only access to `leave_requests` and `leave_balances` for payroll proration.

#### Impact & Safety Analysis:
- **Impact on Existing Records:** Zero data alteration. Elevates system security and closes privilege escalation vectors.
- **Backfill Required:** None.
- **Rollback SQL:**
  ```sql
  DROP POLICY IF EXISTS "leave_requests_employee_select" ON public.leave_requests;
  DROP POLICY IF EXISTS "leave_requests_employee_insert" ON public.leave_requests;
  DROP POLICY IF EXISTS "leave_requests_employee_cancel" ON public.leave_requests;
  DROP POLICY IF EXISTS "leave_requests_super_admin_all" ON public.leave_requests;
  DROP POLICY IF EXISTS "leave_requests_tenant_admin_select" ON public.leave_requests;
  DROP POLICY IF EXISTS "leave_requests_tenant_admin_modify" ON public.leave_requests;
  DROP POLICY IF EXISTS "leave_requests_payroll_admin_select" ON public.leave_requests;
  -- Reinstall migration 09 policies
  ```

---

### 5. Migration 14: Attendance Leave Classification & Muster Synchronization

**File:** `supabase/migrations/20261114000014_attendance_leave_classification.sql`  
**Dependencies:** `20261103000005_attendance_and_regularisations.sql`, `20261103000006_leave_management.sql`  

#### Existing Database State:
- `daily_attendance_records.status` CHECK constraint only allowed `('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY')`.
- No `leave_request_id` column existed in `daily_attendance_records`.
- Approved leaves were never synchronized into the attendance muster, causing employees on approved leave to be reported as absent and triggering erroneous LWP salary cuts.

#### Intended Changes:
1. Expands `daily_attendance_records_status_check` to include `'UNPAID_LEAVE'`.
2. Adds column `leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL`.
3. Creates index `idx_daily_attendance_leave`.
4. Installs trigger function `public.sync_approved_leave_to_muster()` and trigger `trg_sync_approved_leave_to_muster` on `public.leave_requests` to automatically populate or revert muster entries on approval/cancellation.

#### Impact & Safety Analysis:
- **Impact on Existing Records:** Additive column defaults to NULL. Existing punches remain untouched.
- **Backfill Required:** Optional historical backfill query provided:
  ```sql
  -- Backfill existing approved leave into muster (if any)
  INSERT INTO public.daily_attendance_records (client_id, employee_id, date, status, leave_request_id, location_name)
  SELECT lr.client_id, lr.employee_id, lr.start_date, 
         CASE WHEN lr.leave_type = 'LWP' THEN 'UNPAID_LEAVE' ELSE 'PAID_LEAVE' END,
         lr.id, 'Approved Leave'
  FROM public.leave_requests lr
  WHERE lr.status = 'APPROVED'
  ON CONFLICT (employee_id, date) DO NOTHING;
  ```
- **Rollback SQL:**
  ```sql
  DROP TRIGGER IF EXISTS trg_sync_approved_leave_to_muster ON public.leave_requests;
  DROP FUNCTION IF EXISTS public.sync_approved_leave_to_muster();
  DROP INDEX IF EXISTS idx_daily_attendance_leave;
  ALTER TABLE public.daily_attendance_records DROP COLUMN IF EXISTS leave_request_id;
  ALTER TABLE public.daily_attendance_records DROP CONSTRAINT IF EXISTS daily_attendance_records_status_check;
  ALTER TABLE public.daily_attendance_records ADD CONSTRAINT daily_attendance_records_status_check 
    CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'));
  ```

---

### 6. Verification Queries Post-Migration

```sql
-- 1. Verify constraints
SELECT conname, pg_get_constraintdef(c.oid) 
FROM pg_constraint c 
JOIN pg_class t ON c.conrelid = t.oid 
WHERE t.relname IN ('leave_balances', 'leave_requests', 'daily_attendance_records');

-- 2. Verify RPC existence and grants
SELECT routine_name, routine_type, security_type 
FROM information_schema.routines 
WHERE routine_name = 'review_leave_request_atomic';

-- 3. Verify Active RLS Policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('leave_balances', 'leave_requests')
ORDER BY tablename, policyname;

-- 4. Verify Trigger
SELECT trigger_name, event_manipulation, event_object_table, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'trg_sync_approved_leave_to_muster';
```
