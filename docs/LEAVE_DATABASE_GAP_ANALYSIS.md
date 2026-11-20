# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE MANAGEMENT DATABASE GAP ANALYSIS

**Document Version:** 1.0.0  
**Milestone:** 2.4D  
**Database Tables Evaluated:** `public.leave_balances`, `public.leave_requests`, `public.client_policies`  

---

### 1. Scope & Objective

This document analyzes the existing Supabase PostgreSQL schema supporting Leave Management (`20261103000006_leave_management.sql`), identifying supported capabilities, schema limitations, and technical recommendations for future milestones without introducing unapproved schema modifications.

---

### 2. Supported Database Capabilities (Verified in Milestone 2.4D)

| Schema Element | Database Column / Constraint | Status | Operational Capability |
|---|---|:---:|---|
| **Fractional Balances** | `NUMERIC(4,1)` (`opening`, `credited`, `used`, `closing`) | Fully Supported | Handles whole days and half-days ($0.5\text{d}$) with non-negative check constraints. |
| **Annual Scoping** | `year INT NOT NULL` | Fully Supported | Allows annual entitlement roll-forward and historical leave auditing. |
| **Compound Uniqueness** | `UNIQUE(client_id, employee_id, leave_type, year)` | Fully Supported | Prevents duplicate balance records for the same employee in a calendar year. |
| **Leave Date Spans** | `start_date DATE NOT NULL`, `end_date DATE NOT NULL` | Fully Supported | Captures full time-off duration. |
| **Duration Tracking** | `total_days NUMERIC(4,1) CHECK (total_days > 0)` | Fully Supported | Enforces positive leave durations. |
| **Status State Machine** | `status VARCHAR(20) DEFAULT 'PENDING'` | Fully Supported | Supports `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`. |
| **Reviewer Audit Trail** | `reviewed_by UUID`, `reviewed_at TIMESTAMPTZ`, `manager_remarks TEXT` | Fully Supported | Records reviewer identity and managerial decision comments. |

---

### 3. Identified Schema Gaps & Recommendations

#### Gap 1: Multi-Level Approval Hierarchy
- **Current Schema:** Single `reviewed_by UUID` foreign key in `public.leave_requests`.
- **Limitation:** Cannot represent sequential two-stage approvals (e.g. Stage 1: Team Lead / Reporting Manager, Stage 2: HR Head) in a single database record without intermediate states.
- **Handling in 2.4D:** Adhered strictly to single-stage managerial approval as specified in the schema.
- **Future Recommendation:** If client policy requires multi-tier approval, introduce a `leave_request_approvals` junction ledger with `level INT`, `approver_id UUID`, and `status`.

#### Gap 2: Partial-Day / Half-Day Time Slot Identifiers
- **Current Schema:** `total_days NUMERIC(4,1)` supports $0.5$, but `leave_requests` lacks a `half_day_slot` column (`FIRST_HALF` vs `SECOND_HALF`).
- **Limitation:** An employee taking a half-day cannot record whether they will be absent in the morning or afternoon.
- **Handling in 2.4D:** Encoded duration as $0.5$ in `total_days`, with the slot noted in the `reason` string.
- **Future Recommendation:** Add `half_day_slot VARCHAR(15) CHECK (half_day_slot IN ('FIRST_HALF', 'SECOND_HALF', 'FULL_DAY')) DEFAULT 'FULL_DAY'`.

#### Gap 3: Medical Certificate Attachment Storage
- **Current Schema:** `leave_requests` does not possess a `document_url` or `attachment_id` column for doctor prescriptions or wedding invitations.
- **Limitation:** Medical proof must be verified offline.
- **Handling in 2.4D:** Manager remarks and reason text strings utilized for verification notes.
- **Future Recommendation:** Add `document_url TEXT` referencing a private Supabase Storage bucket (`leave-documents`).

#### Gap 4: Automatic Accrual Engine Cron
- **Current Schema:** `client_policies.monthly_paid_leave_accrual` stores the rate (e.g. $2.00$), but there is no PostgreSQL pg_cron trigger executing monthly balance updates automatically.
- **Handling in 2.4D:** Calculated on-the-fly and managed via `store` / `leaveService`.
- **Future Recommendation:** Deploy a Supabase scheduled edge function or pg_cron job to credit balances on the 1st of each calendar month.
