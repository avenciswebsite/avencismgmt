# AVENCIS WORKFORCE MANAGEMENT (WFM)
## EXPECTED DATABASE OBJECTS INVENTORY (MIGRATIONS 01 TO 10)

**Project:** Avencis ERP / Business Management Platform  
**Target Backend:** PostgreSQL 15+ / Supabase  
**Total Tables:** 20 Relational Tables  
**Total Functions:** 8 Functions (3 RBAC Helpers + 5 Trigger Guards)  
**Total Triggers:** 8 Triggers (4 Updated-at + 4 Security Guards)  
**Total RLS Policies:** 33 Security Policies  
**Status:** **AUTHORITATIVE OBJECT REFERENCE SPECIFICATION**  

---

## 1. Migration 01: Clients and Legal Entities
*File: `supabase/migrations/20261103000001_initial_schema_clients_and_entities.sql`*

### Extensions Installed:
* `uuid-ossp`
* `pgcrypto`

### Tables Created:
1. **`clients`** (10 columns):
   - `id` (UUID PK), `code` (VARCHAR 20 UNIQUE), `name` (VARCHAR 255), `industry` (VARCHAR 100), `status` (VARCHAR 30 CHECK), `contact_person` (VARCHAR 150), `contact_email` (VARCHAR 255), `contact_phone` (VARCHAR 30), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
2. **`client_legal_entities`** (14 columns):
   - `id` (UUID PK), `client_id` (UUID FK $\to$ `clients.id` ON DELETE CASCADE), `legal_name` (VARCHAR 255), `trade_name` (VARCHAR 255), `registration_type` (VARCHAR 50 CHECK), `registration_number` (VARCHAR 100), `pan` (VARCHAR 10), `tan` (VARCHAR 10), `gstin` (VARCHAR 15), `pf_establishment_code` (VARCHAR 50), `esic_registration_code` (VARCHAR 50), `registered_address` (TEXT), `payroll_responsibility` (VARCHAR 40 CHECK), `is_primary` (BOOLEAN), `created_at` (TIMESTAMPTZ).

### Constraints:
* `unq_client_pan` UNIQUE (`client_id`, `pan`) on `client_legal_entities`.
* `clients_code_key` UNIQUE (`code`) on `clients`.

### Performance Indexes:
* `idx_clients_status` ON `clients(status)`
* `idx_clients_code` ON `clients(code)`
* `idx_legal_entities_client` ON `client_legal_entities(client_id)`

### Data API Grants:
* `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`
* `ALTER DEFAULT PRIVILEGES` for future tables & sequences.
* `GRANT SELECT` to `anon`, `CRUD` to `authenticated`, `ALL` to `service_role` on both tables.

---

## 2. Migration 02: Locations, Departments & Policies
*File: `supabase/migrations/20261103000002_locations_departments_and_policies.sql`*

### Tables Created:
3. **`work_locations`** (10 columns):
   - `id` (UUID PK), `client_id` (UUID FK $\to$ `clients.id`), `name` (VARCHAR 255), `code` (VARCHAR 50), `address` (TEXT), `state` (VARCHAR 100), `latitude` (DOUBLE PRECISION), `longitude` (DOUBLE PRECISION), `radius_meters` (INT CHECK 20-5000), `active_headcount` (INT), `created_at` (TIMESTAMPTZ).
4. **`departments`** (6 columns):
   - `id` (UUID PK), `client_id` (UUID FK $\to$ `clients.id`), `name` (VARCHAR 150), `code` (VARCHAR 50), `head_employee_id` (UUID FK $\to$ `employees.id`), `created_at` (TIMESTAMPTZ).
