import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
import { policyService } from '../../services/policyService';
import { 
  LegalEntityRow, 
  WorkLocationRow, 
  DepartmentRow 
} from '../../services/serviceTypes';
import { 
  UserPlus, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Building2, 
  DollarSign, 
  CreditCard, 
  FileText,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const AddEmployeeWizard: React.FC = () => {
  const { clientId: routeClientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const { activeClient, activeClientId, refreshWorkspace } = useWorkspace();
  const { currentUser } = useAuth();

  const effectiveClientId = routeClientId || activeClientId || activeClient?.id;
  const clientCode = activeClient?.code || 'EMP';

  const [legalEntities, setLegalEntities] = useState<LegalEntityRow[]>([]);
  const [locations, setLocations] = useState<WorkLocationRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [step, setStep] = useState(1);

  // Form State: Step 1 - Personal Details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [designation, setDesignation] = useState('');
  const [joiningDate, setJoiningDate] = useState('2026-11-01');

  // Form State: Step 2 - Employment & Hierarchy
  const [employmentArrangement, setEmploymentArrangement] = useState<'DIRECT_PERMANENT' | 'DIRECT_CONTRACT' | 'DEPUTED_STAFFING' | 'INTERN'>('DIRECT_PERMANENT');
  const [legalEntityId, setLegalEntityId] = useState('');
  const [workLocationId, setWorkLocationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [customEmployeeCode, setCustomEmployeeCode] = useState('');

  // Form State: Step 3 - Compensation
  const [fixedSalary, setFixedSalary] = useState('25000');
  const [incentive, setIncentive] = useState('2000');
  const [otherAllowances, setOtherAllowances] = useState('1000');

  // Form State: Step 4 - Bank & KYC Identity
  const [bankName, setBankName] = useState('HDFC Bank Ltd');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  const userRole = currentUser?.role;
  const userClientId = currentUser?.clientId || effectiveClientId;
  const userEmpId = currentUser?.employeeId;

  const callerScope = useMemo(() => ({
    role: userRole,
    clientId: userClientId,
    employeeId: userEmpId,
  }), [userRole, userClientId, userEmpId]);

  // Load organizational dropdowns
  const loadMetadata = useCallback(async () => {
    if (!effectiveClientId) return;
    setIsLoadingMetadata(true);
    try {
      const [leRes, locRes, deptRes] = await Promise.all([
        policyService.getLegalEntities(effectiveClientId),
        policyService.getWorkLocations(effectiveClientId),
        policyService.getDepartments(effectiveClientId),
      ]);

      if (leRes.success && leRes.data && leRes.data.length > 0) {
        setLegalEntities(leRes.data);
        setLegalEntityId(leRes.data[0].id);
      }
      if (locRes.success && locRes.data && locRes.data.length > 0) {
        setLocations(locRes.data);
        setWorkLocationId(locRes.data[0].id);
      }
      if (deptRes.success && deptRes.data && deptRes.data.length > 0) {
        setDepartments(deptRes.data);
        setDepartmentId(deptRes.data[0].id);
      }
    } catch (err: any) {
      setErrorMsg('Failed to load organizational configuration for this client.');
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [effectiveClientId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const handleBackToDirectory = () => {
    const returnUrl = effectiveClientId ? `/workspace/${effectiveClientId}/employees` : '/workspace/employees';
    navigate(returnUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!effectiveClientId) {
      setErrorMsg('Active client workspace is required.');
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setErrorMsg('First Name, Last Name, and Corporate Email are mandatory.');
      setStep(1);
      return;
    }

    if (!legalEntityId) {
      setErrorMsg('Please select a Legal Employer Entity.');
      setStep(2);
      return;
    }

    if (!workLocationId) {
      setErrorMsg('Please select an Assigned Work Location.');
      setStep(2);
      return;
    }

    const cleanPan = (panNumber || 'ABCDE1234F').trim().toUpperCase();
    if (cleanPan.length !== 10) {
      setErrorMsg('Permanent Account Number (PAN) must be exactly 10 alphanumeric characters.');
      setStep(4);
      return;
    }

    const cleanAadhaar = (aadhaarNumber || '5544 3322 1100').trim();
    if (cleanAadhaar.replace(/\s+/g, '').length < 12) {
      setErrorMsg('Aadhaar number must contain at least 12 digits.');
      setStep(4);
      return;
    }

    setIsSubmitting(true);

    try {
      const codeNum = Math.floor(1000 + Math.random() * 9000);
      const generatedCode = customEmployeeCode.trim() || `${clientCode}-${codeNum}`;

      // 1. Create Core Employee Record
      const createRes = await employeeService.createEmployee(
        {
          client_id: effectiveClientId,
          legal_entity_id: legalEntityId,
          work_location_id: workLocationId,
          department_id: departmentId || null,
          employee_code: generatedCode,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile.trim() || '+91 98000 00000',
          designation: designation.trim() || 'Operations Associate',
          joining_date: joiningDate,
          employment_arrangement: employmentArrangement,
          status: 'ACTIVE',
          pan_number: cleanPan,
          aadhaar_number: cleanAadhaar,
          avatar_url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200`,
        },
        callerScope
      );

      if (!createRes.success || !createRes.data) {
        setErrorMsg(createRes.error?.message || 'Failed to onboard employee.');
        setIsSubmitting(false);
        return;
      }

      const createdEmp = createRes.data;

      // 2. Configure Compensation Structure (if entered and authorized)
      const baseSalaryNum = parseFloat(fixedSalary) || 0;
      if (baseSalaryNum > 0) {
        const salRes = await employeeService.createSalaryStructure(
          {
            employee_id: createdEmp.id,
            client_id: effectiveClientId,
            fixed_monthly_base: baseSalaryNum,
            hra: Math.round(baseSalaryNum * 0.4),
            conveyance: 1600,
            special_allowances: parseFloat(otherAllowances) || 0,
            variable_incentives: parseFloat(incentive) || 0,
            effective_from: joiningDate,
            is_active: true,
          },
          callerScope
        );
        // Note: Non-payroll roles will be denied gracefully by design without failing the whole onboarding
        if (!salRes.success && salRes.error?.code !== 'PERMISSION_ERROR') {
          console.warn('Salary structure configuration notice:', salRes.error?.message);
        }
      }

      // 3. Configure Bank Disbursement Coordinates (if entered and authorized)
      if (accountNumber.trim()) {
        const bankRes = await employeeService.createBankDetails(
          {
            employee_id: createdEmp.id,
            client_id: effectiveClientId,
            bank_name: bankName || 'HDFC Bank Ltd',
            account_number: accountNumber.trim(),
            ifsc_code: (ifscCode || 'HDFC0001234').toUpperCase(),
            account_type: 'SALARY',
            is_verified: true,
          },
          callerScope
        );
        if (!bankRes.success && bankRes.error?.code !== 'PERMISSION_ERROR') {
          console.warn('Bank details registration notice:', bankRes.error?.message);
        }
      }

      refreshWorkspace();
      handleBackToDirectory();
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred during onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientTitle = activeClient?.name || 'Client Workspace';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
        <div>
          <button
            onClick={handleBackToDirectory}
            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center space-x-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Employee Directory</span>
          </button>
          <h1 className="text-2xl font-serif font-bold text-primary">Onboard Employee: {clientTitle}</h1>
          <p className="text-xs text-on-surface-variant">Step {step} of 4 • Complete mandatory employment and compensation details</p>
        </div>

        <div className="w-32 bg-surface-container-high h-2 rounded-full overflow-hidden">
          <div className="bg-accent h-full transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }} />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-xs font-semibold text-error flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-xs font-bold underline ml-2">Dismiss</button>
        </div>
      )}

      {/* Step 1: Personal Details */}
      {step === 1 && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card space-y-4 text-xs">
          <h2 className="font-serif font-bold text-base text-primary pb-2 border-b border-surface-container-high">
            1. Personal & Contact Information
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-on-surface block mb-1">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="e.g. Rahul"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="e.g. Sharma"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Corporate Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="rahul.sharma@client.com"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Mobile Number</label>
              <input
                type="tel"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="+91 98000 00000"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Joining Date</label>
              <input
                type="date"
                value={joiningDate}
                onChange={e => setJoiningDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Designation Title</label>
              <input
                type="text"
                value={designation}
                onChange={e => setDesignation(e.target.value)}
                placeholder="e.g. Logistics Supervisor"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={() => {
                if (!firstName.trim() || !lastName.trim() || !email.trim()) {
                  setErrorMsg('First Name, Last Name, and Corporate Email are mandatory.');
                  return;
                }
                if (!email.includes('@')) {
                  setErrorMsg('Please enter a valid corporate email address.');
                  return;
                }
                setErrorMsg('');
                setStep(2);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold"
            >
              <span>Continue to Assignment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Employment & Hierarchy */}
      {step === 2 && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card space-y-4 text-xs">
          <h2 className="font-serif font-bold text-base text-primary pb-2 border-b border-surface-container-high">
            2. Legal Entity & Work Location Assignment
          </h2>

          <div className="space-y-4">
            <div>
              <label className="font-bold text-on-surface block mb-1">Legal Employer / Payroll Entity *</label>
              <select
                value={legalEntityId}
                onChange={e => setLegalEntityId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              >
                {legalEntities.map(le => (
                  <option key={le.id} value={le.id}>
                    {le.legal_name} (PAN: {le.pan})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-on-surface-variant mt-1 block">
                Confirmed: Employee will be on this client legal entity's payroll.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-on-surface block mb-1">Assigned Work Location *</label>
                <select
                  value={workLocationId}
                  onChange={e => setWorkLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.radius_meters}m geofence)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-on-surface block mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={e => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
                >
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Employment Arrangement *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { value: 'DIRECT_PERMANENT', label: 'Direct Permanent' },
                  { value: 'DIRECT_CONTRACT', label: 'Direct Contract' },
                  { value: 'DEPUTED_STAFFING', label: 'Deputed Staffing' },
                  { value: 'INTERN', label: 'Intern' },
                ].map(item => (
                  <label 
                    key={item.value} 
                    className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer ${
                      employmentArrangement === item.value 
                        ? 'border-primary bg-primary/5 text-primary font-bold' 
                        : 'border-surface-container-high hover:bg-surface-container-low'
                    }`}
                  >
                    <input
                      type="radio"
                      name="employmentArrangement"
                      checked={employmentArrangement === item.value}
                      onChange={() => setEmploymentArrangement(item.value as any)}
                      className="accent-primary"
                    />
                    <span className="text-xs">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Custom Employee Code (Optional)</label>
              <input
                type="text"
                value={customEmployeeCode}
                onChange={e => setCustomEmployeeCode(e.target.value.toUpperCase())}
                placeholder={`Leave blank to auto-generate (e.g. ${clientCode}-1001)`}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-mono uppercase"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-lg border border-surface-container-high font-bold hover:bg-surface-container-low"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (!legalEntityId) {
                  setErrorMsg('Legal Entity is required.');
                  return;
                }
                if (!workLocationId) {
                  setErrorMsg('Work Location is required.');
                  return;
                }
                setErrorMsg('');
                setStep(3);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold"
            >
              <span>Continue to Compensation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Compensation */}
      {step === 3 && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card space-y-4 text-xs">
          <h2 className="font-serif font-bold text-base text-primary pb-2 border-b border-surface-container-high">
            3. Monthly Compensation & Salary Structure
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="font-bold text-on-surface block mb-1">Fixed Monthly Base Salary *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">₹</span>
                <input
                  type="number"
                  value={fixedSalary}
                  onChange={e => setFixedSalary(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Variable Incentive (Target)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">₹</span>
                <input
                  type="number"
                  value={incentive}
                  onChange={e => setIncentive(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Other Monthly Allowances</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">₹</span>
                <input
                  type="number"
                  value={otherAllowances}
                  onChange={e => setOtherAllowances(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-surface-container-low rounded-lg flex items-center justify-between text-xs">
            <span className="font-medium text-on-surface-variant">Projected Gross Monthly Wages:</span>
            <span className="text-base font-serif font-bold text-primary font-mono">
              ₹{(parseFloat(fixedSalary || '0') + parseFloat(incentive || '0') + parseFloat(otherAllowances || '0')).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-lg border border-surface-container-high font-bold hover:bg-surface-container-low"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold"
            >
              <span>Continue to Bank & Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Bank, Statutory & Submit */}
      {step === 4 && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card space-y-4 text-xs">
          <h2 className="font-serif font-bold text-base text-primary pb-2 border-b border-surface-container-high">
            4. Bank Account & KYC Identity
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-on-surface block mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                placeholder="50100234567891"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Bank IFSC Code</label>
              <input
                type="text"
                value={ifscCode}
                onChange={e => setIfscCode(e.target.value.toUpperCase())}
                placeholder="HDFC0001234"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-mono uppercase"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Permanent Account Number (PAN) *</label>
              <input
                type="text"
                value={panNumber}
                onChange={e => setPanNumber(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-mono uppercase font-bold"
              />
            </div>

            <div className="col-span-2">
              <label className="font-bold text-on-surface block mb-1">Aadhaar UID Number *</label>
              <input
                type="text"
                value={aadhaarNumber}
                onChange={e => setAadhaarNumber(e.target.value)}
                placeholder="5544 3322 1100"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(3)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-surface-container-high font-bold hover:bg-surface-container-low"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold shadow-md disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Onboarding Employee...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Onboarding & Save Employee</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
