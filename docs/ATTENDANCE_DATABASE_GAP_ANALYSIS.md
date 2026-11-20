# AVENCIS WORKFORCE MANAGEMENT (WFM)
## MILESTONE 2.4C: ATTENDANCE DATABASE GAP ANALYSIS

**Author:** Antigravity Integration Agent  
**Date:** 2026-11-14  
**Status:** COMPLETE & DOCUMENTED  

---

### 1. Objective

This analysis audits the physical schema defined in [migration 05](file:///c:/Avencis%20Management/supabase/migrations/20261103000005_attendance_and_regularisations.sql) (`attendance_events`, `daily_attendance_records`, `attendance_corrections`) against frontend and operational requirements, documenting architectural nuances, constraints, and recommendations without modifying production migrations.

---

### 2. Schema Alignment Matrix

| Database Table | Schema Column | Operational Purpose | Frontend/Service Alignment | Status / Finding |
|---|---|---|---|:---:|
| `attendance_events` | `id UUID` | Primary key | Populated by `gen_random_uuid()` or client UUID | ALIGNED |
| `attendance_events` | `client_id UUID` | Multi-tenant boundary | Mandated in all queries & inserts | ALIGNED |
| `attendance_events` | `employee_id UUID` | Staff identification | Scoped to authenticated employee | ALIGNED |
| `attendance_events` | `event_type VARCHAR(20)` | `CHECK_IN` or `CHECK_OUT` | Validated by TypeScript union type | ALIGNED |
| `attendance_events` | `timestamp TIMESTAMPTZ` | Authoritative server punch time | Defaults to `NOW()` | ALIGNED |
| `attendance_events` | `latitude NUMERIC(10,8)` | WGS84 GPS latitude | Validated between -90 and +90 | ALIGNED |
| `attendance_events` | `longitude NUMERIC(11,8)` | WGS84 GPS longitude | Validated between -180 and +180 | ALIGNED |
| `attendance_events` | `accuracy_meters NUMERIC(6,2)`| GPS radius accuracy | Captured from browser `coords.accuracy` | ALIGNED |
| `attendance_events` | `geofence_status VARCHAR(50)` | Verification flag | `'WITHIN_GEOFENCE'` or `'OUT_OF_BOUNDS'` | ALIGNED |
| `attendance_events` | `is_suspicious BOOLEAN` | Security audit signal | `true` if accuracy > 100m or out-of-bounds | ALIGNED |
| `daily_attendance_records` | `unq_emp_attendance_date` | Unique composite constraint | `UNIQUE (employee_id, date)` | ALIGNED |
| `daily_attendance_records` | `check_in_time TIME` | Shift start time | Extracted from first punch of date | ALIGNED |
| `daily_attendance_records` | `check_out_time TIME` | Shift end time | Extracted from final punch of date | ALIGNED |
| `daily_attendance_records` | `total_hours NUMERIC(4,2)` | Effective shift duration | Range: 0.00 to 99.99 (max shift 24.00h) | ALIGNED |
| `attendance_corrections` | `status VARCHAR(30)` | Approval workflow | `PENDING`, `APPROVED`, `REJECTED` | ALIGNED |

---

### 3. Identified Database Constraints & Gaps

#### Gap 1: Overnight Shift Day Attribution Boundary
- **Current Schema:** `daily_attendance_records` enforces `CONSTRAINT unq_emp_attendance_date UNIQUE (employee_id, date)`.
- **Finding:** A shift starting at `10:00 PM` on Day 1 and concluding at `06:00 AM` on Day 2 requires explicit day attribution based on `client_policies.overnight_shift_attribution` (`'shift_start_date'` vs `'shift_end_date'`).
- **Resolution Applied:** The service layer groups overnight punches by the shift start date when attribution is set to `shift_start_date`.

#### Gap 2: In-Memory vs. Database Time Format
- **Current Behavior:** In PostgreSQL, `check_in_time` is stored as `TIME WITHOUT TIME ZONE` (e.g. `'09:00:00'`), whereas the existing mock store used 12-hour AM/PM strings (e.g. `'09:00 AM'`).
- **Resolution Applied:** Implemented bidirectional time parsing in `attendanceService.calculateWorkingHours()` and UI formatting helpers to seamlessly handle both representations.

#### Gap 3: Append-Only Trigger Exception Handling
- **Database Trigger:** `trg_guard_attendance_events_immutability` raises:
  `RAISE EXCEPTION 'AUDIT SECURITY VIOLATION: Raw attendance events are immutable...'`
- **Frontend Safeguard:** The frontend exposes zero UI actions or endpoints to edit or delete rows in `attendance_events`. Correction requests must strictly pass through `attendance_corrections`.
