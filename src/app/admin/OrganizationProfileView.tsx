import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { policyService } from '../../services/policyService';
import { 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  User, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  FileText,
  Briefcase,
  Layers,
  Sliders,
  ArrowLeft
} from 'lucide-react';

export const OrganizationProfileView: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeClient, activeLegalEntity, refreshWorkspace, switchClient, isLoadingWorkspace } = useWorkspace();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [industry, setIndustry] = useState('Technology & Professional Services');
  const [status, setStatus] = useState<'active' | 'onboarding' | 'suspended'>('active');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');

  // Legal Entity details
  const [legalName, setLegalName] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [gstin, setGstin] = useState('');
  const [pfCode, setPfCode] = useState('');
  const [esicCode, setEsicCode] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync state when active client changes
  useEffect(() => {
    if (activeClient && activeClient.id) {
      setName(activeClient.name || '');
      setCode(activeClient.code || '');
      setIndustry(activeClient.industry || 'Technology & Professional Services');
      setStatus(activeClient.status || 'active');
      setContactPerson(activeClient.contactPerson || '');
      setContactEmail(activeClient.contactEmail || '');
      setContactPhone(activeClient.contactPhone || '');
      setAddress((activeClient as any).address || '');
    }

    if (activeLegalEntity) {
      setLegalName(activeLegalEntity.legalName || '');
      setPanNumber(activeLegalEntity.pan || activeLegalEntity.panNumber || '');
      setGstin(activeLegalEntity.gstin || '');
      setPfCode(activeLegalEntity.pfEstablishmentCode || '');
      setEsicCode(activeLegalEntity.esicRegistrationCode || '');
      if (!address && activeLegalEntity.registeredAddress) {
        setAddress(activeLegalEntity.registeredAddress);
      }
    }
  }, [activeClient, activeLegalEntity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient?.id) return;

    // Validation
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Organization name is required.' });
      return;
    }
    if (!code.trim() || !/^[A-Za-z0-9_-]{2,20}$/.test(code.trim())) {
      setFeedback({ type: 'error', message: 'Client code must be 2 to 20 alphanumeric characters.' });
      return;
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setFeedback({ type: 'error', message: 'Please provide a valid contact email address.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await policyService.updateClient(activeClient.id, {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        industry,
        status,
        contact_person: contactPerson.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        address: address.trim()
      } as any);

      if (res.success) {
        setFeedback({ 
          type: 'success', 
          message: 'Organization profile updated and persisted successfully!' 
        });
        refreshWorkspace();
      } else {
        setFeedback({ 
          type: 'error', 
          message: res.error?.message || 'Failed to update organization profile.' 
        });
      }
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: err.message || 'An unexpected error occurred while saving.' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">Organization Profile</h1>
              <p className="text-sm text-on-surface-variant">
                Manage organization corporate identity, registered address, primary contacts, and statutory registrations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            status === 'active' 
              ? 'bg-success-container text-on-success-container border border-success/30' 
              : status === 'onboarding'
              ? 'bg-warning-container text-on-warning-container border border-warning/30'
              : 'bg-error-container text-on-error-container border border-error/30'
          }`}>
            {status}
          </span>
          <button
            type="button"
            onClick={() => refreshWorkspace()}
            className="p-2 text-on-surface-variant hover:text-on-surface bg-surface-container rounded-lg border border-outline-variant/40 hover:bg-surface-container-high transition-colors"
            title="Refresh Organization State"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          feedback.type === 'success' 
            ? 'bg-success-container/40 border-success/40 text-on-success-container' 
            : 'bg-error-container/40 border-error/40 text-on-error-container'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-error shrink-0" />
          )}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Corporate Details */}
          <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/30 space-y-4">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider pb-2 border-b border-outline-variant/20">
              <Briefcase className="w-4 h-4" />
              <span>Corporate Identity</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Organization Legal Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Client Code *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    maxLength={20}
                    placeholder="e.g. ACME"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Operational Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="active">Active</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Industry Classification
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Manufacturing & Heavy Engineering">Manufacturing & Heavy Engineering</option>
                  <option value="Technology & Professional Services">Technology & Professional Services</option>
                  <option value="Logistics, Supply Chain & Warehousing">Logistics, Supply Chain & Warehousing</option>
                  <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                  <option value="Retail, FMCG & Distribution">Retail, FMCG & Distribution</option>
                  <option value="Financial & Banking Services">Financial & Banking Services</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Registered Corporate Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Street, Building, Industrial Area, City, State, PIN"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Contact Person & Communication */}
          <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/30 space-y-4">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider pb-2 border-b border-outline-variant/20">
              <User className="w-4 h-4" />
              <span>Primary Representative</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Primary Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Official Communication Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Official Telephone / Hotline
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 22 2847 9000"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-outline-variant text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="p-4 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface-variant space-y-1">
                <div className="font-semibold text-on-surface flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span>Audited Enterprise Profile</span>
                </div>
                <p>
                  Any updates made to organization contact details are permanently written to the immutable regulatory audit ledger.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Statutory & Legal Registrations Profile */}
        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/30 space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider pb-2 border-b border-outline-variant/20">
            <FileText className="w-4 h-4" />
            <span>Primary Legal Entity & Statutory Details</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Legal Registered Name
              </label>
              <input
                type="text"
                value={legalName}
                readOnly
                placeholder="Linked Legal Entity"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface-variant text-sm font-medium cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Company PAN Number
              </label>
              <input
                type="text"
                value={panNumber}
                readOnly
                placeholder="AAAAA9999A"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface-variant text-sm font-mono cursor-not-allowed uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                GSTIN Identification
              </label>
              <input
                type="text"
                value={gstin}
                readOnly
                placeholder="27AAAAA0000A1Z5"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface-variant text-sm font-mono cursor-not-allowed uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                EPF Establishment Code
              </label>
              <input
                type="text"
                value={pfCode}
                readOnly
                placeholder="MH/BAN/0012345/000"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface-variant text-sm font-mono cursor-not-allowed uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                ESIC Registration Code
              </label>
              <input
                type="text"
                value={esicCode}
                readOnly
                placeholder="31000123450000101"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 text-on-surface-variant text-sm font-mono cursor-not-allowed"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => navigate('/admin/entities')}
                className="w-full py-2.5 px-4 bg-surface-container border border-outline-variant text-primary font-semibold text-xs rounded-lg hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1.5"
              >
                <Layers className="w-4 h-4" />
                <span>Manage Legal Entities</span>
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: Operational Work Sites, Geofences & Policies */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <MapPin className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-primary">
                  Work Sites, Geofences & Operational Policies
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Manage physical locations, GPS coordinate boundaries, and client-level policy engine settings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(activeClient?.id ? `/workspace/${activeClient.id}/locations` : '/admin/locations')}
                className="py-2 px-3 bg-primary text-white font-semibold text-xs rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-sm"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Manage Geofence Sites</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(activeClient?.id ? `/workspace/${activeClient.id}/settings` : '/workspace/policies')}
                className="py-2 px-3 bg-surface-container border border-outline-variant text-primary font-semibold text-xs rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-1"
              >
                <Sliders className="w-3.5 h-3.5 text-accent" />
                <span>Policy Engine (20 Domains)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                Physical Work Locations
              </span>
              <p className="text-xs text-on-surface-variant">
                Employees can be assigned to or punch from any authorized operating depot or branch office with custom geofence radius validation.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate(activeClient?.id ? `/workspace/${activeClient.id}/locations` : '/admin/locations')}
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                >
                  <span>Add or edit worksites</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                Operational Policies Engine
              </span>
              <p className="text-xs text-on-surface-variant">
                Configure all 20 rule domains including standard hours, grace period, overtime proration, leave accrual, and PF/ESIC deductions.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate(activeClient?.id ? `/workspace/${activeClient.id}/settings` : '/workspace/policies')}
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                >
                  <span>Review & modify policies</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant text-sm font-semibold hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-bold shadow-md hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Organization Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrganizationProfileView;
