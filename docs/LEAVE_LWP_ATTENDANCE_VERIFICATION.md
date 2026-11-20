# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE WITHOUT PAY (LWP) & ATTENDANCE INTEGRITY VERIFICATION

**Document Version:** 1.0.0  
**Milestone:** 2.4D Verification Gate  
**Target Files:** `src/services/leaveService.ts`, `src/services/attendanceService.ts`, `src/app/workspace/AttendanceCommandCenter.tsx`  
**Database Tables:** `public.leave_requests`, `public.leave_balances`, `public.daily_attendance_records`, `public.attendance_events`  

---

### 1. Executive Summary & Core Conflict

In workforce management systems, accurate attendance classification is the foundational input for payroll computation. When an employee is away from work, the system must clearly distinguish between:
1. **Approved Paid Leave (PL, CL, SL):** Deducted from leave balance, 100% payable in payroll.
2. **Approved Unpaid Leave (LWP):** Zero balance deduction, causes proportional salary cut in payroll.
3. **Scheduled Rest Days (Weekly Offs):** Non-working days, payable based on client wage policy.
4. **Declared Public/Company Holidays:** Non-working days, 100% payable.
5. **Unauthorized Absence (Truancy):** Missing punches without approved leave, causes salary deduction and disciplinary notice.

This audit reveals that **the integration between Leave Management and the Attendance Muster is fundamentally disconnected**, creating a critical false-absenteeism hazard that makes the application unsafe for direct payroll processing.

---

### 2. LWP vs Paid Leave Lifecycle Verification

The table below summarizes the operational behavior of each leave category:

| Lifecycle Action | Privilege Leave (PL) | Casual Leave (CL) | Sick Leave (SL) | Leave Without Pay (LWP) | Verification Status |
|---|:---:|:---:|:---:|:---:|:---:|
| **Balance Requirement at Submission** | Requires $\ge \text{totalDays}$ | Requires $\ge \text{totalDays}$ | Requires $\ge \text{totalDays}$ | **Exempt** (No balance required) | **PASS** |
| **Pending Request Balance Impact** | $\pm 0$ (Zero deduction) | $\pm 0$ (Zero deduction) | $\pm 0$ (Zero deduction) | $\pm 0$ | **PASS** |
| **Approved Request Balance Impact** | $-\text{totalDays}$ from PL | $-\text{totalDays}$ from CL | $-\text{totalDays}$ from SL | **$\pm 0$ (Zero deduction)** | **PASS** |
| **Rejected / Cancelled Impact** | $\pm 0$ (Zero deduction) | $\pm 0$ (Zero deduction) | $\pm 0$ (Zero deduction) | $\pm 0$ | **PASS** |
| **Status in `leave_requests`** | `PL` | `CL` | `SL` | `LWP` | **PASS** |
| **Status in `daily_attendance_records`** | `PAID_LEAVE` | `PAID_LEAVE` | `PAID_LEAVE` | **NOT SUPPORTED (CHECK Error)** | **FAIL (Defect)** |
| **Payroll Identifiability** | Counted as Paid | Counted as Paid | Counted as Paid | **Ambiguous (Treated as Absent)** | **FAIL (Defect)** |

---

### 3. Critical Defect: Database Check Constraint Excludes LWP

In `supabase/migrations/20261103000005_attendance_and_regularisations.sql`, the schema for `public.daily_attendance_records` is defined as:

```sql
CREATE TABLE IF NOT EXISTS daily_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time VARCHAR(20),
    check_out_time VARCHAR(20),
    total_hours NUMERIC(4,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY')
    ),
    location_name VARCHAR(255),
    is_regularised BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_emp_attendance_date UNIQUE (employee_id, date)
);
```

#### The Conflict:
1. `daily_attendance_records.status` ONLY permits: `'PRESENT'`, `'ABSENT'`, `'HALF_DAY'`, `'PAID_LEAVE'`, `'WEEKLY_OFF'`, `'HOLIDAY'`.
2. There is **NO `'UNPAID_LEAVE'` or `'LWP'` status** in PostgreSQL!
3. Notice `src/types/index.ts` line 187:
   ```typescript
   export interface DailyAttendanceRecord {
     ...
     status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'WEEKLY_OFF' | 'HOLIDAY';
   }
   ```
   The TypeScript frontend declared `UNPAID_LEAVE`, but the physical database rejects it!
4. If an approved LWP record is saved as `'PAID_LEAVE'`, it is paid in full (financial loss to client).
5. If it is saved as `'ABSENT'`, it is indistinguishable from unexcused truancy.
6. Furthermore, `daily_attendance_records` has **no foreign key column** to `leave_requests(id)`.

---

### 4. Critical Defect: Absence of Automatic Muster Overlay

#### The Code Reality:
1. **`leaveService.reviewLeaveRequest()` (lines 423–462):**
   When a manager approves a leave request:
   - Updates `leave_requests`.
   - Updates `leave_balances`.
   - **DOES NOT write or insert into `daily_attendance_records`.**
