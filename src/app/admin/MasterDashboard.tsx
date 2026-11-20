import React from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../../data/store';
import { useWorkspace } from '../../context/WorkspaceContext';
import { 
  Building2, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  ShieldCheck,
  TrendingUp,
  MapPin
} from 'lucide-react';

export const MasterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { switchClient } = useWorkspace();
  const clients = store.getClients();
  const employees = store.getEmployees();
  const auditLogs = store.getAuditLogs().slice(0, 5);
  const attendanceRecords = store.getAttendanceRecords();
  const payrollRuns = store.getPayrollRuns();

  const activeClients = clients.filter(c => c.status === 'active');
  const onboardingClients = clients.filter(c => c.status === 'onboarding');

  const presentCount = attendanceRecords.filter(r => r.status === 'PRESENT').length;
  const presenceRate = employees.length > 0
    ? Math.round((presentCount / employees.length) * 100)
    : 0;

  const latestRun = payrollRuns.length > 0 ? payrollRuns[payrollRuns.length - 1] : null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const payrollPeriodLabel = latestRun ? `${months[latestRun.periodMonth - 1]} ${latestRun.periodYear}` : 'Pending Run';
  const payrollStatusLabel = latestRun?.status === 'locked' ? 'Locked & Audited' : latestRun?.status ? latestRun.status.toUpperCase() : 'Not Generated';

  const handleEnterWorkspace = (clientId: string) => {
    switchClient(clientId);
    navigate(`/workspace/${clientId}`);
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-surface-container-high">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent font-sans">
            Central Workforce Operations
          </div>
          <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">
            Avencis Master Administration
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Global management command center oversight across all client organisations and legal entities.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/admin/clients/onboard')}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Onboard New Client</span>
          </button>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase tracking-wider">Total Workforce</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            {employees.length}
          </div>
          <div className="text-[11px] text-success flex items-center space-x-1 mt-1 font-semibold">
            <TrendingUp className="w-3 h-3" />
            <span>Across {clients.length} Registered Organisations</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase tracking-wider">Active Client Accounts</span>
            <Building2 className="w-4 h-4 text-accent" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            {activeClients.length}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            + {onboardingClients.length} In Onboarding Phase
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Presence Rate</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            {presenceRate}%
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            {presentCount} of {employees.length} staff checked in
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase tracking-wider">Payroll Processing</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            {payrollPeriodLabel}
          </div>
          <div className={`text-[11px] font-semibold mt-1 ${latestRun?.status === 'locked' ? 'text-success' : 'text-on-surface-variant'}`}>
            {payrollStatusLabel}
          </div>
        </div>
      </div>

      {/* Client Workspaces Overview Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif font-bold text-primary">Managed Client Organisations</h2>
            <p className="text-xs text-on-surface-variant">
              Select any organisation to enter its scoped workspace and administer its operations.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/clients')}
            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
          >
            <span>View All Clients</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {clients.map(client => {
            const policy = store.getClientPolicy(client.id);
            const clientEmployees = store.getEmployees(client.id);
            const clientLocations = store.getLocations(client.id);

            return (
              <div
                key={client.id}
                className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center font-serif text-lg font-bold text-primary">
                      {client.code.substring(0, 2)}
                    </div>
                    {client.status === 'active' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20">
                        ACTIVE WORKSPACE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20">
                        ONBOARDING IN PROGRESS
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-primary mt-3 truncate">{client.name}</h3>
                  <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">{client.industry}</p>

                  <div className="mt-4 pt-3 border-t border-surface-container-high grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Workforce</span>
                      <span className="font-bold text-primary text-sm">{clientEmployees.length} Staff</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Sites</span>
                      <span className="font-bold text-primary text-sm">{clientLocations.length} Geofenced</span>
                    </div>
                  </div>

                  <div className="mt-3 p-2 rounded-lg bg-surface-container-low text-[11px] flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium">Policy Engine:</span>
                    {policy.isConfigured ? (
                      <span className="font-bold text-success flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Configured</span>
                      </span>
                    ) : (
                      <span className="font-bold text-error flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Unconfigured</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-surface-container-high flex items-center justify-between">
                  <span className="text-[11px] text-on-surface-variant">Code: <strong>{client.code}</strong></span>
                  <button
                    onClick={() => handleEnterWorkspace(client.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-colors shadow-sm"
                  >
                    <span>Enter Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security Audit Feed */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5 shadow-card">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-surface-container-high">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-base font-serif font-bold text-primary">Recent Platform Audit Events</h2>
          </div>
          <button
            onClick={() => navigate('/admin/audit')}
            className="text-xs font-bold text-accent hover:text-accent-hover"
          >
            View Full Security Ledger
          </button>
        </div>

        <div className="divide-y divide-surface-container-high text-xs">
          {auditLogs.map(log => (
            <div key={log.id} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  log.severity === 'critical' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
                }`}>
                  {log.action}
                </span>
                <span className="font-medium text-on-surface">{log.details}</span>
              </div>
              <div className="text-[11px] text-on-surface-variant whitespace-nowrap ml-4">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.actorName}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
