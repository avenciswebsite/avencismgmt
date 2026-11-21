import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { attendanceService } from '../../services/attendanceService';
import { CallerScope, AttendanceCorrectionRow } from '../../services/serviceTypes';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowLeft, 
  FileText, 
  Calendar,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Home
} from 'lucide-react';

export const AttendanceRegularisations: React.FC = () => {
  const { clientId: routeClientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeClient, refreshWorkspace } = useWorkspace();

  const client = activeClient;

  const effectiveClientId = client?.id || routeClientId;
  const userRole = user?.role;
  const userClientId = user?.clientId;
  const userEmployeeId = user?.employeeId;

  // Caller scope for role-based authorization - memoized to prevent infinite re-render loops
  const callerScope: CallerScope | undefined = useMemo(() => userRole ? {
    role: userRole,
    clientId: userClientId || effectiveClientId,
    employeeId: userEmployeeId,
  } : undefined, [userRole, userClientId, effectiveClientId, userEmployeeId]);

  const [corrections, setCorrections] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'WFH' | 'PUNCH'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [decisionModal, setDecisionModal] = useState<{ id: string; action: 'APPROVED' | 'REJECTED'; empId?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load regularisation requests from attendance service
  const loadRequests = useCallback(async () => {
    if (!effectiveClientId) return;

    setIsLoading(true);
    setError(null);

    const scope: CallerScope | undefined = userRole ? {
      role: userRole,
      clientId: userClientId || effectiveClientId,
      employeeId: userEmployeeId,
    } : undefined;

    try {
      const res = await attendanceService.getRegularisationRequests({ clientId: effectiveClientId }, scope);
      if (res.data) {
        setCorrections(res.data);
      } else {
        setError(res.error?.message || 'Failed to retrieve regularisation requests.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected network error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveClientId, userRole, userClientId, userEmployeeId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Handle Approval or Rejection Decision
  const handleDecision = async () => {
    if (!decisionModal || !user) return;

    // Client-side anti-self-approval guard
    if (decisionModal.action === 'APPROVED' && user.employeeId && decisionModal.empId === user.employeeId) {
      setFeedback({
        type: 'error',
        message: 'Corporate Governance Violation: You cannot approve your own attendance regularisation request.',
      });
      setDecisionModal(null);
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await attendanceService.reviewRegularisation(
        decisionModal.id,
        {
          status: decisionModal.action,
          reviewerId: user.employeeId || user.id,
          remarks: remarks.trim() || `${decisionModal.action === 'APPROVED' ? 'Approved' : 'Rejected'} by ${user.fullName || 'Authorized Reviewer'}`,
        },
        callerScope
      );

      if (res.data) {
        setFeedback({
          type: 'success',
          message: `Regularisation request successfully marked as ${decisionModal.action}. Daily attendance ledger updated.`,
        });
        setDecisionModal(null);
        setRemarks('');
        refreshWorkspace();
        await loadRequests();
      } else {
        setFeedback({
          type: 'error',
          message: res.error?.message || `Failed to ${decisionModal.action.toLowerCase()} request.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to process regularisation decision.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetClientId = () => effectiveClientId || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-surface-container-high">
        <div>
          <button
            onClick={() => navigate(`/workspace/${getTargetClientId()}/attendance`)}
            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center space-x-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Attendance Command</span>
          </button>
          <h1 className="text-2xl font-serif font-bold text-primary">Work From Home & Attendance Ledger</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Audit and approve staff Work From Home (WFH) requests, off-site exceptions, and missed punches.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={isLoading}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-surface-container-high hover:bg-surface-container-low text-xs font-bold text-primary flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert with Retry */}
      {error && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadRequests}
            className="underline font-bold hover:text-error-hover"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Corrections Queue */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-card overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="font-serif font-bold text-sm text-primary">
            Review Queue: {corrections.length} Total Requests
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-on-surface-variant font-mono mr-2">
              Pending: {corrections.filter(c => (c.status || '').toUpperCase() === 'PENDING').length}
            </span>
            <div className="flex items-center bg-surface-container-low p-0.5 rounded-lg border border-surface-container-high">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  filterType === 'ALL' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('WFH')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
                  filterType === 'WFH' ? 'bg-blue-600 text-white shadow-xs' : 'text-on-surface-variant hover:text-blue-700'
                }`}
              >
                <Home className="w-3 h-3" />
                <span>WFH</span>
              </button>
              <button
                onClick={() => setFilterType('PUNCH')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  filterType === 'PUNCH' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Punch
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-surface-container-high text-xs">
          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" />
              <span>Loading regularisation audit records from database...</span>
            </div>
          ) : corrections.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant">
              No regularisation requests recorded for this client.
            </div>
          ) : (
            corrections
              .filter((c: any) => {
                const isWfh = c.reason?.includes('[WORK_FROM_HOME]') || c.reason?.includes('[WFH]');
                if (filterType === 'WFH') return isWfh;
                if (filterType === 'PUNCH') return !isWfh;
                return true;
              })
              .map((c: any) => {
              const empId = c.employeeId || c.employee_id;
              const empName = c.employeeName || c.employee_name || 'Staff Member';
              const reqDate = c.date;
              const reqIn = c.requestedCheckIn || c.requested_check_in || c.requested_in_time || '--:--';
              const reqOut = c.requestedCheckOut || c.requested_check_out || c.requested_out_time || '--:--';
              const reasonText = c.reason || '';
              const isWfh = reasonText.includes('[WORK_FROM_HOME]') || reasonText.includes('[WFH]');
              const cleanReason = isWfh ? reasonText.replace('[WORK_FROM_HOME]', '').replace('[WFH]', '').trim() : reasonText;
              const mgrRemarks = c.managerRemarks || c.manager_remarks || c.review_remarks;
              const status = (c.status || 'PENDING').toUpperCase();

              // Corporate Governance Anti-Self-Approval Rule Check
              const isOwnRequest = Boolean(user?.employeeId && empId === user.employeeId);

              return (
                <div key={c.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-container-low/40 transition-colors">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-primary text-sm">{empName}</span>
                      {isWfh && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 shadow-2xs">
                          <Home className="w-3 h-3 text-blue-600" />
                          <span>Work From Home</span>
                        </span>
                      )}
                      <span className="text-[10px] text-on-surface-variant font-mono">Date: {reqDate}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        status === 'APPROVED'
                          ? 'bg-success/10 text-success'
                          : status === 'PENDING'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-error/10 text-error'
                      }`}>
                        {status}
                      </span>
                      {isOwnRequest && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20">
                          Your Request
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-on-surface">
                      Requested Timings: <strong>{reqIn}</strong> to <strong>{reqOut}</strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-surface-container-low text-[11px] text-on-surface-variant italic">
                      "{cleanReason}"
                    </div>

                    {mgrRemarks && (
                      <div className="text-[11px] text-primary font-medium flex items-center space-x-1 pt-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>Manager Note: {mgrRemarks}</span>
                      </div>
                    )}
                  </div>

                  {status === 'PENDING' && (
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => setDecisionModal({ id: c.id, action: 'REJECTED', empId })}
                        className="px-3 py-1.5 rounded-lg border border-error/30 text-error hover:bg-error/10 text-xs font-bold transition-colors"
                      >
                        Reject
                      </button>

                      {isOwnRequest ? (
                        <div 
                          title="Anti-Self-Approval Rule: Managers cannot approve their own regularisation requests."
                          className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface-variant text-[11px] font-bold flex items-center gap-1 cursor-not-allowed opacity-75"
                        >
                          <ShieldAlert className="w-3 h-3 text-secondary" />
                          <span>Self-Approval Prohibited</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDecisionModal({ id: c.id, action: 'APPROVED', empId })}
                          className="px-4 py-1.5 rounded-lg bg-success hover:bg-success/90 text-white text-xs font-bold transition-colors shadow-sm flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Decision Remarks Modal */}
      {decisionModal && (
        <div className="fixed inset-0 bg-primary-dark/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-elevated border border-surface-container-high p-6 max-w-md w-full space-y-4 text-xs">
            <h3 className="text-base font-serif font-bold text-primary">
              {decisionModal.action === 'APPROVED' ? 'Approve Regularisation' : 'Reject Regularisation'}
            </h3>
            <p className="text-on-surface-variant">
              Enter your managerial justification. This will be permanently recorded in the immutable audit log and the daily attendance record.
            </p>

            <div>
              <label className="font-bold text-on-surface block mb-1">Audit Remarks / Verification Note</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Verified against physical depot security log..."
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
