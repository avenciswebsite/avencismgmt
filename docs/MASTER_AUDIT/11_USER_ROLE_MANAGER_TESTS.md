# AVENCIS WORKFORCE MANAGEMENT
## Document 11 — Suite B: User Account, RBAC & Role Management Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 25  
**Priority Breakdown:** P0: 10 | P1: 10 | P2: 4 | P3: 1  
**Target Module:** Authentication, User Provisioning, 7 Application Roles, RBAC Enforcement, Manager Scope  

---

### TC-USR-001: Super Admin Provisions Client Admin
- **Scenario:** Super Admin invites or creates the primary Client Admin for a tenant.
- **Priority:** P0
- **User Role:** `super_admin` (`superadmin@avencis.test`)
- **Target URL / View:** `/users` -> "Invite User"
- **Preconditions:** Client Acme Corp exists.
- **Test Data:** Email: `newadmin@acme.test`, Full Name: "Acme Lead Admin", Role: `client_admin`, Client: Acme Corp
- **Execution Steps:**
  1. Navigate to `/users` and click "Invite User".
  2. Enter Email, Full Name, select Role `client_admin` and Client "Acme Corp".
  3. Click "Send Invitation".
- **Expected Result (UI):** Toast "User invitation sent successfully". User appears in users table with role badge "Client Admin".
- **Database Verification:** `SELECT u.email, r.role, r.client_id FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id WHERE u.email = 'newadmin@acme.test';`
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'USER_PROVISIONED' AND target_id = (SELECT id FROM auth.users WHERE email = 'newadmin@acme.test');`
- **Cleanup / Teardown:** Delete test user from `auth.users` and `user_roles`.
- **Status:** NOT RUN

---

### TC-USR-002: Client Admin Provisions Operational Roles (HR & Payroll)
- **Scenario:** Client Admin creates HR Admin and Payroll Admin accounts within their tenant.
- **Priority:** P0
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** `/users`
- **Preconditions:** Client Admin logged in.
- **Test Data:** Email: `hr.test@acme.test`, Role: `hr_admin`
- **Execution Steps:**
  1. Open "Add User" modal.
  2. Select Role "HR Admin", enter email and name.
  3. Save user.
- **Expected Result (UI):** User added with `hr_admin` role.
- **Database Verification:** `SELECT role FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hr.test@acme.test');` (Returns 'hr_admin').
- **Audit Verification:** Audit log records `ROLE_ASSIGNED`.
- **Cleanup / Teardown:** Remove test user.
- **Status:** NOT RUN

---

### TC-USR-003: Privilege Escalation Defense (Client Admin -> Super Admin)
- **Scenario:** Client Admin attempts to assign the `super_admin` role to a user.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** Client Admin authenticated.
- **Test Data:** Target Email: `attacker@acme.test`, Role attempted: `super_admin`
- **Execution Steps:**
  1. Inspect the Role dropdown in UI: verify "Super Admin" is NOT an available option.
  2. Attempt via direct PostgREST POST to `/rest/v1/user_roles` with `role: "super_admin"`.
- **Expected Result (UI):** Dropdown restricts options to tenant roles. Direct API call returns HTTP 403 Forbidden (`42501` RLS violation).
- **Database Verification:** Database table policy `client_admin_manage_tenant` blocks the row insert.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-004: Location Manager Assignment to Specific Physical Sites
- **Scenario:** Assigning a Location Manager to one or more physical work locations.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/users` -> "Edit User Locations"
- **Preconditions:** User `mgr.pune@avencis.test` exists.
- **Test Data:** User: `mgr.pune@avencis.test`, Location: "Pune Plant 1"
- **Execution Steps:**
  1. Click Edit on `mgr.pune@avencis.test`.
  2. Select "Location Manager" role.
  3. Under Assigned Locations, check "Pune Plant 1" and uncheck "Mumbai HQ".
  4. Save.
- **Expected Result (UI):** User card displays "Locations: Pune Plant 1 (1 site)".
- **Database Verification:** `SELECT location_id FROM public.user_work_locations WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mgr.pune@avencis.test');` (Returns Pune Plant UUID).
- **Audit Verification:** Audit log records `USER_LOCATIONS_UPDATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-005: Department Manager Assignment to Department
- **Scenario:** Linking a Department Manager to their operational department.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** User `mgr.ops@avencis.test` exists.
- **Test Data:** Department: "Plant Operations"
- **Execution Steps:**
  1. Assign Role `department_manager`.
  2. Select Assigned Department "Plant Operations".
  3. Save.
- **Expected Result (UI):** User card displays "Department: Plant Operations".
- **Database Verification:** User record reflects assigned department.
- **Audit Verification:** Audit log records `USER_DEPARTMENT_UPDATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-006: User Account Deactivation
- **Scenario:** Deactivating an active user account prevents subsequent authentication.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** User account exists.
- **Test Data:** Target: `temp.user@acme.test`
- **Execution Steps:**
  1. Toggle User Status to "Deactivated".
  2. Confirm modal.
  3. Open an Incognito browser and attempt login as `temp.user@acme.test`.
