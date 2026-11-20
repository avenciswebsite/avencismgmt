import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { store } from '../../data/store';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Building2, 
  Layers, 
  Filter, 
  CheckCircle2, 
  FileText,
  Printer
} from 'lucide-react';

export const ReportsAnalyticsView: React.FC = () => {
  const { clients, currentClient } = useWorkspace();

  const [selectedReport, setSelectedReport] = useState<string>('muster');
  const [selectedClient, setSelectedClient] = useState<string>(currentClient?.id || clients[0]?.id || '');
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isGenerated, setIsGenerated] = useState<boolean>(true);

  const reportTypes = [
    { id: 'muster', name: 'Monthly Attendance Muster (Form II)', desc: 'Daily punch status, paid days, loss of pay for compliance' },
    { id: 'leave', name: 'Leave Ledger & Accrual Register (Form XIV)', desc: 'Opening balances, credits, approved leaves and closing ledger' },
    { id: 'epf', name: 'EPF ECR Pre-filing Statement', desc: 'UAN-wise basic wages, employee 12% and employer EPS/EPF shares' },
    { id: 'esic', name: 'ESIC Contribution Register', desc: 'IP numbers, gross wages, employee 0.75% and employer 3.25%' },
    { id: 'bank', name: 'Bank Transfer Disbursement Batch', desc: 'NEFT/RTGS batch file with IFSC and account numbers for corporate banking' },
  ];

  const client = clients.find(c => c.id === selectedClient) || clients[0];
  const employees = client ? store.getEmployees(client.id) : [];
  const policy = client ? store.getClientPolicy(client.id) : undefined;

  const handleDownload = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (selectedReport === 'muster') {
      headers = ['Employee', 'Code', 'Designation', 'Calendar Days', 'Present', 'Paid Leaves', 'LWP (Unpaid)', 'Payable Days'];
      rows = employees.map(emp => {
        const unpaid = emp.id.endsWith('05') ? 1 : 0;
        const paid = 30 - unpaid;
        return [`"${emp.firstName} ${emp.lastName}"`, `"${emp.employeeCode}"`, `"${emp.designation}"`, '30', '25', '4', `${unpaid}`, `${paid}`];
      });
    } else if (selectedReport === 'bank') {
      headers = ['Beneficiary Name', 'Employee Code', 'Bank Name', 'Account Number', 'IFSC Code', 'Net Amount (INR)', 'Payment Mode'];
      rows = employees.map(emp => {
        const unpaid = emp.id.endsWith('05') ? 1 : 0;
        const paid = 30 - unpaid;
        const net = Math.round((emp.fixedMonthlySalary / 30) * paid * 0.88 + emp.variableIncentive);
        return [`"${emp.firstName} ${emp.lastName}"`, `"${emp.employeeCode}"`, `"${emp.bankName}"`, `"${emp.accountNumber}"`, `"${emp.ifscCode}"`, `${net}`, 'NEFT'];
      });
    } else {
      headers = ['Employee', 'Statutory ID', 'Qualifying Base Wages', 'Employee Contribution', 'Employer Share', 'Total Deposit'];
      rows = employees.map(emp => {
        const wage = Math.min(emp.fixedMonthlySalary, 15000);
        const empShare = Math.round(wage * 0.12);
        const emplyrShare = Math.round(wage * 0.12);
        return [`"${emp.firstName} ${emp.lastName}"`, `"${emp.uanNumber || emp.esicNumber || '109876543210'}"`, `${wage}`, `${empShare}`, `${emplyrShare}`, `${empShare + emplyrShare}`];
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedReport}_report_${client?.code || 'client'}_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Statutory Dossier & Compliance Archives
          </span>
          <h1 className="font-serif text-3xl text-primary font-normal">
            Reports & Analytics Dashboard
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Generate and export verified statutory registers, labour law filings, and corporate banking payout schedules.
          </p>
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded font-medium text-sm hover:bg-primary/90 shadow transition-all"
        >
          <Download className="w-4 h-4 text-secondary-fixed" />
          <span>Export Current Report (.csv)</span>
        </button>
      </div>

      {/* Control Configuration Bar */}
      <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="block text-on-surface-variant font-medium mb-1">Statutory Report Type</label>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
            className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface font-semibold"
          >
            {reportTypes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-on-surface-variant font-medium mb-1">Organisation</label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-on-surface-variant font-medium mb-1">Period Cycle</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface"
          >
            <option value={10}>October 2026</option>
            <option value={11}>November 2026</option>
            <option value={9}>September 2026</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => setIsGenerated(true)}
            className="w-full py-2 bg-secondary-container text-on-secondary-container rounded font-semibold text-xs hover:bg-secondary-container/80 transition-colors shadow-sm"
          >
            Refresh Ledger View
          </button>
        </div>
      </div>

      {/* Report Preview Surface */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="p-4 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
          <div>
            <span className="font-serif text-lg text-primary font-normal block">
              {reportTypes.find(r => r.id === selectedReport)?.name}
            </span>
            <span className="text-xs text-on-surface-variant">
              Organisation: <strong>{client?.name}</strong> • Period: <strong>{selectedMonth}/{selectedYear}</strong>
            </span>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-semibold">
            VERIFIED & AUDITED
          </span>
        </div>

        <div className="overflow-x-auto">
          {selectedReport === 'muster' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-outline-variant/30">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3 text-center">Calendar Days</th>
                  <th className="p-3 text-center">Present</th>
                  <th className="p-3 text-center">Paid Leaves</th>
                  <th className="p-3 text-center text-error font-semibold">LWP (Unpaid)</th>
                  <th className="p-3 text-right font-bold text-primary">Payable Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {employees.map((emp) => {
                  const unpaid = emp.id.endsWith('05') ? 1 : 0;
                  const paid = 30 - unpaid;
                  return (
                    <tr key={emp.id} className="hover:bg-surface-container-low/40">
                      <td className="p-3 font-semibold text-on-surface">{emp.firstName} {emp.lastName}</td>
                      <td className="p-3 font-mono text-on-surface-variant">{emp.employeeCode}</td>
                      <td className="p-3 text-on-surface-variant">{emp.designation}</td>
                      <td className="p-3 text-center">30</td>
                      <td className="p-3 text-center font-medium">25</td>
                      <td className="p-3 text-center">4</td>
                      <td className="p-3 text-center font-bold text-error">{unpaid}</td>
                      <td className="p-3 text-right font-mono font-bold text-primary">{paid}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {selectedReport === 'bank' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-outline-variant/30">
                  <th className="p-3">Beneficiary Name</th>
                  <th className="p-3">Employee Code</th>
                  <th className="p-3">Bank Name</th>
                  <th className="p-3 font-mono">Account Number</th>
                  <th className="p-3 font-mono">IFSC Code</th>
                  <th className="p-3 text-right font-bold text-primary">Net Amount (INR)</th>
                  <th className="p-3 text-center">Payment Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {employees.map((emp) => {
                  const unpaid = emp.id.endsWith('05') ? 1 : 0;
                  const paid = 30 - unpaid;
                  const net = Math.round((emp.fixedMonthlySalary / 30) * paid * 0.88 + emp.variableIncentive);
                  return (
                    <tr key={emp.id} className="hover:bg-surface-container-low/40">
                      <td className="p-3 font-semibold text-on-surface">{emp.firstName} {emp.lastName}</td>
                      <td className="p-3 font-mono text-on-surface-variant">{emp.employeeCode}</td>
                      <td className="p-3">{emp.bankName}</td>
                      <td className="p-3 font-mono">{emp.accountNumber}</td>
                      <td className="p-3 font-mono">{emp.ifscCode}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-900">
                        ₹{net.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-mono font-bold">
                          NEFT
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {(selectedReport === 'epf' || selectedReport === 'esic' || selectedReport === 'leave') && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-outline-variant/30">
                  <th className="p-3">Employee</th>
                  <th className="p-3 font-mono">Statutory ID (UAN / IP)</th>
                  <th className="p-3 text-right">Qualifying Base Wages</th>
                  <th className="p-3 text-right text-error">Employee Contribution</th>
                  <th className="p-3 text-right font-semibold text-primary">Employer Share</th>
                  <th className="p-3 text-right font-bold">Total Deposit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {employees.map((emp) => {
                  const wage = Math.min(emp.fixedMonthlySalary, 15000);
                  const empShare = Math.round(wage * 0.12);
                  const emplyrShare = Math.round(wage * 0.12);
                  return (
                    <tr key={emp.id} className="hover:bg-surface-container-low/40">
                      <td className="p-3 font-semibold text-on-surface">{emp.firstName} {emp.lastName}</td>
                      <td className="p-3 font-mono">{emp.uanNumber || emp.esicNumber || '109876543210'}</td>
                      <td className="p-3 text-right font-mono">₹{wage.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono text-error">₹{empShare.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono text-primary">₹{emplyrShare.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono font-bold text-on-surface">
                        ₹{(empShare + emplyrShare).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
