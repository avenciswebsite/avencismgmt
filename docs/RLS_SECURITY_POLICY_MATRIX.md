# AVENCIS WORKFORCE MANAGEMENT (WFM)
## ROW LEVEL SECURITY (RLS) POLICY MATRIX & ACCESS CONTROL SPECIFICATION

**Project:** Avencis ERP / Business Management Platform  
**Target Backend:** PostgreSQL 15+ / Supabase  
**Security Model:** Database-Level Multi-Tenant Row Level Security (RLS)  
**Roles Tested:** Super Admin, HR Admin, Payroll Admin, Client Admin, Client Manager, Location Manager, Employee  
**Status:** **AUTHORITATIVE SECURITY SPECIFICATION**  

---

## 1. System Role Hierarchy & Definitions

```
                     ┌──────────────────────────────┐
                     │         super_admin          │ (Global Platform Governance)
                     └──────────────┬───────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   client_admin   │      │     hr_admin     │      │  payroll_admin   │ (Tenant Administration)
└─────────┬────────┘      └─────────┬────────┘      └─────────┬────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      ▼                           ▼
            ┌──────────────────┐        ┌──────────────────┐
            │  client_manager  │        │ location_manager │ (Mid-Level Operational)
            └─────────┬────────┘        └─────────┬────────┘
                      │                           │
                      └─────────────┬─────────────┘
                                    │
                                    ▼
                         ┌──────────────────┐
                         │     employee     │ (End-Worker Self-Service)
                         └──────────────────┘
```

---

## 2. Table-by-Role Permission Matrix

| Table Name | `super_admin` | `client_admin` | `hr_admin` | `payroll_admin` | `client_manager` | `location_manager` | `employee` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **`clients`** | ALL | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) |
| **`client_legal_entities`** | ALL | ALL (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) |
| **`client_policies`** | ALL | ALL (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) |
| **`work_locations`** | ALL | ALL (Own) | ALL (Own) | SELECT (Own) | SELECT (Own) | ALL (Own Site) | SELECT (Own) |
| **`departments`** | ALL | ALL (Own) | ALL (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) |
| **`user_profiles`** | ALL | ALL (Own) | ALL (Own) | SELECT (Own) | SELECT (Team) | SELECT (Site) | SELECT (Self) |
| **`employees`** | ALL | ALL (Own) | ALL (Own) | SELECT (Own) | SELECT (Team) | SELECT (Site) | SELECT (Self) |
| **`employee_salary_structures`** | ALL | ALL (Own) | NO ACCESS | ALL (Own) | NO ACCESS | NO ACCESS | SELECT (Self Active) |
| **`employee_bank_details`** | ALL | ALL (Own) | NO ACCESS | ALL (Own) | NO ACCESS | NO ACCESS | SELECT (Self) |
| **`attendance_events`** | SELECT (All) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Team) | SELECT (Site) | INSERT & SELECT (Self) |
| **`daily_attendance_records`** | ALL | ALL (Own) | ALL (Own) | SELECT (Own) | ALL (Team) | ALL (Site) | SELECT, INSERT & UPDATE (Self) |
| **`attendance_corrections`** | ALL | ALL (Own) | ALL (Own) | NO ACCESS | ALL (Team) | ALL (Site) | INSERT & SELECT (Self) |
| **`leave_balances`** | ALL | ALL (Own) | ALL (Own) | SELECT (Own) | SELECT (Team) | SELECT (Site) | SELECT (Self) |
| **`leave_requests`** | ALL | ALL (Own) | ALL (Own) | SELECT (Own) | ALL (Team) | ALL (Site) | INSERT & SELECT (Self) |
| **`payroll_runs`** | ALL | ALL (Own) | SELECT (Own) | ALL (Own) | NO ACCESS | NO ACCESS | NO ACCESS |
| **`payroll_items`** | ALL | ALL (Own) | SELECT (Own) | ALL (Own) | NO ACCESS | NO ACCESS | SELECT (Self Locked) |
| **`payslips`** | ALL | ALL (Own) | SELECT (Own) | ALL (Own) | NO ACCESS | NO ACCESS | SELECT (Self Published) |
| **`statutory_pt_slabs`** | ALL | SELECT | SELECT | SELECT | SELECT | SELECT | SELECT |
| **`statutory_holidays`** | ALL | ALL (Own) | ALL (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) | SELECT (Own) |
| **`audit_logs`** | SELECT (All) | SELECT (Own) | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |

*Note: ALL operations on `audit_logs` and `attendance_events` are strictly INSERT or SELECT. No UPDATE or DELETE policies exist for any role.*

---

## 3. Strict Negative Test Scenarios Enforced by RLS

The database policies guarantee that the following attacks are thwarted at the PostgreSQL engine level, even if frontend code is bypassed:

1. **Cross-Tenant Data Probe:**
   - *Attack:* A Client Admin for `client-suman` submits `SELECT * FROM employees WHERE client_id = 'client-maha'`.
   - *Result:* Returns 0 rows. PostgreSQL filters out records where `client_id != public.get_user_client_id()`.
2. **Employee Payslip Snooping:**
   - *Attack:* An Employee with `employee_id = 'emp-01'` executes `SELECT * FROM payroll_items WHERE employee_id = 'emp-02'`.
   - *Result:* Returns 0 rows. Policy `payroll_items_employee_self_select` enforces `employee_id = public.get_user_employee_id()`.
3. **Unpublished Payroll Preview Leaks:**
   - *Attack:* An Employee queries `payroll_items` for the current month while the run is in `draft` status.
   - *Result:* Returns 0 rows. The RLS policy requires `r.status IN ('approved', 'locked')`.
4. **Compensation Data Shielding from General HR:**
   - *Attack:* An HR Admin tries to view bank account numbers or fixed salary CTCs.
   - *Result:* Returns 403 Forbidden / 0 rows. Policies on `employee_salary_structures` and `employee_bank_details` restrict access strictly to `payroll_admin`, `client_admin`, `super_admin`, and the employee themselves.
5. **Retroactive Muster Tampering on Locked Periods:**
   - *Attack:* A manager tries to approve an attendance regularisation for October 2026 after the October payroll run is marked `'locked'`.
   - *Result:* Postgres trigger `trg_guard_payroll_run_lock` halts the transaction with an exception.