- **Expected Result (UI):** User shows "Deactivated" badge. Login attempt displays: "Your account is inactive. Please contact your administrator."
- **Database Verification:** `SELECT is_active FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'temp.user@acme.test');` (Returns false).
- **Audit Verification:** Audit log records `USER_DEACTIVATED`.
- **Cleanup / Teardown:** Reactivate user.
- **Status:** NOT RUN

---

### TC-USR-007: Reactivate Deactivated User
- **Scenario:** Reactivating a previously deactivated user restores system access.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** User is deactivated.
- **Test Data:** Target: `temp.user@acme.test`
- **Execution Steps:**
  1. Click "Reactivate User".
  2. Verify user can now log in successfully.
- **Expected Result (UI):** Status badge turns green "Active". User login succeeds.
- **Database Verification:** `is_active = true`.
- **Audit Verification:** Audit log records `USER_REACTIVATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-008: Role Permission Check — HR Admin Restricted from CTC
- **Scenario:** Verifying HR Admin cannot view or modify master employee salary structures.
- **Priority:** P0
- **User Role:** `hr_admin` (`hr.acme@avencis.test`)
- **Target URL / View:** `/employees/[id]` -> Salary Tab
- **Preconditions:** Logged in as HR Admin.
- **Test Data:** Employee: Rahul Sharma (`EMP-ACM-001`)
- **Execution Steps:**
  1. Open Rahul Sharma's employee profile.
  2. Inspect the Salary / Compensation section.
  3. Attempt direct API request: `GET /rest/v1/employee_salary_structures`.
- **Expected Result (UI):** Salary CTC fields are masked or hidden ("Access Restricted to Payroll Admin"). Direct API request returns empty array `[]` (RLS enforced).
- **Database Verification:** Table RLS policy `payroll_admin_tenant` allows only `payroll_admin` and `super_admin`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-009: Role Permission Check — Payroll Admin Restricted from Leave Approval
- **Scenario:** Verifying Payroll Admin cannot approve employee leave requests.
- **Priority:** P1
- **User Role:** `payroll_admin` (`payroll.acme@avencis.test`)
- **Target URL / View:** `/leave-approvals`
- **Preconditions:** Pending leave request exists.
- **Test Data:** Target: Casual leave request.
- **Execution Steps:**
  1. Log in as Payroll Admin.
  2. Navigate to `/leave-approvals`.
- **Expected Result (UI):** Leave Approvals tab is not visible in navigation, or action buttons are disabled (read-only view for muster reconciliation).
- **Database Verification:** RLS policy on `leave_requests` restricts UPDATE to `hr_admin`, `client_admin`, and managers.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-010: Role Permission Check — Location Manager Restricted from Payroll
- **Scenario:** Verifying Location Manager cannot access payroll runs or salary registers.
- **Priority:** P0
- **User Role:** `location_manager` (`mgr.pune@avencis.test`)
- **Target URL / View:** Direct navigation to `/payroll`
- **Preconditions:** Logged in as Pune Location Manager.
- **Test Data:** URL: `http://localhost:5173/payroll`
- **Execution Steps:**
  1. Manually type `/payroll` in address bar.
- **Expected Result (UI):** Route guard redirects to `/attendance` or displays "403 Forbidden: Insufficient Permissions".
- **Database Verification:** `SELECT * FROM public.payroll_runs` via REST returns empty array `[]`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-011: Role Permission Check — Employee ESS Scope Isolation
- **Scenario:** Verifying an Employee can only access their own attendance, leaves, and payslips.
- **Priority:** P0
- **User Role:** `employee` (`emp.rahul@avencis.test`)
- **Target URL / View:** `/portal`
- **Preconditions:** Logged in as Rahul Sharma.
- **Test Data:** Fellow employee Sneha Patil's UUID.
- **Execution Steps:**
  1. Log in to ESS Portal.
  2. Attempt to query Sneha's attendance: `GET /rest/v1/daily_attendance_records?employee_id=eq.[Sneha_UUID]`.
