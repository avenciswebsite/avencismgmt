import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { employeeService, attendanceService, EmployeeRow, DailyAttendanceRow } from '../../services';
import { 
  Building2, 
  Users, 
  CalendarCheck, 
  DollarSign, 
  MapPin, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  UserPlus,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';

export const ClientOverview: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { 
    activeClient, 
    activeClientId, 
    clientPolicy, 
    activeLegalEntity, 
    activeLocations, 
    isLoadingWorkspace, 
    workspaceError, 
    switchClient,
    refreshWorkspace 
  } = useWorkspace();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [attendance, setAttendance] = useState<DailyAttendanceRow[]>([]);
  const [isLoadingOperationalData, setIsLoadingOperationalData] = useState<boolean>(true);

  // Synchronize client selection if clientId is provided in the route
  useEffect(() => {
    if (clientId && clientId !== activeClientId && !isLoadingWorkspace) {
      switchClient(clientId);
    }
  }, [clientId, activeClientId, isLoadingWorkspace, switchClient]);

  // Load live operational data (employees and attendance muster) for the active client
  useEffect(() => {
    let isMounted = true;
    const loadOperationalData = async () => {
      if (!activeClient.id) {
        if (isMounted) {
          setEmployees([]);
          setAttendance([]);
          setIsLoadingOperationalData(false);
        }
        return;
      }

      setIsLoadingOperationalData(true);
      try {
        const [empRes, attRes] = await Promise.all([
          employeeService.getEmployees({ clientId: activeClient.id }),
          attendanceService.getDailyAttendance({ clientId: activeClient.id }),
        ]);

        if (!isMounted) return;

        setEmployees(empRes.success && empRes.data ? empRes.data : []);
        setAttendance(attRes.success && attRes.data ? attRes.data : []);
      } catch (err) {
        console.error('[Avencis WFM] Error fetching operational data for client overview:', err);
      } finally {
        if (isMounted) {
          setIsLoadingOperationalData(false);
        }
      }
    };

    loadOperationalData();

    return () => {
      isMounted = false;
    };
  }, [activeClient.id]);

  const client = activeClient;
  const policy = clientPolicy;
  const primaryEntity = activeLegalEntity;
  const locations = activeLocations;

  const presentToday = attendance.filter(a => a.status === 'PRESENT').length;
  const onLeaveToday = attendance.filter(a => a.status === 'PAID_LEAVE' || a.status === 'HALF_DAY').length;
  const absentToday = attendance.filter(a => a.status === 'ABSENT').length;

  const isLoading = isLoadingWorkspace || isLoadingOperationalData;

  // Error boundary state
  if (workspaceError) {
    return (
      <div className="bg-surface-container-lowest p-8 rounded-xl border border-error/20 shadow-card text-center space-y-4 max-w-lg mx-auto mt-12">
        <ShieldAlert className="w-12 h-12 text-error mx-auto" />
        <h2 className="text-xl font-serif font-bold text-primary">Workspace Access Restriction</h2>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          {workspaceError}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            onClick={() => refreshWorkspace()}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-primary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
          <button
            onClick={() => navigate('/admin/clients')}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors"
          >
            <span>Return to Client Directory</span>
          </button>
        </div>
      </div>
    );
  }

  // Loading skeleton state preventing stale data flash
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Banner Skeleton */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-xl bg-surface-container"></div>
            <div className="space-y-2">
              <div className="h-4 w-24 bg-surface-container rounded"></div>
              <div className="h-6 w-48 bg-surface-container rounded"></div>
              <div className="h-3 w-64 bg-surface-container rounded"></div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="h-9 w-28 bg-surface-container rounded-lg"></div>
            <div className="h-9 w-36 bg-surface-container rounded-lg"></div>
          </div>
        </div>

        {/* Policy Strip Skeleton */}
        <div className="h-12 bg-surface-container-lowest border border-surface-container-high rounded-xl"></div>

        {/* Operational KPI Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card space-y-3">
              <div className="h-3 w-24 bg-surface-container rounded"></div>
              <div className="h-8 w-16 bg-surface-container rounded"></div>
              <div className="h-3 w-32 bg-surface-container rounded"></div>
            </div>
          ))}
        </div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-surface-container-lowest rounded-xl border border-surface-container-high p-5 shadow-card"></div>
          <div className="h-64 bg-surface-container-lowest rounded-xl border border-surface-container-high p-5 shadow-card"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Context Banner */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-surface-container-high shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-xl bg-primary text-white flex items-center justify-center font-serif text-2xl font-bold shadow-md shrink-0">
            {client.code ? client.code.substring(0, 2) : 'CL'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                Client Workspace
              </span>
              <span className="text-xs text-on-surface-variant font-mono">Code: {client.code}</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-primary mt-1">{client.name}</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Legal Employer: <strong>{primaryEntity?.legalName || 'Not configured'}</strong> • PAN: {primaryEntity?.pan || primaryEntity?.panNumber || 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/workspace/employees/add')}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-primary text-xs font-bold transition-colors border border-surface-container-high"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </button>

          <button
            onClick={() => navigate('/workspace/payroll/run')}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-md"
          >
            <DollarSign className="w-4 h-4" />
            <span>Run Monthly Payroll</span>
          </button>
        </div>
      </div>

      {/* Policy Engine Compliance Alert */}
      {!policy.isConfigured ? (
        <div className="p-4 bg-error/10 border border-error/20 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-error shrink-0" />
            <div>
              <div className="text-xs font-bold text-error">Mandatory Policy Configuration Pending</div>
              <div className="text-[11px] text-on-surface-variant">
                This client has unconfigured policy values. Payroll finalisation and automated statutory withholding are currently blocked.
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/workspace/policies')}
            className="px-3 py-1.5 bg-error text-white text-xs font-bold rounded-lg hover:bg-error/90 transition-colors shrink-0"
          >
            Configure Policies
          </button>
        </div>
      ) : (
        <div className="p-3 bg-surface-container-lowest border border-surface-container-high rounded-xl flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center space-x-2 text-success font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Client Policy Active:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-surface-container-low border border-surface-container-high">
              Divisor: <strong>{policy.salaryDivisor} Days</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-low border border-surface-container-high">
              OT: <strong>{policy.overtimeMethod === 'multiplier' ? `${policy.overtimeRate}x` : policy.overtimeMethod}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-low border border-surface-container-high">
              Grace: <strong>{policy.lateGraceMinutes}m</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-low border border-surface-container-high">
              Monthly Leave: <strong>{policy.monthlyPaidLeaveAccrual}d</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-low border border-surface-container-high">
              PF: <strong>{policy.pfEnabled ? 'Enabled' : 'Disabled'}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-low border border-surface-container-high">
              ESIC: <strong>{policy.esicEnabled ? 'Enabled' : 'Disabled'}</strong>
            </span>
          </div>
          <button
            onClick={() => navigate('/workspace/policies')}
            className="text-accent font-bold hover:underline ml-2"
          >
            Edit Settings
          </button>
        </div>
      )}

      {/* Operational KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-bold uppercase">
            <span>Client Headcount</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            {employees.length}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            Active under {primaryEntity?.legalName?.substring(0, 20) || 'Registered Entity'}...
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-bold uppercase">
            <span>Present Today</span>
            <CalendarCheck className="w-4 h-4 text-success" />
          </div>
          <div className="text-3xl font-serif font-bold text-success mt-2">
            {presentToday}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            {onLeaveToday} on leave • {absentToday} absent
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-bold uppercase">
            <span>Work Locations</span>
            <MapPin className="w-4 h-4 text-accent" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            {locations.length}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            Geofenced operational sites
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-on-surface-variant text-xs font-bold uppercase">
            <span>Next Payroll</span>
            <DollarSign className="w-4 h-4 text-warning" />
          </div>
          <div className="text-3xl font-serif font-bold text-primary mt-2">
            Nov 2026
          </div>
          <div className="text-[11px] text-accent font-semibold mt-1">
            Period Open for Tracking
          </div>
        </div>
      </div>

      {/* Two Column Layout: Employees Quick List & Location Presence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Deployed Employees */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-surface-container-high p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
            <h2 className="text-base font-serif font-bold text-primary">Employees in Workspace</h2>
            <button
              onClick={() => navigate('/workspace/employees')}
              className="text-xs font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
            >
              <span>View Full Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {employees.length === 0 ? (
              <div className="py-8 text-center text-xs text-on-surface-variant">
                No active employee profiles deployed under this client organization.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Employee</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Arrangement</th>
                    <th className="py-2.5 px-3 rounded-r-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {employees.map(emp => {
                    const loc = locations.find(l => l.id === emp.work_location_id);
                    const locName = loc ? loc.name : 'Primary Site';

                    return (
                      <tr key={emp.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-primary">{emp.first_name} {emp.last_name}</div>
                          <div className="text-[10px] text-on-surface-variant font-mono">{emp.employee_code}</div>
                        </td>
                        <td className="py-3 px-3 text-on-surface font-medium">{emp.designation}</td>
                        <td className="py-3 px-3 text-on-surface-variant">{locName}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-on-surface-variant">
                          {emp.employment_arrangement.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success">
                            {emp.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right (1 col): Locations & Geofences */}
        <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
            <h2 className="text-base font-serif font-bold text-primary">Geofenced Work Locations</h2>
            <button
              onClick={() => navigate(client?.id ? `/workspace/${client.id}/locations` : '/workspace/locations')}
              className="text-xs font-bold text-accent hover:text-accent-hover flex items-center space-x-1"
            >
              <span>Manage / Add Sites</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            {locations.length === 0 ? (
              <div className="p-4 rounded-lg bg-surface-container-low border border-surface-container-high text-center text-xs text-on-surface-variant">
                No geofenced work locations configured for this client.
              </div>
            ) : (
              locations.map(loc => (
                <div key={loc.id} className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-primary">{loc.name}</div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {loc.radiusMeters}m radius
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant line-clamp-1">{loc.address}</div>
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant pt-1 border-t border-surface-container-high font-mono">
                    <span>GPS: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
                    <span className="text-success font-semibold">● Active Site</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={() => navigate(client?.id ? `/workspace/${client.id}/locations` : '/workspace/locations')}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors shadow-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-white" />
              <span>Add or Edit Geofenced Sites</span>
            </button>
            <button
              onClick={() => navigate('/workspace/attendance')}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-colors shadow-sm"
            >
              <span>View Attendance Command Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
