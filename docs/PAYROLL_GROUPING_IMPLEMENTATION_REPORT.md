# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E.1 — PAYROLL GROUPING ARCHITECTURE IMPLEMENTATION REPORT

**Author:** Antigravity Agent  
**Date:** November 15, 2026  
**Status:** PROPOSED & STAGED (PENDING USER EXECUTION APPROVAL)  
**Target Migration:** `supabase/migrations/20261115000019_payroll_grouping_multientity.sql`  

---

## 1. Executive Summary & Problem Analysis

In the baseline database schema established through Migrations 7 and 18, `payroll_runs` was bounded by a single-entity uniqueness constraint:
```sql
CONSTRAINT unq_client_period UNIQUE (client_id, period_month, period_year)
```

### The Architectural Conflict
In enterprise multi-entity operations, an organization client frequently operates multiple legal entities under a single enterprise umbrella (e.g., Parent Holdings, Technology Solutions Pvt Ltd, and Logistics Services LLP). Furthermore, organizations require distinct payroll processing models:
1. **Avencis-Managed Payroll (`AVENCIS_MANAGED`):** Avencis WFM operations team calculates, audits, and executes payroll as an outsourced/managed service or employer of record.
2. **Client-Managed Payroll (`SELF_MANAGED`):** The client's in-house HR and Payroll team executes calculations, approvals, and disbursement independently.
3. **Hybrid Processing (`HYBRID`):** Core staff handled by the client, contingent or contracted workforce managed by Avencis.

Under the legacy `unq_client_period` constraint:
- Calculating payroll for a second legal entity within the same client and pay cycle triggered an immediate PostgreSQL integrity violation: `23505: duplicate key value violates unique constraint "unq_client_period"`.
- Independent approval lifecycles were impossible: locking payroll for Entity A prematurely locked or blocked Entity B.
- Attendance regularisation gates could not be scoped to individual legal entities, resulting in artificial blockers across unrelated business divisions.

---

## 2. Existing Schema Audit & Baseline Verification

Prior to proposing schema modifications, a read-only catalog audit was conducted on the live Supabase database (`mlopgvkvzhwhkbewhefb.supabase.co`):

| Database Object | Target Table / Column | Verified State on Live Supabase | Impact Assessment |
| :--- | :--- | :--- | :--- |
| `public.payroll_runs` | Total Row Count | **0 rows** (`count(*) = 0`) | Safe to refactor constraints without row collisions. |
| `public.payroll_items` | Total Row Count | **0 rows** (`count(*) = 0`) | Zero child line items exist. |
| `public.payslips` | Total Row Count | **0 rows** (`count(*) = 0`) | Zero published payslips exist. |
| `public.payroll_runs` | `legal_entity_id` | Column exists (Nullable UUID FK) | Must be transitioned to `NOT NULL`. |
| `public.payroll_runs` | `unq_client_period` | Present in catalog | Must be dropped and replaced. |
| `public.generate_payroll_run` | RPC Function | Present from Migration 18 | Must be updated to target `legal_entity_id`. |

Because exactly 0 historical payroll rows exist in the live database, there is zero risk of data loss or foreign key orphaned record creation during migration.

---

## 3. Multi-Entity Data Architecture Design

### 3.1 Uniqueness Constraint Refactoring
The legacy constraint is dropped, and an authoritative 4-tuple composite constraint is established:
```sql
ALTER TABLE public.payroll_runs
DROP CONSTRAINT IF EXISTS unq_client_period;

ALTER TABLE public.payroll_runs
ADD CONSTRAINT unq_client_legal_entity_period
UNIQUE (client_id, legal_entity_id, period_month, period_year);
```

### 3.2 Explicit Payroll Processing Responsibility
To track statutory liability and operational ownership, a dedicated column is introduced:
```sql
ALTER TABLE public.payroll_runs
ADD COLUMN IF NOT EXISTS payroll_responsibility VARCHAR(20) NOT NULL DEFAULT 'SELF_MANAGED'
CHECK (payroll_responsibility IN ('SELF_MANAGED', 'AVENCIS_MANAGED', 'HYBRID'));
```

