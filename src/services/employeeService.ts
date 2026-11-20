/**
 * Avencis Workforce Management (WFM)
 * Employee Directory, Profile & Sensitive Compensation Service
 *
 * Enforces strict separation between ordinary employee directory lookups
 * and sensitive financial information (salary structures and bank details).
 * Role-based authorization is enforced at both service layer and database RLS.
 */

import { supabase } from '../lib/supabase';
import { isMockMode } from './serviceConfig';
import {
  ServiceResponse,
  EmployeeRow,
  EmployeeInsert,
  EmployeeUpdate,
  SalaryStructureRow,
  SalaryStructureInsert,
  BankDetailsRow,
  BankDetailsInsert,
  EmployeeFilter,
  CallerScope,
  successResponse,
  errorResponse,
} from './serviceTypes';
import {
  handleSupabaseError,
  createValidationError,
  createNotFoundError,
  createPermissionError,
} from './serviceErrors';
import { store } from '../data/store';

// Roles permitted to view sensitive compensation CTC and banking coordinates
const SENSITIVE_FINANCIAL_ROLES = ['super_admin', 'client_admin', 'payroll_admin'];

export const employeeService = {
  /**
   * Retrieves employees matching filter criteria.
   * Ordinary directory queries return staff details WITHOUT bank information.
   * Enforces tenant scoping and employee self-service restrictions.
   */
  async getEmployees(filter?: EmployeeFilter, callerScope?: CallerScope): Promise<ServiceResponse<EmployeeRow[]>> {
    // 1. Role Scope Enforcements
    if (callerScope?.role) {
      // Regular employees may only see their own record
      if (callerScope.role === 'employee') {
        if (!callerScope.employeeId) {
          return successResponse([]);
        }
        const selfResult = await this.getEmployeeById(callerScope.employeeId, callerScope);
        return selfResult.success && selfResult.data ? successResponse([selfResult.data]) : successResponse([]);
      }

      // Tenant-level roles cannot query other clients (Cross-tenant block)
      if (callerScope.role !== 'super_admin' && callerScope.clientId) {
        if (filter?.clientId && filter.clientId !== callerScope.clientId) {
          return errorResponse(
            createPermissionError(
              `Cross-tenant access forbidden. You cannot access employee data outside your client organization.`
            )
          );
        }
        // Force client scoping
        filter = { ...filter, clientId: callerScope.clientId };
      }
    }

    if (isMockMode()) {
      let emps = store.getEmployees();
      if (filter?.clientId) {
        emps = emps.filter(e => e.clientId === filter.clientId);
      }
      if (filter?.workLocationId && filter.workLocationId !== 'ALL') {
        emps = emps.filter(e => e.workLocationId === filter.workLocationId);
      }
      if (filter?.departmentId && filter.departmentId !== 'ALL') {
        emps = emps.filter(e => e.departmentId === filter.departmentId);
      }
      if (filter?.status) {
        emps = emps.filter(e => e.status === filter.status);
      }
      if (filter?.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        emps = emps.filter(
          e =>
            e.firstName.toLowerCase().includes(q) ||
            e.lastName.toLowerCase().includes(q) ||
            e.employeeCode.toLowerCase().includes(q) ||
            e.designation.toLowerCase().includes(q)
        );
      }

      const mockRows: EmployeeRow[] = emps.map(e => ({
        id: e.id,
        client_id: e.clientId,
        legal_entity_id: e.legalEntityId || '',
        work_location_id: e.workLocationId || '',
        department_id: e.departmentId || null,
        employee_code: e.employeeCode,
        first_name: e.firstName,
        last_name: e.lastName,
        email: e.email,
        mobile: e.mobile,
        designation: e.designation,
        joining_date: e.joiningDate,
        employment_arrangement: (e.employmentType === 'CONTRACT' ? 'DIRECT_CONTRACT' : 'DIRECT_PERMANENT') as EmployeeRow['employment_arrangement'],
        status: (e.status || 'ACTIVE') as EmployeeRow['status'],
        pan_number: e.panNumber || 'MOCKPAN123',
        aadhaar_number: e.aadhaarNumber || '0000 0000 0000',
        uan_number: e.uanNumber || null,
        esic_number: e.esicNumber || null,
        avatar_url: e.avatarUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      return successResponse(mockRows);
    }

    try {
      let query = supabase.from('employees').select('*').order('first_name');

      if (filter?.clientId) {
        query = query.eq('client_id', filter.clientId);
      }
      if (filter?.workLocationId && filter.workLocationId !== 'ALL') {
        query = query.eq('work_location_id', filter.workLocationId);
      }
      if (filter?.departmentId && filter.departmentId !== 'ALL') {
        query = query.eq('department_id', filter.departmentId);
      }
      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.employmentArrangement) {
        query = query.eq('employment_arrangement', filter.employmentArrangement);
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(handleSupabaseError(error, 'employeeService.getEmployees'));
      }

      let result = data || [];
      if (filter?.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        result = result.filter(
          e =>
            e.first_name.toLowerCase().includes(q) ||
            e.last_name.toLowerCase().includes(q) ||
            e.employee_code.toLowerCase().includes(q) ||
            e.designation.toLowerCase().includes(q)
        );
      }

      return successResponse(result);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.getEmployees'));
    }
  },

  /**
   * Retrieves a specific employee by ID.
   * Enforces self-service and tenant boundaries.
   */
  async getEmployeeById(id: string, callerScope?: CallerScope): Promise<ServiceResponse<EmployeeRow>> {
    if (!id) {
      return errorResponse(createValidationError('Employee ID is required.', 'id'));
    }

    // Role boundary checks
    if (callerScope?.role === 'employee' && callerScope.employeeId && callerScope.employeeId !== id) {
      return errorResponse(
        createPermissionError('Access denied: Employees may only view their own profile.')
      );
    }

    if (isMockMode()) {
      const emp = store.getEmployee(id);
      if (!emp) {
        return errorResponse(createNotFoundError('Employee', id));
      }

      if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && emp.clientId !== callerScope.clientId) {
        return errorResponse(
          createPermissionError('Cross-tenant access forbidden. You cannot view employees outside your organization.')
        );
      }

      return successResponse<EmployeeRow>({
        id: emp.id,
        client_id: emp.clientId,
        legal_entity_id: emp.legalEntityId || '',
        work_location_id: emp.workLocationId || '',
        department_id: emp.departmentId || null,
        employee_code: emp.employeeCode,
        first_name: emp.firstName,
        last_name: emp.lastName,
        email: emp.email,
        mobile: emp.mobile,
        designation: emp.designation,
        joining_date: emp.joiningDate,
        employment_arrangement: (emp.employmentType === 'CONTRACT' ? 'DIRECT_CONTRACT' : 'DIRECT_PERMANENT') as EmployeeRow['employment_arrangement'],
        status: (emp.status || 'ACTIVE') as EmployeeRow['status'],
        pan_number: emp.panNumber || 'MOCKPAN123',
        aadhaar_number: emp.aadhaarNumber || '0000 0000 0000',
        uan_number: emp.uanNumber || null,
        esic_number: emp.esicNumber || null,
        avatar_url: emp.avatarUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'employeeService.getEmployeeById'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('Employee', id));
      }

      if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && data.client_id !== callerScope.clientId) {
        return errorResponse(
          createPermissionError('Cross-tenant access forbidden. You cannot view employees outside your organization.')
        );
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.getEmployeeById'));
    }
  },

  /**
   * Retrieves an employee by their unique code within a client organization.
   */
  async getEmployeeByCode(clientId: string, code: string, callerScope?: CallerScope): Promise<ServiceResponse<EmployeeRow>> {
    if (!clientId || !code) {
      return errorResponse(createValidationError('Both Client ID and Employee Code are required.'));
    }

    if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && clientId !== callerScope.clientId) {
      return errorResponse(
        createPermissionError('Cross-tenant access forbidden.')
      );
    }

    if (isMockMode()) {
      const emp = store.getEmployees().find(e => e.clientId === clientId && e.employeeCode.toUpperCase() === code.toUpperCase());
      if (!emp) {
        return errorResponse(createNotFoundError('Employee with code', code));
      }
      return this.getEmployeeById(emp.id, callerScope);
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('client_id', clientId)
        .eq('employee_code', code)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'employeeService.getEmployeeByCode'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('Employee with code', code));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.getEmployeeByCode'));
    }
  },

  /**
   * Retrieves the sensitive salary structure for an employee.
   * Scoped by RLS to Super Admin, Client Admin, Payroll Admin, or the employee themselves.
   * Strictly denies HR Admins, Location Managers, and unauthorized peers (403 Forbidden).
   */
  async getSalaryStructure(employeeId: string, callerScope?: CallerScope): Promise<ServiceResponse<SalaryStructureRow>> {
    if (!employeeId) {
      return errorResponse(createValidationError('Employee ID is required.', 'employeeId'));
    }

    // Role-based financial data gatekeeper
    if (callerScope?.role) {
      const isSensitiveRole = SENSITIVE_FINANCIAL_ROLES.includes(callerScope.role);
      const isSelf = callerScope.role === 'employee' && callerScope.employeeId === employeeId;

      if (!isSensitiveRole && !isSelf) {
        return errorResponse(
          createPermissionError(
            'Access Denied: Compensation CTC is confidential and restricted to Super Admin, Client Admin, Payroll Admin, or the employee themselves.'
          )
        );
      }
    }

    if (isMockMode()) {
      const emp = store.getEmployee(employeeId);
      if (!emp) {
        return errorResponse(createNotFoundError('Employee', employeeId));
      }

      // Verify tenant boundary
      if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && emp.clientId !== callerScope.clientId) {
        return errorResponse(
          createPermissionError('Cross-tenant access forbidden: Cannot view salary of employee in another client.')
        );
      }

      const mockSalary: SalaryStructureRow = {
        id: `mock-sal-${emp.id}`,
        employee_id: emp.id,
        client_id: emp.clientId,
        fixed_monthly_base: emp.fixedMonthlySalary || 30000,
        hra: (emp.fixedMonthlySalary || 30000) * 0.4,
        conveyance: 1600,
        special_allowances: emp.otherAllowances || 1000,
        variable_incentives: emp.variableIncentive || 0,
        effective_from: emp.joiningDate || '2026-01-01',
        effective_to: null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      return successResponse(mockSalary);
    }

    try {
      const { data, error } = await supabase
        .from('employee_salary_structures')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'employeeService.getSalaryStructure'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('Salary Structure for employee', employeeId));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.getSalaryStructure'));
    }
  },

  /**
   * Retrieves the sensitive bank account details for an employee.
   * Scoped by RLS to Super Admin, Client Admin, Payroll Admin, or the employee themselves.
   * Strictly denies HR Admins, Location Managers, and unauthorized peers (403 Forbidden).
   */
  async getBankDetails(employeeId: string, callerScope?: CallerScope): Promise<ServiceResponse<BankDetailsRow>> {
    if (!employeeId) {
      return errorResponse(createValidationError('Employee ID is required.', 'employeeId'));
    }

    // Role-based bank coordinates gatekeeper
    if (callerScope?.role) {
      const isSensitiveRole = SENSITIVE_FINANCIAL_ROLES.includes(callerScope.role);
      const isSelf = callerScope.role === 'employee' && callerScope.employeeId === employeeId;

      if (!isSensitiveRole && !isSelf) {
        return errorResponse(
          createPermissionError(
            'Access Denied: Bank disbursement coordinates are restricted to Super Admin, Client Admin, Payroll Admin, or the employee themselves.'
          )
        );
      }
    }

    if (isMockMode()) {
      const emp = store.getEmployee(employeeId);
      if (!emp) {
        return errorResponse(createNotFoundError('Employee', employeeId));
      }

      // Verify tenant boundary
      if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && emp.clientId !== callerScope.clientId) {
        return errorResponse(
          createPermissionError('Cross-tenant access forbidden: Cannot view banking of employee in another client.')
        );
      }

      const mockBank: BankDetailsRow = {
        id: `mock-bank-${emp.id}`,
        employee_id: emp.id,
        client_id: emp.clientId,
        bank_name: emp.bankName || 'HDFC Bank Ltd',
        account_number: emp.accountNumber || '50100987654321',
        ifsc_code: emp.ifscCode || 'HDFC0001234',
        account_type: 'SALARY',
        is_verified: true,
        created_at: new Date().toISOString(),
      };
      return successResponse(mockBank);
    }

    try {
      const { data, error } = await supabase
        .from('employee_bank_details')
        .select('*')
        .eq('employee_id', employeeId)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'employeeService.getBankDetails'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('Bank Details for employee', employeeId));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.getBankDetails'));
    }
  },

  /**
   * Creates a new employee record with rigorous client-side and business rule validation.
   */
  async createEmployee(data: EmployeeInsert, callerScope?: CallerScope): Promise<ServiceResponse<EmployeeRow>> {
    // 1. Mandatory Fields Validation
    if (!data.client_id) return errorResponse(createValidationError('Client ID is required.', 'client_id'));
    if (!data.legal_entity_id) return errorResponse(createValidationError('Legal Entity is required.', 'legal_entity_id'));
    if (!data.work_location_id) return errorResponse(createValidationError('Work Location is required.', 'work_location_id'));
    if (!data.employee_code?.trim()) return errorResponse(createValidationError('Employee code is required.', 'employee_code'));
    if (!data.first_name?.trim()) return errorResponse(createValidationError('First name is required.', 'first_name'));
    if (!data.last_name?.trim()) return errorResponse(createValidationError('Last name is required.', 'last_name'));
    if (!data.email?.includes('@')) return errorResponse(createValidationError('A valid corporate email is required.', 'email'));
    if (!data.mobile?.trim()) return errorResponse(createValidationError('Mobile number is required.', 'mobile'));
    if (!data.joining_date) return errorResponse(createValidationError('Joining date is required.', 'joining_date'));

    // 2. Caller Permissions
    if (callerScope?.role) {
      if (['employee', 'client_manager'].includes(callerScope.role)) {
        return errorResponse(createPermissionError('Access Denied: You do not have permission to onboard new employees.'));
      }
      if (callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== data.client_id) {
        return errorResponse(createPermissionError('Cross-tenant creation forbidden. You can only onboard employees into your own organization.'));
      }
    }

    // 3. PAN Format Validation (10 chars uppercase alphanumeric)
    const cleanPan = data.pan_number?.trim().toUpperCase();
    if (!cleanPan || cleanPan.length !== 10) {
      return errorResponse(createValidationError('PAN number must be exactly 10 alphanumeric characters (e.g. ABCDE1234F).', 'pan_number'));
    }

    // 4. Aadhaar Format Validation (12 digits, spaces permitted)
    const cleanAadhaar = data.aadhaar_number?.replace(/\s+/g, '');
    if (!cleanAadhaar || cleanAadhaar.length < 12) {
      return errorResponse(createValidationError('Aadhaar number must contain at least 12 digits.', 'aadhaar_number'));
    }

    // 5. Employment Arrangement Validation
    const validArrangements = ['DIRECT_PERMANENT', 'DIRECT_CONTRACT', 'DEPUTED_STAFFING', 'INTERN'];
    const arrangement = data.employment_arrangement || 'DIRECT_PERMANENT';
    if (!validArrangements.includes(arrangement)) {
      return errorResponse(createValidationError(`Invalid employment arrangement '${arrangement}'.`, 'employment_arrangement'));
    }

    const payload: EmployeeInsert = {
      ...data,
      pan_number: cleanPan,
      aadhaar_number: data.aadhaar_number.trim(),
      employment_arrangement: arrangement as EmployeeRow['employment_arrangement'],
      status: data.status || 'ACTIVE',
    };

    if (isMockMode()) {
      // Check duplicate employee code within client
      const existing = store.getEmployees().find(
        e => e.clientId === payload.client_id && e.employeeCode.toUpperCase() === payload.employee_code.toUpperCase()
      );
      if (existing) {
        return errorResponse(createValidationError(`Employee code '${payload.employee_code}' already exists for this client.`, 'employee_code'));
      }

      const newMock = store.addEmployee({
        clientId: payload.client_id,
        legalEntityId: payload.legal_entity_id,
        workLocationId: payload.work_location_id,
        departmentId: payload.department_id || '',
        employeeCode: payload.employee_code,
        firstName: payload.first_name,
        lastName: payload.last_name,
        email: payload.email,
        mobile: payload.mobile,
        designation: payload.designation,
        joiningDate: payload.joining_date,
        employmentType: payload.employment_arrangement === 'DIRECT_CONTRACT' ? 'CONTRACT' : 'FULL_TIME',
        status: (payload.status === 'SUSPENDED' ? 'ON_NOTICE' : payload.status) || 'ACTIVE',
        panNumber: payload.pan_number,
        aadhaarNumber: payload.aadhaar_number,
        fixedMonthlySalary: 0,
        variableIncentive: 0,
        otherAllowances: 0,
        bankName: '',
        accountNumber: '',
        ifscCode: '',
      });
      return this.getEmployeeById(newMock.id, callerScope);
    }

    try {
      const { data: inserted, error } = await supabase
        .from('employees')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return errorResponse(
            createValidationError(`Employee code '${payload.employee_code}' already exists for this client.`, 'employee_code', error)
          );
        }
        return errorResponse(handleSupabaseError(error, 'employeeService.createEmployee'));
      }

      return successResponse(inserted);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.createEmployee'));
    }
  },

  /**
   * Creates or updates the salary structure record for an employee.
   * Scoped to Super Admin, Client Admin, or Payroll Admin.
   */
  async createSalaryStructure(
    data: SalaryStructureInsert,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<SalaryStructureRow>> {
    if (!data.employee_id) return errorResponse(createValidationError('Employee ID is required.', 'employee_id'));
    if (!data.client_id) return errorResponse(createValidationError('Client ID is required.', 'client_id'));
    if (typeof data.fixed_monthly_base !== 'number' || data.fixed_monthly_base < 0) {
      return errorResponse(createValidationError('Fixed monthly base salary must be a positive number.', 'fixed_monthly_base'));
    }

    if (callerScope?.role && !SENSITIVE_FINANCIAL_ROLES.includes(callerScope.role)) {
      return errorResponse(
        createPermissionError('Access Denied: Only Super Admin, Client Admin, or Payroll Admin can configure compensation structures.')
      );
    }

    if (isMockMode()) {
      const emp = store.getEmployee(data.employee_id);
      if (emp) {
        emp.fixedMonthlySalary = data.fixed_monthly_base;
        if (data.variable_incentives !== undefined) emp.variableIncentive = data.variable_incentives;
        if (data.special_allowances !== undefined) emp.otherAllowances = data.special_allowances;
      }
      return this.getSalaryStructure(data.employee_id, callerScope);
    }

    try {
      const { data: inserted, error } = await supabase
        .from('employee_salary_structures')
        .insert(data)
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'employeeService.createSalaryStructure'));
      }

      return successResponse(inserted);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.createSalaryStructure'));
    }
  },

  /**
   * Creates or updates the bank details record for an employee.
   * Scoped to Super Admin, Client Admin, or Payroll Admin.
   */
  async createBankDetails(
    data: BankDetailsInsert,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<BankDetailsRow>> {
    if (!data.employee_id) return errorResponse(createValidationError('Employee ID is required.', 'employee_id'));
    if (!data.client_id) return errorResponse(createValidationError('Client ID is required.', 'client_id'));
    if (!data.bank_name?.trim()) return errorResponse(createValidationError('Bank name is required.', 'bank_name'));
    if (!data.account_number?.trim()) return errorResponse(createValidationError('Bank account number is required.', 'account_number'));
    if (!data.ifsc_code?.trim()) return errorResponse(createValidationError('IFSC code is required.', 'ifsc_code'));

    if (callerScope?.role && !SENSITIVE_FINANCIAL_ROLES.includes(callerScope.role)) {
      return errorResponse(
        createPermissionError('Access Denied: Only Super Admin, Client Admin, or Payroll Admin can configure bank coordinates.')
      );
    }

    if (isMockMode()) {
      const emp = store.getEmployee(data.employee_id);
      if (emp) {
        emp.bankName = data.bank_name;
        emp.accountNumber = data.account_number;
        emp.ifscCode = data.ifsc_code;
      }
      return this.getBankDetails(data.employee_id, callerScope);
    }

    try {
      const { data: inserted, error } = await supabase
        .from('employee_bank_details')
        .insert(data)
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'employeeService.createBankDetails'));
      }

      return successResponse(inserted);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.createBankDetails'));
    }
  },

  /**
   * Updates an existing employee profile.
   */
  async updateEmployee(id: string, updates: EmployeeUpdate, callerScope?: CallerScope): Promise<ServiceResponse<EmployeeRow>> {
    if (!id) {
      return errorResponse(createValidationError('Employee ID is required.', 'id'));
    }

    if (callerScope?.role) {
      if (['employee'].includes(callerScope.role)) {
        return errorResponse(createPermissionError('Access Denied: Employees cannot modify their own core profile fields.'));
      }
    }

    if (isMockMode()) {
      const emp = store.getEmployee(id);
      if (emp) {
        if (updates.first_name) emp.firstName = updates.first_name;
        if (updates.last_name) emp.lastName = updates.last_name;
        if (updates.email) emp.email = updates.email;
        if (updates.mobile) emp.mobile = updates.mobile;
        if (updates.designation) emp.designation = updates.designation;
        if (updates.status) emp.status = (updates.status === 'SUSPENDED' ? 'ON_NOTICE' : updates.status) as any;
      }
      return this.getEmployeeById(id, callerScope);
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'employeeService.updateEmployee'));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'employeeService.updateEmployee'));
    }
  },
};
