import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { store } from '../../data/store';
import { useWorkspace } from '../../context/WorkspaceContext';
import { 
  Sliders, 
  CheckCircle2, 
  Save, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  DollarSign, 
  FileText, 
  AlertCircle,
  HelpCircle,
  MapPin,
  ArrowRight
} from 'lucide-react';

export const ClientPolicySettings: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { activeClient, refreshWorkspace } = useWorkspace();

  const client = activeClient;
  const currentPolicy = store.getClientPolicy(client.id);

  // Form State for the 20 Policy Domains
  const [salaryDivisor, setSalaryDivisor] = useState(currentPolicy.salaryDivisor);
  const [overtimeMethod, setOvertimeMethod] = useState(currentPolicy.overtimeMethod);
  const [overtimeRate, setOvertimeRate] = useState(currentPolicy.overtimeRate.toString());
  const [lateGraceMinutes, setLateGraceMinutes] = useState(currentPolicy.lateGraceMinutes.toString());
  const [latePenaltyRule, setLatePenaltyRule] = useState(currentPolicy.latePenaltyRule);
  const [overnightShiftAttribution, setOvernightShiftAttribution] = useState(currentPolicy.overnightShiftAttribution);
  const [standardWorkingHours, setStandardWorkingHours] = useState(currentPolicy.standardWorkingHours.toString());
  const [halfDayHours, setHalfDayHours] = useState(currentPolicy.halfDayHours.toString());
  
  // Weekly Offs
  const [weeklyOffs, setWeeklyOffs] = useState<string[]>(currentPolicy.weeklyOffDays);

  // Telemetry
  const [trackingMode, setTrackingMode] = useState(currentPolicy.attendanceTrackingMode);
  const [requireGps, setRequireGps] = useState(currentPolicy.requireGps);
  const [requireSelfie, setRequireSelfie] = useState(currentPolicy.requireSelfie);
  const [enforceStrictGeofence, setEnforceStrictGeofence] = useState(currentPolicy.enforceStrictGeofence);

  // Leave
  const [monthlyLeave, setMonthlyLeave] = useState(currentPolicy.monthlyPaidLeaveAccrual.toString());
  const [maxCarryForward, setMaxCarryForward] = useState(currentPolicy.maxCarryForward.toString());
  const [allowEncashment, setAllowEncashment] = useState(currentPolicy.allowLeaveEncashment);

  // Statutory
  const [pfEnabled, setPfEnabled] = useState(currentPolicy.pfEnabled);
  const [pfEmpRate, setPfEmpRate] = useState(currentPolicy.pfEmployeePercent.toString());
  const [esicEnabled, setEsicEnabled] = useState(currentPolicy.esicEnabled);
  const [esicEmpRate, setEsicEmpRate] = useState(currentPolicy.esicEmployeePercent.toString());
  const [ptEnabled, setPtEnabled] = useState(currentPolicy.ptEnabled);
  const [tdsEnabled, setTdsEnabled] = useState(currentPolicy.tdsEnabled);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateClientPolicy(client.id, {
      isConfigured: true,
      salaryDivisor,
      overtimeMethod,
      overtimeRate: parseFloat(overtimeRate) || 1.0,
      lateGraceMinutes: parseInt(lateGraceMinutes) || 0,
      latePenaltyRule,
      overnightShiftAttribution,
      standardWorkingHours: parseFloat(standardWorkingHours) || 9.0,
      halfDayHours: parseFloat(halfDayHours) || 4.5,
      weeklyOffDays: weeklyOffs as any,
      attendanceTrackingMode: trackingMode,
      requireGps,
      requireSelfie,
      enforceStrictGeofence,
      monthlyPaidLeaveAccrual: parseFloat(monthlyLeave) || 2.0,
      maxCarryForward: parseInt(maxCarryForward) || 30,
      allowLeaveEncashment: allowEncashment,
      pfEnabled,
      pfEmployeePercent: parseFloat(pfEmpRate) || 12.0,
      esicEnabled,
      esicEmployeePercent: parseFloat(esicEmpRate) || 0.75,
      ptEnabled,
      tdsEnabled,
    });

    refreshWorkspace();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-surface-container-high">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent font-sans">
            Client-Level Configuration
          </div>
          <h1 className="text-2xl font-serif font-bold text-primary">
            Policy Engine & Operational Rules
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Configuring all 20 operational domains for <strong>{client.name}</strong>. All employees in this client inherit these rules with zero individual overrides.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <div className="flex items-center space-x-1.5 text-xs font-bold text-success bg-success/10 px-3 py-1.5 rounded-lg border border-success/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>Policies Saved & Audited</span>
            </div>
          )}

          <button
            type="submit"
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Client Policies</span>
          </button>
        </div>
      </div>

      {/* Grid of Policy Domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Section 1: Payroll Divisor & Overtime */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-surface-container-high">
            <DollarSign className="w-4 h-4 text-primary" />
            <h2 className="font-serif font-bold text-sm text-primary">1. Payroll Divisor & Overtime Engine</h2>
          </div>

          <div>
            <label className="font-bold text-on-surface block mb-1">
              Monthly Salary Divisor Rule *
            </label>
            <select
              value={salaryDivisor}
              onChange={e => setSalaryDivisor(e.target.value as any)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
            >
              <option value="30">Fixed 30 Days (Salary = Base * PaidDays / 30)</option>
              <option value="26">Fixed 26 Days (Excludes Scheduled Sundays)</option>
              <option value="calendar_days">Actual Calendar Days in Active Pay Period</option>
            </select>
            <span className="text-[10px] text-on-surface-variant block mt-1">
              Controls pro-rata earnings and loss-of-pay (LWP) deduction multipliers.
            </span>
          </div>

          <div>
            <label className="font-bold text-on-surface block mb-1">
              Overtime Calculation Method *
            </label>
            <select
              value={overtimeMethod}
              onChange={e => setOvertimeMethod(e.target.value as any)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
            >
              <option value="multiplier">Wage Multiplier (e.g., 1.5x / 2.0x hourly base)</option>
              <option value="flat_rate">Flat Rate Allowance (Fixed rate per approved OT hour)</option>
              <option value="comp_off">Compensatory Off (Accrues into employee leave balance)</option>
              <option value="disabled">Overtime Compensation Disabled</option>
            </select>
          </div>

          {overtimeMethod === 'multiplier' && (
            <div>
              <label className="font-bold text-on-surface block mb-1">Overtime Multiplier Factor</label>
              <input
                type="number"
                step="0.1"
                value={overtimeRate}
                onChange={e => setOvertimeRate(e.target.value)}
                placeholder="1.5"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>
          )}

          {overtimeMethod === 'flat_rate' && (
            <div>
              <label className="font-bold text-on-surface block mb-1">Flat Rate (₹ per Hour)</label>
              <input
                type="number"
                value={overtimeRate}
                onChange={e => setOvertimeRate(e.target.value)}
                placeholder="120"
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>
          )}
        </div>

        {/* Section 2: Working Hours & Shifts */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-surface-container-high">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="font-serif font-bold text-sm text-primary">2. Shift Durations & Overnight Spans</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-on-surface block mb-1">Standard Day Hours</label>
              <input
                type="number"
                step="0.5"
                value={standardWorkingHours}
                onChange={e => setStandardWorkingHours(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Half-Day Threshold</label>
              <input
                type="number"
                step="0.25"
                value={halfDayHours}
                onChange={e => setHalfDayHours(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-on-surface block mb-1">
              Overnight Shift Paid-Day Attribution *
            </label>
            <select
              value={overnightShiftAttribution}
              onChange={e => setOvernightShiftAttribution(e.target.value as any)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
            >
              <option value="shift_start_date">Shift Start Calendar Date (Recommended Standard)</option>
              <option value="shift_end_date">Shift End Calendar Date (Morning Check-Out Date)</option>
            </select>
            <span className="text-[10px] text-on-surface-variant block mt-1">
              Determines which calendar day receives the paid day credit for shifts crossing 00:00 midnight.
            </span>
          </div>

          <div>
            <label className="font-bold text-on-surface block mb-1">Scheduled Weekly Off Day</label>
            <div className="flex gap-2">
              {['SUNDAY', 'SATURDAY'].map(day => (
                <button
                  type="button"
                  key={day}
                  onClick={() => {
                    if (weeklyOffs.includes(day)) {
                      setWeeklyOffs(weeklyOffs.filter(d => d !== day));
                    } else {
                      setWeeklyOffs([...weeklyOffs, day]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    weeklyOffs.includes(day)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-container-low text-on-surface border-surface-container-high'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Attendance Discipline & GPS Geofence */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-surface-container-high">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="font-serif font-bold text-sm text-primary">3. Late Arrivals & Geofence Verification</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-on-surface block mb-1">Grace Period (Minutes)</label>
              <input
                type="number"
                value={lateGraceMinutes}
                onChange={e => setLateGraceMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Late Penalty Rule</label>
              <select
                value={latePenaltyRule}
                onChange={e => setLatePenaltyRule(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high text-xs font-semibold"
              >
                <option value="none">No Automatic Penalty</option>
                <option value="deduct_half_day_per_3">3 Late Marks = 0.5 Day Loss of Pay</option>
                <option value="deduct_cl">Deduct 0.5 Day Casual Leave</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-surface-container-high">
            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low cursor-pointer">
              <div>
                <div className="font-bold text-on-surface">GPS Coordinate Telemetry</div>
                <div className="text-[10px] text-on-surface-variant">Capture latitude, longitude & accuracy on mobile punch</div>
              </div>
              <input
                type="checkbox"
                checked={requireGps}
                onChange={e => setRequireGps(e.target.checked)}
                className="accent-primary w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low cursor-pointer">
              <div>
                <div className="font-bold text-on-surface">Strict Geofence Enforcement</div>
                <div className="text-[10px] text-on-surface-variant">Flag punches outside work site radius as exception</div>
              </div>
              <input
                type="checkbox"
                checked={enforceStrictGeofence}
                onChange={e => setEnforceStrictGeofence(e.target.checked)}
                className="accent-primary w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low cursor-pointer">
              <div>
                <div className="font-bold text-on-surface">Mandatory Selfie Verification</div>
                <div className="text-[10px] text-on-surface-variant">Require camera snapshot before allowing check-in</div>
              </div>
              <input
                type="checkbox"
                checked={requireSelfie}
                onChange={e => setRequireSelfie(e.target.checked)}
                className="accent-primary w-4 h-4 rounded"
              />
            </label>

            {/* Direct Work Locations & Geofence Manager Shortcut */}
            <div className="pt-2">
              <a
                href={client?.id ? `/workspace/${client.id}/locations` : '/workspace/locations'}
                className="w-full py-2.5 px-3.5 rounded-lg bg-surface-container-high/60 hover:bg-surface-container-high border border-outline-variant/30 hover:border-accent text-accent font-bold text-xs flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-accent" />
                  <span>Configure Physical Work Sites & Geofence Perimeter (Lat / Lng / Radius)</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <span>Manage Sites</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Section 4: Leave Ledger & Statutory Withholding */}
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-surface-container-high">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="font-serif font-bold text-sm text-primary">4. Leave Entitlements & Statutory Withholding</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-on-surface block mb-1">Monthly Paid Leave (Days)</label>
              <input
                type="number"
                step="0.25"
                value={monthlyLeave}
                onChange={e => setMonthlyLeave(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Max Carry-Forward Cap</label>
              <input
                type="number"
                value={maxCarryForward}
                onChange={e => setMaxCarryForward(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-surface-container-high">
            <div className="font-bold text-on-surface text-[11px] uppercase tracking-wider text-on-surface-variant">
              Statutory Withholding Configurations
            </div>

            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low cursor-pointer">
              <div>
                <div className="font-bold text-on-surface">Provident Fund (EPF 12%)</div>
                <div className="text-[10px] text-on-surface-variant">Statutory deduction on basic salary up to ₹15,000 ceiling</div>
              </div>
              <input
                type="checkbox"
                checked={pfEnabled}
                onChange={e => setPfEnabled(e.target.checked)}
                className="accent-primary w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low cursor-pointer">
              <div>
                <div className="font-bold text-on-surface">ESIC (Employee 0.75% / Employer 3.25%)</div>
                <div className="text-[10px] text-on-surface-variant">Applicable for monthly wages up to ₹21,000</div>
              </div>
              <input
                type="checkbox"
                checked={esicEnabled}
                onChange={e => setEsicEnabled(e.target.checked)}
                className="accent-primary w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low cursor-pointer">
              <div>
                <div className="font-bold text-on-surface">Professional Tax (State PT)</div>
                <div className="text-[10px] text-on-surface-variant">Maharashtra standard ₹200/month deduction</div>
              </div>
              <input
                type="checkbox"
                checked={ptEnabled}
                onChange={e => setPtEnabled(e.target.checked)}
                className="accent-primary w-4 h-4 rounded"
              />
            </label>
          </div>
        </div>
      </div>
    </form>
  );
};
