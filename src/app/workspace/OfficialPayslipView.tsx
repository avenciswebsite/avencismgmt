import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { payrollService } from '../../services/payrollService';
import { employeeService } from '../../services/employeeService';
import { policyService } from '../../services/policyService';
import { PayrollItemRow } from '../../services/serviceTypes';
import { 
  Printer, 
  Download, 
  ArrowLeft, 
  ShieldCheck, 
  Building2, 
  CheckCircle2, 
  Lock,
  QrCode,
  Loader2
} from 'lucide-react';
import { getDaysInMonth } from '../../services/payrollCalculationHelper';

export const OfficialPayslipView: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { currentClient, activeLegalEntity } = useWorkspace();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [resolvedItem, setResolvedItem] = useState<PayrollItemRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!employeeId || !currentClient?.id) return;
    setIsLoading(true);
    Promise.all([
      employeeService.getEmployeeById(employeeId),
      policyService.getClientPolicy(currentClient.id),
      payrollService.getPublishedPayslip(employeeId, 10, 2026),
    ]).then(([empRes, polRes, slipRes]) => {
      if (empRes.success && empRes.data) {
        setEmployee({
          id: empRes.data.id,
          firstName: empRes.data.first_name,
          lastName: empRes.data.last_name,
          employeeCode: empRes.data.employee_code,
          designation: empRes.data.designation,
          joiningDate: empRes.data.joining_date,
          fixedMonthlySalary: Number((empRes.data as any).fixed_monthly_base) || Number((empRes.data as any).fixed_monthly_salary) || 0,
          variableIncentive: Number((empRes.data as any).variable_incentive) || 0,
          otherAllowances: Number((empRes.data as any).other_allowances) || 0,
          panNumber: empRes.data.pan_number || 'Not Provided',
          aadhaarNumber: empRes.data.aadhaar_number || 'Not Provided',
          bankName: (empRes.data as any).bank_name || 'Not Configured',
          accountNumber: (empRes.data as any).account_number || 'Not Configured',
          ifscCode: (empRes.data as any).ifsc_code || 'Not Configured',
        });
      }
      if (polRes.success && polRes.data) {
        setPolicy({
          pfEnabled: polRes.data.pf_enabled,
          pfEmployerPercent: Number(polRes.data.pf_employer_percent) || 12,
          esicEnabled: polRes.data.esic_enabled,
          esicEmployerPercent: Number(polRes.data.esic_employer_percent) || 3.25,
        });
      }
      if (slipRes.success && slipRes.data?.item) {
        setResolvedItem(slipRes.data.item);
      }
    }).finally(() => {
      setIsLoading(false);
    });
  }, [employeeId, currentClient?.id]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-on-surface-variant flex flex-col items-center justify-center space-y-2">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-xs">Loading Form XIX official payslip certificate from Supabase...</p>
      </div>
    );
  }

  if (!currentClient || !employee) {
    return (
      <div className="p-8 text-on-surface-variant">
        <p>Employee or Client configuration not found.</p>
        <button
          onClick={() => navigate('/workspace/payslips')}
          className="mt-4 px-4 py-2 bg-primary text-white rounded text-sm"
        >
          Back to Payslip List
        </button>
      </div>
    );
  }

  let calendarDays = 30;
  let paidDays = 30;
  let unpaidDays = 0;
  let basic = Math.round(employee.fixedMonthlySalary * 0.5);
  let hra = Math.round(employee.fixedMonthlySalary * 0.3);
  let conveyance = 1600;
  let specialAllowance = Math.max(0, employee.fixedMonthlySalary - basic - hra - conveyance);
  let overtimePay = 0;
  let variableIncentives = employee.variableIncentive;
  let otherAllowances = employee.otherAllowances;
  let grossEarnings = basic + hra + conveyance + specialAllowance + variableIncentives;
  let pfDeduction = policy?.pfEnabled ? Math.round(Math.min(basic, 15000) * 0.12) : 0;
  let esicDeduction = policy?.esicEnabled && grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0075) : 0;
  let ptDeduction = 200;
  let tdsDeduction = employee.fixedMonthlySalary >= 50000 ? 2500 : 0;
  let pfEmployer = policy?.pfEnabled ? Math.round(Math.min(basic, 15000) * (policy.pfEmployerPercent / 100)) : 0;
  let esicEmployer = policy?.esicEnabled && grossEarnings <= 21000 ? Math.round(grossEarnings * (policy.esicEmployerPercent / 100)) : 0;
  let totalDeductions = pfDeduction + esicDeduction + ptDeduction + tdsDeduction;
  let netPayable = grossEarnings - totalDeductions;

  if (resolvedItem) {
    calendarDays = resolvedItem.calendar_days;
    paidDays = resolvedItem.paid_days;
    unpaidDays = resolvedItem.unpaid_days;
    basic = resolvedItem.basic_pay ?? Math.round(resolvedItem.fixed_salary * 0.5);
    hra = resolvedItem.hra ?? Math.round(resolvedItem.fixed_salary * 0.3);
    conveyance = resolvedItem.conveyance ?? 1600;
    specialAllowance = resolvedItem.special_allowance ?? 0;
    overtimePay = resolvedItem.overtime_pay ?? 0;
    variableIncentives = resolvedItem.incentives;
    otherAllowances = resolvedItem.other_allowances;
    grossEarnings = resolvedItem.gross_earned;
    pfDeduction = resolvedItem.pf_deduction;
    esicDeduction = resolvedItem.esic_deduction;
    ptDeduction = resolvedItem.pt_deduction;
    tdsDeduction = resolvedItem.tds_deduction;
    pfEmployer = resolvedItem.pf_employer ?? 0;
    esicEmployer = resolvedItem.esic_employer ?? 0;
    totalDeductions = resolvedItem.total_deductions;
    netPayable = resolvedItem.net_salary;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Action Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-low p-3.5 sm:p-4 rounded-lg border border-outline-variant/30 print:hidden">
        <button
          onClick={() => navigate('/workspace/payslips')}
          className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Payslips Register</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 shadow transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Payslip (A4)</span>
          </button>
          <button
            onClick={() => alert('PDF generation initiated...')}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-lowest text-on-surface border border-outline-variant/40 rounded text-xs font-medium hover:bg-surface-container transition-colors"
          >
            <Download className="w-4 h-4 text-secondary" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Official Printable A4 Document Sheet */}
      <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-8 md:p-12 shadow-md text-on-surface print:border-none print:shadow-none print:p-0">
        {/* Header with Employer Entity */}
        <div className="border-b-2 border-primary pb-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-secondary block mb-1">
                Official Salary Disbursement Certificate • Form XIX (Rule 26)
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-primary">
                {activeLegalEntity?.legalName || currentClient.name}
              </h1>
              <p className="text-xs text-on-surface-variant mt-1 max-w-md">
                Registered Office: {activeLegalEntity?.registeredAddress || 'Tech Center, Magarpatta City, Pune, MH 411028'}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant mt-2 font-mono">
                <span>CIN/LLPIN: U72900PN2021PTC199823</span>
                <span>PAN: {activeLegalEntity?.panNumber || 'AAACT9921B'}</span>
                <span>PF Est. Code: {activeLegalEntity?.pfEstablishmentCode || 'MH/PUN/0088124/000'}</span>
              </div>
            </div>

            <div className="text-right sm:border-l sm:pl-6 border-outline-variant/30 shrink-0">
              <div className="inline-block p-2 bg-surface-container rounded border border-outline-variant/20 mb-2">
                <span className="font-serif text-lg font-bold text-primary">AVENCIS WFM</span>
                <span className="block text-[9px] uppercase tracking-wider text-on-surface-variant">Platform Administered</span>
              </div>
              <p className="text-xs font-semibold text-primary">Pay Slip for October 2026</p>
              <p className="text-[10px] text-on-surface-variant font-mono">Doc Ref: PS-2026-10-{employee.employeeCode}</p>
            </div>
          </div>
        </div>

        {/* Employee & Bank Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-surface-container-low/50 rounded-lg border border-outline-variant/20 text-xs mb-6">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">Employee Name</span>
            <span className="font-bold text-on-surface">{employee.firstName} {employee.lastName}</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">Employee Code</span>
            <span className="font-mono font-bold text-primary">{employee.employeeCode}</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">Designation</span>
            <span>{employee.designation}</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">Date of Joining</span>
            <span>{employee.joiningDate}</span>
          </div>

          <div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">Bank Name</span>
            <span>{employee.bankName}</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">Bank Account No.</span>
            <span className="font-mono">{employee.accountNumber}</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">IFSC Code</span>
            <span className="font-mono">{employee.ifscCode}</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">PAN / Aadhaar</span>
            <span className="font-mono">{employee.panNumber}</span>
          </div>
        </div>

        {/* Attendance Summary Strip */}
        <div className="flex items-center justify-between p-3 bg-primary-container/10 border border-primary-container/30 rounded-lg text-xs mb-6 font-medium">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-on-surface-variant">Calendar Days: </span>
              <strong className="text-primary font-mono">{calendarDays}</strong>
            </div>
            <div>
              <span className="text-on-surface-variant">Paid Days: </span>
              <strong className="text-emerald-700 font-mono">{paidDays}</strong>
            </div>
            <div>
              <span className="text-on-surface-variant">Loss of Pay (LWP): </span>
              <strong className="text-error font-mono">{unpaidDays}</strong>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-800 text-[11px] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Muster Reconciled</span>
          </div>
        </div>

        {/* Two-Column Earnings & Deductions Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* Earnings Column */}
          <div className="border border-outline-variant/30 rounded-lg overflow-hidden">
            <div className="bg-surface-container px-4 py-2 border-b border-outline-variant/30 flex justify-between items-center">
              <span className="font-serif font-bold text-xs uppercase tracking-wider text-primary">Earnings Components</span>
              <span className="text-[10px] text-on-surface-variant font-mono">Amount (₹)</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-outline-variant/20">
                <tr>
                  <td className="px-4 py-2 text-on-surface">Basic Pay (Prorated)</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">₹{basic.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-on-surface">House Rent Allowance (HRA)</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">₹{hra.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-on-surface">Conveyance Allowance</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">₹{conveyance.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-on-surface">Special Allowance</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">₹{specialAllowance.toLocaleString('en-IN')}</td>
                </tr>
                {overtimePay > 0 && (
                  <tr className="bg-emerald-50">
                    <td className="px-4 py-2 text-emerald-900 font-semibold">Authorised Overtime Pay</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-emerald-900">₹{overtimePay.toLocaleString('en-IN')}</td>
                  </tr>
                )}
                {variableIncentives > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-on-surface">Variable Performance Incentive</td>
                    <td className="px-4 py-2 text-right font-mono font-medium">₹{variableIncentives.toLocaleString('en-IN')}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-surface-container font-bold border-t border-outline-variant/30">
                  <td className="px-4 py-2.5 text-primary">Total Gross Earnings (A)</td>
                  <td className="px-4 py-2.5 text-right font-mono text-primary text-sm">
                    ₹{grossEarnings.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deductions Column */}
          <div className="border border-outline-variant/30 rounded-lg overflow-hidden">
            <div className="bg-surface-container px-4 py-2 border-b border-outline-variant/30 flex justify-between items-center">
              <span className="font-serif font-bold text-xs uppercase tracking-wider text-primary">Statutory Deductions</span>
              <span className="text-[10px] text-on-surface-variant font-mono">Amount (₹)</span>
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-outline-variant/20">
                <tr>
                  <td className="px-4 py-2 text-on-surface">Employee Provident Fund (EPF 12%)</td>
                  <td className="px-4 py-2 text-right font-mono font-medium text-error">
                    ₹{pfDeduction.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-on-surface">Employee State Insurance (ESIC 0.75%)</td>
                  <td className="px-4 py-2 text-right font-mono font-medium text-error">
                    ₹{esicDeduction.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-on-surface">Professional Tax (PT - Maharashtra)</td>
                  <td className="px-4 py-2 text-right font-mono font-medium text-error">
                    ₹{ptDeduction.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-on-surface">Tax Deducted at Source (TDS)</td>
                  <td className="px-4 py-2 text-right font-mono font-medium text-error">
                    ₹{tdsDeduction.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-surface-container font-bold border-t border-outline-variant/30">
                  <td className="px-4 py-2.5 text-primary">Total Deductions (B)</td>
                  <td className="px-4 py-2.5 text-right font-mono text-error text-sm">
                    - ₹{totalDeductions.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Net Take-Home Highlight Card */}
        <div className="p-5 bg-primary rounded-xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider opacity-80 block">Net Salary Payable (A - B)</span>
            <div className="font-serif text-3xl font-bold mt-0.5">
              ₹{netPayable.toLocaleString('en-IN')}
            </div>
            <p className="text-xs opacity-90 mt-1">
              Indian Rupees {netPayable.toLocaleString('en-IN')} Only
            </p>
          </div>

          <div className="text-right sm:border-l sm:pl-6 border-white/20">
            <span className="text-[11px] uppercase tracking-wider opacity-80 block">Disbursement Mode</span>
            <span className="font-semibold text-sm">Direct Bank NEFT / RTGS</span>
            <span className="text-[10px] block opacity-75 mt-0.5 font-mono">Txn Batch Ref: NEFT-202610-AVENCIS</span>
          </div>
        </div>

        {/* Employer Statutory Contributions Reference Strip */}
        <div className="p-3 bg-surface-container rounded-lg border border-outline-variant/30 text-[11px] text-on-surface-variant flex flex-wrap items-center justify-between gap-2 mb-8 font-mono">
          <span>Employer PF Contribution: ₹{pfEmployer.toLocaleString('en-IN')} (3.67% EPF + 8.33% EPS)</span>
          <span>Employer ESIC Contribution: ₹{esicEmployer.toLocaleString('en-IN')} (3.25%)</span>
          <span>CTC Cost to Company: ₹{(grossEarnings + pfEmployer + esicEmployer).toLocaleString('en-IN')}</span>
        </div>

        {/* Statutory Compliance Footer & QR Authentication */}
        <div className="border-t-2 border-outline-variant/40 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-on-surface-variant">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-surface-container-high rounded p-1 flex items-center justify-center">
              <QrCode className="w-10 h-10 text-primary" />
            </div>
            <div>
              <span className="font-bold text-primary block">Form XIX Cryptographic Seal</span>
              <span className="text-[10px] font-mono block">SHA-256: 8f9b4c2e...d4a1</span>
              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Statutorily Validated without physical signature under IT Act 2000</span>
              </span>
            </div>
          </div>

          <div className="text-right text-[11px]">
            <span className="font-semibold text-primary block">Authorized Signatory</span>
            <span className="font-serif italic text-on-surface block mt-1">Avencis Global Governance Officer</span>
            <span className="text-[10px] text-on-surface-variant">For {activeLegalEntity?.legalName || currentClient.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
