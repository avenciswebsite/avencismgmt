# AVENCIS WORKFORCE MANAGEMENT
## Document 10 — Suite A: Client & Organization Lifecycle Test Suite

**Status:** Ready for Execution  
**Total Test Cases:** 25  
**Priority Breakdown:** P0: 8 | P1: 12 | P2: 4 | P3: 1  
**Target Module:** Clients, Legal Entities, Work Locations, Departments, Multi-Tenancy  

---

### TC-CLI-001: Super Admin Client Creation (Happy Path)
- **Scenario:** Super Admin successfully creates a new corporate client organization.
- **Priority:** P0
- **User Role:** `super_admin` (`superadmin@avencis.test`)
- **Target URL / View:** `/clients` -> "Add Client" Modal
- **Preconditions:** Super Admin authenticated. Client code `TST` does not exist.
- **Test Data:** Name: "Test Enterprise Pvt Ltd", Code: "TST", Email: "contact@testent.test", Phone: "+919876543210", Address: "100 Tech Park, Mumbai"
- **Execution Steps:**
  1. Log in as Super Admin.
  2. Navigate to `/clients` and click "Add Client".
  3. Fill in Name, Code, Email, Phone, and Address.
  4. Click "Create Client".
- **Expected Result (UI):** Toast notification "Client created successfully". Modal closes, and "Test Enterprise Pvt Ltd" appears in the active clients list.
- **Database Verification:** `SELECT id, name, client_code, status FROM public.clients WHERE client_code = 'TST';` (Returns 1 row, status 'active').
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'CLIENT_CREATED' AND target_id = (SELECT id FROM public.clients WHERE client_code = 'TST');`
- **Cleanup / Teardown:** `DELETE FROM public.clients WHERE client_code = 'TST';`
- **Status:** NOT RUN

---

### TC-CLI-002: Duplicate Client Code Validation
- **Scenario:** System rejects creation of a client with a code that already exists.
- **Priority:** P0
- **User Role:** `super_admin`
- **Target URL / View:** `/clients`
- **Preconditions:** Client code `ACM` already exists in database.
- **Test Data:** Name: "Acme Clone", Code: "ACM", Email: "clone@acme.test"
- **Execution Steps:**
  1. Open "Add Client" modal.
  2. Enter Code "ACM" and click "Create Client".
- **Expected Result (UI):** Form validation error "Client code already exists". Form remains open; submission blocked.
- **Database Verification:** `SELECT COUNT(*) FROM public.clients WHERE client_code = 'ACM';` (Returns exactly 1).
- **Audit Verification:** N/A (Failed validation does not commit).
- **Cleanup / Teardown:** None required.
- **Status:** NOT RUN

---

### TC-CLI-003: Update Client Organization Profile
- **Scenario:** Client Admin updates organization address and contact details.
- **Priority:** P1
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** `/settings` -> Organization Tab
- **Preconditions:** Client Acme Corp is active.
- **Test Data:** New Address: "Level 14, Tower B, Bandra Kurla Complex, Mumbai 400051", Phone: "+912211223344"
- **Execution Steps:**
  1. Log in as Client Admin for Acme Corp.
  2. Navigate to `/settings` -> "Organization Profile".
  3. Update Address and Phone fields.
  4. Click "Save Changes".
- **Expected Result (UI):** "Profile updated successfully" alert. UI immediately reflects new address.
- **Database Verification:** `SELECT address, phone FROM public.clients WHERE client_code = 'ACM';`
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'CLIENT_UPDATED' AND client_id = (SELECT id FROM public.clients WHERE client_code = 'ACM');`
- **Cleanup / Teardown:** Revert address to standard synthetic baseline.
- **Status:** NOT RUN

---

