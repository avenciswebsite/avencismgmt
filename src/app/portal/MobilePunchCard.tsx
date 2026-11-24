import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { attendanceService } from '../../services/attendanceService';
import { employeeService } from '../../services/employeeService';
import { policyService } from '../../services/policyService';
import { CallerScope } from '../../services/serviceTypes';
import {
  MapPin,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  RefreshCw,
  LogOut,
  Calendar,
  UserCheck,
  Compass
} from 'lucide-react';

export const MobilePunchCard: React.FC = () => {
  const { user } = useAuth();
  const { currentClient, activeLocations, clientPolicy } = useWorkspace();

  // Coordinates & GPS Telemetry
  const defaultCoords = { lat: 18.5204, lng: 73.8567 };
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(defaultCoords);
  const [accuracy, setAccuracy] = useState<number>(8.5);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'active' | 'denied' | 'unavailable' | 'timeout'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Punch & Muster State
  const [isPunching, setIsPunching] = useState<boolean>(false);
  const [punchFeedback, setPunchFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [todayMuster, setTodayMuster] = useState<{
    checkInTime?: string | null;
    checkOutTime?: string | null;
    totalHours?: number | null;
    status?: string;
  } | null>(null);
  const [latestEvent, setLatestEvent] = useState<{
    eventType: string;
    recordedAt: string;
    isSuspicious?: boolean;
  } | null>(null);
  const [isLoadingMuster, setIsLoadingMuster] = useState<boolean>(false);
  const [currentEmp, setCurrentEmp] = useState<any>(null);

  const currentClientId = currentClient?.id;
  const userRole = user?.role;
  const userClientId = user?.clientId;
  const userEmployeeId = user?.employeeId;

  // Caller scope for multitenant / role verification - memoized to prevent re-render cascades
  const callerScope: CallerScope | undefined = useMemo(() => userRole ? {
    role: userRole,
    clientId: userClientId || currentClientId,
    employeeId: userEmployeeId,
  } : undefined, [userRole, userClientId, currentClientId, userEmployeeId]);

  // Real-time clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setCurrentDate(now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Browser Geolocation Acquisition
  const acquireGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      setGpsError('Geolocation is not supported by this browser.');
      return;
    }

    setGpsStatus('acquiring');
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: Math.round(position.coords.latitude * 1000000) / 1000000,
          lng: Math.round(position.coords.longitude * 1000000) / 1000000,
        });
        setAccuracy(Math.round(position.coords.accuracy * 10) / 10);
        setGpsStatus('active');
        setGpsError(null);
      },
      (error) => {
        let errorMsg = 'Failed to obtain GPS position.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsStatus('denied');
            errorMsg = 'Location permission denied by user. Accurate geofence verification requires GPS access.';
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsStatus('unavailable');
            errorMsg = 'Location signal unavailable from browser hardware.';
            break;
          case error.TIMEOUT:
            setGpsStatus('timeout');
            errorMsg = 'Location acquisition timed out. Using last known coordinates.';
            break;
        }
        setGpsError(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    acquireGeolocation();
  }, [acquireGeolocation]);

  // Resolve Employee & Load Today's Attendance Muster
  const loadEmployeeAndAttendance = useCallback(async () => {
    if (!currentClient) return;

    try {
      setIsLoadingMuster(true);
      // Fetch employees for current client
      const empRes = await employeeService.getEmployees({ clientId: currentClient.id }, callerScope);
      const employees = empRes.data || [];

      // Match employee by user.employeeId or user.email
      let matchedEmp = employees.find(
        (e: any) =>
          (user?.employeeId && e.id === user.employeeId) ||
          (user?.email && e.email?.toLowerCase() === user.email.toLowerCase())
      );

      // If user is a client admin or manager without an employee profile, auto-provision their profile
      if (!matchedEmp && user && ['client_admin', 'client_manager', 'hr_admin'].includes(user.role)) {
        const mgrRes = await employeeService.ensureManagerEmployeeProfile(user as any);
        if (mgrRes.success && mgrRes.data) {
          matchedEmp = mgrRes.data;
        }
      }

      // Only fall back to first employee for regular employee preview mode
      if (!matchedEmp && user?.role === 'employee' && employees.length > 0) {
        matchedEmp = employees[0];
      }

      setCurrentEmp(matchedEmp || null);

      if (matchedEmp) {
        const todayDate = new Date().toISOString().split('T')[0];
        const attRes = await attendanceService.getTodayAttendance(
          currentClient.id,
          matchedEmp.id,
          todayDate,
          callerScope
        );

        if (attRes.data) {
          const musterRaw = attRes.data.muster;
          if (musterRaw) {
            setTodayMuster({
              checkInTime: (musterRaw as any).checkInTime || (musterRaw as any).check_in_time || null,
              checkOutTime: (musterRaw as any).checkOutTime || (musterRaw as any).check_out_time || null,
              totalHours: (musterRaw as any).totalHours ?? (musterRaw as any).total_hours ?? null,
              status: (musterRaw as any).status || 'PRESENT',
            });
          } else {
            setTodayMuster(null);
          }

          const eventRaw = attRes.data.latestEvent;
          if (eventRaw) {
            setLatestEvent({
              eventType: (eventRaw as any).eventType || (eventRaw as any).event_type,
              recordedAt: (eventRaw as any).timestamp || (eventRaw as any).recorded_at,
              isSuspicious: (eventRaw as any).isSuspicious ?? (eventRaw as any).is_suspicious ?? false,
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load employee attendance muster:', err);
    } finally {
      setIsLoadingMuster(false);
    }
  }, [currentClient, user, callerScope]);

  useEffect(() => {
    loadEmployeeAndAttendance();
  }, [loadEmployeeAndAttendance]);

  if (!currentClient || !currentEmp) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm text-center">
        <AlertTriangle className="w-8 h-8 text-secondary mx-auto mb-2 opacity-60" />
        <h3 className="font-serif text-sm font-bold text-primary">No Active Employee Record Linked</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Your authenticated account is not associated with an active employee profile in {currentClient?.name || 'this organization'}.
        </p>
      </div>
    );
  }

  // Work Location and Multi-Site Geofence Resolution
  const empLocationId = currentEmp?.workLocationId || (currentEmp as any)?.work_location_id;
  const primaryLocation = activeLocations.find(l => l.id === empLocationId) || activeLocations[0];

  // Evaluate geofence against primary site and all authorized client locations
  let effectiveLocation = primaryLocation;
  let bestGeofenceEval = attendanceService.evaluateGeofence(
    { latitude: coords.lat, longitude: coords.lng },
    {
      latitude: primaryLocation?.latitude || defaultCoords.lat,
      longitude: primaryLocation?.longitude || defaultCoords.lng,
      radius_meters: (primaryLocation as any)?.radiusMeters || (primaryLocation as any)?.geofence_radius_meters || 150
    }
  );

  // If outside primary site geofence, check if employee is physically inside any other authorized company site
  if (!bestGeofenceEval.isWithinGeofence && activeLocations.length > 1) {
    for (const site of activeLocations) {
      const siteRadius = (site as any)?.radiusMeters || (site as any)?.geofence_radius_meters || 150;
      const evalResult = attendanceService.evaluateGeofence(
        { latitude: site.latitude, longitude: site.longitude },
        { latitude: coords.lat, longitude: coords.lng, radius_meters: siteRadius }
      );
      if (evalResult.isWithinGeofence) {
        effectiveLocation = site;
        bestGeofenceEval = evalResult;
        break;
      }
    }
  }

  const assignedLocation = effectiveLocation;
  const targetLat = assignedLocation?.latitude || defaultCoords.lat;
  const targetLng = assignedLocation?.longitude || defaultCoords.lng;
  const targetRadius = (assignedLocation as any)?.radiusMeters || (assignedLocation as any)?.geofence_radius_meters || 150;
  const geofenceEval = bestGeofenceEval;

  // Employee Tenure & Status Evaluation
  const empStatus = currentEmp?.status || 'ACTIVE';
  const lastWorkingDay = currentEmp?.lastWorkingDay || currentEmp?.last_working_day;
  const todayDateStr = new Date().toISOString().split('T')[0];
  const isPastLwd = Boolean(lastWorkingDay && todayDateStr > lastWorkingDay);
  const isEmployeeEligible = empStatus === 'ACTIVE' && !isPastLwd;

  // State Transition Guards
  const hasCheckedIn = Boolean(todayMuster?.checkInTime);
  const hasCheckedOut = Boolean(todayMuster?.checkOutTime);
  const isShiftCompleted = hasCheckedIn && hasCheckedOut;
  const isStrictGeofence = clientPolicy?.enforceStrictGeofence ?? true;
  const isGeofenceBlocked = isStrictGeofence && !geofenceEval.isWithinGeofence;
  const canCheckIn = isEmployeeEligible && !hasCheckedIn && !isShiftCompleted && !isGeofenceBlocked;
  const canCheckOut = isEmployeeEligible && hasCheckedIn && !hasCheckedOut;

  // Punch Action Handler
  const handlePunch = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!isEmployeeEligible) {
      setPunchFeedback({
        type: 'error',
        message: isPastLwd
          ? `Punch disabled: Service tenure ended on Last Working Day (${lastWorkingDay}).`
          : `Punch disabled: Employee account status is ${empStatus}. Only ACTIVE employees can record punches.`
      });
      return;
    }

    if (type === 'CHECK_IN' && !canCheckIn) {
      setPunchFeedback({
        type: 'error',
        message: hasCheckedIn
          ? 'Already checked in today. Please record check-out to conclude your shift.'
          : 'Shift already completed for today.',
      });
      return;
    }

    if (type === 'CHECK_OUT' && !canCheckOut) {
      setPunchFeedback({
        type: 'error',
        message: 'Cannot record Check-Out without an active Check-In session for today.',
      });
      return;
    }

    setIsPunching(true);
    setPunchFeedback(null);

    try {
      const res = await attendanceService.recordPunch({
        clientId: currentClient.id,
        employeeId: currentEmp.id,
        eventType: type,
        coords: { latitude: coords.lat, longitude: coords.lng },
        accuracyMeters: accuracy,
        deviceInfo: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile')
          ? 'Mobile Browser (MobilePunchCard)'
          : 'Desktop Browser Terminal',
        verificationSource: gpsStatus === 'active' ? 'GPS_HARDWARE' : 'BROWSER_TELEMETRY',
      }, callerScope);

      if (res.data) {
        setPunchFeedback({
          type: 'success',
          message: `Official ${type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} recorded at ${currentTime}!`,
        });
        // Immediately reload muster from backend
        await loadEmployeeAndAttendance();
      } else {
        setPunchFeedback({
          type: 'error',
          message: res.error?.message || 'Attendance recording failed.',
        });
      }
    } catch (err: any) {
      setPunchFeedback({
        type: 'error',
        message: err.message || 'Network or service error during attendance punch.',
      });
    } finally {
      setIsPunching(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5">
      {/* Feedback banner */}
      {punchFeedback && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${punchFeedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-red-50 text-red-900 border-red-200'
          }`}>
          {punchFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span className="font-medium">{punchFeedback.message}</span>
        </div>
      )}

      {/* Inactive / Exited Employee Warning Banner */}
      {!isEmployeeEligible && (
        <div className="p-4 rounded-xl text-xs flex items-center gap-3 border bg-amber-50 text-amber-900 border-amber-300">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <div className="font-bold text-sm">Attendance Recording Disabled</div>
            <p className="mt-0.5">
              {isPastLwd
                ? `Your official exit was on ${lastWorkingDay}. Attendance punching is deactivated post-tenure.`
                : `Your employee record status is ${empStatus}. Only ACTIVE employees are authorized to punch in.`}
            </p>
          </div>
        </div>
      )}

      {/* GPS Warning Banner if Permission Denied or Degraded */}
      {gpsError && (
        <div className="p-3.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{gpsError}</span>
          </div>
          <button
            onClick={acquireGeolocation}
            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[10px] shrink-0 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry GPS</span>
          </button>
        </div>
      )}

      {/* Main Responsive Attendance Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        {/* Terminal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/20 pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-bold">
              Attendance Terminal
            </span>
            <div className="font-serif text-3xl sm:text-4xl text-primary font-bold mt-1">
              {currentTime}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">{currentDate}</p>
          </div>

          <div className="flex items-center gap-3 bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/20">
            {(currentEmp.avatarUrl || currentEmp.avatar_url) ? (
              <img
                src={currentEmp.avatarUrl || currentEmp.avatar_url}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-secondary/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                {((currentEmp.firstName || currentEmp.first_name || 'E')[0]) + ((currentEmp.lastName || currentEmp.last_name || '')[0] || '')}
              </div>
            )}
            <div>
              <span className="font-bold text-xs text-primary block leading-tight">
                {currentEmp.firstName || currentEmp.first_name} {currentEmp.lastName || currentEmp.last_name}
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant">
                {currentEmp.employeeCode || currentEmp.employee_code} • {currentClient.name.split(' ')[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Location & Geofence telemetry */}
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>{assignedLocation?.name || 'Authorized Fleet Depot'}</span>
            </div>
            {geofenceEval.isWithinGeofence ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Inside Geofence Radius
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                Outside Geofence ({geofenceEval.distanceMeters}m away)
              </span>
            )}
          </div>

          <p className="text-xs text-on-surface-variant">
            {assignedLocation?.address || (assignedLocation as any)?.address_line1 || 'Authorized Workplace Depot'}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-on-surface-variant pt-2 border-t border-outline-variant/20">
            <div className="flex flex-wrap items-center gap-3">
              <span>Lat: {coords.lat}° N</span>
              <span>Lng: {coords.lng}° E</span>
              <span>Accuracy: ±{accuracy}m</span>
              <span>Geofence: {targetRadius}m</span>
            </div>
            <button
              onClick={acquireGeolocation}
              title="Refresh GPS Coordinates"
              className="text-accent hover:text-accent-dark flex items-center gap-1 font-sans text-[10px] font-bold transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${gpsStatus === 'acquiring' ? 'animate-spin' : ''}`} />
              <span>Calibrate</span>
            </button>
          </div>
        </div>

        {/* Today's Shift Status Summary */}
        <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/20 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant block">First In Time</span>
            <span className="font-bold text-xs text-primary block mt-0.5">
              {todayMuster?.checkInTime || '--:--'}
            </span>
          </div>
          <div className="border-x border-outline-variant/30">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Last Out Time</span>
            <span className="font-bold text-xs text-primary block mt-0.5">
              {todayMuster?.checkOutTime || '--:--'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Total Hours</span>
            <span className="font-bold text-xs text-primary block mt-0.5">
              {todayMuster?.totalHours ? `${todayMuster.totalHours} hrs` : '--'}
            </span>
          </div>
        </div>

        {/* Punch Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handlePunch('CHECK_IN')}
            disabled={isPunching || !canCheckIn}
            className={`py-4 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow ${canCheckIn
                ? 'bg-primary text-white hover:bg-primary-dark active:scale-[0.98]'
                : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-60'
              }`}
          >
            <Navigation className="w-5 h-5 text-accent-light" />
            <span>
              {isPunching
                ? 'Verifying GPS...'
                : isShiftCompleted
                  ? 'Shift Completed'
                  : hasCheckedIn
                    ? 'Already Checked In'
                    : isGeofenceBlocked
                      ? 'Check-In Blocked (Outside Geofence)'
                      : 'Check-In (Punch)'}
            </span>
          </button>

          <button
            onClick={() => handlePunch('CHECK_OUT')}
            disabled={isPunching || !canCheckOut}
            className={`py-4 px-6 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${canCheckOut
                ? 'bg-surface-container-lowest text-primary border-primary/20 hover:border-primary active:scale-[0.98]'
                : 'bg-surface-container-low text-on-surface-variant border-outline-variant/20 cursor-not-allowed opacity-60'
              }`}
          >
            <Clock className="w-5 h-5 text-secondary" />
            <span>
              {isPunching
                ? 'Verifying GPS...'
                : isShiftCompleted
                  ? 'Shift Completed'
                  : !hasCheckedIn
                    ? 'Check-In Required'
                    : 'Check-Out (Punch)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
