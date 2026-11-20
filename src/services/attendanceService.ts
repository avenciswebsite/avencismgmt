/**
 * Avencis Workforce Management (WFM)
 * Attendance Telemetry, Geofence Validation & Regularisation Service
 *
 * Enforces GPS geofence distance calculation, append-only raw punch immutability,
 * daily muster roll aggregation, state-transition validation, and managerial regularisation workflow.
 */

import { supabase } from '../lib/supabase';
import { isMockMode } from './serviceConfig';
import {
  ServiceResponse,
  AttendanceEventRow,
  DailyAttendanceRow,
  AttendanceCorrectionRow,
  RecordPunchPayload,
  RegularisationRequestPayload,
  AttendanceFilter,
  GeofenceEvaluation,
  CallerScope,
  calculateHaversineDistanceMeters,
  successResponse,
  errorResponse,
} from './serviceTypes';
import {
  handleSupabaseError,
  createValidationError,
  createNotFoundError,
  createPermissionError,
} from './serviceErrors';
import { store } from '../data/store';

// Roles authorized to review and approve/reject regularisation requests
const REGULARISATION_REVIEW_ROLES = ['super_admin', 'client_admin', 'hr_admin', 'client_manager', 'location_manager'];

/**
 * Calculates working hours between two 12-hour AM/PM time strings.
 */
