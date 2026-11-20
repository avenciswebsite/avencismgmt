# AVENCIS WORKFORCE MANAGEMENT (WFM)
# MILESTONE 2.4E: PAYROLL MANAGEMENT
## MULTI-TENANT ROLE & PAYROLL PERMISSION MATRIX (REVISED)

> **Document:** `docs/PAYROLL_ROLE_PERMISSION_MATRIX.md`  
> **Status:** AUTHORITATIVE RBAC SPECIFICATION (REVISED POST-REVIEW)  
> **Milestone:** 2.4E (Payroll Management)  
> **Security Baseline:** Fail-Closed Multitenancy & Principle of Least Privilege  

---

## 1. MULTI-TENANT ENTITY ARCHITECTURE & RESPONSIBILITY SEPARATION

The system enforces a clean separation of corporate dimensions. **Payroll grouping is driven by legal employer and processing responsibility, rather than employment arrangement alone:**

```
+----------------------------------------------------------------------------------------------------+
| 1. LEGAL EMPLOYER             | client_legal_entities (Holds PAN, TAN, PF/ESIC Registrations, Challans) |
| 2. PAYROLL PROCESSOR          | Avencis WFM Managed Operations vs Client In-House Payroll           |
| 3. TENANT BOUNDARY            | clients (Primary isolation boundary enforced by RLS)               |
| 4. PHYSICAL WORK LOCATION     | work_locations (Physical site; determines PT State Jurisdiction)   |
| 5. ORGANIZATIONAL DEPARTMENT  | departments (Internal cost center and operational hierarchy)       |
+----------------------------------------------------------------------------------------------------+
```

### Supported Employment Arrangements:
- `DIRECT_PERMANENT`: Employed directly by client legal entity; full statutory coverage.
- `DIRECT_CONTRACT`: Fixed-term direct engagement under client legal entity.
- `DEPUTED_STAFFING`: Staffing specialist deployed at client site; processed by Avencis.
- `INTERN`: Stipend-based apprentice; exempt from EPF/ESIC wage thresholds.

*Note:* All arrangements under a given legal employer can be calculated within the consolidated tenant batch, with statutory reporting partitioned by legal employer.

---

## 2. ROLE-BASED ACCESS CONTROL (RBAC) PERMISSION MATRIX

| Permission / Capability | Super Admin | Client Admin | Payroll Admin | HR Admin | Client Manager | Location Manager | Employee |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **View Salary Structure CTC** | ✅ Global | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ✅ Self Only |
| **Modify Salary Structure** | ✅ Global | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **View Employee Bank Coordinates** | ✅ Global | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ✅ Self Only |
| **Modify Employee Bank Coordinates** | ✅ Global | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **Initiate Draft Payroll Run** | ✅ Global | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **Execute Calculation Engine** | ✅ Global | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **Input Authorised Overtime / Incentives** | ✅ Global | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **Bypass Pending Regularisations** | ❌ **PROHIBITED** | ❌ **PROHIBITED** | ❌ **PROHIBITED** | ❌ **PROHIBITED** | ❌ **PROHIBITED** | ❌ **PROHIBITED** | ❌ **PROHIBITED** |
| **Formal Approval Sign-off** | ✅ Global | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **Final Lock & Publish Payslips** | ✅ Global | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **View Published Form XIX Register** | ✅ Global | ✅ Tenant | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ❌ Denied |
| **View Self Form XIX Payslip** | ❌ (Unless emp) | ❌ (Unless emp) | ❌ (Unless emp) | ❌ (Unless emp) | ❌ (Unless emp) | ❌ (Unless emp) | ✅ Self Only |
| **Print Form XIX Payslip (A4)** | ✅ Global | ✅ Tenant | ✅ Tenant | ✅ Tenant | ❌ Denied | ❌ Denied | ✅ Self Only |

---

## 3. STRICT ATTENDANCE FINALIZATION GATE ENFORCEMENT [REVISED DECISION]

- **Hard Blocking Invariant:** In accordance with corporate governance decisions, **neither Client Admin nor Super Admin can approve or lock a payroll run while unresolved attendance regularisations exist for that period.**
- **Enforcement:**
  - When initiating or approving a run, the system queries:
    ```sql
    SELECT COUNT(*) FROM attendance_corrections 
    WHERE client_id = p_client_id 
      AND status = 'PENDING'
      AND attendance_date BETWEEN p_period_start AND p_period_end;
    ```
  - If count $> 0$, the transition is strictly blocked with:
    `ATTENDANCE_NOT_FINALIZED: Cannot approve or lock payroll while X attendance regularisation requests remain unresolved.`

---

## 4. DETAILED ROLE BOUNDARIES

### 4.1 Payroll Admin (`payroll_admin`)
- Responsible for operational calculation, attendance verification, and entering authorised overtime and incentives during the `REVIEW` stage.
- **Segregation of Duties:** Barred from giving final executive approval or locking batches.

### 4.2 Client Admin (`client_admin`)
- Holds full managerial authority for their tenant organization.
- Performs formal executive approval and locks payroll batches after verifying attendance finalization.

### 4.3 HR Admin (`hr_admin`)
- **Compensation Privacy Gate:** Strictly denied access to fixed base salaries, salary structures, individual line items, and bank accounts.
- **Disbursement Support:** Once a batch is locked, HR Admin can access published Form XIX payslip registers to facilitate employee communications.

### 4.4 Employee Self-Service (`employee`)
- Can access only their own active salary structure and own bank coordinates.
- Can access their Form XIX payslip **only after** the run is locked and `is_published = TRUE`.
