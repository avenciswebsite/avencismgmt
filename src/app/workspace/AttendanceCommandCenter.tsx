import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import { policyService } from '../../services/policyService';
import { employeeService } from '../../services/employeeService';
import { 
  DailyAttendanceRow, 
  DepartmentRow, 
  WorkLocationRow, 
  EmployeeRow, 
  ClientPolicyRow 
} from '../../services/serviceTypes';
import { 
  CalendarCheck, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Home
} from 'lucide-react';

export const AttendanceCommandCenter: React.FC = () => {
  const { clientId: routeClientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const { activeClient, activeClientId } = useWorkspace();
  const { currentUser } = useAuth();

  const effectiveClientId = routeClientId || activeClientId || activeClient?.id;

  const [records, setRecords] = useState<DailyAttendanceRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [locations, setLocations] = useState<WorkLocationRow[]>([]);
  const [policy, setPolicy] = useState<ClientPolicyRow | null>(null);
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState('2026-11-03');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterLoc, setFilterLoc] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const userRole = currentUser?.role;
  const userClientId = currentUser?.clientId || effectiveClientId;
  const userEmpId = currentUser?.employeeId;

  const callerScope = useMemo(() => ({
    role: userRole,
    clientId: userClientId,
    employeeId: userEmpId,
  }), [userRole, userClientId, userEmpId]);

  const loadData = useCallback(async () => {
    if (!effectiveClientId) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch metadata in parallel
      const [deptRes, locRes, polRes, empRes, corrRes] = await Promise.all([
        policyService.getDepartments(effectiveClientId),
        policyService.getWorkLocations(effectiveClientId),
        policyService.getClientPolicy(effectiveClientId),
        employeeService.getEmployees({ clientId: effectiveClientId }, callerScope),
        attendanceService.getRegularisationRequests({ clientId: effectiveClientId, status: 'PENDING' }, callerScope),
      ]);

      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
      if (locRes.success && locRes.data) setLocations(locRes.data);
      if (polRes.success && polRes.data) setPolicy(polRes.data);
      if (empRes.success && empRes.data) setEmployees(empRes.data);
      if (corrRes.success && corrRes.data) setPendingCorrectionsCount(corrRes.data.length);

      // 2. Fetch daily attendance records
      const attRes = await attendanceService.getDailyAttendance(
        {
          clientId: effectiveClientId,
          date: filterDate || undefined,
        },
        callerScope
      );

      if (!attRes.success) {
        setErrorMsg(attRes.error?.message || 'Failed to load attendance records.');
        setRecords([]);
      } else {
        setRecords(attRes.data || []);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An error occurred while loading attendance data.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveClientId, filterDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Merge records with employee details and apply client-side filters
  const enrichedRecords = records.map(rec => {
    const emp = employees.find(e => e.id === rec.employee_id);
    const dept = departments.find(d => d.id === emp?.department_id);
    const loc = locations.find(l => l.id === emp?.work_location_id);

    return {
      ...rec,
      employeeName: emp ? `${emp.first_name} ${emp.last_name}` : 'Staff Member',
      employeeCode: emp?.employee_code || 'EMP-ID',
      departmentId: emp?.department_id,
      departmentName: dept?.name || 'Operations',
      locationId: emp?.work_location_id,
      resolvedLocationName: rec.location_name || loc?.name || 'Assigned Site',
    };
  });

  const filteredRecords = enrichedRecords.filter(rec => {
    const matchesStatus = filterStatus === 'ALL' || rec.status === filterStatus;
    const matchesDept = filterDept === 'ALL' || rec.departmentId === filterDept;
    const matchesLoc = filterLoc === 'ALL' || rec.locationId === filterLoc;
    const matchesSearch = 
      !searchTerm.trim() ||
      rec.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesDept && matchesLoc && matchesSearch;
  });

  // Calculate real metrics
  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const halfDayCount = records.filter(r => r.status === 'HALF_DAY').length;
  const paidLeaveCount = records.filter(r => r.status === 'PAID_LEAVE').length;
  const unpaidLeaveCount = records.filter(r => r.status === 'UNPAID_LEAVE').length;
  const weeklyOffCount = records.filter(r => r.status === 'WEEKLY_OFF').length;
  const holidayCount = records.filter(r => r.status === 'HOLIDAY').length;
  const leaveCount = paidLeaveCount + unpaidLeaveCount;
  const totalRoster = employees.length > 0 ? employees.length : records.length;

  // Check if target filterDate is a weekly off day for the client
  const dateObj = new Date(filterDate);
  const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][dateObj.getDay()];
  const isDateWeeklyOff = (policy?.weekly_off_days || ['SUNDAY']).map(d => d.toUpperCase()).includes(dayName);

  const absentCount = isDateWeeklyOff
    ? 0
    : Math.max(0, totalRoster - (presentCount + halfDayCount + leaveCount + weeklyOffCount + holidayCount));

  const clientName = activeClient?.name || 'Client Workspace';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-surface-container-high">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent font-sans">
            Shift Operations & Live Telemetry
          </div>
          <h1 className="text-2xl font-serif font-bold text-primary">Attendance Command Center</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Real-time workforce attendance monitoring for <strong>{clientName}</strong>.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2.5 rounded-lg border border-surface-container-high hover:bg-surface-container-low text-on-surface-variant transition-colors"
            title="Refresh Attendance"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : ''}`} />
          </button>

          {pendingCorrectionsCount > 0 && (
            <button
              onClick={() => navigate(effectiveClientId ? `/workspace/${effectiveClientId}/attendance/regularisations` : '/workspace/regularisations')}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs font-bold hover:bg-warning/20 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{pendingCorrectionsCount} Regularisation(s) Pending Review</span>
            </button>
          )}

          <button
            onClick={() => navigate('/portal/check-in')}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-xs font-bold text-primary border border-surface-container-high"
          >
            <Clock className="w-4 h-4 text-accent" />
            <span>Simulate Mobile Check-In</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl flex items-center justify-between text-xs text-error">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="px-3 py-1 bg-error text-white font-bold rounded-lg text-xs hover:bg-error/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Attendance KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-bold uppercase">
            <span>Present Staff</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-serif font-bold text-success mt-1">{presentCount}</div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Within Active Geofence</div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-bold uppercase">
            <span>Half Day / Late</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-serif font-bold text-warning mt-1">{halfDayCount}</div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">
            {policy?.late_grace_minutes || 15}m Grace Window
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-bold uppercase">
            <span>On Approved Leave</span>
            <CalendarCheck className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-serif font-bold text-accent mt-1">{leaveCount}</div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Debited from leave ledger</div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-high shadow-card">
          <div className="flex items-center justify-between text-xs text-on-surface-variant font-bold uppercase">
            <span>Absent / Unmarked</span>
            <AlertTriangle className="w-4 h-4 text-error" />
          </div>
          <div className="text-2xl font-serif font-bold text-error mt-1">{absentCount}</div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Triggers LWP Deduction</div>
        </div>
      </div>

      {/* Attendance Roster Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-card overflow-hidden">
        <div className="p-4 border-b border-surface-container-high flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="font-serif font-bold text-sm text-primary flex items-center space-x-2">
            <span>Shift Session Register:</span>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="font-sans font-bold px-2 py-0.5 bg-surface-container-low rounded text-primary border border-surface-container-high"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search staff..."
                className="w-full pl-8 pr-2.5 py-1 bg-surface-container-low rounded-lg border border-surface-container-high text-xs"
              />
            </div>

            {/* Department Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-on-surface-variant font-medium">Dept:</span>
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="px-2 py-1 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
              >
                <option value="ALL">All Depts</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-on-surface-variant font-medium">Site:</span>
              <select
                value={filterLoc}
                onChange={e => setFilterLoc(e.target.value)}
                className="px-2 py-1 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
              >
                <option value="ALL">All Sites</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-on-surface-variant font-semibold">Status:</span>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-2.5 py-1 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="PAID_LEAVE">Paid Leave</option>
                <option value="UNPAID_LEAVE">Unpaid Leave (LWP)</option>
                <option value="WEEKLY_OFF">Weekly Off</option>
                <option value="HOLIDAY">Holiday</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px] border-b border-surface-container-high">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Work Location</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4 text-right">Integrity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="h-3 w-28 bg-surface-container-high rounded mb-1" />
                      <div className="h-2 w-16 bg-surface-container-high rounded" />
                    </td>
                    <td className="py-3 px-4"><div className="h-3 w-16 bg-surface-container-high rounded" /></td>
                    <td className="py-3 px-4"><div className="h-3 w-16 bg-surface-container-high rounded" /></td>
                    <td className="py-3 px-4"><div className="h-3 w-12 bg-surface-container-high rounded" /></td>
                    <td className="py-3 px-4"><div className="h-3 w-24 bg-surface-container-high rounded" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-14 bg-surface-container-high rounded-full" /></td>
                    <td className="py-3 px-4 text-right"><div className="h-3 w-16 bg-surface-container-high rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-on-surface-variant">
                    <Clock className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-on-surface">No attendance records found.</p>
                    <p className="text-xs mt-1">No muster entries recorded for date {filterDate} matching the active filters.</p>
                    {(filterStatus !== 'ALL' || filterDept !== 'ALL' || filterLoc !== 'ALL' || searchTerm) && (
                      <button
                        onClick={() => {
                          setFilterStatus('ALL');
                          setFilterDept('ALL');
                          setFilterLoc('ALL');
                          setSearchTerm('');
                        }}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-surface-container-high text-primary font-bold text-xs hover:bg-surface-container-highest transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-primary">{rec.employeeName}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        {rec.employeeCode} • {rec.departmentName}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-on-surface">
                      {rec.check_in_time || <span className="text-on-surface-variant italic font-sans">Pending</span>}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-on-surface">
                      {rec.check_out_time || <span className="text-on-surface-variant italic font-sans">Open Session</span>}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {rec.total_hours > 0 ? `${rec.total_hours} hrs` : '—'}
                    </td>

                    <td className="py-3 px-4 text-on-surface-variant">
                      <div className="flex items-center space-x-1">
                        {rec.location_name === 'Work From Home' || rec.resolvedLocationName === 'Work From Home' ? (
                          <>
                            <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate max-w-[160px] font-bold text-blue-800">Work From Home</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                            <span className="truncate max-w-[160px]">{rec.resolvedLocationName}</span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        rec.status === 'PRESENT'
                          ? 'bg-success/10 text-success border border-success/20'
                          : rec.status === 'HALF_DAY'
                          ? 'bg-warning/10 text-warning border border-warning/20'
                          : rec.status === 'PAID_LEAVE'
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : rec.status === 'UNPAID_LEAVE'
                          ? 'bg-secondary/10 text-secondary border border-secondary/20'
                          : rec.status === 'WEEKLY_OFF' || rec.status === 'HOLIDAY'
                          ? 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'
                          : 'bg-error/10 text-error border border-error/20'
                      }`}>
                        {rec.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {rec.is_regularised ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                          Regularised
                        </span>
                      ) : (
                        <span className="text-[10px] text-success font-semibold flex items-center justify-end space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>GPS Verified</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