5. **`client_policies`** (30 columns):
   - `id` (UUID PK), `client_id` (UUID FK $\to$ `clients.id` UNIQUE), `is_configured` (BOOLEAN), `overtime_method` (CHECK), `overtime_rate` (NUMERIC 4,2), `late_grace_minutes` (INT), `late_penalty_rule` (CHECK), `overnight_shift_attribution` (CHECK), `standard_working_hours` (NUMERIC 4,2), `half_day_hours` (NUMERIC 4,2), `weekly_off_days` (TEXT[]), `attendance_tracking_mode` (CHECK), `require_gps` (BOOLEAN), `require_selfie` (BOOLEAN), `enforce_strict_geofence` (BOOLEAN), `leave_types_supported` (TEXT[]), `min_service_days_for_leave` (INT), `monthly_paid_leave_accrual` (NUMERIC 4,2), `max_carry_forward` (INT), `allow_leave_encashment` (BOOLEAN), `unpaid_leave_deduction_formula` (VARCHAR 40), `salary_divisor` (CHECK '26','30','calendar_days'), `pf_enabled` (BOOLEAN), `pf_employee_percent` (NUMERIC 4,2), `pf_employer_percent` (NUMERIC 4,2), `esic_enabled` (BOOLEAN), `esic_employee_percent` (NUMERIC 4,2), `esic_employer_percent` (NUMERIC 4,2), `pt_enabled` (BOOLEAN), `tds_enabled` (BOOLEAN), `updated_at` (TIMESTAMPTZ), `updated_by` (VARCHAR 150).

### Constraints:
* `unq_client_dept_code` UNIQUE (`client_id`, `code`) on `departments`.
* Unique constraint on `client_policies(client_id)`.

### Performance Indexes:
* `idx_work_locations_client` ON `work_locations(client_id)`
* `idx_departments_client` ON `departments(client_id)`
* `idx_policies_client` ON `client_policies(client_id)`

---

## 3. Migration 03: Auth Profiles & RBAC
*File: `supabase/migrations/20261103000003_auth_profiles_and_rbac.sql`*

### Tables Created:
6. **`user_profiles`** (10 columns):
   - `id` (UUID PK $\to$ `auth.users.id` ON DELETE CASCADE), `email` (VARCHAR 255 UNIQUE), `full_name` (VARCHAR 150), `role` (CHECK super_admin, hr_admin, payroll_admin, client_admin, client_manager, location_manager, employee), `client_id` (UUID FK $\to$ `clients.id`), `employee_id` (UUID FK $\to$ `employees.id`), `is_active` (BOOLEAN), `last_login_at` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).

### Helper Functions (in `public` schema):
* `public.get_user_role() RETURNS text` (SECURITY DEFINER)
* `public.get_user_client_id() RETURNS uuid` (SECURITY DEFINER)
* `public.get_user_employee_id() RETURNS uuid` (SECURITY DEFINER)

### Indexes:
* `idx_user_profiles_role` ON `user_profiles(role)`
* `idx_user_profiles_client` ON `user_profiles(client_id)`
* `idx_user_profiles_employee` ON `user_profiles(employee_id)`

---

## 4. Migration 04: Employees & Compensation
*File: `supabase/migrations/20261103000004_employees_and_compensation.sql`*

### Tables Created:
7. **`employees`** (20 columns):
   - `id` (UUID PK), `client_id` (UUID FK), `legal_entity_id` (UUID FK), `work_location_id` (UUID FK), `department_id` (UUID FK), `employee_code` (VARCHAR 50), `first_name` (VARCHAR 100), `last_name` (VARCHAR 100), `email` (VARCHAR 255), `mobile` (VARCHAR 30), `designation` (VARCHAR 150), `joining_date` (DATE), `employment_arrangement` (CHECK DIRECT_PERMANENT, DIRECT_CONTRACT, DEPUTED_STAFFING, INTERN), `status` (CHECK ACTIVE, ON_NOTICE, SUSPENDED, TERMINATED), `pan_number` (VARCHAR 10), `aadhaar_number` (VARCHAR 20), `uan_number` (VARCHAR 20), `esic_number` (VARCHAR 20), `avatar_url` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
