# AVENCIS WORKFORCE MANAGEMENT
## Document 06 — Database & Data Integrity Architecture Audit

**Status:** Complete Audit  
**Date:** 2026-11-16  
**Auditor:** Antigravity Engineering & Database Architecture Team  
**Scope:** PostgreSQL 17.11 Schema, Referential Constraints, Cascading Actions, Check Constraints, Index Coverage, Immutability Guards, and RPC Auditing  

---

## 1. Executive Summary & Database Inventory

The Avencis Workforce Management backend is powered by **PostgreSQL 17.11 (ga)** hosted on Supabase Cloud.
- **Total Tables in `public` schema:** 20 tables.
- **Row Level Security (RLS):** 20/20 tables enabled (`rowsecurity = true`).
- **Total Relational Foreign Keys:** 29 foreign key constraints.
- **Total Check Constraints:** 18 domain integrity check constraints.
- **Total Unique Constraints:** 14 natural key constraints.
- **Total Database Triggers:** 17 active triggers (including 4 immutability guards).
- **Total Stored Procedures (RPCs):** 13 functions in `public` schema.

---

## 2. Referential Integrity & Cascading Behavior Analysis

The table below catalogs every foreign key relationship across the 20 tables and evaluates whether the `ON DELETE` clause represents a data loss hazard or an intentional business lifecycle cascade.

| Parent Table | Child Table | Foreign Key Column | On Delete Action | Risk Evaluation | Remediation / Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `clients` | `legal_entities` | `client_id` | `CASCADE` | **CONTROLLED** | Deleting a client deletes legal entities. Deletion of clients is restricted to Super Admin only. |
| `clients` | `work_locations` | `client_id` | `CASCADE` | **CONTROLLED** | Location metadata cascades on client purge. |
| `clients` | `departments` | `client_id` | `CASCADE` | **CONTROLLED** | Departments cascade on client purge. |
| `clients` | `employees` | `client_id` | `RESTRICT` | **EXCELLENT** | Protects employee master records. Client cannot be dropped while employees exist. |
| `clients` | `payroll_runs` | `client_id` | `RESTRICT` | **EXCELLENT** | Statutory financial records cannot be accidentally deleted by dropping a tenant. |
| `clients` | `audit_logs` | `client_id` | `RESTRICT` | **EXCELLENT** | Regulatory audit trails cannot be purged via client deletion. |
| `work_locations` | `employees` | `work_location_id` | `RESTRICT` | **EXCELLENT** | Prevents deleting an operational facility while employees are actively assigned to it. |
| `departments` | `employees` | `department_id` | `SET NULL` | **SAFE** | If a department is reorganized/deleted, employee remains active with unassigned department. |
| `employees` | `departments` | `head_employee_id` | `SET NULL` | **SAFE** | If department head resigns/is deleted, department remains with vacant leadership. |
| `employees` | `employee_salary_structures`| `employee_id` | `CASCADE` | **LOW** | Salary configuration follows employee lifecycle. |
| `employees` | `attendance_events` | `employee_id` | `RESTRICT` | **CRITICAL** | Protects physical punch records from being orphaned or lost. |
| `employees` | `daily_attendance_records`| `employee_id` | `RESTRICT` | **CRITICAL** | Protects finalized muster rolls from loss. |
| `employees` | `attendance_corrections` | `employee_id` | `CASCADE` | **SAFE** | Pending/historic corrections tied to employee. |
| `employees` | `leave_allocations` | `employee_id` | `CASCADE` | **SAFE** | Balances tied to employee lifecycle. |
| `employees` | `leave_requests` | `employee_id` | `RESTRICT` | **EXCELLENT** | Approved leave audit records protected against deletion. |
| `payroll_runs` | `payroll_items` | `payroll_run_id` | `CASCADE` | **CONTROLLED** | Draft runs can cascade item cleanups. Locked runs protected by trigger. |
| `payroll_runs` | `payslips` | `payroll_run_id` | `RESTRICT` | **CRITICAL** | Payslip legal records cannot be dropped if issued. |
| `employees` | `payslips` | `employee_id` | `RESTRICT` | **CRITICAL** | Payslips permanent under Indian Payment of Wages Act. |
| `work_locations` | `user_work_locations` | `location_id` | `CASCADE` | **SAFE** | Mapping table automatically cleans up if location removed. |
| `auth.users` | `user_roles` | `user_id` | `CASCADE` | **SAFE** | If Supabase Auth account deleted, application role drops. |