### TC-CLI-004: Primary Legal Entity Creation
- **Scenario:** Super Admin or Client Admin creates a primary legal entity with statutory numbers.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/client-setup` or `/settings/legal-entities`
- **Preconditions:** Client Acme Corp exists.
- **Test Data:** Name: "Acme Manufacturing Pvt Ltd", Code: "LE-MFG", PAN: "AAACA1234A", GSTIN: "27AAACA1234A1Z5", PF Code: "MH/BAN/0012345/000"
- **Execution Steps:**
  1. Navigate to Legal Entities section.
  2. Click "Add Legal Entity".
  3. Enter Name, Entity Code, PAN, GSTIN, and PF Code.
  4. Click "Save Entity".
- **Expected Result (UI):** Entity appears in the table with "Active" badge and formatted statutory codes.
- **Database Verification:** `SELECT * FROM public.legal_entities WHERE entity_code = 'LE-MFG';`
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'LEGAL_ENTITY_CREATED';`
- **Cleanup / Teardown:** Handled in test teardown suite.
- **Status:** NOT RUN

---

### TC-CLI-005: Multi-Entity Setup under Single Client
- **Scenario:** Adding a second legal entity under the same client for multi-entity payroll.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/legal-entities`
- **Preconditions:** First legal entity exists.
- **Test Data:** Name: "Acme Logistics LLP", Code: "LE-LOG", PAN: "AAACL5678B", GSTIN: "27AAACL5678B1Z2"
- **Execution Steps:**
  1. Click "Add Legal Entity".
  2. Enter details for "Acme Logistics LLP".
  3. Save entity.
- **Expected Result (UI):** Both "Acme Manufacturing Pvt Ltd" and "Acme Logistics LLP" display in the list.
- **Database Verification:** `SELECT COUNT(*) FROM public.legal_entities WHERE client_id = (SELECT id FROM public.clients WHERE client_code = 'ACM');` (Returns 2).
- **Audit Verification:** Check audit logs for second entity creation.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-006: Work Location Creation with Circular Geofence
- **Scenario:** Client Admin defines a physical facility with coordinates and GPS geofence radius.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/work-locations`
- **Preconditions:** Legal entity exists.
- **Test Data:** Name: "Pune Plant 1", Code: "LOC-PUN", Lat: 18.5204, Lng: 73.8567, Radius: 250 meters
- **Execution Steps:**
  1. Navigate to `/work-locations` and click "Add Location".
  2. Enter Name, Code, Address, Latitude, Longitude, and Geofence Radius (250m).
  3. Select Legal Entity "Acme Manufacturing Pvt Ltd".
  4. Click "Save Location".
- **Expected Result (UI):** Location created with map pin and radius indicator; displays in locations table.
- **Database Verification:** `SELECT * FROM public.work_locations WHERE location_code = 'LOC-PUN';`
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'LOCATION_CREATED';`
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-007: Geofence Coordinate Boundary Validation
- **Scenario:** Validating rejection of invalid latitude (> 90 or < -90) and longitude (> 180 or < -180).
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/work-locations`
- **Preconditions:** "Add Location" modal open.
- **Test Data:** Name: "Invalid Site", Lat: 95.1234, Lng: 195.5678, Radius: 50
- **Execution Steps:**
  1. Input Lat: 95.1234, Lng: 195.5678.
  2. Click "Save Location".
- **Expected Result (UI):** Field level validation error: "Latitude must be between -90 and 90; Longitude between -180 and 180".
- **Database Verification:** Table check constraint `chk_location_lat` / `chk_location_lng` prevents row insert.
- **Audit Verification:** No log generated.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-008: Minimum Geofence Radius Validation
- **Scenario:** Ensuring system enforces minimum 10m radius to account for mobile GPS drift.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/work-locations`
- **Preconditions:** Modal open.
- **Test Data:** Radius: 2 meters.
- **Execution Steps:**
  1. Input Radius: 2.
  2. Attempt to save.
- **Expected Result (UI):** Validation message: "Geofence radius must be at least 10 meters".
- **Database Verification:** Check constraint `chk_location_radius` blocks commit.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-009: Department Hierarchy Creation
- **Scenario:** Creating organizational departments (HR, Operations, Finance) under a client.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/departments`
- **Preconditions:** Client active.
- **Test Data:** Department Name: "Plant Operations", Code: "DEPT-OPS"
- **Execution Steps:**
  1. Navigate to Departments tab.
  2. Click "Add Department", enter Name and Code.
  3. Click "Save".
