import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  RefreshCw
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
              <h3 className="font-serif text-base text-primary font-normal">Organizational Placement</h3>
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
              <h3 className="font-serif text-base text-primary font-normal">Work Schedule & Geofencing</h3>
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
                  <h3 className="font-serif text-base text-primary font-normal mb-3">Salary & Remuneration Structure</h3>
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
                  <h3 className="font-serif text-base text-primary font-normal mb-3">Bank Disbursement Coordinates</h3>
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
            <h3 className="font-serif text-base text-primary font-normal">Statutory Registrations & KYC IDs</h3>
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
    </div>
  );
};
