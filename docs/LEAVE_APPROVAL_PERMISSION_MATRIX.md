# AVENCIS WORKFORCE MANAGEMENT (WFM)
## LEAVE APPROVAL PERMISSION MATRIX

**Document Version:** 1.0.0  
**Milestone:** 2.4D  
**Coverage:** 7 User Roles across Leave Operations & Service Layer Security  

---

### 1. Matrix Overview

The following matrix documents the operational permissions granted to each of the 7 system roles in Avencis Workforce Management regarding leave management, balance visibility, application workflows, and approval capabilities.

| Action / Capability | Super Admin | HR Admin | Payroll Admin | Client Admin | Client Manager | Location Manager | Employee |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **View Own Leave Balances** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **View Peer Leave Balances** | Yes | Yes | No | Yes | Team Only | Location Only | **No (403)** |
| **Submit Leave Request (Self)** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Submit Leave for Peer** | No | No | No | No | No | No | **No (403)** |
| **Cancel Own Pending Request** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Cancel Peer Pending Request** | Yes | Yes | No | Yes | No | No | **No (403)** |
| **View Tenant Leave Queue** | All | Tenant | No | Tenant | Dept Scope | Loc Scope | **Self Only** |
| **Approve Leave Applications** | Yes | Yes | **No (403)** | Yes | Yes (Subordinates) | Yes (Location) | **No (403)** |
| **Reject Leave Applications** | Yes | Yes | **No (403)** | Yes | Yes (Subordinates) | Yes (Location) | **No (403)** |
| **Approve Own Application** | **NO (Rule)** | **NO (Rule)** | **NO (Rule)** | **NO (Rule)** | **NO (Rule)** | **NO (Rule)** | **NO (Rule)** |
| **Manual Balance Adjustment** | Yes | Yes | No | Yes | No | No | No |
| **Cross-Tenant Access** | Yes | **No (403)** | **No (403)** | **No (403)** | **No (403)** | **No (403)** | **No (403)** |

---

### 2. Role-Specific Governance Directives

#### 1. Employee (`employee`)
- **Self-Service Only:** Can view only their own balances and requests.
- **Fail-Closed Peer Isolation:** Attempting to view another employee's balances or requests returns HTTP 403 (`PERMISSION_ERROR`).
- **Withdrawal Right:** Can cancel only requests where `status === 'PENDING'` and `employee_id === callerScope.employeeId`.

#### 2. Client Manager (`client_manager`)
- **Organizational Queue:** Can view and review leave applications for staff in their designated department or team.
- **Corporate Governance Anti-Self-Approval Rule:** If a client manager applies for leave, they are strictly prohibited from approving their own request. Their request must be approved by the Client Admin, HR Admin, or Super Admin.

#### 3. Location Manager (`location_manager`)
- **Location Scope:** Reviews applications for staff assigned to their operational work location.
- **Corporate Governance Anti-Self-Approval Rule:** Prohibited from approving their own requests.

#### 4. Payroll Admin (`payroll_admin`)
- **Read-Only Ledger Consumer:** Consumes approved leave data for payroll proration and paid-day calculation.
- **No Approval Authority:** Prohibited from approving or rejecting leave requests to preserve separation of duties between leave administration and payroll disbursement.

#### 5. HR Admin & Client Admin (`hr_admin`, `client_admin`)
- **Full Operational Scope:** Can review, approve, and reject leave requests across their client tenant.
- **Anti-Self-Approval Active:** Even Client Admins and HR Admins cannot approve their own personal leave requests.

#### 6. Super Admin (`super_admin`)
- **Global Governance:** Can inspect cross-client queues and resolve escalations.
- **Anti-Self-Approval Active:** Universal anti-self-approval rule applies even to Super Admins.

---

### 3. Database & RLS Enforcement

1. **Table `leave_balances`:**
   - Employees can SELECT records matching `auth.uid() = profile.id` and `employee_id = profile.employee_id`.
   - Direct unauthenticated updates are blocked by PostgreSQL RLS.
2. **Table `leave_requests`:**
   - Employees can INSERT records only with their own `employee_id`.
   - Anonymous inserts and cross-tenant reads are rejected at the database boundary.
