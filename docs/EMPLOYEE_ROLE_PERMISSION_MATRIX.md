# Avencis WFM — Employee Role Permission Matrix
## Milestone 2.4B: Multi-Tenant Role Hierarchy, Security Gates & Data Boundaries

---

### 1. Role Hierarchy Overview

Avencis Workforce Management enforces an 8-tier role model across the organizational hierarchy. Access controls are applied via PostgreSQL Row-Level Security (RLS) policies at the database layer and corroborated at the domain service layer.

---

### 2. Comprehensive Permission Matrix

| Role | Employee Directory | Employee Profile (Personal/Org) | Statutory & KYC (PAN/Aadhaar) | Compensation CTC (`salary_structures`) | Bank Coordinates (`bank_details`) | Onboard Employee (`createEmployee`) | Edit Employee (`updateEmployee`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`super_admin`** | Global (All Clients) | Global (All Clients) | Global (All Clients) | **FULL GLOBAL ACCESS** | **FULL GLOBAL ACCESS** | Global (Any Client) | Global (Any Client) |
| **`client_admin`** | Own Client Only | Own Client Only | Own Client Only | **FULL TENANT ACCESS** | **FULL TENANT ACCESS** | Own Client Only | Own Client Only |
| **`hr_admin`** | Own Client Only | Own Client Only | Own Client Only | <span style="color:red">**DENIED (403)**</span> | <span style="color:red">**DENIED (403)**</span> | Own Client Only | Own Client Only |
| **`payroll_admin`** | Own Client Only | Own Client Only | Own Client Only | **FULL TENANT ACCESS** | **FULL TENANT ACCESS** | <span style="color:red">**DENIED**</span> | <span style="color:red">**DENIED**</span> |
| **`client_manager`** | Own Department | Own Department | View Only | <span style="color:red">**DENIED (403)**</span> | <span style="color:red">**DENIED (403)**</span> | <span style="color:red">**DENIED**</span> | <span style="color:red">**DENIED**</span> |
| **`location_manager`**| Own Worksite | Own Worksite | View Only | <span style="color:red">**DENIED (403)**</span> | <span style="color:red">**DENIED (403)**</span> | <span style="color:red">**DENIED**</span> | Worksite Only |
| **`employee`** | Self Only | Self Only | Self Only | **Self Active Record Only** | **Self Record Only** | <span style="color:red">**DENIED**</span> | <span style="color:red">**DENIED**</span> |

---

### 3. Key Security Gates & Enforcement Mechanisms

#### Gate A: Financial Remuneration Isolation (CTC & Allowances)
- **Problem Statement:** In many legacy HR tools, any manager with access to an employee profile can see gross base salary, bonuses, and allowance breakdowns.
- **Avencis Guard:**
  - `public.employees` contains zero compensation fields.
  - Remuneration is isolated in `public.employee_salary_structures`.
  - Database RLS policy `salary_payroll_admin_tenant` restricts access exclusively to `super_admin`, `client_admin`, `payroll_admin`, or `employee` (for their own active record).
  - Calling `employeeService.getSalaryStructure(employeeId)` as an `hr_admin` or peer employee immediately triggers `PERMISSION_ERROR` with HTTP status `403`.

#### Gate B: Bank Account Disbursement Coordinates
- **Problem Statement:** Bank account numbers, IFSC codes, and verification status represent high-risk PII subject to financial fraud.
- **Avencis Guard:**
  - Bank coordinates are isolated in `public.employee_bank_details`.
  - Database RLS policy `bank_payroll_admin_tenant` denies read/write access to HR Admins, Location Managers, and unauthorized peers.
  - Calling `employeeService.getBankDetails(employeeId)` as an `hr_admin` or peer employee immediately triggers `PERMISSION_ERROR` with HTTP status `403`.

#### Gate C: Tenant Boundary & Tamper Resistance
- **Problem Statement:** Malicious users attempting URL manipulation (e.g. changing `:clientId` or employee ID parameter).
- **Avencis Guard:**
  - Service methods inspect caller claims (`callerScope.clientId`).
  - Cross-tenant queries are blocked with `createPermissionError('Cross-tenant access forbidden')`.
  - Database RLS enforces `client_id = public.get_user_client_id()` at the PostgreSQL engine level.

#### Gate D: Self-Service Peer Isolation
- **Problem Statement:** Regular employees attempting to view peer personnel records or compensation.
- **Avencis Guard:**
  - When `callerScope.role === 'employee'`, lookups for any `id !== callerScope.employeeId` are rejected with `createPermissionError('Access denied: Employees may only view their own profile.')`.