8. **`employee_salary_structures`** (11 columns):
   - `id` (UUID PK), `employee_id` (UUID FK $\to$ `employees.id`), `client_id` (UUID FK $\to$ `clients.id`), `fixed_monthly_base` (NUMERIC 12,2), `hra` (NUMERIC 12,2), `conveyance` (NUMERIC 12,2), `special_allowances` (NUMERIC 12,2), `variable_incentives` (NUMERIC 12,2), `effective_from` (DATE), `effective_to` (DATE), `is_active` (BOOLEAN), `created_at` (TIMESTAMPTZ).
9. **`employee_bank_details`** (8 columns):
   - `id` (UUID PK), `employee_id` (UUID FK UNIQUE), `client_id` (UUID FK), `bank_name` (VARCHAR 150), `account_number` (VARCHAR 50), `ifsc_code` (VARCHAR 20), `account_type` (CHECK SALARY, SAVINGS, CURRENT), `is_verified` (BOOLEAN), `created_at` (TIMESTAMPTZ).

### Constraints:
* `unq_client_employee_code` UNIQUE (`client_id`, `employee_code`) on `employees`.

### Indexes:
* `idx_employees_client`, `idx_employees_location`, `idx_employees_legal_entity`, `idx_salary_structures_emp`, `idx_bank_details_emp`.

---

## 5. Migration 05: Attendance & Regularisations
*File: `supabase/migrations/20261103000005_attendance_and_regularisations.sql`*

### Tables Created:
10. **`attendance_events`** (12 columns — Raw Append-Only):
    - `id` (UUID PK), `client_id` (UUID FK), `employee_id` (UUID FK), `event_type` (CHECK CHECK_IN, CHECK_OUT), `timestamp` (TIMESTAMPTZ), `latitude` (DOUBLE PRECISION), `longitude` (DOUBLE PRECISION), `accuracy_meters` (NUMERIC 6,2), `geofence_status` (CHECK WITHIN_GEOFENCE, OUT_OF_BOUNDS), `ip_address` (VARCHAR 45), `device_info` (TEXT), `selfie_url` (TEXT), `is_suspicious` (BOOLEAN).
11. **`daily_attendance_records`** (11 columns — Aggregated Muster):
    - `id` (UUID PK), `client_id` (UUID FK), `employee_id` (UUID FK), `date` (DATE), `check_in_time` (VARCHAR 20), `check_out_time` (VARCHAR 20), `total_hours` (NUMERIC 4,2), `status` (CHECK PRESENT, ABSENT, HALF_DAY, PAID_LEAVE, WEEKLY_OFF, HOLIDAY), `location_name` (VARCHAR 255), `is_regularised` (BOOLEAN), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
12. **`attendance_corrections`** (12 columns — Regularisation Requests):
    - `id` (UUID PK), `client_id` (UUID FK), `employee_id` (UUID FK), `date` (DATE), `original_check_in` (VARCHAR 20), `original_check_out` (VARCHAR 20), `requested_check_in` (VARCHAR 20), `requested_check_out` (VARCHAR 20), `reason` (TEXT), `manager_remarks` (TEXT), `status` (CHECK PENDING, APPROVED, REJECTED), `reviewed_by` (UUID FK $\to$ `user_profiles.id`), `reviewed_at` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ).

### Constraints:
* `unq_emp_attendance_date` UNIQUE (`employee_id`, `date`) on `daily_attendance_records`.

---

## 6. Migration 06: Leave Management
*File: `supabase/migrations/20261103000006_leave_management.sql`*

### Tables Created:
13. **`leave_balances`** (9 columns):
    - `id` (UUID PK), `client_id` (UUID FK), `employee_id` (UUID FK), `leave_type` (CHECK PL, CL, SL), `year` (INT), `opening` (NUMERIC 4,1), `credited` (NUMERIC 4,1), `used` (NUMERIC 4,1), `closing` (NUMERIC 4,1), `updated_at` (TIMESTAMPTZ).
