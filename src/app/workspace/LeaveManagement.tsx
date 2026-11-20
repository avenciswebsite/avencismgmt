import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { leaveService } from '../../services/leaveService';
import { policyService } from '../../services/policyService';
import { employeeService } from '../../services/employeeService';
import { CallerScope, LeaveRequestRow, LeaveBalanceRow } from '../../services/serviceTypes';
import { 
  FileText, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Plus, 
  Sliders,
  RefreshCw,
  ShieldAlert,
  Search,
  Filter,
  Check,
  Building2,
  MapPin
} from 'lucide-react';

export const LeaveManagement: React.FC = () => {
  const { clientId: routeClientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeClient, activeClientId, availableClients } = useWorkspace();

  const effectiveClientId = routeClientId || activeClientId || activeClient?.id;
  const currentClient = availableClients.find(c => c.id === effectiveClientId) || activeClient;

  const userRole = user?.role;
  const userClientId = user?.clientId || effectiveClientId;
  const userEmployeeId = user?.employeeId;

  // Data states
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [clientPolicy, setClientPolicy] = useState<any>(null);
  const [employeeBalances, setEmployeeBalances] = useState<Record<string, LeaveBalanceRow[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Decision Modal state
  const [decisionModal, setDecisionModal] = useState<{ id: string; action: 'APPROVED' | 'REJECTED'; empId?: string } | null>(null);
  const [managerRemarks, setManagerRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch all live leave data
  const loadLeaveData = useCallback(async () => {
    if (!effectiveClientId) return;

    setIsLoading(true);
    setError(null);

    const scope: CallerScope | undefined = userRole ? {
      role: userRole,
      clientId: userClientId || effectiveClientId,
      employeeId: userEmployeeId,
    } : undefined;

    try {
      const [reqRes, empRes, polRes] = await Promise.all([
        leaveService.getLeaveRequests({ clientId: effectiveClientId }, scope),
        employeeService.getEmployees({ clientId: effectiveClientId }, scope),
        policyService.getClientPolicy(effectiveClientId)
      ]);

      if (reqRes.data) {
        setLeaveRequests(reqRes.data);
      } else if (reqRes.error) {
        setError(reqRes.error.message);
      }

      const emps = empRes.data || [];
      setEmployees(emps);

      if (polRes.data) {
        setClientPolicy(polRes.data);
      }

      // Fetch balances for employees who have pending requests
      const pendingEmps = Array.from(new Set((reqRes.data || []).map(r => r.employee_id || (r as any).employeeId)));
      const balancesMap: Record<string, LeaveBalanceRow[]> = {};

      if (pendingEmps.length > 0) {
        await Promise.all(
          pendingEmps.map(async (empId: string) => {
            if (!empId) return;
            const balRes = await leaveService.getLeaveBalances(empId, undefined, scope);
            if (balRes.data) {
              balancesMap[empId] = balRes.data;
            }
          })
        );
      }

      setEmployeeBalances(balancesMap);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while loading leave management records.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveClientId, userRole, userClientId, userEmployeeId]);

  useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  // Handle Review Decision
  const handleDecision = async () => {
    if (!decisionModal || !user) return;

    // Client-side anti-self-approval guard
    if (decisionModal.action === 'APPROVED' && user.employeeId && decisionModal.empId === user.employeeId) {
      setActionFeedback({
        type: 'error',
        message: 'Corporate Governance Violation: You cannot approve your own leave application.',
      });
      setDecisionModal(null);
      return;
    }

    setIsSubmitting(true);
    setActionFeedback(null);

    const scope: CallerScope | undefined = userRole ? {
      role: userRole,
      clientId: userClientId || effectiveClientId,
      employeeId: userEmployeeId,
    } : undefined;

    try {
      const res = await leaveService.reviewLeaveRequest(
        decisionModal.id,
        {
          status: decisionModal.action,
          reviewerId: user.id,
          reviewerEmployeeId: user.employeeId,
          remarks: managerRemarks.trim() || `${decisionModal.action === 'APPROVED' ? 'Approved' : 'Rejected'} by ${user.fullName || 'Authorized Reviewer'}`,
        },
        scope
      );

      if (res.data) {
        setActionFeedback({
          type: 'success',
          message: `Leave application marked as ${decisionModal.action}. Balances and records successfully updated.`,
        });
        setDecisionModal(null);
        setManagerRemarks('');
        await loadLeaveData();
      } else {
        setActionFeedback({
          type: 'error',
          message: res.error?.message || `Failed to ${decisionModal.action.toLowerCase()} leave request.`,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'An unexpected error occurred during review.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to resolve employee name
  const getEmployeeName = (empId: string, fallbackName?: string) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const first = emp.firstName || emp.first_name || '';
      const last = emp.lastName || emp.last_name || '';
      const full = `${first} ${last}`.trim();
      if (full) return full;
    }
    return fallbackName || 'Staff Member';
  };

  // Filtering
  const filteredRequests = leaveRequests.filter(req => {
    const empId = req.employee_id || req.employeeId;
    const empName = getEmployeeName(empId, req.employeeName);
    const leaveType = req.leave_type || req.leaveType;
    const status = (req.status || 'PENDING').toUpperCase();

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = empName.toLowerCase().includes(q);
      const matchReason = (req.reason || '').toLowerCase().includes(q);
      if (!matchName && !matchReason) return false;
    }

    // Type filter
    if (typeFilter !== 'ALL' && leaveType !== typeFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'ALL' && status !== statusFilter) {
      return false;
    }

    return true;
  });

  const pendingRequests = filteredRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING');
  const pastRequests = filteredRequests.filter(r => (r.status || '').toUpperCase() !== 'PENDING');

  const monthlyCredit = clientPolicy?.monthly_paid_leave_accrual ?? clientPolicy?.monthlyPaidLeaveAccrual ?? 2.0;
  const maxCarryForward = clientPolicy?.max_carry_forward ?? clientPolicy?.maxCarryForward ?? 30;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-surface-container-high">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent font-sans">
            Workforce Entitlements
          </div>
          <h1 className="text-2xl font-serif font-bold text-primary">Leave Management & Approvals</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Administer leave ledgers and employee time-off requests for <strong>{currentClient?.name || 'Client Organisation'}</strong>.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-surface-container-high font-semibold text-primary">
            Monthly Credit: <strong>{monthlyCredit} Days</strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-surface-container-high font-semibold text-primary">
            Carry-Forward Cap: <strong>{maxCarryForward} Days</strong>
          </span>
          <button
            onClick={loadLeaveData}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-surface-container-high hover:bg-surface-container-low text-primary transition-colors"
            title="Refresh Leave Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 border ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-bold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadLeaveData}
            className="underline font-bold hover:text-error-hover"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-surface-container-high flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30">
          <Search className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
          <input
            type="text"
            placeholder="Search employee name or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-on-surface focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface text-xs focus:outline-primary"
          >
            <option value="ALL">All Categories</option>
            <option value="PL">Privilege Leave (PL)</option>
            <option value="CL">Casual Leave (CL)</option>
            <option value="SL">Sick Leave (SL)</option>
            <option value="LWP">Leave Without Pay (LWP)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface text-xs focus:outline-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Pending Leave Applications Queue */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-card overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex items-center justify-between text-xs">
          <div className="font-serif font-bold text-sm text-primary flex items-center space-x-2">
            <span>Pending Leave Requests</span>
            <span className="w-5 h-5 rounded-full bg-accent text-white font-bold flex items-center justify-center text-[10px]">
              {pendingRequests.length}
            </span>
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono">
            {pendingRequests.length} Actionable Application{pendingRequests.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="divide-y divide-surface-container-high text-xs">
          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" />
              <span>Loading leave applications from authorized ledger...</span>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">
              No pending leave applications requiring approval.
            </div>
          ) : (
            pendingRequests.map(req => {
              const empId = req.employee_id || req.employeeId;
              const empName = getEmployeeName(empId, req.employeeName);
              const leaveType = req.leave_type || req.leaveType;
              const startDate = req.start_date || req.startDate;
              const endDate = req.end_date || req.endDate;
              const totalDays = req.total_days ?? req.totalDays ?? 1;
              const balances = employeeBalances[empId] || [];
              const currentBal = balances.find(b => (b.leave_type || (b as any).leaveType) === leaveType)?.closing ?? '--';
              const isOwnRequest = Boolean(user?.employeeId && empId === user.employeeId);

              return (
                <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-container-low/40 transition-colors">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-primary text-sm">{empName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/10 text-accent">
                        {leaveType} ({totalDays} Day{totalDays > 1 ? 's' : ''})
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        {startDate} to {endDate}
                      </span>
                      {isOwnRequest && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20">
                          Your Application
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-on-surface italic">
                      "{req.reason}"
                    </div>

                    <div className="flex items-center space-x-4 text-[11px] text-on-surface-variant pt-1">
                      <span>Available {leaveType} Balance: <strong>{currentBal} Days</strong></span>
                      <span>Applied on: {new Date(req.created_at || (req as any).createdAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => setDecisionModal({ id: req.id, action: 'REJECTED', empId })}
                      className="px-3.5 py-1.5 rounded-lg border border-error/30 text-error hover:bg-error/10 text-xs font-bold transition-colors"
                    >
                      Reject
                    </button>

                    {isOwnRequest ? (
                      <div 
                        title="Corporate Governance Violation: Employees cannot approve their own leave applications."
                        className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface-variant text-[11px] font-bold flex items-center gap-1 cursor-not-allowed opacity-75"
                      >
                        <ShieldAlert className="w-3 h-3 text-secondary" />
                        <span>Self-Approval Prohibited</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDecisionModal({ id: req.id, action: 'APPROVED', empId })}
                        className="px-4 py-1.5 rounded-lg bg-success hover:bg-success/90 text-white text-xs font-bold transition-colors shadow-sm flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Historical / Approved Leave Register */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-card overflow-hidden">
        <div className="p-4 border-b border-surface-container-high text-xs flex items-center justify-between">
          <div className="font-serif font-bold text-sm text-primary">
            Recent Leave History & Actions
          </div>
          <span className="text-[10px] text-on-surface-variant font-mono">
            {pastRequests.length} Concluded Record{pastRequests.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px] border-b border-surface-container-high">
              <tr>
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Date Span</th>
                <th className="py-2.5 px-4">Duration</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Manager Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {pastRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-on-surface-variant">
                    No historical leave records match the active criteria.
                  </td>
                </tr>
              ) : (
                pastRequests.map(r => {
                  const empId = r.employee_id || r.employeeId;
                  const empName = getEmployeeName(empId, r.employeeName);
                  const leaveType = r.leave_type || r.leaveType;
                  const startDate = r.start_date || r.startDate;
                  const endDate = r.end_date || r.endDate;
                  const totalDays = r.total_days ?? r.totalDays ?? 1;
                  const status = (r.status || 'APPROVED').toUpperCase();
                  const mgrRemarks = r.manager_remarks || r.managerRemarks;

                  return (
                    <tr key={r.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-primary">{empName}</td>
                      <td className="py-3 px-4 font-semibold text-on-surface">{leaveType}</td>
                      <td className="py-3 px-4 text-on-surface-variant">{startDate} to {endDate}</td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">{totalDays} day(s)</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          status === 'APPROVED' ? 'bg-success/10 text-success' :
                          status === 'REJECTED' ? 'bg-error/10 text-error' :
                          'bg-surface-container-high text-on-surface-variant'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant italic">{mgrRemarks || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Modal */}
      {decisionModal && (
        <div className="fixed inset-0 bg-primary-dark/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-elevated border border-surface-container-high p-6 max-w-md w-full space-y-4 text-xs">
            <h3 className="text-base font-serif font-bold text-primary">
              {decisionModal.action === 'APPROVED' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </h3>
            <p className="text-on-surface-variant">
              Confirm your decision. Approved paid leaves will automatically debit the employee's leave balance ledger and update the month-end payroll calculation.
            </p>

            <div>
              <label className="font-bold text-on-surface block mb-1">Manager Note / Approval Reason</label>
              <textarea
                value={managerRemarks}
                onChange={e => setManagerRemarks(e.target.value)}
                placeholder="e.g. Approved. Shift coverage arranged..."
                rows={3}
                className="w-full p-2.5 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setDecisionModal(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-surface-container-high text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleDecision}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-lg text-white text-xs font-bold shadow-sm flex items-center gap-1.5 ${
                  decisionModal.action === 'APPROVED' ? 'bg-success hover:bg-success/90' : 'bg-error hover:bg-error/90'
                }`}
              >
                {isSubmitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Confirm {decisionModal.action}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
