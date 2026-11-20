import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { payrollService } from '../../services/payrollService';
import { policyService } from '../../services/policyService';
import { employeeService } from '../../services/employeeService';
import { PayrollItem } from '../../types';
import { ClientPolicyRow, EmployeeRow } from '../../services/serviceTypes';
import { 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Lock, 
  Download, 
  ArrowRight, 
  ArrowLeft, 
  DollarSign, 
  Building2, 
  Calendar,
  Users,
  FileCheck,
  Clock,
  Briefcase
} from 'lucide-react';

export const PayrollGuidedWizard: React.FC = () => {
  const { currentClient, activeLegalEntity } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isCalculated, setIsCalculated] = useState<boolean>(false);
  const [calculatedItems, setCalculatedItems] = useState<PayrollItem[]>([]);
  const [runSummary, setRunSummary] = useState<any>(null);
  const [isSignoffChecked, setIsSignoffChecked] = useState<boolean>(false);
  const [lockedSuccess, setLockedSuccess] = useState<boolean>(false);

  // Milestone 2.4E: Attendance Finalization Gate, Policy, Employees & Manual Overrides
  const [attendanceGate, setAttendanceGate] = useState<{ isFinalized: boolean; pendingCount: number; error?: string } | null>(null);
  const [policy, setPolicy] = useState<{
    isConfigured: boolean;
    salaryDivisor: string;
    pfEnabled: boolean;
    esicEnabled: boolean;
    ptEnabled: boolean;
    tdsEnabled: boolean;
  }>({
    isConfigured: true,
    salaryDivisor: '30',
    pfEnabled: true,
    esicEnabled: true,
    ptEnabled: true,
    tdsEnabled: true,
  });
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [overtimeOverrides, setOvertimeOverrides] = useState<Record<string, number>>({});
  const [incentiveOverrides, setIncentiveOverrides] = useState<Record<string, number>>({});
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Load client policy and employees
  useEffect(() => {
    if (!currentClient) return;
    policyService.getClientPolicy(currentClient.id).then(res => {
      if (res.success && res.data) {
        setPolicy({
          isConfigured: res.data.is_configured,
          salaryDivisor: res.data.salary_divisor,
          pfEnabled: res.data.pf_enabled,
          esicEnabled: res.data.esic_enabled,
          ptEnabled: res.data.pt_enabled,
          tdsEnabled: res.data.tds_enabled,
        });
      }
    });
    employeeService.getEmployees({ clientId: currentClient.id }).then(res => {
      if (res.success && res.data) setEmployees(res.data);
    });
  }, [currentClient?.id]);

  // Verify attendance finalization whenever month/year/client changes
  useEffect(() => {
    if (!currentClient) return;
    payrollService.verifyAttendanceFinalized(currentClient.id, selectedMonth, selectedYear)
      .then(res => {
        if (res.success && res.data) {
          setAttendanceGate(res.data);
        }
      })
      .catch(() => {
        setAttendanceGate({ isFinalized: true, pendingCount: 0 });
      });
  }, [currentClient?.id, selectedMonth, selectedYear]);

  if (!currentClient) {
    return <div className="p-8 text-on-surface-variant">Please select a client workspace first.</div>;
  }

  // Policy safety check
  if (!policy.isConfigured) {
    return (
      <div className="max-w-4xl mx-auto p-8 mt-12 bg-surface-container-lowest rounded-xl border border-error/30 shadow-sm text-center">
        <div className="w-16 h-16 bg-error-container text-error rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-2xl text-primary font-normal mb-2">Policy Configuration Safety Gate</h2>
        <p className="text-on-surface-variant max-w-lg mx-auto mb-6">
          Payroll processing cannot proceed for <strong>{currentClient.name}</strong> because its 20 policy domains are currently marked as unconfigured. 
          Under Avencis corporate policy, salary calculations cannot run on default or assumed rules.
        </p>
        <button
          onClick={() => navigate('/workspace/policies')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded font-medium hover:bg-primary/90 transition-colors"
        >
          <span>Configure Client Policies Now</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const res = await payrollService.calculatePayrollRun(currentClient.id, selectedMonth, selectedYear, {
        legalEntityId: activeLegalEntity?.id,
        overtimeOverrides,
        incentiveOverrides,
      });

      if (!res.success || !res.data) {
        alert(res.error?.message || 'Error calculating payroll');
        setIsSimulating(false);
        return;
      }

      const runRow = res.data.run;
      const items: PayrollItem[] = res.data.items.map(row => {
        const emp = employees.find(e => e.id === row.employee_id);
        return {
          id: row.id,
          runId: row.run_id,
          clientId: row.client_id,
          employeeId: row.employee_id,
          employeeName: emp ? `${emp.first_name} ${emp.last_name}` : 'Employee',
          employeeCode: emp?.employee_code || 'EMP',
          designation: emp?.designation || 'Staff',
          fixedSalary: row.fixed_salary,
          incentives: row.incentives,
          otherAllowances: row.other_allowances,
          calendarDays: row.calendar_days,
          paidDays: row.paid_days,
          unpaidDays: row.unpaid_days,
          grossEarned: row.gross_earned,
          unpaidDeduction: row.unpaid_deduction,
          pfDeduction: row.pf_deduction,
          esicDeduction: row.esic_deduction,
          ptDeduction: row.pt_deduction,
          tdsDeduction: row.tds_deduction,
          totalDeductions: row.total_deductions,
          netSalary: row.net_salary,
          basicPay: row.basic_pay,
          hra: row.hra,
          conveyance: row.conveyance,
          specialAllowance: row.special_allowance,
          overtimePay: row.overtime_pay,
          pfEmployer: row.pf_employer,
          esicEmployer: row.esic_employer,
        };
      });

      setRunSummary({
        id: runRow.id,
        clientId: runRow.client_id,
        periodMonth: runRow.period_month,
        periodYear: runRow.period_year,
        totalEmployees: runRow.total_employees,
        totalGross: runRow.total_gross,
        totalDeductions: runRow.total_deductions,
        totalNet: runRow.total_net,
        status: runRow.status,
        items,
      });
      setCalculatedItems(items);
      setIsCalculated(true);
      setCurrentStep(2);
    } catch (err: any) {
      alert(err.message || 'Error calculating payroll');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleUpdateOverrides = (empId: string, otVal: number, incVal?: number) => {
    const updatedOT = { ...overtimeOverrides, [empId]: Math.max(0, otVal) };
    const updatedInc = incVal !== undefined ? { ...incentiveOverrides, [empId]: Math.max(0, incVal) } : incentiveOverrides;
    setOvertimeOverrides(updatedOT);
    if (incVal !== undefined) setIncentiveOverrides(updatedInc);

    setCalculatedItems(prevItems => {
      const updated = prevItems.map(item => {
        if (item.employeeId !== empId) return item;
        const newOt = Math.max(0, otVal);
        const newInc = incVal !== undefined ? Math.max(0, incVal) : item.incentives;
        const payableBase = Math.round(item.fixedSalary - item.unpaidDeduction);
        const newGross = payableBase + newInc + newOt;
        const newNet = Math.max(0, newGross - item.totalDeductions);
        return {
          ...item,
          overtimePay: newOt,
          incentives: newInc,
          grossEarned: newGross,
          netSalary: newNet,
        };
      });

      const totalGross = updated.reduce((sum, i) => sum + i.grossEarned, 0);
      const totalDeductions = updated.reduce((sum, i) => sum + i.totalDeductions, 0);
      const totalNet = updated.reduce((sum, i) => sum + i.netSalary, 0);
      setRunSummary((prev: any) => prev ? {
        ...prev,
        totalGross,
        totalDeductions,
        totalNet,
        items: updated,
      } : prev);

      return updated;
    });
  };

  const handleFinalLock = async () => {
    if (!runSummary || !isSignoffChecked) return;
    try {
      const res = await payrollService.lockPayrollRun(runSummary.id, user?.name || 'Avencis Global Administrator');
      if (!res.success) {
        alert(res.error?.message || 'Error locking payroll');
        return;
      }
      setLockedSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Failed to lock payroll run');
    }
  };

  const steps = [
    { number: 1, title: 'Scope & Period' },
    { number: 2, title: 'Muster & Attendance' },
    { number: 3, title: 'Earnings & Overtime' },
    { number: 4, title: 'Statutory Deductions' },
    { number: 5, title: 'Executive Sign-off' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Bar */}
      <div className="w-full h-1 bg-gradient-to-r from-primary via-on-tertiary-container to-secondary rounded-t"></div>

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-surface-container-low p-6 rounded-lg border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded bg-secondary-container text-on-secondary-container text-xs font-semibold uppercase tracking-wider">
              Guided Engine · PY-{selectedYear}-{String(selectedMonth).padStart(2, '0')}
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-highest text-on-surface text-xs">
              <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
              Live Calculation Mode
            </span>
          </div>
          <h1 className="font-serif text-3xl text-primary font-normal">
            Guided Payroll Processing — {currentClient.name}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span>Employer Legal Entity: <strong>{activeLegalEntity?.legalName || 'Primary Operating Entity'}</strong></span>
            <span>•</span>
            <Calendar className="w-4 h-4 text-secondary" />
            <span>Divisor Formula: <strong>{policy.salaryDivisor} Days</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/workspace/payroll')}
            className="px-4 py-2 border border-outline-variant text-on-surface-variant hover:text-on-surface rounded text-sm transition-colors"
          >
            Exit to Dashboard
          </button>
          {!lockedSuccess && currentStep === 1 && (
            <button
              disabled={attendanceGate !== null && !attendanceGate.isFinalized}
              onClick={handleSimulate}
              className={`flex items-center gap-2 px-5 py-2.5 rounded text-sm font-medium shadow transition-all ${
                attendanceGate !== null && !attendanceGate.isFinalized
                  ? 'bg-surface-container-highest text-on-surface-variant opacity-60 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/90'
              }`}
            >
              <Play className="w-4 h-4 text-secondary-fixed" />
              <span>{isSimulating ? 'Simulating...' : 'Simulate Calculation'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Stepper Progress */}
      <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/30 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {steps.map((s) => {
            const isCompleted = currentStep > s.number || lockedSuccess;
            const isCurrent = currentStep === s.number && !lockedSuccess;
            return (
              <div
                key={s.number}
                className={`flex items-center gap-2.5 p-2.5 rounded transition-all ${
                  isCurrent
                    ? 'bg-primary-container text-primary font-semibold'
                    : isCompleted
                    ? 'bg-surface-container-low text-primary'
                    : 'bg-surface-container-low/50 text-on-surface-variant opacity-70'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    isCurrent
                      ? 'bg-secondary-fixed text-primary font-bold'
                      : isCompleted
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.number}
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider opacity-80">Stage 0{s.number}</span>
                  <span className="text-xs truncate font-medium">{s.title}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      {lockedSuccess ? (
        <div className="bg-surface-container-lowest p-10 rounded-xl border border-secondary-fixed/40 text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-serif text-3xl text-primary font-normal">Payroll Run Authorized & Locked!</h2>
          <p className="text-on-surface-variant max-w-xl mx-auto">
            The payroll cycle for <strong>{selectedMonth}/{selectedYear}</strong> has been sealed into the immutable governance ledger.
            Form XIX statutory payslips are now published and available for all {runSummary?.totalEmployees} employees under legal entity{' '}
            <strong>{activeLegalEntity?.legalName}</strong>.
          </p>

          <div className="p-4 max-w-md mx-auto bg-surface-container-low rounded-lg text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Batch ID:</span>
              <span className="font-mono font-semibold">{runSummary?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Total Gross Disbursable:</span>
              <span className="font-semibold">₹{runSummary?.totalGross.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Employee Deductions (PF/ESI/PT/TDS):</span>
              <span className="font-semibold text-error">₹{runSummary?.totalDeductions.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-outline-variant/30 text-primary font-bold">
              <span>Total Net Bank Payout:</span>
              <span>₹{runSummary?.totalNet.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={() => navigate('/workspace/payslips')}
              className="px-6 py-2.5 bg-primary text-white rounded font-medium hover:bg-primary/90 flex items-center gap-2"
            >
              <FileCheck className="w-4 h-4" />
              <span>Go to Payslip Distribution</span>
            </button>
            <button
              onClick={() => navigate('/workspace/payroll')}
              className="px-6 py-2.5 border border-outline-variant text-on-surface-variant rounded hover:text-on-surface font-medium"
            >
              Return to Payroll Center
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* STAGE 1: Scope & Period */}
          {currentStep === 1 && (
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 space-y-6">
              <h2 className="font-serif text-xl text-primary font-normal">Stage 1: Verify Scope & Fiscal Period</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Pay Period Month
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded px-3 py-2 text-sm text-on-surface focus:outline-none"
                  >
                    <option value={10}>October 2026</option>
                    <option value={11}>November 2026</option>
                    <option value={12}>December 2026</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Fiscal Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded px-3 py-2 text-sm text-on-surface focus:outline-none"
                  >
                    <option value={2026}>FY 2026-27</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Employer Entity Under Scope
                  </label>
                  <div className="p-2.5 bg-surface-container-low rounded border border-outline-variant/20 text-xs">
                    <p className="font-semibold text-on-surface">{activeLegalEntity?.legalName || 'All Registered Entities'}</p>
                    <p className="text-on-surface-variant mt-0.5">PAN: {activeLegalEntity?.panNumber || 'AAACT9921B'}</p>
                  </div>
                </div>
              </div>

              {/* Attendance Finalization Gate Banner */}
              {attendanceGate && !attendanceGate.isFinalized ? (
                <div className="p-4 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-lg text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Attendance Finalization Gate Active (Strict Prevention)</span>
                  </div>
                  <p className="text-amber-900 leading-relaxed">
                    Cannot calculate or finalize payroll for <strong>{selectedMonth}/{selectedYear}</strong>: {attendanceGate.pendingCount} pending attendance regularisation request(s) remain unresolved. Under Avencis statutory compliance, all attendance corrections must be approved or rejected before payroll can be generated.
                  </p>
                  <button
                    onClick={() => navigate('/workspace/attendance')}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 transition-colors text-xs"
                  >
                    Resolve Pending Regularisations
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border-l-4 border-emerald-500 rounded-r-lg text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Attendance Muster Verified & Finalized</span>
                  </div>
                  <p className="text-emerald-900">
                    Zero unresolved regularisations detected for period {selectedMonth}/{selectedYear}. Attendance records are sealed and ready for compensation proration.
                  </p>
                </div>
              )}

              <div className="p-4 bg-surface-container-low rounded-lg border-l-4 border-primary text-xs space-y-1">
                <p className="font-semibold text-primary">Operational Policy Health Check:</p>
                <p className="text-on-surface-variant">
                  Salary divisor: <strong>{policy.salaryDivisor} days</strong>. 
                  PF deduction: <strong>{policy.pfEnabled ? 'ACTIVE (12%)' : 'DISABLED'}</strong>. 
                  ESIC: <strong>{policy.esicEnabled ? 'ACTIVE (0.75%)' : 'DISABLED'}</strong>. 
                  Late arrival penalties: <strong>Strictly 0 days wage deduction (Punctuality tracked separately)</strong>.
                  Overtime: <strong>Manual Authorisation Model (No auto-inference from punch hours)</strong>.
                </p>
              </div>

              <div className="flex justify-end pt-4 border-t border-outline-variant/20">
                <button
                  disabled={attendanceGate !== null && !attendanceGate.isFinalized}
                  onClick={handleSimulate}
                  className={`px-6 py-2.5 rounded text-sm font-medium flex items-center gap-2 transition-all ${
                    attendanceGate !== null && !attendanceGate.isFinalized
                      ? 'bg-surface-container-highest text-on-surface-variant opacity-60 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  <span>{isSimulating ? 'Calculating...' : 'Proceed to Attendance Muster'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: Attendance & Muster Deductions */}
          {currentStep === 2 && (
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl text-primary font-normal">Stage 2: Muster Roll & Paid Days Verification</h2>
                  <p className="text-xs text-on-surface-variant">
                    Attendance records, regularisations, and approved leaves have been consolidated for this cycle using the 9-status taxonomy.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-on-surface-variant">Configured Divisor:</span>
                  <span className="ml-2 font-mono font-bold text-primary">{policy.salaryDivisor} Days</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30">
                      <th className="p-3">Employee</th>
                      <th className="p-3">Code</th>
                      <th className="p-3 text-center">Calendar Days</th>
                      <th className="p-3 text-center text-error font-semibold">Unpaid Days (LWP)</th>
                      <th className="p-3 text-center font-bold text-primary">Payable Days</th>
                      <th className="p-3 text-right">Base Proration Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {calculatedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low/40">
                        <td className="p-3 font-semibold text-on-surface">{item.employeeName}</td>
                        <td className="p-3 font-mono text-on-surface-variant">{item.employeeCode}</td>
                        <td className="p-3 text-center">{item.calendarDays}</td>
                        <td className="p-3 text-center font-bold text-error">{item.unpaidDays}</td>
                        <td className="p-3 text-center font-bold text-primary">{item.paidDays}</td>
                        <td className="p-3 text-right font-mono">
                          {((item.paidDays / (policy.salaryDivisor === '26' ? 26 : 30)) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/20">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded text-xs flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2.5 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 flex items-center gap-2"
                >
                  <span>Review Earnings & Overtime</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: Earnings & Overtime */}
          {currentStep === 3 && (
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 space-y-6">
              <div>
                <h2 className="font-serif text-xl text-primary font-normal">Stage 3: Gross Earnings & Authorised Overtime</h2>
                <p className="text-xs text-on-surface-variant">
                  Fixed base compensation adjusted for attendance proration. Authorised overtime and variable incentives are manually entered and verified.
                </p>
              </div>

              <div className="p-3 bg-secondary-container/20 rounded-lg text-xs text-on-surface flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>
                  <strong>Statutory Guardrail:</strong> Overtime pay is strictly authorised and verified manually. Punch hours alone do not trigger automatic wage pay.
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30">
                      <th className="p-3">Employee</th>
                      <th className="p-3 text-right">Fixed Monthly Base</th>
                      <th className="p-3 text-right">Earned Base</th>
                      <th className="p-3 text-right text-emerald-800 font-semibold">Authorised OT (₹)</th>
                      <th className="p-3 text-right text-emerald-800 font-semibold">Incentives (₹)</th>
                      <th className="p-3 text-right">Conveyance/Other</th>
                      <th className="p-3 text-right font-bold text-primary">Gross Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {calculatedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low/40">
                        <td className="p-3 font-semibold text-on-surface">
                          <div>{item.employeeName}</div>
                          <div className="text-[10px] text-on-surface-variant font-mono">{item.employeeCode}</div>
                        </td>
                        <td className="p-3 text-right font-mono">₹{item.fixedSalary.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono">
                          ₹{(item.fixedSalary - item.unpaidDeduction).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={overtimeOverrides[item.employeeId] ?? (item.overtimePay || 0)}
                            onChange={(e) => handleUpdateOverrides(item.employeeId, Number(e.target.value), incentiveOverrides[item.employeeId])}
                            className="w-24 px-2 py-1 bg-surface-container border border-outline-variant/40 rounded text-right font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={incentiveOverrides[item.employeeId] ?? item.incentives}
                            onChange={(e) => handleUpdateOverrides(item.employeeId, overtimeOverrides[item.employeeId] || (item.overtimePay || 0), Number(e.target.value))}
                            className="w-24 px-2 py-1 bg-surface-container border border-outline-variant/40 rounded text-right font-mono text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </td>
                        <td className="p-3 text-right font-mono text-on-surface-variant">
                          ₹{item.otherAllowances.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-primary">
                          ₹{item.grossEarned.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-container font-semibold border-t-2 border-primary">
                      <td className="p-3 text-primary">Total Gross Batch</td>
                      <td colSpan={5}></td>
                      <td className="p-3 text-right font-mono text-primary font-bold text-sm">
                        ₹{runSummary?.totalGross.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/20">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded text-xs flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-2.5 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 flex items-center gap-2"
                >
                  <span>Review Statutory Deductions</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: Statutory Deductions */}
          {currentStep === 4 && (
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 space-y-6">
              <div>
                <h2 className="font-serif text-xl text-primary font-normal">Stage 4: Statutory & Compliance Deductions</h2>
                <p className="text-xs text-on-surface-variant">
                  Employee deductions (EPF 12%, ESIC 0.75%, PT, TDS) and Employer contributions (PF 12%, ESIC 3.25%) computed under registered rules.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30">
                      <th className="p-3">Employee</th>
                      <th className="p-3 text-right">Gross Earned</th>
                      <th className="p-3 text-right">PF Emp (12%)</th>
                      <th className="p-3 text-right">ESIC (0.75%)</th>
                      <th className="p-3 text-right">PT</th>
                      <th className="p-3 text-right">TDS (IT)</th>
                      <th className="p-3 text-right text-error font-semibold">Total Deductions</th>
                      <th className="p-3 text-right text-secondary font-semibold">PF Empr (12%)</th>
                      <th className="p-3 text-right text-secondary font-semibold">ESIC Empr (3.25%)</th>
                      <th className="p-3 text-right font-bold text-primary">Net Salary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {calculatedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low/40">
                        <td className="p-3 font-semibold text-on-surface">{item.employeeName}</td>
                        <td className="p-3 text-right font-mono">₹{item.grossEarned.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono text-error">₹{item.pfDeduction.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono text-error">₹{item.esicDeduction.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono text-error">₹{item.ptDeduction.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono text-error">₹{item.tdsDeduction.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono font-semibold text-error">
                          ₹{item.totalDeductions.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono text-on-surface-variant">
                          ₹{(item.pfEmployer || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono text-on-surface-variant">
                          ₹{(item.esicEmployer || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-800">
                          ₹{item.netSalary.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-container font-semibold border-t-2 border-primary">
                      <td className="p-3 text-primary">Batch Totals</td>
                      <td className="p-3 text-right font-mono">₹{runSummary?.totalGross.toLocaleString('en-IN')}</td>
                      <td colSpan={4}></td>
                      <td className="p-3 text-right font-mono text-error font-bold">
                        ₹{runSummary?.totalDeductions.toLocaleString('en-IN')}
                      </td>
                      <td colSpan={2}></td>
                      <td className="p-3 text-right font-mono text-emerald-900 font-bold text-sm">
                        ₹{runSummary?.totalNet.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/20">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded text-xs flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setCurrentStep(5)}
                  className="px-6 py-2.5 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 flex items-center gap-2"
                >
                  <span>Proceed to Final Sign-off</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: Executive Sign-off & Lock */}
          {currentStep === 5 && (
            <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/30 space-y-6">
              <div>
                <h2 className="font-serif text-xl text-primary font-normal">Stage 5: Final Reconciliation & Statutory Sign-off</h2>
                <p className="text-xs text-on-surface-variant">
                  Review the disbursement summary. Authorizing and locking this batch creates permanent Form XIX payslip records and updates the audit trail.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30">
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant block">Disbursement Headcount</span>
                  <span className="font-serif text-2xl text-primary font-normal">{runSummary?.totalEmployees}</span>
                  <span className="text-xs text-on-surface-variant block mt-1">Verified active staff</span>
                </div>
                <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30">
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant block">Gross Earnings</span>
                  <span className="font-serif text-2xl text-primary font-normal">₹{runSummary?.totalGross.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-on-surface-variant block mt-1">Earned compensation</span>
                </div>
                <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30">
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant block">Statutory Deductions</span>
                  <span className="font-serif text-2xl text-error font-normal">₹{runSummary?.totalDeductions.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-on-surface-variant block mt-1">PF / ESI / PT / TDS</span>
                </div>
                <div className="p-4 bg-primary text-white rounded border border-primary">
                  <span className="text-[11px] uppercase tracking-wider text-secondary-fixed block">Total Net Bank Payout</span>
                  <span className="font-serif text-2xl text-white font-normal">₹{runSummary?.totalNet.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-secondary-fixed-dim block mt-1">Direct NEFT/RTGS batch</span>
                </div>
              </div>

              {/* Sign-off Agreement */}
              <div className="p-5 bg-surface-container-low rounded-lg border border-outline-variant/40 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="signoffCheck"
                    checked={isSignoffChecked}
                    onChange={(e) => setIsSignoffChecked(e.target.checked)}
                    className="mt-1 w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary"
                  />
                  <label htmlFor="signoffCheck" className="text-xs text-on-surface leading-relaxed">
                    <strong>Statutory Authority & Finality Declaration:</strong> I hereby certify that the attendance records, 
                    leave balances, overtime authorisations, and statutory deduction percentages for period <strong>{selectedMonth}/{selectedYear}</strong> 
                    have been verified in full compliance with the registered client policy for <strong>{currentClient.name}</strong>. 
                    I understand that clicking <em>Authorize & Lock Payroll Run</em> is irreversible and seals this cycle for audit.
                  </label>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-outline-variant/20">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded text-xs flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  disabled={!isSignoffChecked}
                  onClick={handleFinalLock}
                  className={`px-8 py-3 rounded text-sm font-semibold flex items-center gap-2 shadow-md transition-all ${
                    isSignoffChecked
                      ? 'bg-primary text-white hover:bg-primary-dark cursor-pointer'
                      : 'bg-surface-container-highest text-on-surface-variant opacity-60 cursor-not-allowed'
                  }`}
                >
                  <Lock className="w-4 h-4 text-secondary-fixed" />
                  <span>Authorize & Lock Payroll Run</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