function calculateWorkingHours(inTime: string, outTime: string): number {
  const parseMin = (str: string): number | null => {
    const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const inM = parseMin(inTime);
  const outM = parseMin(outTime);
  if (inM === null || outM === null || outM <= inM) return 8.5; // fallback standard
  return Math.round(((outM - inM) / 60) * 100) / 100;
}

export const attendanceService = {
  /**
   * Evaluates whether a pair of GPS coordinates falls within the geofence radius of a work location.
   */
  evaluateGeofence(
    punchCoords: { latitude: number; longitude: number },
    targetLocation: { latitude: number; longitude: number; radius_meters: number }
  ): GeofenceEvaluation {
    const distanceMeters = calculateHaversineDistanceMeters(
      punchCoords.latitude,
      punchCoords.longitude,
      targetLocation.latitude,
      targetLocation.longitude
    );

    const isWithinGeofence = distanceMeters <= targetLocation.radius_meters;

    return {
      isWithinGeofence,
      distanceMeters: Math.round(distanceMeters * 10) / 10,
      thresholdRadiusMeters: targetLocation.radius_meters,
      geofenceStatus: isWithinGeofence ? 'WITHIN_GEOFENCE' : 'OUT_OF_BOUNDS',
    };
  },

  /**
   * Records a raw punch event and updates/creates the daily attendance muster record.
   * Enforces raw telemetry immutability (append-only in attendance_events) and validates state transitions.
   */
  async recordPunch(
    payload: RecordPunchPayload,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<{ event: AttendanceEventRow; muster: DailyAttendanceRow }>> {
    // 1. Validate Caller Permissions & Tenancy
    if (callerScope?.role) {
      if (callerScope.role === 'employee' && callerScope.employeeId && callerScope.employeeId !== payload.employeeId) {
        return errorResponse(
          createPermissionError('Access Denied: Employees may only record attendance for their own profile.')
        );
      }
      if (callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== payload.clientId) {
        return errorResponse(
          createPermissionError('Cross-tenant access forbidden: Cannot record attendance outside your organization.')
        );
      }
    }

    // 2. Validate GPS Coordinates
    if (typeof payload.coords.latitude !== 'number' || payload.coords.latitude < -90 || payload.coords.latitude > 90) {
      return errorResponse(createValidationError('Latitude must be a valid number between -90 and 90 degrees.', 'latitude'));
    }
    if (typeof payload.coords.longitude !== 'number' || payload.coords.longitude < -180 || payload.coords.longitude > 180) {
      return errorResponse(createValidationError('Longitude must be a valid number between -180 and 180 degrees.', 'longitude'));
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (isMockMode()) {
      const emp = store.getEmployee(payload.employeeId);
      if (!emp) {
        return errorResponse(createNotFoundError('Employee', payload.employeeId));
      }

      // Check current today attendance in store for duplicate/state validation
      const existingMuster = store.getAttendanceRecords(payload.clientId, todayStr).find(r => r.employeeId === payload.employeeId);

      // State Transition Guard: Duplicate Check-In Prevention
      if (payload.eventType === 'CHECK_IN' && existingMuster && existingMuster.checkInTime && !existingMuster.checkOutTime) {
        return errorResponse(
          createValidationError('Already checked in today. Please check out before recording a new check-in.', 'eventType')
        );
      }

      // State Transition Guard: Invalid Check-Out without Prior Check-In
      if (payload.eventType === 'CHECK_OUT' && (!existingMuster || !existingMuster.checkInTime)) {
        return errorResponse(
          createValidationError('Cannot check out without an active check-in session for today.', 'eventType')
        );
      }

      const loc = store.getLocations(payload.clientId).find(l => l.id === emp.workLocationId) || store.getLocations(payload.clientId)[0];
      if (!loc) {
        return errorResponse(createValidationError('No work location assigned to employee. Contact HR.', 'workLocationId'));
      }

      const radius = loc.radiusMeters || 150;
      const targetCoords = { latitude: loc.latitude, longitude: loc.longitude, radius_meters: radius };
      const geofence = this.evaluateGeofence(payload.coords, targetCoords);

      const isSuspicious = !geofence.isWithinGeofence || (payload.coords.accuracyMeters !== undefined && payload.coords.accuracyMeters > 100);

      // Record in local store
      const { record: storeRec, event: storeEvt } = store.recordPunch(
        payload.clientId,
        payload.employeeId,
        payload.eventType,
        { lat: payload.coords.latitude, lng: payload.coords.longitude },
        payload.deviceInfo || 'Responsive Web App'
      );

      const mockEvent: AttendanceEventRow = {
        id: storeEvt.id,
        client_id: payload.clientId,
        employee_id: payload.employeeId,
        event_type: payload.eventType,
        timestamp: storeEvt.timestamp,
        latitude: payload.coords.latitude,
        longitude: payload.coords.longitude,
        accuracy_meters: payload.coords.accuracyMeters || 10,
        geofence_status: geofence.geofenceStatus,
        ip_address: payload.ipAddress || '127.0.0.1',
        device_info: payload.deviceInfo || 'Browser/Mobile Viewport',
        selfie_url: payload.selfieUrl || null,
        is_suspicious: isSuspicious,
      };

      const mockMuster: DailyAttendanceRow = {
        id: storeRec.id,
        client_id: payload.clientId,
        employee_id: payload.employeeId,
        date: todayStr,
        check_in_time: storeRec.checkInTime || timeStr,
        check_out_time: storeRec.checkOutTime || null,
        total_hours: storeRec.totalHours || (payload.eventType === 'CHECK_OUT' ? calculateWorkingHours(storeRec.checkInTime || timeStr, timeStr) : 0),
        status: (storeRec.status || 'PRESENT') as DailyAttendanceRow['status'],
        location_name: loc.name,
        is_regularised: storeRec.isRegularised || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return successResponse({ event: mockEvent, muster: mockMuster });
    }

    try {
      // Fetch Employee Work Location to evaluate Geofence
      const { data: employee, error: empErr } = await supabase
        .from('employees')
        .select('id, client_id, work_location_id')
        .eq('id', payload.employeeId)
        .single();

      if (empErr || !employee) {
        return errorResponse(createNotFoundError('Employee', payload.employeeId));
      }

      if (!employee.work_location_id) {
        return errorResponse(createValidationError('No work location assigned to employee. Contact HR.', 'workLocationId'));
      }

      const { data: assignedLoc, error: locErr } = await supabase
        .from('work_locations')
        .select('*')
        .eq('id', employee.work_location_id)
        .single();

      if (locErr || !assignedLoc) {
        return errorResponse(createNotFoundError('Work Location', employee.work_location_id));
      }

      const geofence = this.evaluateGeofence(payload.coords, {
        latitude: assignedLoc.latitude,
        longitude: assignedLoc.longitude,
        radius_meters: assignedLoc.radius_meters,
      });

      const isSuspicious = !geofence.isWithinGeofence || (payload.coords.accuracyMeters !== undefined && payload.coords.accuracyMeters > 100);

      // Fetch existing daily attendance record for today
      const { data: existingMuster } = await supabase
        .from('daily_attendance_records')
        .select('*')
        .eq('employee_id', payload.employeeId)
        .eq('date', todayStr)
        .maybeSingle();

      // State Transition Guard: Duplicate Check-In Prevention
      if (payload.eventType === 'CHECK_IN' && existingMuster && existingMuster.check_in_time && !existingMuster.check_out_time) {
        return errorResponse(
          createValidationError('Already checked in today. Please check out before recording a new check-in.', 'eventType')
        );
      }

      // State Transition Guard: Invalid Check-Out without Prior Check-In
      if (payload.eventType === 'CHECK_OUT' && (!existingMuster || !existingMuster.check_in_time)) {
        return errorResponse(
          createValidationError('Cannot check out without an active check-in session for today.', 'eventType')
        );
      }

      // 1. Insert Raw Punch Event into attendance_events (Append-only)
      const { data: eventData, error: eventErr } = await supabase
        .from('attendance_events')
        .insert({
          client_id: payload.clientId,
          employee_id: payload.employeeId,
          event_type: payload.eventType,
          timestamp: new Date().toISOString(),
          latitude: payload.coords.latitude,
          longitude: payload.coords.longitude,
          accuracy_meters: payload.coords.accuracyMeters || null,
          geofence_status: geofence.geofenceStatus,
          ip_address: payload.ipAddress || '127.0.0.1',
          device_info: payload.deviceInfo || 'Avencis Web Client',
          selfie_url: payload.selfieUrl || null,
          is_suspicious: isSuspicious,
        })
        .select()
        .single();

      if (eventErr || !eventData) {
        return errorResponse(handleSupabaseError(eventErr, 'attendanceService.recordPunch.events'));
      }

      // 2. Update or Insert Daily Attendance Record for today
      let musterData: DailyAttendanceRow;

      if (!existingMuster) {
        // First punch of the day (Check-in)
        const { data: createdMuster, error: createErr } = await supabase
          .from('daily_attendance_records')
          .insert({
            client_id: payload.clientId,
            employee_id: payload.employeeId,
            date: todayStr,
            check_in_time: payload.eventType === 'CHECK_IN' ? timeStr : null,
            check_out_time: payload.eventType === 'CHECK_OUT' ? timeStr : null,
            total_hours: 0,
            status: 'PRESENT',
            location_name: assignedLoc.name,
            is_regularised: false,
          })
          .select()
          .single();

        if (createErr || !createdMuster) {
          return errorResponse(handleSupabaseError(createErr, 'attendanceService.recordPunch.muster'));
        }
        musterData = createdMuster;
      } else {
        // Subsequent punch of the day
        const updates: Partial<DailyAttendanceRow> = {
          updated_at: new Date().toISOString(),
        };

        if (payload.eventType === 'CHECK_IN' && !existingMuster.check_in_time) {
          updates.check_in_time = timeStr;
        } else if (payload.eventType === 'CHECK_OUT') {
          updates.check_out_time = timeStr;
          if (existingMuster.check_in_time) {
            updates.total_hours = calculateWorkingHours(existingMuster.check_in_time, timeStr);
          }
        }

        const { data: updatedMuster, error: updateErr } = await supabase
          .from('daily_attendance_records')
          .update(updates)
          .eq('id', existingMuster.id)
          .select()
          .single();

        if (updateErr || !updatedMuster) {
          return errorResponse(handleSupabaseError(updateErr, 'attendanceService.recordPunch.musterUpdate'));
        }
        musterData = updatedMuster;
      }

      return successResponse({ event: eventData, muster: musterData });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'attendanceService.recordPunch'));
    }
  },

  /**
   * Retrieves today's current punch status and aggregate record for an employee.
   */
  async getTodayAttendance(
    clientId: string,
    employeeId: string,
    date?: string,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<{ muster: DailyAttendanceRow | null; latestEvent: AttendanceEventRow | null }>> {
    if (!clientId || !employeeId) {
      return errorResponse(createValidationError('Both Client ID and Employee ID are required.'));
    }

    if (callerScope?.role === 'employee' && callerScope.employeeId && callerScope.employeeId !== employeeId) {
      return errorResponse(createPermissionError('Access Denied: You may only view your own attendance.'));
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    if (isMockMode()) {
      const records = store.getAttendanceRecords(clientId, targetDate);
      const muster = records.find(r => r.employeeId === employeeId);
      const mockMuster: DailyAttendanceRow | null = muster
        ? {
            id: muster.id,
            client_id: clientId,
            employee_id: employeeId,
            date: targetDate,
            check_in_time: muster.checkInTime || null,
            check_out_time: muster.checkOutTime || null,
            total_hours: muster.totalHours || 0,
            status: (muster.status || 'PRESENT') as DailyAttendanceRow['status'],
            location_name: muster.locationName || 'Work Location',
            is_regularised: muster.isRegularised || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : null;

      return successResponse({ muster: mockMuster, latestEvent: null });
    }

    try {
      const { data: muster } = await supabase
        .from('daily_attendance_records')
        .select('*')
        .eq('client_id', clientId)
        .eq('employee_id', employeeId)
        .eq('date', targetDate)
        .maybeSingle();

      const { data: latestEvent } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('client_id', clientId)
        .eq('employee_id', employeeId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      return successResponse({ muster: muster || null, latestEvent: latestEvent || null });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'attendanceService.getTodayAttendance'));
    }
  },

  /**
   * Retrieves aggregated daily attendance muster records matching filter criteria.
   */
  async getDailyAttendance(
    filter: AttendanceFilter,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<DailyAttendanceRow[]>> {
    if (!filter.clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    // Role boundaries
    if (callerScope?.role) {
      if (callerScope.role === 'employee') {
        if (!callerScope.employeeId) return successResponse([]);
        filter = { ...filter, employeeId: callerScope.employeeId };
      }
      if (callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== filter.clientId) {
        return errorResponse(createPermissionError('Cross-tenant access forbidden.'));
      }
    }

    if (isMockMode()) {
      let records = store.getAttendanceRecords();
      if (filter.clientId) {
        records = records.filter(r => r.clientId === filter.clientId);
      }
      if (filter.employeeId) {
        records = records.filter(r => r.employeeId === filter.employeeId);
      }
      if (filter.date) {
        records = records.filter(r => r.date === filter.date);
      }
      if (filter.status) {
        records = records.filter(r => r.status === filter.status);
      }

      const mockRows: DailyAttendanceRow[] = records.map(r => ({
        id: r.id,
        client_id: r.clientId || filter.clientId,
        employee_id: r.employeeId,
        date: r.date,
        check_in_time: r.checkInTime || null,
        check_out_time: r.checkOutTime || null,
        total_hours: r.totalHours || 0,
        status: (r.status || 'PRESENT') as DailyAttendanceRow['status'],
        location_name: r.locationName || 'Main Office',
        is_regularised: r.isRegularised || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      return successResponse(mockRows);
    }

    try {
      let query = supabase
        .from('daily_attendance_records')
        .select('*')
        .eq('client_id', filter.clientId)
        .order('date', { ascending: false });

      if (filter.employeeId) {
        query = query.eq('employee_id', filter.employeeId);
      }
      if (filter.date) {
        query = query.eq('date', filter.date);
      }
      if (filter.startDate) {
        query = query.gte('date', filter.startDate);
      }
      if (filter.endDate) {
        query = query.lte('date', filter.endDate);
      }
      if (filter.status) {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(handleSupabaseError(error, 'attendanceService.getDailyAttendance'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'attendanceService.getDailyAttendance'));
    }
  },

  /**
   * Retrieves raw immutable attendance events (telemetry audit log).
   */
  async getAttendanceEvents(
    filter: { clientId: string; employeeId?: string; date?: string; limit?: number },
    callerScope?: CallerScope
  ): Promise<ServiceResponse<AttendanceEventRow[]>> {
    if (!filter.clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (callerScope?.role) {
      if (callerScope.role === 'employee') {
        if (!callerScope.employeeId) return successResponse([]);
        filter = { ...filter, employeeId: callerScope.employeeId };
      }
      if (callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== filter.clientId) {
        return errorResponse(createPermissionError('Cross-tenant access forbidden.'));
      }
    }

    if (isMockMode()) {
      let events = store.getAttendanceEvents();
      if (filter.clientId) events = events.filter((e: any) => e.clientId === filter.clientId);
      if (filter.employeeId) events = events.filter((e: any) => e.employeeId === filter.employeeId);

      const mockRows: AttendanceEventRow[] = events.map((e: any) => ({
        id: e.id,
        client_id: e.clientId,
        employee_id: e.employeeId,
        event_type: e.eventType,
        timestamp: e.timestamp,
        latitude: e.latitude ?? e.coords?.lat ?? 18.5204,
        longitude: e.longitude ?? e.coords?.lng ?? 73.8567,
        accuracy_meters: e.accuracyMeters ?? 10,
        geofence_status: e.geofenceStatus,
        ip_address: e.ipAddress || '127.0.0.1',
        device_info: e.deviceInfo,
        selfie_url: null,
        is_suspicious: e.isSuspicious ?? false,
      }));

      return successResponse(mockRows.slice(0, filter.limit || 50));
    }

    try {
      let query = supabase
        .from('attendance_events')
        .select('*')
        .eq('client_id', filter.clientId)
        .order('timestamp', { ascending: false });

      if (filter.employeeId) {
        query = query.eq('employee_id', filter.employeeId);
      }
      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(handleSupabaseError(error, 'attendanceService.getAttendanceEvents'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'attendanceService.getAttendanceEvents'));
    }
  },

  /**
   * Submits an attendance regularisation request.
   */
  async submitRegularisation(
    payload: RegularisationRequestPayload,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<AttendanceCorrectionRow>> {
    if (!payload.clientId || !payload.employeeId) {
      return errorResponse(createValidationError('Client ID and Employee ID are required.'));
    }
    if (!payload.date) {
      return errorResponse(createValidationError('Date is required.', 'date'));
    }
    if (!payload.requestedCheckIn || !payload.requestedCheckOut) {
      return errorResponse(createValidationError('Requested check-in and check-out times are required.'));
    }
    if (!payload.reason || payload.reason.trim().length < 5) {
      return errorResponse(createValidationError('A substantive reason (at least 5 characters) is required.', 'reason'));
    }

    if (callerScope?.role === 'employee' && callerScope.employeeId && callerScope.employeeId !== payload.employeeId) {
      return errorResponse(createPermissionError('Access Denied: You may only apply for your own regularisations.'));
    }

    if (isMockMode()) {
      const emp = store.getEmployee(payload.employeeId);
      const createdCorr = store.submitCorrection({
        clientId: payload.clientId,
        employeeId: payload.employeeId,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Employee',
        date: payload.date,
        requestedCheckIn: payload.requestedCheckIn,
        requestedCheckOut: payload.requestedCheckOut,
        reason: payload.reason,
      });

      const mockCorrection: AttendanceCorrectionRow = {
        id: createdCorr.id,
        client_id: payload.clientId,
        employee_id: payload.employeeId,
        date: payload.date,
        original_check_in: payload.originalCheckIn || null,
        original_check_out: payload.originalCheckOut || null,
        requested_check_in: payload.requestedCheckIn,
        requested_check_out: payload.requestedCheckOut,
        reason: payload.reason,
        manager_remarks: null,
        status: 'PENDING',
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      };
      return successResponse(mockCorrection);
    }

    try {
      const { data, error } = await supabase
        .from('attendance_corrections')
        .insert({
          client_id: payload.clientId,
          employee_id: payload.employeeId,
          date: payload.date,
          original_check_in: payload.originalCheckIn || null,
          original_check_out: payload.originalCheckOut || null,
          requested_check_in: payload.requestedCheckIn,
          requested_check_out: payload.requestedCheckOut,
          reason: payload.reason,
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'attendanceService.submitRegularisation'));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'attendanceService.submitRegularisation'));
    }
  },

  /**
   * Alias for submitRegularisation
   */
  submitAttendanceCorrection(payload: RegularisationRequestPayload, callerScope?: CallerScope) {
    return this.submitRegularisation(payload, callerScope);
  },

  /**
   * Retrieves attendance regularisation requests.
   */
  async getRegularisationRequests(
    filter: {
      clientId: string;
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
      employeeId?: string;
    },
    callerScope?: CallerScope
  ): Promise<ServiceResponse<AttendanceCorrectionRow[]>> {
    if (!filter.clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (callerScope?.role) {
      if (callerScope.role === 'employee') {
        if (!callerScope.employeeId) return successResponse([]);
        filter = { ...filter, employeeId: callerScope.employeeId };
      }
      if (callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== filter.clientId) {
        return errorResponse(createPermissionError('Cross-tenant access forbidden.'));
      }
    }

    if (isMockMode()) {
      let corrs = store.getCorrections();
      if (filter.clientId) {
        corrs = corrs.filter(c => c.clientId === filter.clientId);
      }
      if (filter.employeeId) {
        corrs = corrs.filter(c => c.employeeId === filter.employeeId);
      }
      if (filter.status) {
        corrs = corrs.filter(c => c.status === filter.status);
      }

      const mockRows: AttendanceCorrectionRow[] = corrs.map(c => ({
        id: c.id,
        client_id: c.clientId || filter.clientId,
        employee_id: c.employeeId,
        date: c.date,
        original_check_in: null,
        original_check_out: null,
        requested_check_in: c.requestedCheckIn,
        requested_check_out: c.requestedCheckOut,
        reason: c.reason,
        manager_remarks: c.managerRemarks || null,
        status: c.status as AttendanceCorrectionRow['status'],
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      }));
      return successResponse(mockRows);
    }

    try {
      let query = supabase
        .from('attendance_corrections')
        .select('*')
        .eq('client_id', filter.clientId)
        .order('created_at', { ascending: false });

      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      if (filter.employeeId) {
        query = query.eq('employee_id', filter.employeeId);
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(handleSupabaseError(error, 'attendanceService.getRegularisationRequests'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'attendanceService.getRegularisationRequests'));
    }
  },

  /**
   * Approves or rejects a regularisation request (Managerial Action).
   * Enforces Corporate Governance Anti-Self-Approval Rule.
   */
  async reviewRegularisation(
    id: string,
    decision: {
      status: 'APPROVED' | 'REJECTED';
      reviewerId: string;
      remarks?: string;
    },
    callerScope?: CallerScope
  ): Promise<ServiceResponse<AttendanceCorrectionRow>> {
    if (!id) return errorResponse(createValidationError('Correction ID is required.', 'id'));
    if (!decision.reviewerId) return errorResponse(createValidationError('Reviewer ID is required.', 'reviewerId'));

    // 1. Role Authorization Check
    if (callerScope?.role && !REGULARISATION_REVIEW_ROLES.includes(callerScope.role)) {
      return errorResponse(createPermissionError('Access Denied: Only managers and administrators may review attendance regularisations.'));
    }

    if (isMockMode()) {
      const correction = store.getCorrections().find(c => c.id === id);
      if (!correction) return errorResponse(createNotFoundError('Regularisation Request', id));

      // 2. Anti-Self-Approval Enforcement Check
      if (correction.employeeId === decision.reviewerId) {
        return errorResponse(
          createPermissionError('Corporate Governance Violation: Employees cannot approve their own regularisation requests.')
        );
      }

      store.reviewCorrection(id, decision.status, decision.remarks || 'Approved by Manager');
      const updated = store.getCorrections().find(c => c.id === id);
      if (!updated) return errorResponse(createNotFoundError('Regularisation Request', id));

      return successResponse<AttendanceCorrectionRow>({
        id: updated.id,
        client_id: updated.clientId || 'client-suman',
        employee_id: updated.employeeId,
        date: updated.date,
        original_check_in: null,
        original_check_out: null,
        requested_check_in: updated.requestedCheckIn,
        requested_check_out: updated.requestedCheckOut,
        reason: updated.reason,
        manager_remarks: decision.remarks || null,
        status: decision.status,
        reviewed_by: decision.reviewerId,
        reviewed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    try {
      // Fetch existing correction for anti-self-approval validation
      const { data: existingCorr, error: fetchErr } = await supabase
        .from('attendance_corrections')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !existingCorr) {
        return errorResponse(createNotFoundError('Regularisation Request', id));
      }

      // Anti-Self-Approval Enforcement Check
      if (existingCorr.employee_id === decision.reviewerId) {
        return errorResponse(
          createPermissionError('Corporate Governance Violation: Employees cannot approve their own regularisation requests.')
        );
      }

      const { data, error } = await supabase
        .from('attendance_corrections')
        .update({
          status: decision.status,
          reviewed_by: decision.reviewerId,
          reviewed_at: new Date().toISOString(),
          manager_remarks: decision.remarks || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'attendanceService.reviewRegularisation'));
      }

      // If approved, update daily_attendance_records to reflect adjusted check-in and check-out
      if (decision.status === 'APPROVED' && data) {
        await supabase
          .from('daily_attendance_records')
          .update({
            check_in_time: data.requested_check_in,
            check_out_time: data.requested_check_out,
            is_regularised: true,
            status: 'PRESENT',
            updated_at: new Date().toISOString(),
          })
          .eq('employee_id', data.employee_id)
          .eq('date', data.date);
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'attendanceService.reviewRegularisation'));
    }
  },
};
