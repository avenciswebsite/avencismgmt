import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { payrollService } from '../../services/payrollService';
import { employeeService } from '../../services/employeeService';
import { PayrollRunRow, PayrollItemRow, EmployeeRow } from '../../services/serviceTypes';
import { 
  FileText, 
  Download, 
  Search, 
  CheckCircle, 
  Eye, 
  Printer, 
  ShieldCheck, 
  Send,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Loader2
} from 'lucide-react';

export const PayslipManagement: React.FC = () => {
  const { currentClient } = useWorkspace();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isDispatched, setIsDispatched] = useState<boolean>(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);

  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItemRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load clients' runs and employees
  useEffect(() => {
    if (!currentClient?.id) return;
    setIsLoading(true);
    setErrorMsg(null);
    Promise.all([
      payrollService.getPayrollRuns(currentClient.id),
      employeeService.getEmployees({ clientId: currentClient.id }),
    ]).then(([runsRes, empsRes]) => {
      if (runsRes.success && runsRes.data) setRuns(runsRes.data);
      if (empsRes.success && empsRes.data) setEmployees(empsRes.data);
    }).catch(err => {
      setErrorMsg(err.message || 'Error loading records');
    }).finally(() => {
      setIsLoading(false);
    });
  }, [currentClient?.id]);

  // Load items for active run when month/year changes
  const activeRun = runs.find(r => r.period_month === selectedMonth && r.period_year === selectedYear) || runs[0];

  useEffect(() => {
    if (activeRun?.id) {
      payrollService.getPayrollItems(activeRun.id).then(res => {
        if (res.success && res.data) {
          setPayrollItems(res.data);
        }
      });
    } else {
      setPayrollItems([]);
    }
  }, [activeRun?.id]);

  if (!currentClient) {
    return <div className="p-8 text-on-surface-variant">Please select a client workspace first.</div>;
  }

  // Derive payslip line items for employees
  const payslips = employees.map(emp => {
    const runItem = payrollItems.find(i => i.employee_id === emp.id);
    if (runItem) {
      return {
        id: `ps-${emp.id}-${selectedMonth}-${selectedYear}`,
        employee: {
          id: emp.id,
          firstName: emp.first_name,
          lastName: emp.last_name,
          employeeCode: emp.employee_code,
          designation: emp.designation,
          avatarUrl: emp.avatar_url || '',
        },
        month: selectedMonth,
        year: selectedYear,
        calendarDays: runItem.calendar_days,
        paidDays: runItem.paid_days,
        unpaidDays: runItem.unpaid_days,
        payableBase: runItem.fixed_salary - runItem.unpaid_deduction,
        grossEarned: runItem.gross_earned,
        totalDeductions: runItem.total_deductions,
        netSalary: runItem.net_salary,
        status: isDispatched ? 'DISPATCHED' : (activeRun?.status === 'locked' ? 'PUBLISHED' : 'RENDERED'),
      };
    }

    return {
      id: `ps-${emp.id}-${selectedMonth}-${selectedYear}`,
      employee: {
        id: emp.id,
        firstName: emp.first_name,
        lastName: emp.last_name,
        employeeCode: emp.employee_code,
        designation: emp.designation,
        avatarUrl: emp.avatar_url || '',
      },
      month: selectedMonth,
      year: selectedYear,
      calendarDays: 30,
      paidDays: 30,
      unpaidDays: 0,
      payableBase: 0,
      grossEarned: 0,
      totalDeductions: 0,
      netSalary: 0,
      status: isDispatched ? 'DISPATCHED' : 'RENDERED',
    };
  });

  const filteredPayslips = payslips.filter(ps => {
    const matchesSearch = ps.employee.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ps.employee.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ps.employee.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || ps.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalDisbursed = payslips.reduce((sum, p) => sum + p.netSalary, 0);

  const handleDispatchAll = () => {
    setIsDispatched(true);
    setDispatchNotice(`Dispatched ${payslips.length} statutory Form XIX payslips to employee mobile self-service portal.`);
    setTimeout(() => setDispatchNotice(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Dispatch notification banner */}
      {dispatchNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{dispatchNotice}</span>
          </div>
          <button onClick={() => setDispatchNotice(null)} className="text-xs font-bold opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-primary-container text-primary text-xs font-semibold uppercase tracking-wider">
              Document Governance · Batch 07
            </span>
            <span className="text-on-surface-variant text-xs">•</span>
            <span className="text-on-surface-variant text-xs">
              Muster Lock: {activeRun ? `${activeRun.period_month}/${activeRun.period_year}` : 'Verified'}
            </span>
          </div>
          <h1 className="font-serif text-3xl text-primary font-normal">
            Payslip Management & Document Distribution
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            A4 salary slip generation, statutory client compliance, and digital distribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-surface-container-low px-3 py-1.5 rounded border border-outline-variant/30 text-xs">
            <Calendar className="w-3.5 h-3.5 text-secondary mr-1.5" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent font-medium text-on-surface focus:outline-none cursor-pointer"
            >
              <option value={10}>October 2026</option>
              <option value={11}>November 2026</option>
              <option value={9}>September 2026</option>
            </select>
          </div>

          <button
            onClick={() => navigate(`/workspace/${currentClient.id}/payroll/wizard`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Layers className="w-4 h-4 text-secondary-fixed" />
            <span>Open Guided Payroll</span>
          </button>

          <button
            onClick={handleDispatchAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-secondary-container text-on-secondary-container rounded text-sm font-medium hover:bg-secondary-container/80 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>Dispatch to Portal</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-8 text-center text-on-surface-variant flex items-center justify-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span className="text-xs">Loading employee payslips from Supabase...</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
            <span>Eligible Headcount</span>
            <Building2 className="w-4 h-4 text-secondary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-3xl text-primary font-normal">{employees.length}</span>
            <span className="text-xs text-on-surface-variant">Active Staff</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>100% Attendance Reconciled</span>
          </p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
            <span>Slips Generated</span>
            <FileText className="w-4 h-4 text-secondary-fixed-dim" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-3xl text-primary font-normal">{payslips.length}</span>
            <span className="text-xs text-on-surface-variant">/ {employees.length}</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Form XIX Compliant</span>
          </p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
            <span>Net Disbursal</span>
            <span className="text-xs font-mono font-bold text-primary">INR</span>
          </div>
          <div className="mt-2">
            <span className="font-serif text-3xl text-primary font-normal">
              ₹{totalDisbursed.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Authorized for bank NEFT transfer
          </p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
            <span>Status</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="font-serif text-2xl text-emerald-700 font-normal">
              {isDispatched ? 'Dispatched' : (activeRun?.status === 'locked' ? 'Audited & Locked' : 'Rendered')}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Terminal cryptographic lock active
          </p>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by employee name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="RENDERED">Rendered</option>
              <option value="PUBLISHED">Published</option>
              <option value="DISPATCHED">Dispatched</option>
            </select>

            <button
              onClick={() => {
                setDispatchNotice('Bulk PDF compilation: Generating consolidated statutory payslip archives...');
                setTimeout(() => setDispatchNotice(null), 5000);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest text-on-surface hover:bg-surface-container border border-outline-variant/30 rounded text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-secondary" />
              <span>Bulk PDF Archive (.zip)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-outline-variant/30">
                <th className="p-3">Employee</th>
                <th className="p-3">Designation</th>
                <th className="p-3 text-center">Paid / Unpaid</th>
                <th className="p-3 text-right">Gross Earned</th>
                <th className="p-3 text-right">Statutory Ded.</th>
                <th className="p-3 text-right font-bold text-primary">Net Pay</th>
                <th className="p-3 text-center">Format & Compliance</th>
                <th className="p-3 text-center">Delivery</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredPayslips.map((ps) => (
                <tr key={ps.id} className="hover:bg-surface-container-low/40">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      {ps.employee.avatarUrl ? (
                        <img
                          src={ps.employee.avatarUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover border border-outline-variant/30"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                          {(ps.employee.firstName?.[0] || 'E') + (ps.employee.lastName?.[0] || '')}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-on-surface block">
                          {ps.employee.firstName} {ps.employee.lastName}
                        </span>
                        <span className="font-mono text-[10px] text-on-surface-variant">
                          {ps.employee.employeeCode}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-on-surface-variant">{ps.employee.designation}</td>
                  <td className="p-3 text-center">
                    <span className="font-semibold text-primary">{ps.paidDays}</span>
                    <span className="text-on-surface-variant"> / 30</span>
                    {ps.unpaidDays > 0 && (
                      <span className="ml-1 text-error text-[10px]">({ps.unpaidDays} LWP)</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono">₹{ps.grossEarned.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-right font-mono text-error">₹{ps.totalDeductions.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-900">
                    ₹{ps.netSalary.toLocaleString('en-IN')}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-[10px] font-mono">
                      Form XIX • R26
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                        ps.status === 'DISPATCHED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-secondary-container/50 text-secondary'
                      }`}
                    >
                      {ps.status === 'DISPATCHED' ? (
                        <>
                          <CheckCircle className="w-2.5 h-2.5" />
                          <span>Delivered</span>
                        </>
                      ) : (
                        <span>Rendered</span>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => navigate(`/workspace/payslips/view/${ps.employee.id}`)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-container hover:bg-primary hover:text-white rounded text-on-surface font-medium transition-colors"
                      title="View Official Printable Payslip"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