- **Expected Result (UI):** "Plant Operations" department added to department list.
- **Database Verification:** `SELECT * FROM public.departments WHERE department_code = 'DEPT-OPS';`
- **Audit Verification:** Audit log records `DEPARTMENT_CREATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-010: Assign Department Head Employee
- **Scenario:** Assigning an existing employee as the formal Department Head.
- **Priority:** P1
- **User Role:** `client_admin` / `hr_admin`
- **Target URL / View:** `/settings/departments`
- **Preconditions:** Department and employee exist.
- **Test Data:** Department: "Plant Operations", Head Employee: "Rahul Sharma (EMP-ACM-001)"
- **Execution Steps:**
  1. Click "Edit" on Plant Operations.
  2. Select "Rahul Sharma" from Department Head dropdown.
  3. Click "Save".
- **Expected Result (UI):** Department card displays "Head: Rahul Sharma".
- **Database Verification:** `SELECT head_employee_id FROM public.departments WHERE department_code = 'DEPT-OPS';` (Matches Rahul's UUID).
- **Audit Verification:** Audit log records `DEPARTMENT_HEAD_ASSIGNED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-011: Delete Work Location with Active Employees (Foreign Key Restriction)
- **Scenario:** Attempting to delete a work location that has active employees assigned to it.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** `/work-locations`
- **Preconditions:** Location "Pune Plant 1" has employees assigned.
- **Test Data:** Target: "Pune Plant 1"
- **Execution Steps:**
  1. Click "Delete Location" on Pune Plant 1.
  2. Confirm deletion prompt.
- **Expected Result (UI):** Error banner: "Cannot delete location: active employees are currently assigned to this location. Please reassign them first."
- **Database Verification:** Foreign key `RESTRICT` prevents deletion; `SELECT COUNT(*) FROM public.work_locations WHERE location_code = 'LOC-PUN';` remains 1.
- **Audit Verification:** No deletion log.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-012: Delete Department (Cascading SET NULL Verification)
- **Scenario:** Deleting an empty or reorganized department sets employee department reference to NULL without deleting employee.
- **Priority:** P2
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/departments`
- **Preconditions:** Temporary department "Testing Dept" created with 1 employee.
- **Test Data:** "Testing Dept"
- **Execution Steps:**
  1. Delete "Testing Dept".
- **Expected Result (UI):** Department deleted successfully. Employee profile now shows "Department: Unassigned".
- **Database Verification:** Employee row remains intact with `department_id IS NULL`.
- **Audit Verification:** Audit log records `DEPARTMENT_DELETED`.
- **Cleanup / Teardown:** Reassign employee to Operations.
- **Status:** NOT RUN

---

### TC-CLI-013: Super Admin Client Suspension
- **Scenario:** Super Admin suspends a client account due to commercial termination.
- **Priority:** P0
- **User Role:** `super_admin`
- **Target URL / View:** `/clients`
- **Preconditions:** Client Acme Corp active.
- **Test Data:** Client: Acme Corp, Reason: "Account Audit Suspension"
- **Execution Steps:**
  1. Log in as Super Admin, find Acme Corp.
  2. Click Action menu -> "Suspend Client".
  3. Enter reason and confirm.
- **Expected Result (UI):** Client badge updates to "Suspended" in red.
- **Database Verification:** `SELECT status FROM public.clients WHERE client_code = 'ACM';` (Returns 'suspended').
- **Audit Verification:** Audit log records `CLIENT_SUSPENDED`.
- **Cleanup / Teardown:** Reactivate client via TC-CLI-014.
- **Status:** NOT RUN

---

### TC-CLI-014: Suspended Client Access Lockout
- **Scenario:** Verifying that a Client Admin of a suspended client cannot access the system.
- **Priority:** P0
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** `/login`
- **Preconditions:** Acme Corp status is 'suspended'.
- **Test Data:** Email: `admin.acme@avencis.test`, Password: valid.
- **Execution Steps:**
  1. Navigate to `/login`.
  2. Enter credentials and click "Sign In".
- **Expected Result (UI):** Error alert: "Your organization account has been suspended. Please contact Avencis Support." User is NOT granted session.
- **Database Verification:** No active session created.
- **Audit Verification:** `SELECT * FROM public.audit_logs WHERE action = 'LOGIN_BLOCKED_SUSPENDED';`
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-015: Super Admin Client Reactivation
- **Scenario:** Super Admin reactivates a suspended client account.
- **Priority:** P1
- **User Role:** `super_admin`
- **Target URL / View:** `/clients`
- **Preconditions:** Acme Corp is suspended.
- **Test Data:** Target: Acme Corp
- **Execution Steps:**
  1. As Super Admin, click "Reactivate Client" on Acme Corp.
  2. Confirm modal.
- **Expected Result (UI):** Status badge turns green "Active". Client Admin can now log in normally.
- **Database Verification:** `SELECT status FROM public.clients WHERE client_code = 'ACM';` (Returns 'active').
- **Audit Verification:** Audit log records `CLIENT_REACTIVATED`.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-016: Client Branding Logo Upload
- **Scenario:** Client Admin uploads corporate logo image to storage.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/settings` -> Branding Tab
- **Preconditions:** Storage bucket `client-assets` configured.
- **Test Data:** File: `test_logo.png` (PNG, 250 KB)
- **Execution Steps:**
  1. Navigate to Branding settings.
  2. Upload `test_logo.png` and click "Save Branding".