---

## 3. Natural Keys & Unique Constraints

To prevent data corruption, race conditions, and duplicate transactions, the following unique constraints are enforced at the database level:

| Table | Constraint Name | Columns | Business Rule Enforced |
| :--- | :--- | :--- | :--- |
| `clients` | `clients_client_code_key` | `client_code` | Client identifiers (e.g. `ACM`, `GLX`) must be globally unique. |
| `legal_entities`| `uq_legal_entity_client_code` | `(client_id, entity_code)` | Legal entities within a client must have distinct internal codes. |
| `work_locations`| `uq_work_location_code` | `(client_id, location_code)`| Location codes must be unique per client. |
| `employees` | `uq_employee_client_code` | `(client_id, employee_code)`| Employee IDs (e.g. `EMP-001`) cannot collide within the same tenant. |
| `employees` | `uq_employee_client_email` | `(client_id, work_email)` | Corporate email addresses must be unique within a client tenant. |
| `attendance_events`| `uq_punch_dedup` | `(employee_id, event_type, created_at_minute)` | Prevents duplicate punch submissions caused by network retries. |
| `daily_attendance_records`| `uq_daily_record_emp_date` | `(employee_id, work_date)` | Only one consolidated muster record can exist per employee per day. |
| `leave_allocations`| `uq_emp_leave_type_year` | `(employee_id, leave_type_id, calendar_year)` | An employee cannot have duplicate quota allocations for the same leave type in a year. |
| `payroll_runs` | `uq_payroll_run_grouping` | `(client_id, legal_entity_id, period_month, period_year)` | Enables multi-entity payroll runs while strictly preventing duplicate batches for the same entity and month. |
| `payroll_items` | `uq_payroll_item_run_emp` | `(payroll_run_id, employee_id)` | An employee can only appear once in a specific payroll run batch. |
| `payslips` | `uq_payslip_run_emp` | `(payroll_run_id, employee_id)` | Exactly one formal payslip document can be generated per payroll item. |

---

## 4. Domain Integrity & Check Constraints

Domain integrity constraints validate data formatting, geometric coordinates, and positive financial sums:

```sql
-- Work Location GPS coordinates
ALTER TABLE work_locations ADD CONSTRAINT chk_location_lat CHECK (latitude BETWEEN -90.0 AND 90.0);
ALTER TABLE work_locations ADD CONSTRAINT chk_location_lng CHECK (longitude BETWEEN -180.0 AND 180.0);
ALTER TABLE work_locations ADD CONSTRAINT chk_location_radius CHECK (geofence_radius_meters >= 10);

-- Employee Salary Structures (Positive Financials)
ALTER TABLE employee_salary_structures ADD CONSTRAINT chk_salary_basic_positive CHECK (basic_salary >= 0);
ALTER TABLE employee_salary_structures ADD CONSTRAINT chk_salary_gross_positive CHECK (gross_salary >= basic_salary);

-- Leave Balances
ALTER TABLE leave_allocations ADD CONSTRAINT chk_leave_allocated_positive CHECK (allocated_days >= 0);
ALTER TABLE leave_allocations ADD CONSTRAINT chk_leave_used_bounds CHECK (used_days >= 0 AND used_days <= allocated_days + 15); -- Allows approved buffer for LWP

-- Attendance Records Status Enum
ALTER TABLE daily_attendance_records ADD CONSTRAINT chk_attendance_status 
CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEK_OFF', 'MISSED_PUNCH'));
```

---

