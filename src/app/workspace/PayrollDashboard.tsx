import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { payrollService } from '../../services/payrollService';
import { policyService } from '../../services/policyService';
import { PayrollRunRow, ClientPolicyRow } from '../../services/serviceTypes';
import { 
  DollarSign, 
  Lock, 
  Clock, 
  ArrowRight, 
  AlertTriangle,
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';

export const PayrollDashboard: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { activeClient } = useWorkspace();

  const client = activeClient;
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunRow[]>([]);
  const [policy, setPolicy] = useState<ClientPolicyRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDashboardData = async () => {
    if (!client?.id) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [runsRes, policyRes] = await Promise.all([
        payrollService.getPayrollRuns(client.id),
        policyService.getClientPolicy(client.id),
      ]);

      if (runsRes.success && runsRes.data) {
        setPayrollRuns(runsRes.data);
      } else if (runsRes.error) {
        setErrorMsg(runsRes.error.message);
      }

      if (policyRes.success && policyRes.data) {
        setPolicy(policyRes.data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load payroll dashboard records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [client?.id]);

  const lastProcessedRun = payrollRuns.find(r => r.status === 'locked') || payrollRuns[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-surface-container-high">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent font-sans">
            Compensation & Financial Governance
          </div>
          <h1 className="text-2xl font-serif font-bold text-primary">Payroll Processing Dashboard</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Integrated salary calculation and statutory compliance engine for <strong>{client.name}</strong>.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadDashboardData()}
            className="p-2 rounded-lg border border-surface-container-high text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate(`/workspace/${client.id}/payroll/wizard`)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Guided Payroll Run</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-error/10 border border-error/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-error shrink-0" />
            <div>
              <div className="text-xs font-bold text-error">Database Query Notice</div>
              <div className="text-[11px] text-on-surface-variant">{errorMsg}</div>
            </div>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="px-3 py-1.5 bg-error text-white text-xs font-bold rounded-lg hover:bg-error/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Policy Engine Gate Warning if Unconfigured */}
      {policy && !policy.is_configured && (
        <div className="p-4 bg-error/10 border border-error/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-error shrink-0" />
            <div>
              <div className="text-xs font-bold text-error">Mandatory Policy Configuration Missing</div>
              <div className="text-[11px] text-on-surface-variant">
                Payroll execution is gated and blocked until salary divisor and statutory policies are configured.
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate(`/workspace/${client.id}/settings`)}
            className="px-3 py-1.5 bg-error text-white text-xs font-bold rounded-lg hover:bg-error/90 transition-colors"
          >
            Configure Policies
          </button>
        </div>
      )}

      {/* Payroll KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-bold uppercase">
            <span>Last Processed Period</span>
            <Lock className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-serif font-bold text-primary mt-1">
            {lastProcessedRun 
              ? new Date(lastProcessedRun.period_year, lastProcessedRun.period_month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
              : 'October 2026'}
          </div>
          <div className="text-[11px] text-success font-semibold mt-0.5">
            {lastProcessedRun 
              ? `${lastProcessedRun.status.toUpperCase()} (${lastProcessedRun.total_employees} Staff)`
              : 'Locked & Distributed (5 Staff)'}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-bold uppercase">
            <span>Configured Divisor</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-serif font-bold text-primary mt-1">
            {policy ? (policy.salary_divisor === 'calendar_days' ? 'Dynamic' : `${policy.salary_divisor} Days`) : '30 Days'}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-0.5">
            Client-level wage proration basis
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-bold uppercase">
            <span>Current Pay Period</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-serif font-bold text-primary mt-1">November 2026</div>
          <div className="text-[11px] text-accent font-semibold mt-0.5">
            Active Tracking in Progress
          </div>
        </div>
      </div>

      {/* Historical Payroll Runs Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-card overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex items-center justify-between text-xs">
          <div className="font-serif font-bold text-sm text-primary">
            Completed & Archived Payroll Batches
          </div>
          <button
            onClick={() => navigate(`/workspace/${client.id}/payroll/payslips`)}
            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
          >
            <span>View All Payslips</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-on-surface-variant flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <div className="text-xs">Loading payroll batches from Supabase...</div>
          </div>
        ) : payrollRuns.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant space-y-3">
            <Clock className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
            <div className="text-sm font-semibold text-primary">No Payroll Runs Recorded Yet</div>
            <p className="text-xs max-w-sm mx-auto text-on-surface-variant">
              No historical payroll runs found for {client.name}. Click "Start Guided Payroll Run" above to calculate November 2026 payroll.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px] border-b border-surface-container-high">
                <tr>
                  <th className="py-3 px-4">Pay Period</th>
                  <th className="py-3 px-4">Headcount</th>
                  <th className="py-3 px-4">Gross Earnings</th>
                  <th className="py-3 px-4">Total Deductions</th>
                  <th className="py-3 px-4">Net Salary Payable</th>
                  <th className="py-3 px-4">Approval State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {payrollRuns.map(run => (
                  <tr key={run.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-primary text-sm">
                        {new Date(run.period_year, run.period_month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-on-surface-variant font-mono">Run ID: {run.id}</div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-on-surface">
                      {run.total_employees} Employees
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-on-surface">
                      ₹{run.total_gross.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-error">
                      - ₹{run.total_deductions.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-success text-sm">
                      ₹{run.total_net.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 w-max ${
                        run.status === 'locked' 
                          ? 'bg-success/10 text-success border-success/20' 
                          : run.status === 'approved' 
                          ? 'bg-accent/10 text-accent border-accent/20'
                          : 'bg-warning/10 text-warning border-warning/20'
                      }`}>
                        <Lock className="w-3 h-3" />
                        <span>{run.status.toUpperCase()}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => navigate(`/workspace/${client.id}/payroll/payslips`)}
                        className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold text-[11px] transition-colors"
                      >
                        View Payslips
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