- **Expected Result (UI):** Direct API call returns empty array `[]`. UI displays only Rahul's data.
- **Database Verification:** RLS policy `employee_view_own` checks `user_id = auth.uid()`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-012: Modify User Role (Promotion / Demotion)
- **Scenario:** Changing a user's role from `hr_admin` to `client_admin`.
- **Priority:** P1
- **User Role:** `super_admin` or `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** User exists.
- **Test Data:** User: `hr.acme@avencis.test`, New Role: `client_admin`
- **Execution Steps:**
  1. Click "Edit Role" on `hr.acme@avencis.test`.
  2. Change role dropdown to `client_admin`.
  3. Save.
- **Expected Result (UI):** Role badge updates to "Client Admin". User now has full admin privileges upon next turn.
- **Database Verification:** `SELECT role FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hr.acme@avencis.test');` (Returns 'client_admin').
- **Audit Verification:** Audit log records `ROLE_MODIFIED`.
- **Cleanup / Teardown:** Revert role to `hr_admin`.
- **Status:** NOT RUN

---

### TC-USR-013: Location Manager Team Directory via RPC (`get_manager_team`)
- **Scenario:** Verifying Location Manager retrieves only employees assigned to Pune Plant 1.
- **Priority:** P0
- **User Role:** `location_manager` (`mgr.pune@avencis.test`)
- **Target URL / View:** `/team` or `/attendance/team-muster`
- **Preconditions:** Migration 21 RPC deployed. 5 employees in Pune, 3 in Mumbai.
- **Test Data:** Pune Plant 1
- **Execution Steps:**
  1. Log in as Pune Location Manager.
  2. Open Team Directory.
- **Expected Result (UI):** Directory displays exactly the 5 employees assigned to Pune Plant 1; Mumbai employees are NOT shown.
- **Database Verification:** `SELECT * FROM public.get_manager_team('[mgr_pune_uuid]', '[acme_client_uuid]');` returns exactly 5 rows.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-014: Department Manager Team Scope
- **Scenario:** Verifying Department Manager views only employees assigned to their department.
- **Priority:** P1
- **User Role:** `department_manager` (`mgr.ops@avencis.test`)
- **Target URL / View:** `/team`
- **Preconditions:** Logged in as Operations Dept Manager.
- **Test Data:** Department: Plant Operations
- **Execution Steps:**
  1. Open Team Directory.
- **Expected Result (UI):** Displays only employees whose `department_id` matches Plant Operations.
- **Database Verification:** Team query matches department filter.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-015: Duplicate User Email Invite Validation
- **Scenario:** System blocks inviting an email that is already registered.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** Email `hr.acme@avencis.test` is already registered.
- **Test Data:** Email: `hr.acme@avencis.test`
- **Execution Steps:**
  1. Open Invite User modal, input `hr.acme@avencis.test`.
  2. Click Invite.
- **Expected Result (UI):** Error alert: "A user with this email address already exists."
- **Database Verification:** No duplicate record inserted in `auth.users`.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-016: Invalid Email Format Validation
- **Scenario:** Rejecting malformed email addresses during user creation.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** Modal open.
- **Test Data:** Email: `not-an-email`
- **Execution Steps:**
  1. Enter `not-an-email` and submit.
- **Expected Result (UI):** Field error "Please enter a valid email address".
- **Database Verification:** Blocked client-side.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-017: User Role Filtering & Search
- **Scenario:** Admin filters users by role (`hr_admin`, `location_manager`, etc.) and searches by name.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** Multiple users exist.
- **Test Data:** Filter: "location_manager"
- **Execution Steps:**
  1. Select Role filter "Location Manager".
- **Expected Result (UI):** Table lists only users with the Location Manager role badge.
- **Database Verification:** UI state filtering.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Clear filter.
- **Status:** NOT RUN

---

### TC-USR-018: Super Admin Cross-Tenant User Inspection
- **Scenario:** Super Admin can inspect user accounts across all tenant organizations.
- **Priority:** P1
- **User Role:** `super_admin`
- **Target URL / View:** `/users` (Global view)
- **Preconditions:** Users exist in both Acme and Globex.
- **Test Data:** Global view
- **Execution Steps:**
  1. View `/users` as Super Admin with no client filter applied.