14. **`leave_requests`** (11 columns):
    - `id` (UUID PK), `client_id` (UUID FK), `employee_id` (UUID FK), `leave_type` (CHECK PL, CL, SL, LWP), `start_date` (DATE), `end_date` (DATE), `total_days` (NUMERIC 4,1), `reason` (TEXT), `manager_remarks` (TEXT), `status` (CHECK PENDING, APPROVED, REJECTED, CANCELLED), `reviewed_by` (UUID FK), `reviewed_at` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ).

### Constraints:
* `unq_emp_leave_year_type` UNIQUE (`employee_id`, `leave_type`, `year`) on `leave_balances`.
* `chk_leave_dates` CHECK (`end_date >= start_date`) on `leave_requests`.

---

## 7. Migration 07: Payroll Engine & Payslips
*File: `supabase/migrations/20261103000007_payroll_engine_and_payslips.sql`*

### Tables Created:
15. **`payroll_runs`** (15 columns):
    - `id` (VARCHAR 100 PK), `client_id` (UUID FK), `legal_entity_id` (UUID FK), `period_month` (INT), `period_year` (INT), `total_employees` (INT), `total_gross` (NUMERIC 14,2), `total_deductions` (NUMERIC 14,2), `total_net` (NUMERIC 14,2), `status` (CHECK draft, under_review, approved, locked), `processed_at` (TIMESTAMPTZ), `approved_at` (TIMESTAMPTZ), `approved_by` (VARCHAR 150), `locked_at` (TIMESTAMPTZ), `locked_by` (VARCHAR 150), `policy_snapshot` (JSONB).
16. **`payroll_items`** (18 columns):
    - `id` (VARCHAR 120 PK), `run_id` (VARCHAR 100 FK $\to$ `payroll_runs.id`), `client_id` (UUID FK), `employee_id` (UUID FK $\to$ `employees.id` ON DELETE RESTRICT), `fixed_salary` (NUMERIC 12,2), `incentives` (NUMERIC 12,2), `other_allowances` (NUMERIC 12,2), `calendar_days` (INT), `paid_days` (NUMERIC 4,1), `unpaid_days` (NUMERIC 4,1), `gross_earned` (NUMERIC 12,2), `unpaid_deduction` (NUMERIC 12,2), `pf_deduction` (NUMERIC 12,2), `esic_deduction` (NUMERIC 12,2), `pt_deduction` (NUMERIC 12,2), `tds_deduction` (NUMERIC 12,2), `total_deductions` (NUMERIC 12,2), `net_salary` (NUMERIC 12,2).
17. **`payslips`** (10 columns — Form XIX Statutory Registry):
    - `id` (UUID PK), `client_id` (UUID FK), `payroll_item_id` (VARCHAR 120 FK), `employee_id` (UUID FK), `period_month` (INT), `period_year` (INT), `revision_number` (INT), `storage_pdf_url` (TEXT), `generated_at` (TIMESTAMPTZ), `is_published` (BOOLEAN).

### Constraints:
* `unq_client_period` UNIQUE (`client_id`, `period_month`, `period_year`) on `payroll_runs`.
* `unq_run_employee` UNIQUE (`run_id`, `employee_id`) on `payroll_items`.
* `unq_emp_payslip_period` UNIQUE (`employee_id`, `period_month`, `period_year`, `revision_number`) on `payslips`.

---

## 8. Migration 08: Statutory & Audit Ledgers
*File: `supabase/migrations/20261103000008_statutory_and_audit_ledgers.sql`*

### Tables Created:
18. **`statutory_pt_slabs`** (9 columns):
    - `id` (UUID PK), `state` (VARCHAR 100), `gender` (CHECK ALL, MALE, FEMALE), `monthly_gross_min` (NUMERIC 10,2), `monthly_gross_max` (NUMERIC 10,2), `tax_amount` (NUMERIC 6,2), `february_tax_amount` (NUMERIC 6,2), `effective_from` (DATE), `is_active` (BOOLEAN).
