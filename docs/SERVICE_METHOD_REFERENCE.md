# Avencis Workforce Management (WFM)
# Domain Service Method Reference

**Document Reference:** `docs/SERVICE_METHOD_REFERENCE.md`  
**Milestone:** 2.2 — Typed Domain Service Layer  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. authService (`src/services/authService.ts`)

| Method | Parameters | Return Type | Database Tables | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getSession()` | None | `Promise<ServiceResponse<Session \| null>>` | GoTrue Auth | Retrieves current active auth session. |
| `getCurrentUser()` | None | `Promise<ServiceResponse<User \| null>>` | GoTrue Auth | Retrieves authenticated GoTrue user. |
| `onAuthStateChange(callback)` | `(event, session) => void` | `{ unsubscribe: () => void }` | GoTrue Auth | Subscribes to real-time auth state events. |
| `signIn(credentials)` | `{ email, password? }` | `Promise<ServiceResponse<{ session, user }>>` | GoTrue Auth | Validates email syntax; executes password auth. |
| `signOut()` | None | `Promise<ServiceResponse<void>>` | GoTrue Auth | Clears user session and tokens. |
| `getUserProfile(userId)` | `userId: string` | `Promise<ServiceResponse<UserProfileRow>>` | `user_profiles` | Retrieves RBAC profile, role, and tenant client ID. |
| `getEmployeeProfile(employeeId)` | `employeeId: string` | `Promise<ServiceResponse<EmployeeRow>>` | `employees` | Resolves linked employee record for employee accounts. |
| `resolveUserContext()` | None | `Promise<ServiceResponse<ResolvedUserContext>>` | `user_profiles`, `employees` | Composite resolution of session, profile, role & tenant. |
| `getDevPersonas()` | None | `User[]` | Mock Store | Exposes developer personas in dev preview mode. |
| `verifyRole(user, allowedRoles)` | `user: UserProfileRow, allowedRoles: string[]` | `boolean` | None (In-memory) | Validates user role against allowed RBAC list. |

---

## 2. policyService (`src/services/policyService.ts`)

| Method | Parameters | Return Type | Database Tables | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getAccessibleClients()` | None | `Promise<ServiceResponse<ClientRow[]>>` | `clients` | Super Admin receives all; tenant admin receives own. |
| `getClient(clientId)` | `clientId: string` | `Promise<ServiceResponse<ClientRow>>` | `clients` | Retrieves individual client record by primary key. |
| `getClientById(clientId)` | `clientId: string` | `Promise<ServiceResponse<ClientRow>>` | `clients` | Alias for `getClient()`. |
| `getLegalEntities(clientId)` | `clientId: string` | `Promise<ServiceResponse<LegalEntityRow[]>>` | `client_legal_entities` | Retrieves registered legal entities for client. |
| `getWorkLocations(clientId)` | `clientId: string` | `Promise<ServiceResponse<WorkLocationRow[]>>` | `work_locations` | Fetches active worksites with GPS coordinates & radii. |
| `getDepartments(clientId)` | `clientId: string` | `Promise<ServiceResponse<DepartmentRow[]>>` | `departments` | Retrieves organizational departments. |
| `getClientPolicy(clientId)` | `clientId: string` | `Promise<ServiceResponse<ClientPolicyRow>>` | `client_policies` | Fetches 20 operational rules and payroll parameters. |
| `updateClientPolicy(clientId, updates)` | `clientId: string, updates: ClientPolicyUpdate` | `Promise<ServiceResponse<ClientPolicyRow>>` | `client_policies` | Updates attendance, leave, or payroll policy settings. |

---

## 3. employeeService (`src/services/employeeService.ts`)

