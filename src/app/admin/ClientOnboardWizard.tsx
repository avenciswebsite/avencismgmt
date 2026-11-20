import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { policyService, formatErrorMessage } from '../../services';
import { 
  Building2, 
  FileCheck2, 
  MapPin, 
  Sliders, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  AlertTriangle,
  Sparkles,
  Loader2
} from 'lucide-react';

export const ClientOnboardWizard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { switchClient, refreshWorkspace } = useWorkspace();

  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Organisation Profile
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Step 2: Legal & Payroll Entity
  const [legalName, setLegalName] = useState('');
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');
  const [pfCode, setPfCode] = useState('');
  const [esicCode, setEsicCode] = useState('');
  const [address, setAddress] = useState('');

  // Step 3: Primary Work Location
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState('18.5204');
  const [longitude, setLongitude] = useState('73.8567');
  const [radiusMeters, setRadiusMeters] = useState('200');

  // Step 4: Initial Policy Configuration (The 20 Domains)
  const [salaryDivisor, setSalaryDivisor] = useState<'26' | '30' | 'calendar_days'>('30');
  const [overtimeMethod, setOvertimeMethod] = useState<'multiplier' | 'flat_rate' | 'comp_off' | 'disabled'>('multiplier');
  const [overtimeRate, setOvertimeRate] = useState('1.5');
  const [lateGraceMinutes, setLateGraceMinutes] = useState('15');
  const [monthlyLeave, setMonthlyLeave] = useState('2.0');
  const [pfEnabled, setPfEnabled] = useState(true);
  const [esicEnabled, setEsicEnabled] = useState(true);
  const [ptEnabled, setPtEnabled] = useState(true);

  // Status
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateClient = async (activateNow = false) => {
    if (!name.trim() || !code.trim()) {
      setErrorMsg('Client Organisation Name and Unique Code are mandatory.');
      return;
    }

    if (currentUser?.role && currentUser.role !== 'super_admin') {
      setErrorMsg('Access Denied: Only Super Admins have permission to onboard new client organisations.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Create Client via policyService
      const clientRes = await policyService.createClient({
        name: name.trim(),
        code: code.toUpperCase().trim(),
        industry: industry.trim() || 'Enterprise Client',
        status: activateNow ? 'active' : 'onboarding',
        contact_person: contactPerson.trim() || 'Operations Contact',
        contact_email: contactEmail.trim() || 'admin@client.com',
        contact_phone: contactPhone.trim() || '+91 98000 00000',
      });

      if (!clientRes.success || !clientRes.data) {
        setErrorMsg(clientRes.error ? formatErrorMessage(clientRes.error) : 'Failed to register client organization.');
        setIsSubmitting(false);
        return;
      }

      const createdClientId = clientRes.data.id;

      // 2. Add Legal Entity if provided
      if (legalName.trim()) {
        const leRes = await policyService.createLegalEntity({
          client_id: createdClientId,
          legal_name: legalName.trim(),
          registration_type: 'PRIVATE_LIMITED',
          pan: (pan.trim() || 'AABCC1234D').toUpperCase(),
          gstin: gstin.trim() || undefined,
          pf_establishment_code: pfCode.trim() || undefined,
          esic_registration_code: esicCode.trim() || undefined,
          registered_address: address.trim() || 'Corporate Registered Office',
          is_primary: true,
        });

        if (!leRes.success) {
          console.warn('[Avencis WFM] Legal entity registration warning:', leRes.error);
        }
      }

      // 3. Add Location if provided
      if (locationName.trim()) {
        const locRes = await policyService.createWorkLocation({
          client_id: createdClientId,
          name: locationName.trim(),
          address: locationAddress.trim() || 'Operational Work Site',
          state: 'Maharashtra',
          latitude: parseFloat(latitude) || 18.5204,
          longitude: parseFloat(longitude) || 73.8567,
          radius_meters: parseInt(radiusMeters) || 200,
        });

        if (!locRes.success) {
          console.warn('[Avencis WFM] Work location registration warning:', locRes.error);
        }
      }

      // 4. Save Policy Configuration
      await policyService.updateClientPolicy(createdClientId, {
        is_configured: true,
        salary_divisor: salaryDivisor,
        overtime_method: overtimeMethod,
        overtime_rate: parseFloat(overtimeRate) || 1.5,
        late_grace_minutes: parseInt(lateGraceMinutes) || 15,
        monthly_paid_leave_accrual: parseFloat(monthlyLeave) || 2.0,
        pf_enabled: pfEnabled,
        esic_enabled: esicEnabled,
        pt_enabled: ptEnabled,
      });

      setSavedClientId(createdClientId);
      refreshWorkspace();
      await switchClient(createdClientId);
      setIsSubmitting(false);
      setStep(5); // Completion Screen
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during client onboarding.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
        <div>
          <button
            onClick={() => navigate('/admin')}
            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center space-x-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel and Return to Master Admin</span>
          </button>
          <h1 className="text-2xl font-serif font-bold text-primary">Client Organisation Onboarding</h1>
          <p className="text-xs text-on-surface-variant">
            Guided 14-point structured onboarding wizard for new client enterprises.
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold text-primary">Step {step} of {totalSteps}</span>
          <div className="w-32 bg-surface-container-high h-2 rounded-full overflow-hidden mt-1">
            <div 
              className="bg-accent h-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-xs font-semibold text-error flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step 1: Organisation Details */}
      {step === 1 && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-surface-container-high">
            <Building2 className="w-5 h-5 text-accent" />
            <h2 className="text-base font-serif font-bold text-primary">1. Client Organisation Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-on-surface block mb-1">Client Legal / Trading Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Unique Client Identifier Code *</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. ACME or CORP"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs uppercase"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Industry Sector</label>
              <input
                type="text"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Logistics & Fleet, Retail, IT Services"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Primary Operational Contact</label>
              <input
                type="text"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="e.g. Suresh Patil"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Contact Email Address</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="admin@client.com"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Contact Phone Number</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                placeholder="+91 98000 00000"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleCreateClient(true)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Onboarding Client...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create &amp; Activate Client Now</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!name.trim() || !code.trim()) {
                  setErrorMsg('Organisation name and unique code are required.');
                  return;
                }
                setErrorMsg('');
                setStep(2);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-colors"
            >
              <span>Continue to Multi-Entity Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Legal Entity */}
      {step === 2 && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-surface-container-high">
            <FileCheck2 className="w-5 h-5 text-accent" />
            <h2 className="text-base font-serif font-bold text-primary">2. Client Legal & Payroll Entity</h2>
          </div>

          <div className="text-xs text-on-surface-variant bg-surface-container-low p-3 rounded-lg">
            <strong>Confirmed Business Rule:</strong> Payroll is processed under the client's own legal registration, not Avencis. Please enter the statutory details for this client.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="font-bold text-on-surface block mb-1">Corporate Legal Registered Name *</label>
              <input
                type="text"
                value={legalName}
                onChange={e => setLegalName(e.target.value)}
                placeholder="e.g. Acme Enterprises Private Limited"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Company PAN</label>
              <input
                type="text"
                value={pan}
                onChange={e => setPan(e.target.value.toUpperCase())}
                placeholder="AABCS1234F"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs uppercase"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">GSTIN Number</label>
              <input
                type="text"
                value={gstin}
                onChange={e => setGstin(e.target.value.toUpperCase())}
                placeholder="27AABCS1234F1Z5"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs uppercase"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">PF Establishment Code</label>
              <input
                type="text"
                value={pfCode}
                onChange={e => setPfCode(e.target.value)}
                placeholder="MH/PUN/0045678/000"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">ESIC Registration Code</label>
              <input
                type="text"
                value={esicCode}
                onChange={e => setEsicCode(e.target.value)}
                placeholder="31000567890001001"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-on-surface block mb-1">Registered Corporate Address</label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                rows={2}
                placeholder="Full official registered address for statutory filings and payslips..."
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              onClick={() => setStep(3)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-colors"
            >
              <span>Continue to Work Locations</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Work Locations & Geofence */}
      {step === 3 && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-surface-container-high">
            <MapPin className="w-5 h-5 text-accent" />
            <h2 className="text-base font-serif font-bold text-primary">3. Primary Work Site & Geofence</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="font-bold text-on-surface block mb-1">Work Site / Branch Name</label>
              <input
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                placeholder="e.g. Pune Central Depot or BKC Corporate Office"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-on-surface block mb-1">Physical Site Address</label>
              <input
                type="text"
                value={locationAddress}
                onChange={e => setLocationAddress(e.target.value)}
                placeholder="Street address, city, pin code..."
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">GPS Latitude (Decimal)</label>
              <input
                type="text"
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
                placeholder="18.5913"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">GPS Longitude (Decimal)</label>
              <input
                type="text"
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
                placeholder="73.7389"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high focus:outline-none focus:border-primary text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-on-surface block mb-1">
                Geofence Radius (Meters): <span className="text-primary font-bold">{radiusMeters}m</span>
              </label>
              <input
                type="range"
                min="50"
                max="1000"
                step="25"
                value={radiusMeters}
                onChange={e => setRadiusMeters(e.target.value)}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                <span>50m (Strict Building)</span>
                <span>200m (Standard Campus)</span>
                <span>1000m (Industrial Zone)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              onClick={() => setStep(4)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-colors"
            >
              <span>Continue to Policy Engine</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Policy Configuration */}
      {step === 4 && (
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-surface-container-high">
            <Sliders className="w-5 h-5 text-accent" />
            <h2 className="text-base font-serif font-bold text-primary">4. Client Policy Configuration</h2>
          </div>

          <div className="text-xs text-on-surface-variant bg-surface-container-low p-3 rounded-lg">
            <strong>Mandatory Policy Baseline:</strong> All employees belonging to this client will inherit these settings.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-on-surface block mb-1">Monthly Salary Divisor Rule *</label>
              <select
                value={salaryDivisor}
                onChange={e => setSalaryDivisor(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
              >
                <option value="30">Fixed 30 Days Basis</option>
                <option value="26">Fixed 26 Days Basis (Excludes Sundays)</option>
                <option value="calendar_days">Actual Calendar Days in Month</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Overtime Calculation Method *</label>
              <select
                value={overtimeMethod}
                onChange={e => setOvertimeMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
              >
                <option value="multiplier">Hourly Multiplier (e.g., 1.5x Base)</option>
                <option value="flat_rate">Flat Rate (e.g., ₹120 / hr)</option>
                <option value="comp_off">Accrue as Compensatory Off</option>
                <option value="disabled">Overtime Disabled</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Late Arrival Grace Period (Minutes)</label>
              <input
                type="number"
                value={lateGraceMinutes}
                onChange={e => setLateGraceMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Monthly Paid Leave Accrual (Days)</label>
              <input
                type="number"
                step="0.25"
                value={monthlyLeave}
                onChange={e => setMonthlyLeave(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high text-xs"
              />
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-surface-container-high">
              <label className="font-bold text-on-surface block mb-2">Statutory Applicability Flags</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pfEnabled}
                    onChange={e => setPfEnabled(e.target.checked)}
                    className="accent-primary rounded"
                  />
                  <span>Provident Fund (12% EPF)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={esicEnabled}
                    onChange={e => setEsicEnabled(e.target.checked)}
                    className="accent-primary rounded"
                  />
                  <span>ESIC (0.75% / 3.25%)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ptEnabled}
                    onChange={e => setPtEnabled(e.target.checked)}
                    className="accent-primary rounded"
                  />
                  <span>Professional Tax (State PT)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center space-x-3">
              <button
                disabled={isSubmitting}
                onClick={() => handleCreateClient(false)}
                className="px-4 py-2 rounded-lg border border-surface-container-high hover:bg-surface-container-low text-xs font-bold text-on-surface transition-colors disabled:opacity-50"
              >
                Save as Draft Onboarding
              </button>

              <button
                disabled={isSubmitting}
                onClick={() => handleCreateClient(true)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering Client...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Complete & Activate Client Workspace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Success & Handover */}
      {step === 5 && (
        <div className="bg-surface-container-lowest p-8 rounded-xl border border-surface-container-high shadow-elevated text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-success/10 text-success mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-serif font-bold text-primary">Client Organisation Successfully Onboarded!</h2>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            <strong>{name} ({code})</strong> has been registered with its own legal entity, work locations, and client-level policy configuration.
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors"
            >
              Back to Master Admin
            </button>

            <button
              onClick={() => navigate('/admin/clients')}
              className="px-4 py-2 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors"
            >
              View in Clients Directory
            </button>

            <button
              onClick={() => {
                if (savedClientId) navigate(`/workspace/${savedClientId}`);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold shadow-md transition-all"
            >
              <span>Enter {name} Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