19. **`statutory_holidays`** (7 columns):
    - `id` (UUID PK), `client_id` (UUID FK), `work_location_id` (UUID FK), `name` (VARCHAR 150), `date` (DATE), `year` (INT), `is_mandatory` (BOOLEAN), `created_at` (TIMESTAMPTZ).
20. **`audit_logs`** (11 columns — Append-Only Security Trail):
    - `id` (VARCHAR 100 PK), `client_id` (UUID FK), `actor_name` (VARCHAR 150), `actor_email` (VARCHAR 255), `actor_role` (VARCHAR 40), `action` (VARCHAR 100), `target_entity` (VARCHAR 100), `target_id` (VARCHAR 100), `details` (TEXT), `ip_address` (VARCHAR 45), `timestamp` (TIMESTAMPTZ), `severity` (CHECK info, warning, critical).

### Seed Records:
* 3 initial records in `statutory_pt_slabs` for Maharashtra state rules.

---

## 9. Migration 09: Row Level Security Policies
*File: `supabase/migrations/20261103000009_row_level_security_policies.sql`*

### RLS Activated (17 Tables):
`clients`, `client_legal_entities`, `work_locations`, `departments`, `client_policies`, `employees`, `employee_salary_structures`, `employee_bank_details`, `attendance_events`, `daily_attendance_records`, `attendance_corrections`, `leave_balances`, `leave_requests`, `payroll_runs`, `payroll_items`, `payslips`, `audit_logs`.

### Security Policies Created (33 Policies):
1. `clients_super_admin_all`
2. `clients_client_admin_select`
3. `employees_super_admin_all`
4. `employees_client_admin_tenant`
5. `employees_self_select`
6. `salary_super_admin_all`
7. `salary_payroll_admin_tenant`
8. `salary_employee_self_select`
9. `bank_super_admin_all`
10. `bank_payroll_admin_tenant`
11. `bank_employee_self_select`
12. `events_super_admin_select`
13. `events_tenant_admin_select`
14. `events_employee_self_select`
15. `events_employee_self_insert`
16. `daily_attendance_super_admin_all`
17. `daily_attendance_tenant_admin_all`
18. `daily_attendance_employee_select`
19. `corrections_employee_apply`
20. `corrections_employee_select`
21. `corrections_tenant_admin_all`
22. `leave_balances_employee_select`
23. `leave_balances_tenant_admin_all`
24. `leave_requests_employee_all`
25. `leave_requests_tenant_admin_all`
26. `payroll_runs_admin_all`
27. `payroll_items_admin_all`
28. `payroll_items_employee_self_select`
29. `payslips_admin_all`
30. `payslips_employee_self_select`
31. `audit_logs_super_admin_select`
32. `audit_logs_client_admin_select`
33. `audit_logs_authenticated_insert`

---

## 10. Migration 10: Database Triggers & Tamper Guards
*File: `supabase/migrations/20261103000010_database_triggers_and_guards.sql`*

### Trigger Functions Created:
1. `public.handle_updated_at()`
2. `public.guard_locked_payroll_modification()`
3. `public.guard_locked_payroll_items()`
4. `public.guard_immutable_attendance_events()`
5. `public.guard_immutable_audit_logs()`

### Triggers Attached:
1. `trg_clients_updated_at` ON `clients` (BEFORE UPDATE)
2. `trg_client_policies_updated_at` ON `client_policies` (BEFORE UPDATE)
3. `trg_employees_updated_at` ON `employees` (BEFORE UPDATE)
4. `trg_daily_attendance_updated_at` ON `daily_attendance_records` (BEFORE UPDATE)
5. `trg_guard_payroll_run_lock` ON `payroll_runs` (BEFORE UPDATE OR DELETE)
6. `trg_guard_payroll_items_lock` ON `payroll_items` (BEFORE UPDATE OR DELETE)
7. `trg_guard_attendance_events_immutability` ON `attendance_events` (BEFORE UPDATE OR DELETE)
8. `trg_guard_audit_logs_immutability` ON `audit_logs` (BEFORE UPDATE OR DELETE)
