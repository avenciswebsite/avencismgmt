import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { policyService } from '../../services/policyService';
import { ClientLegalEntity } from '../../types';
import { 
  Building2, 
  Plus, 
  ShieldCheck, 
  FileCheck, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  ExternalLink
} from 'lucide-react';

export const LegalEntitiesView: React.FC = () => {
  const { clients, currentClient } = useWorkspace();

  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [entities, setEntities] = useState<ClientLegalEntity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form state
  const [formClientId, setFormClientId] = useState<string>(clients[0]?.id || '');
  const [legalName, setLegalName] = useState<string>('');
  const [tradeName, setTradeName] = useState<string>('');
  const [registrationType, setRegistrationType] = useState<'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'LLP' | 'PROPRIETORSHIP'>('PRIVATE_LIMITED');
  const [panNumber, setPanNumber] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [pfCode, setPfCode] = useState<string>('');
  const [esicCode, setEsicCode] = useState<string>('');
  const [registeredAddress, setRegisteredAddress] = useState<string>('');

  const loadEntities = useCallback(async () => {
    if (!clients.length) {
      setEntities([]);
      return;
    }
    setIsLoading(true);
    try {
      const all: ClientLegalEntity[] = [];
      for (const c of clients) {
        const res = await policyService.getLegalEntities(c.id);
        if (res.data) {
          for (const row of res.data) {
            all.push({
              id: row.id,
              clientId: row.client_id,
              legalName: row.legal_name,
              tradeName: row.trade_name || row.legal_name,
              registrationType: 'PRIVATE_LIMITED',
              registrationNumber: row.registration_number || '',
              pan: row.pan,
              panNumber: row.pan,
              gstin: row.gstin || '',
              pfEstablishmentCode: row.pf_establishment_code || '',
              esicRegistrationCode: row.esic_registration_code || '',
              registeredAddress: row.registered_address || '',
              isPrimary: row.is_primary,
            });
          }
        }
      }
      setEntities(all);
    } catch (err) {
      console.error('Failed to load legal entities:', err);
    } finally {
      setIsLoading(false);
    }
  }, [clients]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    if (clients.length && !formClientId) {
      setFormClientId(clients[0].id);
    }
  }, [clients, formClientId]);

  const filteredEntities = entities.filter(le => {
    const matchesClient = selectedClientId === 'ALL' || le.clientId === selectedClientId;
    const matchesSearch = le.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ((le.panNumber || le.pan || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
                          ((le.tradeName || le.legalName || '').toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesClient && matchesSearch;
  });

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName.trim() || !panNumber.trim() || !formClientId) return;

    await policyService.createLegalEntity({
      client_id: formClientId,
      legal_name: legalName,
      trade_name: tradeName || legalName,
      registration_type: registrationType,
      registration_number: `REG-${Date.now().toString(36).toUpperCase()}`,
      pan: panNumber.toUpperCase(),
      gstin: gstin.toUpperCase(),
      pf_establishment_code: pfCode || null,
      esic_registration_code: esicCode || null,
      registered_address: registeredAddress || '',
      is_primary: false,
    });

    await loadEntities();
    setShowAddModal(false);
    // Reset form
    setLegalName('');
    setTradeName('');
    setPanNumber('');
    setGstin('');
    setPfCode('');
    setEsicCode('');
    setRegisteredAddress('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Corporate Identity & Employer Master
          </span>
          <h1 className="font-serif text-3xl text-primary font-normal">
            Client Legal Entities
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Registered corporate employers holding statutory PF establishment codes, ESIC accounts, and payroll liabilities.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded font-medium text-sm hover:bg-primary/90 shadow transition-all"
        >
          <Plus className="w-4 h-4 text-secondary-fixed" />
          <span>Register Legal Entity</span>
        </button>
      </div>

      {/* Avencis Legal Notice Card */}
      <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/30 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-primary">Avencis Platform Operating Model Principle:</p>
          <p className="text-on-surface-variant mt-0.5">
            Avencis acts strictly as the software platform and workforce management service provider. 
            All employment agreements, payslips, PF submissions, and statutory liabilities belong to the respective 
            registered <strong>Client Legal Entities</strong> documented below.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
          <input
            type="text"
            placeholder="Search by legal name, PAN, or trade name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-on-surface-variant font-medium">Filter Client:</span>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="p-1.5 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface text-xs focus:outline-none"
          >
            <option value="ALL">All Clients ({clients.length})</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legal Entities Cards */}
      {filteredEntities.length === 0 ? (
        <div className="bg-surface-container-lowest p-12 rounded-xl border border-outline-variant/30 text-center max-w-lg mx-auto">
          <Building2 className="w-12 h-12 text-outline mx-auto mb-3" />
          <h3 className="text-base font-bold text-on-surface">No Legal Entities Found</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {clients.length === 0 
              ? "Onboard your first client organisation from the dashboard to begin establishing legal employer entities." 
              : "No legal entities have been registered yet for the selected filter."}
          </p>
          {clients.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow hover:bg-primary-hover"
            >
              <Plus className="w-4 h-4" />
              <span>Register Entity</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredEntities.map((entity) => {
            const client = clients.find(c => c.id === entity.clientId);

            return (
              <div
                key={entity.id}
                className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary-container text-primary font-bold">
                      {(entity.registrationType || 'PRIVATE_LIMITED').replace('_', ' ')}
                    </span>
                    <h3 className="font-serif text-xl text-primary font-normal mt-2">
                      {entity.legalName}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Trading as: <strong>{entity.tradeName || entity.legalName}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Parent Client</span>
                    <span className="text-xs font-bold text-primary">{client?.name || 'Assigned Client'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 bg-surface-container-low rounded-lg text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Corporate PAN</span>
                    <span className="font-mono font-bold text-on-surface">{entity.panNumber || entity.pan || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-on-surface-variant block font-medium">GSTIN</span>
                    <span className="font-mono font-medium text-on-surface">{entity.gstin || 'NOT REGISTERED'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-on-surface-variant block font-medium">PF Est. Code</span>
                    <span className="font-mono font-medium text-on-surface">{entity.pfEstablishmentCode || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-on-surface-variant block font-medium">ESIC Code</span>
                    <span className="font-mono font-medium text-on-surface">{entity.esicRegistrationCode || 'N/A'}</span>
                  </div>
                </div>

                <div className="text-xs text-on-surface-variant">
                  <span className="text-[10px] uppercase text-on-surface-variant block font-medium">Registered Address</span>
                  <p className="mt-0.5">{entity.registeredAddress}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Legal Entity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-xl border border-outline-variant/30 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <h3 className="font-serif text-xl text-primary font-normal">Register New Legal Entity</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-on-surface-variant hover:text-on-surface text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEntity} className="space-y-4 text-xs">
              <div>
                <label className="block text-on-surface-variant font-medium mb-1">Parent Client Organisation</label>
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-on-surface-variant font-medium mb-1">Full Legal Corporate Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Global Services Pvt Ltd"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">Trade / Brand Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Solutions"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">Registration Entity Type</label>
                  <select
                    value={registrationType}
                    onChange={(e) => setRegistrationType(e.target.value as any)}
                    className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface"
                  >
                    <option value="PRIVATE_LIMITED">Private Limited</option>
                    <option value="PUBLIC_LIMITED">Public Limited</option>
                    <option value="LLP">LLP</option>
                    <option value="PROPRIETORSHIP">Proprietorship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">Permanent PAN (10 Chars)</label>
                  <input
                    type="text"
                    required
                    placeholder="AAACT9921B"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">GSTIN (15 Chars)</label>
                  <input
                    type="text"
                    placeholder="27AAACT9921B1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">PF Establishment Code</label>
                  <input
                    type="text"
                    placeholder="MH/PUN/0088124/000"
                    value={pfCode}
                    onChange={(e) => setPfCode(e.target.value)}
                    className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface font-mono"
                  />
                </div>
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">ESIC Registration Code</label>
                  <input
                    type="text"
                    placeholder="31000998812000"
                    value={esicCode}
                    onChange={(e) => setEsicCode(e.target.value)}
                    className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-on-surface-variant font-medium mb-1">Official Registered Address</label>
                <textarea
                  rows={2}
                  value={registeredAddress}
                  onChange={(e) => setRegisteredAddress(e.target.value)}
                  placeholder="Complete registered address with pincode..."
                  className="w-full p-2 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white rounded font-semibold hover:bg-primary/90 transition-colors shadow"
                >
                  Register Entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