- **Expected Result (UI):** Logo previews in header navigation immediately.
- **Database Verification:** `SELECT logo_url FROM public.clients WHERE client_code = 'ACM';` (Contains valid storage URL).
- **Audit Verification:** Audit log records `BRANDING_UPDATED`.
- **Cleanup / Teardown:** Revert logo to null.
- **Status:** NOT RUN

---

### TC-CLI-017: Multi-Location Management View
- **Scenario:** Verifying all client locations render correctly with active/inactive indicators.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/work-locations`
- **Preconditions:** 3 locations created for Acme Corp.
- **Test Data:** Locations: Mumbai HQ, Pune Plant 1, Bangalore Hub.
- **Execution Steps:**
  1. View `/work-locations`.
  2. Verify list pagination and filter by city.
- **Expected Result (UI):** Table displays 3 location cards with coordinate details and employee headcounts.
- **Database Verification:** `SELECT COUNT(*) FROM public.work_locations WHERE client_id = (SELECT id FROM public.clients WHERE client_code = 'ACM');`
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-018: Cross-Tenant Client Settings Isolation
- **Scenario:** Verifying Client A admin cannot view or edit Client B settings.
- **Priority:** P0
- **User Role:** `client_admin` (`admin.acme@avencis.test`)
- **Target URL / View:** Direct PostgREST API request targeting Globex client ID
- **Preconditions:** Both clients exist.
- **Test Data:** Globex Client UUID
- **Execution Steps:**
  1. Authenticate as Acme Admin.
  2. Send `GET /rest/v1/clients?id=eq.[Globex_UUID]`.
- **Expected Result (UI):** Returns HTTP 200 with empty array `[]`. No data returned.
- **Database Verification:** RLS policy `client_admin_view_own` prevents row leakage.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-019: Deactivate Work Location
- **Scenario:** Setting a location status to 'inactive' prevents future attendance punches at that site.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/work-locations`
- **Preconditions:** Location exists.
- **Test Data:** Target: Bangalore Hub.
- **Execution Steps:**
  1. Toggle status of Bangalore Hub to "Inactive".
  2. Confirm warning prompt.
- **Expected Result (UI):** Location badge shows "Inactive".
- **Database Verification:** `SELECT is_active FROM public.work_locations WHERE location_code = 'LOC-BLR';` (Returns false).
- **Audit Verification:** Audit log records `LOCATION_DEACTIVATED`.
- **Cleanup / Teardown:** Toggle back to active.
- **Status:** NOT RUN