2. **`AttendanceCommandCenter.tsx` (lines 66–95):**
   ```typescript
   const [deptRes, locRes, polRes, empRes, corrRes] = await Promise.all([
     policyService.getDepartments(...),
     policyService.getWorkLocations(...),
     policyService.getClientPolicy(...),
     employeeService.getEmployees(...),
     attendanceService.getRegularisationRequests(...),
   ]);
   const attRes = await attendanceService.getDailyAttendance({ clientId, date }, callerScope);
   ```
   `AttendanceCommandCenter` **never queries `leave_requests`**.
3. **Metric Calculation in `AttendanceCommandCenter.tsx` (lines 136–140):**
   ```typescript
   const presentCount = records.filter(r => r.status === 'PRESENT').length;
   const halfDayCount = records.filter(r => r.status === 'HALF_DAY').length;
   const leaveCount = records.filter(r => r.status === 'PAID_LEAVE').length;
   const totalRoster = employees.length > 0 ? employees.length : records.length;
   const absentCount = Math.max(0, totalRoster - (presentCount + halfDayCount + leaveCount));
   ```
   Since `reviewLeaveRequest` never inserted a `daily_attendance_records` row, `leaveCount` evaluates to **0**.
   The employee on approved leave is deducted from `totalRoster` and counted in `absentCount`!
4. **UI Banner:**
   In line 241, `absentCount` displays:
   ```tsx
   <div className="text-[10px] text-on-surface-variant mt-0.5">Triggers LWP Deduction</div>
   ```
   **Every employee on approved paid leave is reported to managers as absent and flagged for an LWP pay cut!**

---

### 5. Weekly Off and Holiday Distortion

In `AttendanceCommandCenter.tsx`, `absentCount` is computed purely as `totalRoster - (present + halfDay + leave)`.
- If a manager opens the dashboard on a **Sunday** or on **Diwali**, no biometric punches exist.
- Since Sunday is not in `records`, `absentCount = totalRoster`.
- The entire workforce of 500 employees is shown as **100% ABSENT ("Triggers LWP Deduction")**!
- The system fails to evaluate `client_policies.weekly_off_days` or `statutory_holidays` when aggregating facility attendance metrics.

---

### 6. Raw Attendance Events Immutability Audit

- In `supabase/migrations/20261103000010_database_triggers_and_guards.sql`, trigger `trg_guard_attendance_events_immutability` is installed on `attendance_events`.
- Code inspection confirmed:
  - Approved leaves do **NOT** fabricate artificial clock-in/out records in `attendance_events`.
  - Raw telemetry events remain 100% immutable and append-only.
  - This aspect of the system complies with statutory biometric audit guidelines.

---

### 7. Proposed Database & Architectural Remediation

> [!IMPORTANT]
> **GOVERNANCE NOTICE: DO NOT EXECUTE WITHOUT APPROVAL**  
> Under Strict Rule 1 of Milestone 2.4D instructions, the proposed SQL below is documented for architectural review and explicit stakeholder approval. It has NOT been applied to the live database.

```sql
-- ==============================================================================
-- PROPOSED MIGRATION: 20261114000003_add_lwp_status_and_leave_fk_to_attendance.sql
-- Status: PENDING EXPLICIT APPROVAL (DO NOT EXECUTE)
-- ==============================================================================

-- 1. Modify CHECK constraint on daily_attendance_records to support UNPAID_LEAVE / LWP
ALTER TABLE public.daily_attendance_records 
DROP CONSTRAINT IF EXISTS daily_attendance_records_status_check;

ALTER TABLE public.daily_attendance_records
ADD CONSTRAINT daily_attendance_records_status_check
CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'));

-- 2. Add foreign key link to leave_requests to ensure audit traceability
ALTER TABLE public.daily_attendance_records
ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_attendance_leave ON public.daily_attendance_records(leave_request_id);

-- 3. Create Trigger or RPC hook to synchronize approved leave into daily_attendance_records
CREATE OR REPLACE FUNCTION public.sync_approved_leave_to_muster()
RETURNS TRIGGER AS $$
DECLARE
    v_curr_date DATE;
    v_target_status VARCHAR(30);
BEGIN
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
        v_target_status := CASE WHEN NEW.leave_type = 'LWP' THEN 'UNPAID_LEAVE' ELSE 'PAID_LEAVE' END;
        
        v_curr_date := NEW.start_date;
        WHILE v_curr_date <= NEW.end_date LOOP
            INSERT INTO public.daily_attendance_records (
                client_id,
                employee_id,
                date,
                status,
                leave_request_id,
                total_hours,
                location_name,
                is_regularised
            ) VALUES (
                NEW.client_id,
                NEW.employee_id,
                v_curr_date,
                v_target_status,
                NEW.id,
                0,
                'Approved Leave',
                FALSE
            )
            ON CONFLICT (employee_id, date) DO UPDATE
            SET status = EXCLUDED.status,
                leave_request_id = EXCLUDED.leave_request_id,
                updated_at = NOW();

            v_curr_date := v_curr_date + INTERVAL '1 day';
        END LOOP;
    ELSIF OLD.status = 'APPROVED' AND NEW.status IN ('CANCELLED', 'REJECTED') THEN
        -- Revert attendance records linked to this leave
        DELETE FROM public.daily_attendance_records
        WHERE leave_request_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_approved_leave_to_muster
AFTER UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_approved_leave_to_muster();
```