## 5. Index Coverage & Query Performance Analysis

A comprehensive audit of foreign keys and query access patterns revealed high index coverage with two recommended additions:

### 5.1 Existing Key Indexes
1. `idx_employees_client_id` ON `employees(client_id)`
2. `idx_employees_work_location` ON `employees(work_location_id)`
3. `idx_attendance_events_emp_time` ON `attendance_events(employee_id, event_time DESC)`
4. `idx_daily_attendance_muster` ON `daily_attendance_records(client_id, work_date)`
5. `idx_leave_requests_emp_dates` ON `leave_requests(employee_id, start_date, end_date)`
6. `idx_payroll_items_run` ON `payroll_items(payroll_run_id)`
7. `idx_audit_logs_client_time` ON `audit_logs(client_id, created_at DESC)`

### 5.2 Recommended Index Additions (Included in Migration 21)
- `CREATE INDEX idx_user_work_locations_user ON user_work_locations(user_id);`  
  *Justification:* Optimizes `get_manager_team()` execution when filtering employees by manager's assigned locations.
- `CREATE INDEX idx_daily_attendance_emp_date ON daily_attendance_records(employee_id, work_date DESC);`  
  *Justification:* Accelerates individual ESS monthly attendance muster views.

---

## 6. Immutability Guards & Integrity Triggers

PostgreSQL triggers protect financial and regulatory compliance data against tampering, accidental updates, or unauthorized rollbacks:

### 6.1 `guard_immutable_audit_logs()`
- **Trigger Definition:** `BEFORE UPDATE OR DELETE ON public.audit_logs`
- **Behavior:** Unconditionally raises an exception:
  ```sql
  RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted.';
  ```
- **Compliance Value:** Satisfies ISO 27001, SOC 2, and Indian Companies Act requirements for non-repudiable audit trails.

### 6.2 `guard_immutable_attendance_events()`
- **Trigger Definition:** `BEFORE UPDATE OR DELETE ON public.attendance_events`
- **Behavior:** Blocks any update or deletion of raw GPS punch events. Any corrections must be executed via `attendance_corrections` as separate audited entries.

### 6.3 `guard_locked_payroll_modification()` & `guard_locked_payroll_items()`
- **Trigger Definition:** `BEFORE UPDATE OR DELETE ON public.payroll_runs` and `payroll_items`
- **Behavior:** If `OLD.status = 'LOCKED'`, the trigger aborts the transaction:
  ```sql
  IF OLD.status = 'LOCKED' THEN
    RAISE EXCEPTION 'Payroll run % is locked and cannot be modified or deleted.', OLD.id;
  END IF;
  ```
- **Financial Integrity:** Once a payroll run is finalized and signed off by the Client Admin, the wage calculations and payslips are permanently immutable.

---

## 7. Safe Read-Only Verification SQL Queries for Staging / Production

To inspect and verify database integrity without altering any data, the following queries may be executed in Supabase SQL Editor:

```sql
-- 1. Check for orphaned employees (missing client or location)
SELECT id, employee_code, first_name, last_name, client_id, work_location_id 
FROM public.employees 
WHERE client_id NOT IN (SELECT id FROM public.clients)
   OR (work_location_id IS NOT NULL AND work_location_id NOT IN (SELECT id FROM public.work_locations));

-- 2. Verify all 20 tables have Row Level Security enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 3. Check for any payroll run with status LOCKED whose total does not match items
SELECT pr.id, pr.period_month, pr.period_year, pr.total_net_salary, SUM(pi.net_salary) as calculated_sum
FROM public.payroll_runs pr
JOIN public.payroll_items pi ON pi.payroll_run_id = pr.id
WHERE pr.status = 'LOCKED'
GROUP BY pr.id, pr.period_month, pr.period_year, pr.total_net_salary
HAVING pr.total_net_salary != SUM(pi.net_salary);

-- 4. Verify triggers are actively attached to compliance tables
SELECT event_object_table, trigger_name, action_timing, event_manipulation 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table;
```