### 3.3 Target Performance Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_payroll_runs_legal_entity_period
ON public.payroll_runs(legal_entity_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_responsibility
ON public.payroll_runs(client_id, payroll_responsibility);
```

---

## 4. Preservation & Backfill Logic for Historical Records

Even though the live database currently contains 0 payroll runs, Migration 19 contains defensive backfill scripts to ensure backwards compatibility across development, staging, and demo environments:

```sql
-- 1. Backfill NULL legal_entity_id to Client Primary Legal Entity
UPDATE public.payroll_runs pr
SET legal_entity_id = (
    SELECT le.id
    FROM public.client_legal_entities le
    WHERE le.client_id = pr.client_id
    ORDER BY le.is_primary DESC, le.created_at ASC
    LIMIT 1
)
WHERE pr.legal_entity_id IS NULL;

-- 2. Enforce NOT NULL
ALTER TABLE public.payroll_runs
ALTER COLUMN legal_entity_id SET NOT NULL;

-- 3. Backfill payroll_responsibility from parent legal entity
UPDATE public.payroll_runs pr
SET payroll_responsibility = COALESCE(le.payroll_responsibility, 'SELF_MANAGED')
FROM public.client_legal_entities le
WHERE pr.legal_entity_id = le.id;
```

---

## 5. Transactional RPC Hardening (`generate_payroll_run`)

The authoritative database calculation function `generate_payroll_run` has been upgraded to support multi-entity isolation:

1. **Deterministic Run ID Composite:**
   ```sql
   v_run_id := 'payrun-' || p_client_id::text || '-' || v_target_legal_entity_id::text || '-' || p_period_month::text || '-' || p_period_year::text;
   ```
2. **Entity-Scoped Attendance Gate:**
   Only pending attendance regularisations belonging to employees of the *target legal entity* will gate the calculation:
   ```sql
   SELECT COUNT(*) INTO v_pending_corrections
   FROM public.attendance_corrections ac
   JOIN public.employees e ON ac.employee_id = e.id
   WHERE ac.client_id = p_client_id
     AND e.legal_entity_id = v_target_legal_entity_id
     AND ac.status = 'PENDING'
     AND ac.attendance_date BETWEEN v_start_date AND v_end_date;
   ```
3. **Strict Employee Ingestion Filtering:**
   Only active employees assigned to `v_target_legal_entity_id` are processed into the batch:
   ```sql
   FOR v_emp IN
       SELECT e.* FROM public.employees e
       WHERE e.client_id = p_client_id
         AND e.legal_entity_id = v_target_legal_entity_id
         AND e.status = 'ACTIVE'
         AND e.joining_date <= v_end_date
       ORDER BY e.employee_code ASC
   LOOP
   ```
4. **Idempotent Upsert Strategy:**
   ```sql
   ON CONFLICT (client_id, legal_entity_id, period_month, period_year) DO UPDATE SET
       payroll_responsibility = EXCLUDED.payroll_responsibility,
       status = 'under_review',
       processed_at = NOW(),
       policy_snapshot = EXCLUDED.policy_snapshot;
   ```

---

## 6. Migration File Staging & Approval Gate

The migration SQL has been authored and saved to:
`supabase/migrations/20261115000019_payroll_grouping_multientity.sql`

### STRICT GATE STATUS
- **Database Status:** STAGED ONLY. **NOT EXECUTED.**
- **User Gate:** This migration will only be executed upon explicit user directive in the Supabase SQL editor or via automated tooling with user permission.
- **Rollback Readiness:** Down-migration script verified:
  ```sql
  ALTER TABLE public.payroll_runs DROP CONSTRAINT IF EXISTS unq_client_legal_entity_period;
  ALTER TABLE public.payroll_runs ADD CONSTRAINT unq_client_period UNIQUE (client_id, period_month, period_year);
  ALTER TABLE public.payroll_runs DROP COLUMN IF EXISTS payroll_responsibility;
  ```

---

## 7. Next Steps
Upon review and authorization of Migration 19, the migration will be executed to complete the schema foundation for Milestone 2.4E.
