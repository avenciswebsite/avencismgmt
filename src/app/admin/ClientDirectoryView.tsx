import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { policyService, ClientCardSummary } from '../../services';
import { 
  Building2, 
  Plus, 
  Search, 
  MapPin, 
  Users, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';

export const ClientDirectoryView: React.FC = () => {
  const { currentUser } = useAuth();
  const { clients, switchClient, isLoadingWorkspace, workspaceError, refreshWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [clientSummaries, setClientSummaries] = useState<Record<string, ClientCardSummary>>({});
  const [isLoadingSummaries, setIsLoadingSummaries] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Asynchronously load real summary counts (entities, locations, headcount, policy) for each accessible client
  useEffect(() => {
    let isMounted = true;
    const fetchSummaries = async () => {
      if (clients.length === 0) {
        if (isMounted) {
          setClientSummaries({});
          setIsLoadingSummaries(false);
        }
        return;
      }

      setIsLoadingSummaries(true);
      setSummaryError(null);

      try {
        const results = await Promise.all(
          clients.map(c => policyService.getClientCardSummary(c.id))
        );

        if (!isMounted) return;

        const summaryMap: Record<string, ClientCardSummary> = {};
        results.forEach((res, index) => {
          const client = clients[index];
          if (res.success && res.data) {
            summaryMap[client.id] = res.data;
          } else {
            summaryMap[client.id] = {
              client: {
                id: client.id,
                code: client.code,
                name: client.name,
                industry: client.industry,
                status: client.status as any,
                contact_person: client.contactPerson || '',
                contact_email: client.contactEmail || '',
                contact_phone: client.contactPhone || '',
                created_at: client.createdAt || new Date().toISOString(),
                updated_at: client.createdAt || new Date().toISOString(),
              },
              legalEntitiesCount: 0,
              locationsCount: 0,
              employeeCount: client.employeeCount || 0,
              isPolicyConfigured: false,
              primaryLegalEntityName: 'Pending Setup',
            };
          }
        });

        setClientSummaries(summaryMap);
      } catch (err: any) {
        if (isMounted) {
          setSummaryError(err.message || 'Failed to retrieve client metadata.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingSummaries(false);
        }
      }
    };

    fetchSummaries();

    return () => {
      isMounted = false;
    };
  }, [clients]);

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.industry.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleOpenWorkspace = async (clientId: string) => {
    const success = await switchClient(clientId);
    if (success) {
      navigate('/workspace/overview');
    }
  };

  const handleOpenPolicies = async (clientId: string) => {
    const success = await switchClient(clientId);
    if (success) {
      navigate('/workspace/policies');
    }
  };

  const isLoading = isLoadingWorkspace || isLoadingSummaries;
  const displayError = workspaceError || summaryError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Multi-Tenant Portfolio Administration
          </span>
          <h1 className="font-serif text-3xl text-primary font-normal">
            Client Organisations Directory
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Registered corporate clients operating attendance, GPS geofencing, and statutory payroll under Avencis WFM.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => navigate('/admin/clients/onboard')}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded font-medium text-sm hover:bg-primary/90 shadow transition-all"
            title="Onboard / Add New Client"
          >
            <Plus className="w-4 h-4 text-secondary-fixed" />
            <span>Onboard New Client</span>
          </button>
        )}
      </div>

      {/* Error Alert State */}
      {displayError && (
        <div className="p-4 bg-error/10 border border-error/20 rounded-xl flex items-center justify-between text-xs text-error">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{displayError}</span>
          </div>
          <button
            onClick={() => refreshWorkspace()}
            className="flex items-center space-x-1 px-3 py-1 bg-error text-white rounded font-bold hover:bg-error/90 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
          <input
            type="text"
            placeholder="Search by client name, code, or industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-on-surface-variant font-medium">Filter Status:</span>
          {['ALL', 'active', 'onboarding'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded font-semibold uppercase text-[10px] transition-colors ${
                filterStatus === st
                  ? 'bg-primary text-white'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton Grid */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 space-y-4 animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-16 bg-surface-container rounded"></div>
                  <div className="h-6 w-48 bg-surface-container rounded"></div>
                  <div className="h-3 w-32 bg-surface-container rounded"></div>
                </div>
                <div className="h-5 w-16 bg-surface-container rounded"></div>
              </div>
              <div className="grid grid-cols-3 gap-2 py-4 border-y border-outline-variant/20">
                <div className="h-8 bg-surface-container rounded"></div>
                <div className="h-8 bg-surface-container rounded"></div>
                <div className="h-8 bg-surface-container rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-surface-container rounded"></div>
                <div className="h-4 w-3/4 bg-surface-container rounded"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredClients.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-12 text-center space-y-3 shadow-sm">
          <Building2 className="w-10 h-10 text-outline mx-auto" />
          <h3 className="font-serif text-lg text-primary font-normal">
            No Client Organisations Found
          </h3>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            {searchQuery || filterStatus !== 'ALL'
              ? 'No client organisations matched your current search and filter criteria.'
              : 'No client organisations are currently accessible under your account credentials.'}
          </p>
          {(searchQuery || filterStatus !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('ALL');
              }}
              className="px-4 py-1.5 bg-surface-container hover:bg-surface-container-high rounded text-xs font-semibold text-primary transition-colors inline-block mt-2"
            >
              Reset Search & Filters
            </button>
          )}
        </div>
      )}

      {/* Clients Grid */}
      {!isLoading && filteredClients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => {
            const summary = clientSummaries[client.id];
            const entitiesCount = summary?.legalEntitiesCount ?? 0;
            const locationsCount = summary?.locationsCount ?? 0;
            const headcount = summary?.employeeCount ?? client.employeeCount ?? 0;
            const isPolicyConfigured = summary?.isPolicyConfigured ?? false;
            const primaryLegalEntity = summary?.primaryLegalEntityName ?? 'Pending Setup';

            return (
              <div
                key={client.id}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 hover:border-primary/50 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold">
                        {client.code}
                      </span>
                      <h3 className="font-serif text-xl text-primary font-normal mt-1">
                        {client.name}
                      </h3>
                      <p className="text-xs text-on-surface-variant">{client.industry}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        client.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {client.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-outline-variant/20 text-center text-xs">
                    <div>
                      <span className="text-[10px] uppercase text-on-surface-variant block">Entities</span>
                      <span className="font-serif text-lg text-primary font-normal">{entitiesCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-on-surface-variant block">Locations</span>
                      <span className="font-serif text-lg text-primary font-normal">{locationsCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-on-surface-variant block">Headcount</span>
                      <span className="font-serif text-lg text-primary font-normal">{headcount}</span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Policy Health:</span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                          isPolicyConfigured ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isPolicyConfigured ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>20 Domains Configured</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Action Required (Unconfigured)</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Primary Operating Entity:</span>
                      <span className="font-medium text-on-surface truncate max-w-[170px]">
                        {primaryLegalEntity}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenPolicies(client.id)}
                    className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors font-medium"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Policies</span>
                  </button>

                  <button
                    onClick={() => handleOpenWorkspace(client.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <span>Open Workspace</span>
                    <ChevronRight className="w-3.5 h-3.5 text-secondary-fixed" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
