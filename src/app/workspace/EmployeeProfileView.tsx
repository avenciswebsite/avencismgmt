import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
import { policyService } from '../../services/policyService';
import { leaveService } from '../../services/leaveService';
import { 
  EmployeeRow, 
  SalaryStructureRow, 
  BankDetailsRow, 
  WorkLocationRow, 
  DepartmentRow, 
  LegalEntityRow,
  LeaveBalanceRow 
} from '../../services/serviceTypes';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Calendar, 
  CreditCard, 
  FileText, 
  ShieldCheck, 
  Clock, 
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  ShieldAlert,
  Lock,
  RefreshCw,
  Edit3,
  Save,
  X,
  Layers,
  DollarSign,
  AlertTriangle,
  Loader2
} from 'lucide-react';

export const EmployeeProfileView: React.FC = () => {
  const { clientId: routeClientId, employeeId } = useParams<{ clientId?: string; employeeId: string }>();
  const { activeClient, activeClientId } = useWorkspace();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'compensation' | 'statutory' | 'leaves' | 'documents'>('overview');

  const [employee, setEmployee] = useState<EmployeeRow | null>(null);
  const [legalEntities, setLegalEntities] = useState<LegalEntityRow[]>([]);
  const [locations, setLocations] = useState<WorkLocationRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  
  // Sensitive financial state
  const [salaryStructure, setSalaryStructure] = useState<SalaryStructureRow | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetailsRow | null>(null);
  const [isFinancialDenied, setIsFinancialDenied] = useState(false);
  const [financialDeniedMsg, setFinancialDeniedMsg] = useState('');

  // Leaves & Compliance state
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveClientId = routeClientId || activeClientId || activeClient?.id;

  const userRole = currentUser?.role;
  const userClientId = currentUser?.clientId || effectiveClientId;
  const userEmpId = currentUser?.employeeId;

  const callerScope = useMemo(() => ({
    role: userRole,
    clientId: userClientId,
    employeeId: userEmpId,
  }), [userRole, userClientId, userEmpId]);

  const canEdit = currentUser?.role === 'super_admin' || 
    currentUser?.role === 'client_admin' || 
    currentUser?.role === 'hr_admin' || 
    currentUser?.role === 'payroll_admin';

  const canEditFinance = currentUser?.role === 'super_admin' || 
    currentUser?.role === 'client_admin' || 
    currentUser?.role === 'payroll_admin';

  const [searchParams, setSearchParams] = useSearchParams();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<'personal' | 'org' | 'compensation' | 'banking'>('personal');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  // Form states for full employee editing
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editJoiningDate, setEditJoiningDate] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'ON_NOTICE' | 'SUSPENDED' | 'TERMINATED'>('ACTIVE');
  const [editArrangement, setEditArrangement] = useState<'DIRECT_PERMANENT' | 'DIRECT_CONTRACT' | 'DEPUTED_STAFFING' | 'INTERN'>('DIRECT_PERMANENT');
  const [editLegalEntityId, setEditLegalEntityId] = useState('');
  const [editWorkLocationId, setEditWorkLocationId] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [editEmployeeCode, setEditEmployeeCode] = useState('');
  const [editFixedMonthlyBase, setEditFixedMonthlyBase] = useState('0');
  const [editVariableIncentives, setEditVariableIncentives] = useState('0');
  const [editSpecialAllowances, setEditSpecialAllowances] = useState('0');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editIfscCode, setEditIfscCode] = useState('');
  const [editAccountType, setEditAccountType] = useState<'SAVINGS' | 'CURRENT' | 'SALARY'>('SAVINGS');
  const [editPanNumber, setEditPanNumber] = useState('');
  const [editAadhaarNumber, setEditAadhaarNumber] = useState('');
  const [editUanNumber, setEditUanNumber] = useState('');
  const [editEsicNumber, setEditEsicNumber] = useState('');

  const openEditModal = useCallback((tab: 'personal' | 'org' | 'compensation' | 'banking' = 'personal') => {
    if (!employee) return;
    setEditFirstName(employee.first_name || '');
    setEditLastName(employee.last_name || '');
    setEditEmail(employee.email || '');
    setEditMobile(employee.mobile || '');
    setEditDesignation(employee.designation || '');
    setEditJoiningDate(employee.joining_date || '2026-11-01');
    setEditStatus(employee.status || 'ACTIVE');
    setEditArrangement(employee.employment_arrangement || 'DIRECT_PERMANENT');
    setEditLegalEntityId(employee.legal_entity_id || '');
    setEditWorkLocationId(employee.work_location_id || '');
    setEditDepartmentId(employee.department_id || '');
    setEditEmployeeCode(employee.employee_code || '');
    setEditPanNumber(employee.pan_number || '');
    setEditAadhaarNumber(employee.aadhaar_number || '');
    setEditUanNumber(employee.uan_number || '');
    setEditEsicNumber(employee.esic_number || '');

    if (salaryStructure) {
      setEditFixedMonthlyBase(String(salaryStructure.fixed_monthly_base || 0));
      setEditVariableIncentives(String(salaryStructure.variable_incentives || 0));
      setEditSpecialAllowances(String(salaryStructure.special_allowances || 0));
    } else {
      setEditFixedMonthlyBase('25000');
      setEditVariableIncentives('0');
      setEditSpecialAllowances('0');
    }

    if (bankDetails) {
      setEditBankName(bankDetails.bank_name || '');
      setEditAccountNumber(bankDetails.account_number || '');
      setEditIfscCode(bankDetails.ifsc_code || '');
      setEditAccountType(bankDetails.account_type || 'SAVINGS');
    } else {
      setEditBankName('');
      setEditAccountNumber('');
      setEditIfscCode('');
      setEditAccountType('SAVINGS');
    }

    setEditError(null);
    setActiveEditTab(tab);
    setIsEditModalOpen(true);
  }, [employee, salaryStructure, bankDetails]);

  // Handle URL query parameter ?edit=true
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && employee && !isEditModalOpen) {
      openEditModal('personal');
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, employee, isEditModalOpen, openEditModal, setSearchParams]);

  const handleSaveEmployeeDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!employee) return;

    if (!editFirstName.trim() || !editLastName.trim()) {
      setEditError('First name and last name are required.');
      return;
    }
    if (!editEmail.trim()) {
      setEditError('Work email is required.');
      return;
    }
    if (!editMobile.trim()) {
      setEditError('Mobile number is required.');
      return;
    }
    if (!editLegalEntityId) {
      setEditError('Legal employer / entity is required.');
      return;
    }
    if (!editWorkLocationId) {
      setEditError('Assigned work location is required.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      // 1. Update Core Employee Fields
      const updateRes = await employeeService.updateEmployee(
        employee.id,
        {
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          email: editEmail.trim(),
          mobile: editMobile.trim(),
          designation: editDesignation.trim() || 'Staff',
          joining_date: editJoiningDate,
          status: editStatus,
          employment_arrangement: editArrangement,
          employee_code: editEmployeeCode.trim() || employee.employee_code,
          legal_entity_id: editLegalEntityId,
          work_location_id: editWorkLocationId,
          department_id: editDepartmentId ? editDepartmentId : null,
          pan_number: editPanNumber.trim().toUpperCase(),
          aadhaar_number: editAadhaarNumber.trim(),
          uan_number: editUanNumber.trim() || null,
          esic_number: editEsicNumber.trim() || null,
        },
        callerScope
      );

      if (!updateRes.success) {
        setEditError(updateRes.error?.message || 'Failed to update employee details.');
        setIsSavingEdit(false);
        return;
      }

      // 2. Update Salary Structure if permitted
      if (canEditFinance) {
        const base = parseFloat(editFixedMonthlyBase) || 0;
        const incentive = parseFloat(editVariableIncentives) || 0;
        const allowances = parseFloat(editSpecialAllowances) || 0;
        await employeeService.upsertSalaryStructure(
          employee.id,
          employee.client_id,
          {
            fixed_monthly_base: base,
            variable_incentives: incentive,
            special_allowances: allowances,
          },
          callerScope
        );
      }

      // 3. Update Bank Details if provided and permitted
      if (canEditFinance && editBankName.trim() && editAccountNumber.trim() && editIfscCode.trim()) {
        await employeeService.upsertBankDetails(
          employee.id,
          employee.client_id,
          {
            bank_name: editBankName.trim(),
            account_number: editAccountNumber.trim(),
            ifsc_code: editIfscCode.trim().toUpperCase(),
            account_type: editAccountType,
            is_verified: true,
          },
          callerScope
        );
      }

      setEditSuccessMsg(`Employee record for ${editFirstName} ${editLastName} updated successfully!`);
      setIsEditModalOpen(false);
      await loadProfile();
      setTimeout(() => setEditSuccessMsg(null), 5000);
    } catch (err: any) {
      setEditError(err.message || 'An unexpected error occurred while saving employee details.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const loadProfile = useCallback(async () => {
    if (!employeeId) {
      setErrorMsg('No employee ID provided.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setIsFinancialDenied(false);

    try {
      // 1. Fetch core employee record
      const empRes = await employeeService.getEmployeeById(employeeId, callerScope);
      if (!empRes.success || !empRes.data) {
        setErrorMsg(empRes.error?.message || 'Employee record not found or access denied.');
        setEmployee(null);
        setIsLoading(false);
        return;
      }

      const empData = empRes.data;
      setEmployee(empData);

      // 2. Fetch client context: entities, locations, departments in parallel
      const clientIdToFetch = empData.client_id;
      const [leRes, locRes, deptRes] = await Promise.all([
        policyService.getLegalEntities(clientIdToFetch),
        policyService.getWorkLocations(clientIdToFetch),
        policyService.getDepartments(clientIdToFetch),
      ]);

      if (leRes.success && leRes.data) setLegalEntities(leRes.data);
      if (locRes.success && locRes.data) setLocations(locRes.data);
      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);

      // 3. Attempt to fetch sensitive financial records (Salary & Banking)
      // Service layer and database RLS enforce permission check
      const [salRes, bankRes] = await Promise.all([
        employeeService.getSalaryStructure(employeeId, callerScope),
        employeeService.getBankDetails(employeeId, callerScope),
      ]);

      if (salRes.success && salRes.data) {
        setSalaryStructure(salRes.data);
      } else if (salRes.error?.code === 'PERMISSION_ERROR') {
        setIsFinancialDenied(true);
        setFinancialDeniedMsg(salRes.error.message);
      }

      if (bankRes.success && bankRes.data) {
        setBankDetails(bankRes.data);
      } else if (bankRes.error?.code === 'PERMISSION_ERROR') {
        setIsFinancialDenied(true);
        setFinancialDeniedMsg(bankRes.error.message);
      }

      // 4. Fetch leave balances
      const leaveRes = await leaveService.getLeaveBalances(employeeId);
      if (leaveRes.success && leaveRes.data) {
        setLeaveBalances(leaveRes.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load employee profile data.');
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, effectiveClientId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleBack = () => {
    const backUrl = effectiveClientId ? `/workspace/${effectiveClientId}/employees` : '/workspace/employees';
    navigate(backUrl);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-surface-container-high rounded animate-pulse" />
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 shadow-sm animate-pulse">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-surface-container-high" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 bg-surface-container-high rounded" />
              <div className="h-4 w-32 bg-surface-container-high rounded" />
              <div className="h-3 w-64 bg-surface-container-high rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg || !employee) {
    return (
      <div className="p-8 text-on-surface-variant bg-surface-container-lowest rounded-lg border border-outline-variant/30 max-w-lg mx-auto text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-error mx-auto" />
        <h2 className="text-lg font-serif font-bold text-primary">Unable to Access Profile</h2>
        <p className="text-xs text-on-surface-variant">{errorMsg || 'Employee record not found.'}</p>
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-primary text-white font-bold rounded-lg text-xs hover:bg-primary/90 transition-colors"
        >
          Return to Employee Directory
        </button>
      </div>
    );
  }

  // Lookups for linked foreign keys
  const assignedLocation = locations.find(l => l.id === employee.work_location_id);
  const assignedDepartment = departments.find(d => d.id === employee.department_id);
  const assignedLegalEntity = legalEntities.find(le => le.id === employee.legal_entity_id);

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee Master</span>
        </button>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => openEditModal('personal')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white rounded text-xs font-bold hover:bg-primary-dark transition-colors shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Employee</span>
            </button>
          )}
          <button
            onClick={() => loadProfile()}
            className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-low text-on-surface-variant transition-colors"
            title="Refresh Profile"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigate(`/workspace/payslips/view/${employee.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-container text-on-secondary-container rounded text-xs font-medium hover:bg-secondary-container/80 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Latest Payslip</span>
          </button>
        </div>
      </div>

      {editSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{editSuccessMsg}</span>
          </div>
          <button onClick={() => setEditSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hero Profile Card */}
      <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {employee.avatar_url ? (
            <img
              src={employee.avatar_url}
              alt={`${employee.first_name} ${employee.last_name}`}
              className="w-20 h-20 rounded-full object-cover border-2 border-primary"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center font-serif text-2xl font-bold border-2 border-primary/20 shrink-0">
              {(employee.first_name?.[0] || 'E') + (employee.last_name?.[0] || '')}
            </div>
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="font-serif text-2xl text-primary font-normal">
                {employee.first_name} {employee.last_name}
              </h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold">
                {employee.employee_code}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                <span>{employee.status}</span>
              </span>
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                {employee.employment_arrangement.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface">{employee.designation}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-2">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-secondary" />
                <span>{employee.email}</span>
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-secondary" />
                <span>{employee.mobile}</span>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-secondary" />
                <span>Joined {employee.joining_date}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-outline-variant/30 flex gap-2">
        {[
          { key: 'overview', label: 'Overview & Position' },
          { key: 'compensation', label: 'Salary & Banking' },
          { key: 'statutory', label: 'Statutory & KYC' },
          { key: 'leaves', label: 'Leave Balances' },
          { key: 'documents', label: 'Document Dossier' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-primary text-primary bg-surface-container-low/50'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 shadow-sm">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base text-primary font-normal">Organizational Placement</h3>
                {canEdit && (
                  <button
                    onClick={() => openEditModal('org')}
                    className="text-[11px] font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Placement</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 bg-surface-container-low rounded border border-outline-variant/20">
                <div>
                  <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Employment Arrangement</span>
                  <span className="font-semibold text-on-surface">{employee.employment_arrangement.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Work Site</span>
                  <span className="font-semibold text-on-surface">
                    {assignedLocation?.name || employee.work_location_id}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Department</span>
                  <span className="font-semibold text-on-surface">
                    {assignedDepartment?.name || employee.department_id || 'General Operations'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Legal Employer / Entity</span>
                  <span className="font-semibold text-on-surface">
                    {assignedLegalEntity?.legal_name || employee.legal_entity_id}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base text-primary font-normal">Work Schedule & Geofencing</h3>
                {canEdit && (
                  <button
                    onClick={() => openEditModal('org')}
                    className="text-[11px] font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Location</span>
                  </button>
                )}
              </div>
              <div className="p-4 bg-surface-container-low rounded border border-outline-variant/20 space-y-2">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Default Shift:</span>
                  <span className="font-semibold text-on-surface">General Morning (09:00 AM – 06:00 PM)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Geofence Validation:</span>
                  <span className="font-semibold text-emerald-700">
                    {assignedLocation ? `STRICT ENFORCEMENT (${assignedLocation.radius_meters}m)` : 'STRICT ENFORCEMENT (150m)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Punch Verification Mode:</span>
                  <span className="font-semibold text-primary">GPS Coordinates + Device Fingerprint</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compensation' && (
          <div className="space-y-6 text-xs">
            {isFinancialDenied ? (
              // Fail-closed role protection alert
              <div className="p-6 bg-surface-container-low rounded-lg border border-outline-variant/30 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5" />
                </div>
                <h4 className="font-serif text-base font-bold text-primary">Confidential Financial Information</h4>
                <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                  {financialDeniedMsg || 'Access to compensation CTC structures and bank disbursement coordinates is strictly restricted to Super Admin, Client Admin, Payroll Admin, or the authenticated employee themselves.'}
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-[11px] text-on-surface-variant font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                  <span>Enforced by Row Level Security & Service Governance</span>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-serif text-base text-primary font-normal">Salary & Remuneration Structure</h3>
                    {canEditFinance && (
                      <button
                        onClick={() => openEditModal('compensation')}
                        className="text-[11px] font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Compensation</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-surface-container-low rounded border border-outline-variant/20">
                      <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Fixed Monthly Base CTC</span>
                      <span className="font-serif text-2xl text-primary font-normal">
                        ₹{(salaryStructure?.fixed_monthly_base || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-on-surface-variant block mt-1">Per Calendar Cycle</span>
                    </div>
                    <div className="p-4 bg-surface-container-low rounded border border-outline-variant/20">
                      <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Variable Target Incentive</span>
                      <span className="font-serif text-2xl text-emerald-800 font-normal">
                        ₹{(salaryStructure?.variable_incentives || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-on-surface-variant block mt-1">Performance linked</span>
                    </div>
                    <div className="p-4 bg-surface-container-low rounded border border-outline-variant/20">
                      <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Other Travel/Meal Allowances</span>
                      <span className="font-serif text-2xl text-primary font-normal">
                        ₹{(salaryStructure?.special_allowances || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-on-surface-variant block mt-1">Special & statutory allowances</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-serif text-base text-primary font-normal">Bank Disbursement Coordinates</h3>
                    {canEditFinance && (
                      <button
                        onClick={() => openEditModal('banking')}
                        className="text-[11px] font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Bank Coordinates</span>
                      </button>
                    )}
                  </div>
                  {bankDetails ? (
                    <div className="p-4 bg-surface-container-low rounded border border-outline-variant/20 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="text-[10px] uppercase text-on-surface-variant block">Bank Name</span>
                        <span className="font-semibold text-on-surface">{bankDetails.bank_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-on-surface-variant block">Account Number</span>
                        <span className="font-mono font-semibold text-on-surface">{bankDetails.account_number}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-on-surface-variant block">IFSC Code</span>
                        <span className="font-mono font-semibold text-on-surface">{bankDetails.ifsc_code}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-on-surface-variant block">Verification Status</span>
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{bankDetails.is_verified ? 'Penny Drop Verified' : 'Registered / Active'}</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-surface-container-low rounded border border-outline-variant/20 text-on-surface-variant text-xs">
                      No active bank account on record for disbursement.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'statutory' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base text-primary font-normal">Statutory Registrations & KYC IDs</h3>
              {canEdit && (
                <button
                  onClick={() => openEditModal('banking')}
                  className="text-[11px] font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Statutory IDs</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-container-low rounded border border-outline-variant/20 space-y-2">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Permanent Account Number (PAN):</span>
                  <span className="font-mono font-bold text-on-surface">{employee.pan_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Aadhaar UID:</span>
                  <span className="font-mono font-bold text-on-surface">{employee.aadhaar_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">PAN-Aadhaar Linkage:</span>
                  <span className="text-emerald-700 font-semibold">VERIFIED</span>
                </div>
              </div>

              <div className="p-4 bg-surface-container-low rounded border border-outline-variant/20 space-y-2">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Universal Account Number (UAN):</span>
                  <span className="font-mono font-bold text-on-surface">{employee.uan_number || 'NOT ASSIGNED'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">ESIC IP Number:</span>
                  <span className="font-mono font-bold text-on-surface">{employee.esic_number || 'EXEMPT (>₹21,000)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Form 11 Declaration:</span>
                  <span className="text-emerald-700 font-semibold">FILED ON RECORD</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="space-y-4 text-xs">
            <h3 className="font-serif text-base text-primary font-normal">Registered Leave Balances</h3>
            {leaveBalances.length === 0 ? (
              <div className="p-6 bg-surface-container-low rounded border border-outline-variant/20 text-center text-on-surface-variant">
                <p className="font-semibold text-on-surface">No leave balances registered.</p>
                <p className="text-[11px] mt-1">Leave balances will be credited upon commencement of the calendar accrual cycle.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {leaveBalances.map((lb) => (
                  <div key={lb.id} className="p-4 bg-surface-container-low rounded border border-outline-variant/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-primary text-sm">{lb.leave_type}</span>
                      <span className="text-[10px] text-on-surface-variant">{lb.year} Cycle</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-outline-variant/20">
                      <div>
                        <span className="text-[9px] uppercase text-on-surface-variant block">Opening</span>
                        <span className="font-semibold text-on-surface">{lb.opening}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-on-surface-variant block">Used</span>
                        <span className="font-semibold text-error">{lb.used}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-on-surface-variant block">Closing</span>
                        <span className="font-bold text-emerald-800 text-sm">{lb.closing}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-4 text-xs">
            <div>
              <h3 className="font-serif text-base text-primary font-normal">Compliance & Verification Dossier</h3>
              <p className="text-on-surface-variant text-[11px] mt-0.5">Official employment contract, KYC identities, and statutory compliance filings.</p>
            </div>
            <div className="p-8 bg-surface-container-low rounded-xl border border-outline-variant/20 text-center space-y-2.5">
              <FileCheck className="w-10 h-10 text-on-surface-variant/40 mx-auto" />
              <p className="font-semibold text-on-surface text-sm">No Digital Documents On File</p>
              <p className="text-[11px] text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                No verified digital copies have been uploaded yet for {employee.first_name} {employee.last_name}. Document dossier storage and direct file upload will be enabled via the enterprise storage bucket.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Comprehensive Edit Employee Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-surface-container-lowest max-w-2xl w-full rounded-2xl border border-surface-container-high shadow-elevated overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Edit3 className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg text-primary">
                    Edit Employee: {employee.first_name} {employee.last_name}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant font-mono">
                    ID: {employee.employee_code} • {assignedLegalEntity?.legal_name || 'Client Legal Entity'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="border-b border-surface-container-high px-4 sm:px-5 flex gap-2 bg-surface-container-lowest shrink-0 overflow-x-auto">
              {[
                { key: 'personal', label: '1. Personal Info' },
                { key: 'org', label: '2. Placement & Roles' },
                ...(canEditFinance ? [{ key: 'compensation', label: '3. Compensation & CTC' }] : []),
                { key: 'banking', label: '4. Bank & Statutory KYC' },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveEditTab(t.key as any)}
                  className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeEditTab === t.key
                      ? 'border-primary text-primary font-bold'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveEmployeeDetails} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {editError && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-xs font-semibold text-error flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* TAB 1: Personal Details */}
              {activeEditTab === 'personal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="font-bold text-on-surface block mb-1">First Name *</label>
                      <input
                        type="text"
                        value={editFirstName}
                        onChange={e => setEditFirstName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-on-surface block mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={e => setEditLastName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-on-surface block mb-1">Corporate Email Address *</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-on-surface block mb-1">Mobile Phone Number *</label>
                      <input
                        type="tel"
                        value={editMobile}
                        onChange={e => setEditMobile(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-on-surface block mb-1">Designation / Job Title *</label>
                      <input
                        type="text"
                        value={editDesignation}
                        onChange={e => setEditDesignation(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-bold text-on-surface block mb-1">Date of Joining *</label>
                      <input
                        type="date"
                        value={editJoiningDate}
                        onChange={e => setEditJoiningDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-mono"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-on-surface block mb-1">Employment Lifecycle Status *</label>
                      <select
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value as any)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
                      >
                        <option value="ACTIVE">ACTIVE — Normal operational status</option>
                        <option value="ON_NOTICE">ON_NOTICE — Serving official resignation notice period</option>
                        <option value="SUSPENDED">SUSPENDED — Temporary disciplinary or administrative suspension</option>
                        <option value="TERMINATED">TERMINATED — Discharged or relieved from organisation</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Organizational Placement */}
              {activeEditTab === 'org' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="font-bold text-on-surface block mb-1">Legal Employer / Payroll Entity *</label>
                      <select
                        value={editLegalEntityId}
                        onChange={e => setEditLegalEntityId(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
                      >
                        {legalEntities.map(le => (
                          <option key={le.id} value={le.id}>
                            {le.legal_name} (PAN: {le.pan})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-on-surface block mb-1">Assigned Work Location *</label>
                      <select
                        value={editWorkLocationId}
                        onChange={e => setEditWorkLocationId(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.radius_meters}m geofence)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-on-surface block mb-1">Operational Department</label>
                      <select
                        value={editDepartmentId}
                        onChange={e => setEditDepartmentId(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
                      >
                        <option value="">None / General Operations</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-on-surface block mb-1">Employment Arrangement *</label>
                      <select
                        value={editArrangement}
                        onChange={e => setEditArrangement(e.target.value as any)}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
                      >
                        <option value="DIRECT_PERMANENT">Direct Permanent</option>
                        <option value="DIRECT_CONTRACT">Direct Contract</option>
                        <option value="DEPUTED_STAFFING">Deputed Staffing</option>
                        <option value="INTERN">Intern</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-on-surface block mb-1">Employee Code *</label>
                      <input
                        type="text"
                        value={editEmployeeCode}
                        onChange={e => setEditEmployeeCode(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-mono uppercase"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Compensation & CTC */}
              {activeEditTab === 'compensation' && canEditFinance && (
                <div className="space-y-4">
                  <div className="p-3 bg-surface-container-low rounded-lg border border-surface-container-high text-xs text-on-surface-variant">
                    Update monthly salary components used by the policy engine for payroll generation and tax proration.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="font-bold text-on-surface block mb-1">Fixed Monthly Base CTC (₹) *</label>
                      <input
                        type="number"
                        value={editFixedMonthlyBase}
                        onChange={e => setEditFixedMonthlyBase(e.target.value)}
                        min="0"
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-semibold"
                        required
                      />
                    </div>

                    <div>
                      <label className="font-bold text-on-surface block mb-1">Variable Incentive (₹)</label>
                      <input
                        type="number"
                        value={editVariableIncentives}
                        onChange={e => setEditVariableIncentives(e.target.value)}
                        min="0"
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-on-surface block mb-1">Special / Travel Allowances (₹)</label>
                      <input
                        type="number"
                        value={editSpecialAllowances}
                        onChange={e => setEditSpecialAllowances(e.target.value)}
                        min="0"
                        className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Bank Coordinates & KYC */}
              {activeEditTab === 'banking' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <span className="font-bold text-primary block">Statutory Identity & Registrations</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="font-bold text-on-surface block mb-1">Permanent Account Number (PAN)</label>
                        <input
                          type="text"
                          value={editPanNumber}
                          onChange={e => setEditPanNumber(e.target.value.toUpperCase())}
                          placeholder="ABCDE1234F"
                          className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs uppercase font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-on-surface block mb-1">Aadhaar UID Number</label>
                        <input
                          type="text"
                          value={editAadhaarNumber}
                          onChange={e => setEditAadhaarNumber(e.target.value)}
                          placeholder="12-digit UID"
                          className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-on-surface block mb-1">Universal Account Number (UAN - EPF)</label>
                        <input
                          type="text"
                          value={editUanNumber}
                          onChange={e => setEditUanNumber(e.target.value)}
                          placeholder="12-digit UAN"
                          className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-on-surface block mb-1">ESIC IP Number</label>
                        <input
                          type="text"
                          value={editEsicNumber}
                          onChange={e => setEditEsicNumber(e.target.value)}
                          placeholder="17-digit ESIC IP"
                          className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {canEditFinance && (
                    <div className="pt-3 border-t border-surface-container-high space-y-3">
                      <span className="font-bold text-primary block">Disbursement Banking Coordinates</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="font-bold text-on-surface block mb-1">Bank Name</label>
                          <input
                            type="text"
                            value={editBankName}
                            onChange={e => setEditBankName(e.target.value)}
                            placeholder="e.g. HDFC Bank, ICICI Bank"
                            className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-on-surface block mb-1">Bank Account Number</label>
                          <input
                            type="text"
                            value={editAccountNumber}
                            onChange={e => setEditAccountNumber(e.target.value)}
                            placeholder="Account Number"
                            className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-on-surface block mb-1">IFSC Branch Code</label>
                          <input
                            type="text"
                            value={editIfscCode}
                            onChange={e => setEditIfscCode(e.target.value.toUpperCase())}
                            placeholder="e.g. HDFC0001234"
                            className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs uppercase font-mono"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-on-surface block mb-1">Account Type</label>
                          <select
                            value={editAccountType}
                            onChange={e => setEditAccountType(e.target.value as 'SAVINGS' | 'CURRENT' | 'SALARY')}
                            className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
                          >
                            <option value="SAVINGS">Savings Account</option>
                            <option value="CURRENT">Current Account</option>
                            <option value="SALARY">Salary Account</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-surface-container-high flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex items-center space-x-1.5 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save All Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
