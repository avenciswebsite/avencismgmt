# Avencis WFM — Employee Directory Integration Report
## Milestone 2.4B: Live Supabase & Domain Service Layer Integration

---

### 1. Executive Summary

The **Employee Directory** module (`src/app/workspace/EmployeeDirectory.tsx`) has been connected to the typed domain service layer (`employeeService.ts` and `policyService.ts`) and live Supabase PostgreSQL backend.

The component adheres to the **Zero UI Drift** constraint, maintaining the 29 Stitch screen design specifications while introducing live data loading, multi-tenant scoping, comprehensive search/filtering, and role-based fail-closed security for sensitive compensation data.

---

### 2. Architecture & File Locations

| Component / Layer | File Path | Primary Responsibility |
| :--- | :--- | :--- |
| **Directory UI** | [`src/app/workspace/EmployeeDirectory.tsx`](file:///c:/Avencis%20Management/src/app/workspace/EmployeeDirectory.tsx) | Live staff master grid, search, filters, loading states, CTC gate |
| **Domain Service** | [`src/services/employeeService.ts`](file:///c:/Avencis%20Management/src/services/employeeService.ts) | Typed repository for employee lookup, role verification, and financial gating |
| **Org Context Service**| [`src/services/policyService.ts`](file:///c:/Avencis%20Management/src/services/policyService.ts) | Department and work location retrieval for dropdown filters |
| **Service Types** | [`src/services/serviceTypes.ts`](file:///c:/Avencis%20Management/src/services/serviceTypes.ts) | Typed row interfaces (`EmployeeRow`, `SalaryStructureRow`, `CallerScope`) |
| **Workspace Context** | [`src/context/WorkspaceContext.tsx`](file:///c:/Avencis%20Management/src/context/WorkspaceContext.tsx) | Active client tenancy state and workspace switching |
| **Auth Context** | [`src/context/AuthContext.tsx`](file:///c:/Avencis%20Management/src/context/AuthContext.tsx) | Caller role, client ID, and employee self-service identity |

---

### 3. Database Schema Mappings

The directory queries `public.employees` joined logically with `public.departments`, `public.work_locations`, and `public.employee_salary_structures`:

| UI Field | Source Database Table | Database Column | Notes |
| :--- | :--- | :--- | :--- |
| **Employee Name** | `public.employees` | `first_name`, `last_name` | Combined display with avatar |
| **Employee ID** | `public.employees` | `employee_code` | Scoped unique code per client |
| **Joining Date** | `public.employees` | `joining_date` | Date format `YYYY-MM-DD` |
| **Designation** | `public.employees` | `designation` | Position title |
| **Arrangement Badge**| `public.employees` | `employment_arrangement` | `DIRECT_PERMANENT`, `DIRECT_CONTRACT`, `DEPUTED_STAFFING`, `INTERN` |
| **Department** | `public.departments` | `name` | Resolved via `department_id` FK |
| **Work Location** | `public.work_locations` | `name` | Resolved via `work_location_id` FK |
| **Fixed Monthly Base**| `public.employee_salary_structures` | `fixed_monthly_base` | **SENSITIVE:** Protected by financial role gate |
| **Variable Incentive**| `public.employee_salary_structures` | `variable_incentives` | **SENSITIVE:** Protected by financial role gate |
| **Contact Email** | `public.employees` | `email` | Corporate email |
| **Contact Mobile**| `public.employees` | `mobile` | Primary telephone |
| **Status Badge** | `public.employees` | `status` | `ACTIVE`, `ON_NOTICE`, `SUSPENDED`, `TERMINATED` |

---

### 4. Compensation Data Security Gate

> [!IMPORTANT]
> The `public.employees` database table intentionally does **NOT** contain salary CTC or banking information. Financial structures reside in `public.employee_salary_structures`.

In `EmployeeDirectory.tsx`, compensation visibility is enforced using defense-in-depth:
1. **Frontend Role Check:**
   ```tsx
   const canViewCompensation = currentUser && ['super_admin', 'client_admin', 'payroll_admin'].includes(currentUser.role);
   ```
2. **Authorized View (`canViewCompensation = true`):**
   - Fetches active salary structures via `employeeService.getSalaryStructure(emp.id, callerScope)`.
   - Renders formatted INR values (e.g. `₹28,000` + `₹2,000 Incentive`).
3. **Restricted View (`canViewCompensation = false` — HR Admins, Managers, Employees):**
   - Renders a protected badge: `<ShieldAlert /> Restricted CTC (Confidential)`.
   - No PostgREST network request to `employee_salary_structures` is permitted to leak CTC data.
4. **Database RLS Policy:**
   - PostgreSQL RLS policy `salary_payroll_admin_tenant` denies unauthenticated, HR admin, or cross-tenant callers at the database level.

---

### 5. Filtering and Search Features

- **Text Search:** Live multi-attribute search matching `first_name`, `last_name`, `employee_code`, and `designation`.
- **Department Filter:** Dynamic dropdown populated from `policyService.getDepartments(clientId)`.
- **Location Filter:** Dynamic dropdown populated from `policyService.getWorkLocations(clientId)`.
- **Status Filter:** Selectable filtering across `ALL`, `ACTIVE`, `ON_NOTICE`, `SUSPENDED`, `TERMINATED`.
- **Empty State:** Dedicated empty search notice with a one-click "Clear All Filters" button.
- **Loading Skeleton:** Pulsating shimmer table rows preserving layout dimensions during data retrieval.
- **Error Handling:** Actionable banner with a "Retry" button.

---

### 6. Navigation Flow

- **Row Click:** Routes to `/workspace/:clientId/employees/:employeeId` (or `/workspace/employees/:employeeId`).
- **Onboard Button:** Visible to authorized roles (`super_admin`, `client_admin`, `hr_admin`), routing to `/workspace/:clientId/employees/new`.
- **Refresh Control:** Dedicated manual refresh button with spinning state indicator.