| Method | Parameters | Return Type | Database Tables | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getEmployees(clientId?, filter?)` | `clientId?: string, filter?: EmployeeFilter` | `Promise<ServiceResponse<EmployeeRow[]>>` | `employees` | Retrieves directory filtered by status, department, etc. |
| `getEmployeeById(id)` | `id: string` | `Promise<ServiceResponse<EmployeeRow>>` | `employees` | Fetches single employee profile by UUID. |
| `createEmployee(data)` | `data: EmployeeInsert` | `Promise<ServiceResponse<EmployeeRow>>` | `employees` | Validates PAN (10 chars), email, mobile; inserts record. |
| `updateEmployee(id, updates)` | `id: string, updates: EmployeeUpdate` | `Promise<ServiceResponse<EmployeeRow>>` | `employees` | Updates employee details under tenant RLS. |
| `getSalaryStructure(employeeId)` | `employeeId: string` | `Promise<ServiceResponse<SalaryStructureRow \| null>>` | `employee_salary_structures` | Retrieves active compensation structure (admin only). |
| `getBankDetails(employeeId)` | `employeeId: string` | `Promise<ServiceResponse<BankDetailsRow \| null>>` | `employee_bank_details` | Retrieves bank account details (admin or employee only). |

---

## 4. attendanceService (`src/services/attendanceService.ts`)

| Method | Parameters | Return Type | Database Tables | Description |
| :--- | :--- | :--- | :--- | :--- |
| `recordPunch(payload)` | `payload: RecordPunchPayload` | `Promise<ServiceResponse<{ event, muster }>>` | `attendance_events`, `daily_attendance_records` | Calculates Haversine geofence, logs immutable event, updates muster. |
| `getDailyAttendance(filter)` | `filter: AttendanceFilter` | `Promise<ServiceResponse<DailyAttendanceRow[]>>` | `daily_attendance_records` | Queries attendance muster roll for client/employee/date. |
| `getAttendanceEvents(filter)` | `filter: { clientId, employeeId?, date? }` | `Promise<ServiceResponse<AttendanceEventRow[]>>` | `attendance_events` | Retrieves raw immutable GPS telemetry punch audit log. |
| `submitRegularisation(payload)` | `payload: RegularisationRequestPayload` | `Promise<ServiceResponse<AttendanceCorrectionRow>>` | `attendance_corrections` | Validates reason ($\ge 5$ chars); inserts pending correction. |
| `submitAttendanceCorrection(p)` | `payload: RegularisationRequestPayload` | `Promise<ServiceResponse<AttendanceCorrectionRow>>` | `attendance_corrections` | Alias for `submitRegularisation()`. |
| `reviewRegularisation(id, dec)` | `id: string, decision: { status, reviewerId, remarks? }` | `Promise<ServiceResponse<AttendanceCorrectionRow>>` | `attendance_corrections`, `daily_attendance_records` | Approves/rejects correction; adjusts muster on approval. |
| `evaluateGeofence(emp, target)` | `emp: Coordinates, target: LocationCoordinates` | `GeofenceEvaluationResult` | None (Mathematical) | Computes distance and evaluates within vs out of bounds. |

---

## 5. leaveService (`src/services/leaveService.ts`)

| Method | Parameters | Return Type | Database Tables | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getLeaveBalances(employeeId, yr?)` | `employeeId: string, year?: number` | `Promise<ServiceResponse<LeaveBalanceRow[]>>` | `leave_balances` | Retrieves PL, CL, SL opening, credited, used, closing. |
| `getLeaveRequests(filter)` | `filter: LeaveRequestFilter` | `Promise<ServiceResponse<LeaveRequestRow[]>>` | `leave_requests` | Queries leave applications by client, employee, status. |
| `submitLeaveRequest(payload)` | `payload: SubmitLeavePayload` | `Promise<ServiceResponse<LeaveRequestRow>>` | `leave_requests` | Validates date order, totalDays > 0, reason length $\ge 5$. |
| `reviewLeaveRequest(id, dec)` | `id: string, decision: { status, reviewerId, reviewerEmployeeId?, remarks? }` | `Promise<ServiceResponse<LeaveRequestRow>>` | `leave_requests`, `leave_balances` | Enforces anti-self-approval; deducts balance on approval. |
| `cancelLeaveRequest(id, empId)` | `id: string, employeeId: string` | `Promise<ServiceResponse<LeaveRequestRow>>` | `leave_requests` | Allows applicant to cancel pending leave application. |

---

## 6. payrollService (`src/services/payrollService.ts`)

| Method | Parameters | Return Type | Database Tables | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getPayrollRuns(clientId, yr?)` | `clientId: string, year?: number` | `Promise<ServiceResponse<PayrollRunRow[]>>` | `payroll_runs` | Retrieves payroll run batches for client. |
| `getPayrollRunById(runId)` | `runId: string` | `Promise<ServiceResponse<PayrollRunRow>>` | `payroll_runs` | Retrieves single payroll batch summary by ID. |
| `getPayrollItems(runId)` | `runId: string` | `Promise<ServiceResponse<PayrollItemRow[]>>` | `payroll_items` | Fetches employee line items (gross, deductions, net). |
| `getPayslips(filter)` | `filter: { clientId?, employeeId?, periodMonth?, periodYear? }` | `Promise<ServiceResponse<PayslipRow[]>>` | `payslips` | Retrieves published Form XIX payslips. |
| `calculateProrationDays(cal, unp, div)` | `cal: number, unp: number, div: '26' \| '30' \| 'calendar_days'` | `ProrationCalculationResult` | None (Mathematical) | Computes paid days, divisor, and payable ratio. |
| `assertPayrollNotLocked(run)` | `run: PayrollRunRow` | `ServiceResponse<void>` | None (In-memory guard) | Fails with `PERMISSION_ERROR` if run status is `'locked'`. |

---

## 7. reportingService (`src/services/reportingService.ts`)

| Method | Parameters | Return Type | Database Tables | Description |
| :--- | :--- | :--- | :--- | :--- |
| `getAuditLogs(filter?)` | `filter?: AuditLogFilter` | `Promise<ServiceResponse<AuditLogRow[]>>` | `audit_logs` | Queries immutable security ledger by client, role, date. |
| `logAuditEvent(event)` | `event: { clientId?, actorName, actorEmail, actorRole, action, targetEntity, targetId, details, severity? }` | `Promise<ServiceResponse<AuditLogRow>>` | `audit_logs` | Appends new audit record to compliance ledger. |
| `getAttendanceSummary(client, start, end)` | `clientId: string, startDate: string, endDate: string` | `Promise<ServiceResponse<AttendanceSummaryReport>>` | `daily_attendance_records` | Aggregates presence, absence, half-day, and leave rates. |
| `getFormXIXData(clientId, month, yr)` | `clientId: string, periodMonth: number, periodYear: number` | `Promise<ServiceResponse<FormXIXRegisterData>>` | `payroll_runs`, `payroll_items`, `employees` | Prepares structured statutory muster roll and wage register. |

---

## 8. Summary of Shared Utilities & Models

- `serviceConfig.ts`: `getDataSourceMode()`, `setDevDataSourceMode()`, `isMockMode()`.
- `serviceErrors.ts`: `ServiceError`, `handleSupabaseError()`, `createValidationError()`, `createNotFoundError()`, `createPermissionError()`, `createAuthError()`, `createNetworkError()`, `formatErrorMessage()`.
- `serviceTypes.ts`: `calculateHaversineDistanceMeters()`, `successResponse()`, `errorResponse()`.