- **Expected Result (UI):** Table lists users from Acme Corp and Globex Logistics with organization tags.
- **Database Verification:** `SELECT COUNT(*) FROM public.user_roles;` (Returns total across all tenants).
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-019: Self-Role Demotion Prevention
- **Scenario:** Client Admin cannot remove their own `client_admin` role to prevent lockout.
- **Priority:** P1
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** `/users`
- **Preconditions:** Admin viewing their own record.
- **Test Data:** Own user row.
- **Execution Steps:**
  1. Attempt to change own role to `employee` or deactivate own account.
- **Expected Result (UI):** Edit button disabled on own user row, or alert: "You cannot modify your own administrative role."
- **Database Verification:** Application business logic guard.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-020: Delete User Account (Soft Deactivation vs Hard Delete)
- **Scenario:** Deleting a user with historical audit trail references performs soft deactivation.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** User has approved leaves in the past.
- **Test Data:** Manager user.
- **Execution Steps:**
  1. Click "Delete User".
  2. Confirm modal.
- **Expected Result (UI):** User is marked "Archived / Inactive"; historical approvals retain manager name.
- **Database Verification:** User remains in `auth.users` with `is_active = false`; foreign keys remain intact.
- **Audit Verification:** Audit log records `USER_ARCHIVED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-021: Role Permission Check — Multi-Location Manager Access
- **Scenario:** Location Manager assigned to two locations can switch views between both sites.
- **Priority:** P1
- **User Role:** `location_manager`
- **Target URL / View:** `/attendance`
- **Preconditions:** Manager assigned to Pune Plant 1 and Bangalore Hub.
- **Test Data:** Locations: Pune & Bangalore
- **Execution Steps:**
  1. Log in as multi-location manager.
  2. Switch location filter from Pune to Bangalore.
- **Expected Result (UI):** Attendance records switch seamlessly between the two permitted sites.
- **Database Verification:** `SELECT location_id FROM public.user_work_locations WHERE user_id = auth.uid();` returns both IDs.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-022: Unassigned Location Manager Fallback
- **Scenario:** Location Manager with 0 assigned locations receives informative empty state.
- **Priority:** P2
- **User Role:** `location_manager`
- **Target URL / View:** `/attendance`
- **Preconditions:** Newly created manager with no linked locations in `user_work_locations`.
- **Test Data:** Unassigned manager.
- **Execution Steps:**
  1. Log in.
- **Expected Result (UI):** Empty state banner: "No work locations assigned. Please contact your Client Admin to assign facilities to your profile."
- **Database Verification:** Zero rows in `user_work_locations`.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-023: Role Permission Check — Session Invalidation on Role Change
- **Scenario:** Demoting an admin immediately restricts privileges in an active session.
- **Priority:** P1
- **User Role:** `client_admin` demoted to `employee`
- **Target URL / View:** Active browser session
- **Preconditions:** User logged in as admin in Browser 1; Super Admin demotes user in Browser 2.
- **Test Data:** Target user.
- **Execution Steps:**
  1. In Browser 1, attempt to navigate to `/settings`.
- **Expected Result (UI):** System checks `get_user_role()`, detects downgrade, and immediately displays 403 or redirects to ESS portal.
- **Database Verification:** `user_roles.role = 'employee'`.
- **Audit Verification:** Audit log records `ROLE_DOWNGRADE`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-024: Audit Trail on Role Modification
- **Scenario:** All changes to `user_roles` generate an immutable entry in `audit_logs`.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/users`
- **Preconditions:** Role change executed.
- **Test Data:** Role change event.
- **Execution Steps:**
  1. Perform any role alteration.
  2. Query `audit_logs`.
- **Expected Result (UI):** Audit trail records timestamp, acting user ID, target user ID, old role, and new role.
- **Database Verification:** `SELECT * FROM public.audit_logs WHERE action = 'ROLE_MODIFIED' ORDER BY created_at DESC LIMIT 1;`
- **Audit Verification:** Record verified.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-USR-025: Password Complexity & Policy Enforcement
- **Scenario:** Enforcing minimum 8 characters with upper, lower, digit, and symbol on user invite/reset.
- **Priority:** P3
- **User Role:** `client_admin`
- **Target URL / View:** `/users` / `/reset-password`
- **Preconditions:** User setting password.
- **Test Data:** Weak password: `pass`
- **Execution Steps:**
  1. Enter `pass` in password field.
- **Expected Result (UI):** Helper text flags missing requirements: "Password must be at least 8 characters with a number and symbol."
- **Database Verification:** Supabase Auth password policy enforcement.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN
