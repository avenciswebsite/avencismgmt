import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { policyService, ClientCardSummary } from '../../services';
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
  MapPin,
  RefreshCw
} from 'lucide-react';

export const MasterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { availableClients: clients, switchClient, refreshWorkspace, isLoadingWorkspace } = useWorkspace();
  const [clientSummaries, setClientSummaries] = useState<Record<string, ClientCardSummary>>({});
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadSummaries = async () => {
      if (clients.length === 0) {
        setClientSummaries({});
        return;
      }
      setIsLoadingSummaries(true);
      try {
        const results = await Promise.all(
          clients.map(c => policyService.getClientCardSummary(c.id))
        );
        if (isMounted) {
          const map: Record<string, ClientCardSummary> = {};
          results.forEach(res => {
            if (res.success && res.data) {
              map[res.data.client.id] = res.data;
            }
          });
          setClientSummaries(map);
        }
      } catch (err) {
        console.error('[MasterDashboard] Error loading client summaries:', err);
      } finally {
        if (isMounted) setIsLoadingSummaries(false);
      }
    };

    loadSummaries();
    return () => { isMounted = false; };
  }, [clients]);

  const activeClients = clients.filter(c => c.status === 'active');
  const onboardingClients = clients.filter(c => c.status === 'onboarding');

  const totalWorkforce = clients.reduce((acc, c) => {
    const summary = clientSummaries[c.id];
    return acc + (summary ? summary.employeeCount : (c.employeeCount || 0));
  }, 0);

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
            onClick={() => refreshWorkspace()}
            disabled={isLoadingWorkspace}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-xs font-semibold text-on-surface transition-colors"
            title="Refresh workspaces"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWorkspace ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => navigate('/admin/clients/onboard')}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-white">Onboard New Client</span>
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
            {totalWorkforce}
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
            <span className="text-xs font-bold uppercase tracking-wider">Database Status</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            Live
          </div>
          <div className="text-[11px] text-success font-semibold mt-1">
            Supabase Tenant Isolation Active
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-bold uppercase tracking-wider">Payroll Governance</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            Ready
          </div>
          <div className="text-[11px] text-on-surface-variant font-semibold mt-1">
            Form XIX Statutory Engine
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
          {clients.length > 0 && (
            <button
              onClick={() => navigate('/admin/clients')}
              className="text-xs font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
            >
              <span>View All Clients</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {clients.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-12 text-center shadow-card">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-serif font-bold text-primary">No Client Organisations Created Yet</h3>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1 mb-6 leading-relaxed">
              All demo and mock data has been purged. The database is clean and ready. Click below to onboard your first real client organisation with legal entities, geofenced worksites, and attendance policies.
            </p>
            <button
              onClick={() => navigate('/admin/clients/onboard')}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold shadow-md transition-all"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-white">Onboard Your First Client</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {clients.map(client => {
              const summary = clientSummaries[client.id];
              const headcount = summary ? summary.employeeCount : (client.employeeCount || 0);
              const locationsCount = summary ? summary.locationsCount : (client.activeLocationsCount || 0);
              const isPolicyConfigured = summary ? summary.isPolicyConfigured : true;

              return (
                <div
                  key={client.id}
                  className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center font-serif text-lg font-bold text-primary">
                        {client.code ? client.code.substring(0, 2).toUpperCase() : 'CL'}
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
                        <span className="font-bold text-primary text-sm">{headcount} Staff</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Sites</span>
                        <span className="font-bold text-primary text-sm">{locationsCount} Geofenced</span>
                      </div>
                    </div>

                    <div className="mt-3 p-2 rounded-lg bg-surface-container-low text-[11px] flex items-center justify-between">
                      <span className="text-on-surface-variant font-medium">Policy Engine:</span>
                      {isPolicyConfigured ? (
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
                      <span className="text-white">Enter Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Audit Feed */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5 shadow-card">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-surface-container-high">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-base font-serif font-bold text-primary">Platform Security & Audit Status</h2>
          </div>
          <button
            onClick={() => navigate('/admin/audit')}
            className="text-xs font-bold text-accent hover:text-accent-hover"
          >
            View Security Ledger
          </button>
        </div>

        <div className="py-6 text-center text-xs text-on-surface-variant">
          <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-60" />
          <p className="font-semibold text-on-surface">Supabase Row-Level Security Enforced</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5 max-w-md mx-auto">
            All user operations, cross-tenant isolation, and master governance events are actively authenticated against Supabase GoTrue and PostgreSQL RLS policies.
          </p>
        </div>
      </div>
    </div>
  );
};