---

### TC-CLI-020: Statutory Registration Number Formatting
- **Scenario:** Validating PAN (5 letters, 4 digits, 1 letter) and GSTIN (15 chars) format enforcement.
- **Priority:** P1
- **User Role:** `client_admin`
- **Target URL / View:** `/settings/legal-entities`
- **Preconditions:** Modal open.
- **Test Data:** Invalid PAN: "12345ABCDE", Invalid GSTIN: "27INVALID"
- **Execution Steps:**
  1. Enter invalid PAN and click Save.
- **Expected Result (UI):** Validation error: "Invalid PAN format. Standard format: ABCDE1234F".
- **Database Verification:** Prevented before DB commit.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-021: Client Super Admin Filter Switching
- **Scenario:** Super Admin switches active tenant context in header dropdown.
- **Priority:** P1
- **User Role:** `super_admin`
- **Target URL / View:** Global Navigation Header
- **Preconditions:** Super Admin logged in.
- **Test Data:** Target Client: "Globex Logistics"
- **Execution Steps:**
  1. Click Client Switcher dropdown in header.
  2. Select "Globex Logistics".
- **Expected Result (UI):** Dashboard reloads with Globex metrics, employee count, and company branding.
- **Database Verification:** Local state updates; all subsequent queries pass Globex client ID.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Switch back to Acme Corp.
- **Status:** NOT RUN

---

### TC-CLI-022: Prevent Non-Super Admin Access to `/clients`
- **Scenario:** Ensuring Client Admin and lower roles cannot access global `/clients` route.
- **Priority:** P0
- **User Role:** `client_admin`
- **Target URL / View:** Direct URL navigation to `/clients`
- **Preconditions:** Logged in as Acme Client Admin.
- **Test Data:** URL: `http://localhost:5173/clients`
- **Execution Steps:**
  1. Manually type `/clients` in browser address bar.
- **Expected Result (UI):** System redirects to `/dashboard` or renders "403 Forbidden: Access Restricted to Super Admin".
- **Database Verification:** N/A (Route guard enforcement).
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-023: Client Search & Filter on Admin Dashboard
- **Scenario:** Super Admin searches client list by name, code, or status.
- **Priority:** P2
- **User Role:** `super_admin`
- **Target URL / View:** `/clients`
- **Preconditions:** Multiple clients exist.
- **Test Data:** Search query: "Acme"
- **Execution Steps:**
  1. Enter "Acme" in search box.
- **Expected Result (UI):** Table dynamically filters to show only Acme Corporation.
- **Database Verification:** UI state filtering.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** Clear search box.
- **Status:** NOT RUN

---

### TC-CLI-024: Delete Client with Active Database Dependencies
- **Scenario:** Super Admin attempts to delete a client with active employees and payroll runs.
- **Priority:** P0
- **User Role:** `super_admin`
- **Target URL / View:** `/clients`
- **Preconditions:** Acme Corp has employees and payroll history.
- **Test Data:** Acme Corp
- **Execution Steps:**
  1. Attempt to execute client hard delete.
- **Expected Result (UI):** System blocks deletion: "Cannot delete client: historical payroll and employee records exist. Suspend the client instead."
- **Database Verification:** Foreign key `RESTRICT` on `employees.client_id` blocks deletion.
- **Audit Verification:** None.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN

---

### TC-CLI-025: Client Setup Wizard Completion State
- **Scenario:** Verifying that a newly created client tracks onboarding wizard completion percentage.
- **Priority:** P3
- **User Role:** `client_admin`
- **Target URL / View:** `/dashboard`
- **Preconditions:** Newly onboarded client with incomplete setup.
- **Test Data:** Incomplete client.
- **Execution Steps:**
  1. Log in to dashboard.
- **Expected Result (UI):** Onboarding progress widget shows: "Setup 60% complete (Add Work Locations, Configure Policies)".
- **Database Verification:** Calculated from presence of entities, locations, and policies.
- **Audit Verification:** N/A.
- **Cleanup / Teardown:** None.
- **Status:** NOT RUN
