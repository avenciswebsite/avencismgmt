import { 
  Client, 
  ClientLegalEntity, 
  WorkLocation, 
  Department, 
  ClientPolicy, 
  Employee, 
  DailyAttendanceRecord, 
  AttendanceEvent, 
  AttendanceCorrection, 
  LeaveBalance, 
  LeaveRequest, 
  PayrollRun, 
  PayrollItem, 
  Payslip,
  AuditLog, 
  User 
} from '../types';
import { 
  INITIAL_USERS, 
  INITIAL_CLIENTS, 
  INITIAL_LEGAL_ENTITIES, 
  INITIAL_LOCATIONS, 
  INITIAL_DEPARTMENTS, 
  INITIAL_POLICIES, 
  INITIAL_EMPLOYEES, 
  INITIAL_ATTENDANCE_RECORDS, 
  INITIAL_CORRECTIONS, 
  INITIAL_LEAVE_BALANCES, 
  INITIAL_LEAVE_REQUESTS, 
  INITIAL_PAYROLL_RUNS, 
  INITIAL_AUDIT_LOGS 
} from './mockData';
import { calculateEffectiveLeaveDays } from '../services/leaveCalculationHelper';
import {
  aggregateMonthlyAttendance,
  calculateEarningsBreakdown,
  calculateStatutoryDeductions,
  calculateProrationRatio,
  calculateEmployeePayrollItem,
  getDaysInMonth,
} from '../services/payrollCalculationHelper';

class AppStore {
  private users: User[] = [...INITIAL_USERS];
  private clients: Client[] = [...INITIAL_CLIENTS];
  private legalEntities: ClientLegalEntity[] = [...INITIAL_LEGAL_ENTITIES];
  private locations: WorkLocation[] = [...INITIAL_LOCATIONS];
  private departments: Department[] = [...INITIAL_DEPARTMENTS];
  private policies: Record<string, ClientPolicy> = { ...INITIAL_POLICIES };
  private employees: Employee[] = [...INITIAL_EMPLOYEES];
  private attendanceRecords: DailyAttendanceRecord[] = [...INITIAL_ATTENDANCE_RECORDS];
  private attendanceEvents: AttendanceEvent[] = [];
  private corrections: AttendanceCorrection[] = [...INITIAL_CORRECTIONS];
  private leaveBalances: LeaveBalance[] = [...INITIAL_LEAVE_BALANCES];
  private leaveRequests: LeaveRequest[] = [...INITIAL_LEAVE_REQUESTS];
  private payrollRuns: PayrollRun[] = [...INITIAL_PAYROLL_RUNS];
  private payslips: Payslip[] = [];
  private auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];

  constructor() {
    this.loadFromStorage();
  }

  public saveToStorage() {
    try {
      localStorage.setItem('avencis_wfm_clients', JSON.stringify(this.clients));
      localStorage.setItem('avencis_wfm_employees', JSON.stringify(this.employees));
      localStorage.setItem('avencis_wfm_policies', JSON.stringify(this.policies));
      localStorage.setItem('avencis_wfm_attendance', JSON.stringify(this.attendanceRecords));
      localStorage.setItem('avencis_wfm_leave_requests', JSON.stringify(this.leaveRequests));
      localStorage.setItem('avencis_wfm_payroll_runs', JSON.stringify(this.payrollRuns));
      localStorage.setItem('avencis_wfm_payslips', JSON.stringify(this.payslips));
      localStorage.setItem('avencis_wfm_audit_logs', JSON.stringify(this.auditLogs));
    } catch (e) {
      // LocalStorage fallback for non-browser or sandbox environments
    }
  }

  private loadFromStorage() {
    try {
      const c = localStorage.getItem('avencis_wfm_clients');
      if (c) this.clients = JSON.parse(c);
      const e = localStorage.getItem('avencis_wfm_employees');
      if (e) this.employees = JSON.parse(e);
      const p = localStorage.getItem('avencis_wfm_policies');
      if (p) this.policies = JSON.parse(p);
      const a = localStorage.getItem('avencis_wfm_attendance');
      if (a) this.attendanceRecords = JSON.parse(a);
      const l = localStorage.getItem('avencis_wfm_leave_requests');
      if (l) this.leaveRequests = JSON.parse(l);
      const pr = localStorage.getItem('avencis_wfm_payroll_runs');
      if (pr) this.payrollRuns = JSON.parse(pr);
      const ps = localStorage.getItem('avencis_wfm_payslips');
      if (ps) this.payslips = JSON.parse(ps);
      const al = localStorage.getItem('avencis_wfm_audit_logs');
      if (al) this.auditLogs = JSON.parse(al);
    } catch (e) {
      // Use in-memory defaults
    }
  }

  // --- Users & Auth ---
  getUsers(): User[] {
    return this.users;
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  // --- Clients & Onboarding ---
  getClients(): Client[] {
    return this.clients;
  }

  getClient(id: string): Client | undefined {
    return this.clients.find(c => c.id === id);
  }

  createClient(clientData: Omit<Client, 'id' | 'createdAt' | 'employeeCount' | 'activeLocationsCount'>): Client {
    const newClient: Client = {
      ...clientData,
      id: `client-${clientData.code.toLowerCase()}-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      employeeCount: 0,
      activeLocationsCount: 0,
    };
    this.clients.unshift(newClient);
    
    // Initialize unconfigured policy
    this.policies[newClient.id] = {
      id: `pol-${newClient.id}`,
      clientId: newClient.id,
      isConfigured: false,
      overtimeMethod: 'disabled',
      overtimeRate: 1.0,
      lateGraceMinutes: 0,
      latePenaltyRule: 'none',
      overnightShiftAttribution: 'shift_start_date',
      standardWorkingHours: 9.0,
      halfDayHours: 4.5,
      weeklyOffDays: ['SUNDAY'],
      attendanceTrackingMode: 'double_punch',
      requireGps: true,
      requireSelfie: false,
      enforceStrictGeofence: true,
      leaveTypesSupported: ['PL', 'CL', 'SL', 'LWP'],
      minServiceDaysForLeave: 30,
      monthlyPaidLeaveAccrual: 2.0,
      maxCarryForward: 30,
      allowLeaveEncashment: false,
      unpaidLeaveDeductionFormula: 'per_day_proration',
      salaryDivisor: '30',
      pfEnabled: false,
      pfEmployeePercent: 0,
      pfEmployerPercent: 0,
      esicEnabled: false,
      esicEmployeePercent: 0,
      esicEmployerPercent: 0,
      ptEnabled: false,
      tdsEnabled: false,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Onboarding Initialiser',
    };

    this.logAction('CLIENT_ONBOARD', 'Client', newClient.id, `Created new client organisation: ${newClient.name} (${newClient.code})`);
    this.saveToStorage();
    return newClient;
  }

  updateClient(clientId: string, updates: Partial<Client>): Client | undefined {
    const client = this.getClient(clientId);
    if (client) {
      Object.assign(client, updates);
      this.logAction('CLIENT_UPDATE', 'Client', clientId, `Updated client organisation: ${client.name}`);
      this.saveToStorage();
      return client;
    }
    return undefined;
  }

  updateClientStatus(clientId: string, status: 'onboarding' | 'active' | 'suspended') {
    const client = this.getClient(clientId);
    if (client) {
      client.status = status;
      this.logAction('CLIENT_STATUS_CHANGE', 'Client', clientId, `Updated status to ${status}`);
      this.saveToStorage();
    }
  }

  // --- Legal Entities ---
  getLegalEntities(clientId: string): ClientLegalEntity[] {
    return this.legalEntities.filter(le => le.clientId === clientId);
  }

  addLegalEntity(entity: Omit<ClientLegalEntity, 'id'>): ClientLegalEntity {
    const newEntity: ClientLegalEntity = {
      ...entity,
      id: `le-${Date.now().toString(36)}`,
    };
    this.legalEntities.push(newEntity);
    this.logAction('LEGAL_ENTITY_CREATE', 'ClientLegalEntity', newEntity.id, `Added legal entity: ${newEntity.legalName}`);
    return newEntity;
  }

  // --- Locations & Departments ---
  getLocations(clientId: string): WorkLocation[] {
    return this.locations.filter(l => l.clientId === clientId);
  }

  addLocation(loc: Omit<WorkLocation, 'id' | 'activeHeadcount'>): WorkLocation {
    const newLoc: WorkLocation = {
      ...loc,
      id: `loc-${Date.now().toString(36)}`,
      activeHeadcount: 0,
    };
    this.locations.push(newLoc);
    const client = this.getClient(loc.clientId);
    if (client) client.activeLocationsCount++;
    this.logAction('LOCATION_CREATE', 'WorkLocation', newLoc.id, `Added work location: ${newLoc.name}`);
    this.saveToStorage();
    return newLoc;
  }

  updateLocation(locationId: string, updates: Partial<WorkLocation>): WorkLocation | undefined {
    const loc = this.locations.find(l => l.id === locationId);
    if (loc) {
      Object.assign(loc, updates);
      this.logAction('LOCATION_UPDATE', 'WorkLocation', locationId, `Updated work location & geofence: ${loc.name}`);
      this.saveToStorage();
      return loc;
    }
    return undefined;
  }

  deleteLocation(locationId: string): boolean {
    const idx = this.locations.findIndex(l => l.id === locationId);
    if (idx !== -1) {
      const loc = this.locations[idx];
      this.locations.splice(idx, 1);
      const client = this.getClient(loc.clientId);
      if (client && client.activeLocationsCount > 0) client.activeLocationsCount--;
      this.logAction('LOCATION_DELETE', 'WorkLocation', locationId, `Deleted work location: ${loc.name}`);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  getDepartments(clientId: string): Department[] {
    return this.departments.filter(d => d.clientId === clientId);
  }

  // --- Client Policies ---
  getClientPolicy(clientId: string): ClientPolicy {
    if (!this.policies[clientId]) {
      this.policies[clientId] = {
        id: `pol-${clientId}`,
        clientId,
        isConfigured: false,
        overtimeMethod: 'disabled',
        overtimeRate: 1.0,
        lateGraceMinutes: 0,
        latePenaltyRule: 'none',
        overnightShiftAttribution: 'shift_start_date',
        standardWorkingHours: 9.0,
        halfDayHours: 4.5,
        weeklyOffDays: ['SUNDAY'],
        attendanceTrackingMode: 'double_punch',
        requireGps: true,
        requireSelfie: false,
        enforceStrictGeofence: true,
        leaveTypesSupported: ['PL', 'CL', 'SL', 'LWP'],
        minServiceDaysForLeave: 30,
        monthlyPaidLeaveAccrual: 2.0,
        maxCarryForward: 30,
        allowLeaveEncashment: false,
        unpaidLeaveDeductionFormula: 'per_day_proration',
        salaryDivisor: '30',
        pfEnabled: false,
        pfEmployeePercent: 0,
        pfEmployerPercent: 0,
        esicEnabled: false,
        esicEmployeePercent: 0,
        esicEmployerPercent: 0,
        ptEnabled: false,
        tdsEnabled: false,
        updatedAt: new Date().toISOString(),
        updatedBy: 'System Auto-Generated',
      };
    }
    return this.policies[clientId];
  }

  updateClientPolicy(clientId: string, updates: Partial<ClientPolicy>, updatedBy = 'Administrator'): ClientPolicy {
    const policy = this.getClientPolicy(clientId);
    Object.assign(policy, updates, {
      isConfigured: true,
      updatedAt: new Date().toISOString(),
      updatedBy,
    });
    this.logAction('POLICY_UPDATE', 'ClientPolicy', policy.id, `Updated client policy settings for client ${clientId}`);
    this.saveToStorage();
    return policy;
  }

  // --- Employees ---
  getEmployees(clientId?: string): Employee[] {
    if (clientId) {
      return this.employees.filter(e => e.clientId === clientId);
    }
    return this.employees;
  }

  getEmployee(id: string): Employee | undefined {
    return this.employees.find(e => e.id === id);
  }

  addEmployee(empData: Omit<Employee, 'id'>): Employee {
    const newEmp: Employee = {
      ...empData,
      id: `emp-${Date.now().toString(36)}`,
    };
    this.employees.unshift(newEmp);
    
    // Update client employee count
    const client = this.getClient(empData.clientId);
    if (client) client.employeeCount++;

    // Initialise default leave balances
    const leaveTypes: ('PL' | 'CL' | 'SL')[] = ['PL', 'CL', 'SL'];
    leaveTypes.forEach(lt => {
      this.leaveBalances.push({
        id: `lb-${newEmp.id}-${lt}`,
        clientId: newEmp.clientId,
        employeeId: newEmp.id,
        leaveType: lt,
        opening: 2,
        credited: 0,
        used: 0,
        closing: 2,
      });
    });

    this.logAction('EMPLOYEE_CREATE', 'Employee', newEmp.id, `Onboarded employee: ${newEmp.firstName} ${newEmp.lastName} (${newEmp.employeeCode})`);
    this.saveToStorage();
    return newEmp;
  }

  // --- Attendance ---
  getAttendanceRecords(clientId?: string, date?: string): DailyAttendanceRecord[] {
    let records = this.attendanceRecords;
    if (clientId) {
      records = records.filter(r => r.clientId === clientId);
    }
    if (date) {
      records = records.filter(r => r.date === date);
    }
    return records;
  }

  recordPunch(
    clientId: string, 
    employeeId: string, 
    eventType: 'CHECK_IN' | 'CHECK_OUT', 
    coords: { lat: number; lng: number },
    deviceInfo = 'Chrome Mobile on Android'
  ): { record: DailyAttendanceRecord; event: AttendanceEvent } {
    const employee = this.getEmployee(employeeId);
    if (!employee) throw new Error('Employee not found');

    const policy = this.getClientPolicy(clientId);
    const today = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Validate location distance vs geofence
    // Check against all authorized client locations: if employee is within ANY authorized location's geofence radius, accept it!
    const clientLocations = this.locations.filter(l => l.clientId === clientId);
    const assignedLocation = this.locations.find(l => l.id === employee.workLocationId) || clientLocations[0] || this.locations[0];
    
    let matchedLocation = assignedLocation;
    let withinGeofence = false;
    let distanceMeters = this.calculateDistance(coords.lat, coords.lng, assignedLocation.latitude, assignedLocation.longitude);
    if (distanceMeters <= (assignedLocation.radiusMeters || 150)) {
      withinGeofence = true;
      matchedLocation = assignedLocation;
    } else {
      // Evaluate other active working sites for this client
      for (const loc of clientLocations) {
        const d = this.calculateDistance(coords.lat, coords.lng, loc.latitude, loc.longitude);
        if (d <= (loc.radiusMeters || 150)) {
          withinGeofence = true;
          distanceMeters = d;
          matchedLocation = loc;
          break;
        }
      }
    }
    const location = matchedLocation;
    const geofenceStatus = withinGeofence ? 'WITHIN_GEOFENCE' : 'OUT_OF_BOUNDS';

    // Anti-spoofing heuristic: flag if out of bounds and strict geofence is mandated
    const isSuspicious = !withinGeofence && policy.enforceStrictGeofence;

    // 1. Immutable Event
    const event: AttendanceEvent = {
      id: `evt-${Date.now().toString(36)}`,
      clientId,
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      eventType,
      timestamp: new Date().toISOString(),
      latitude: coords.lat,
      longitude: coords.lng,
      accuracyMeters: 12.5,
      geofenceStatus,
      ipAddress: '103.21.124.8',
      deviceInfo,
      isSuspicious,
    };
    this.attendanceEvents.unshift(event);

    // 2. Aggregate Daily Record
    let daily = this.attendanceRecords.find(r => r.employeeId === employeeId && r.date === today);
    if (!daily) {
      daily = {
        id: `att-${Date.now().toString(36)}`,
        clientId,
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        date: today,
        checkInTime: nowTimeStr,
        totalHours: 0,
        status: 'PRESENT',
        locationName: location.name,
        isRegularised: false,
      };
      this.attendanceRecords.unshift(daily);
    } else {
      if (eventType === 'CHECK_IN' && !daily.checkInTime) {
        daily.checkInTime = nowTimeStr;
        daily.status = 'PRESENT';
      } else if (eventType === 'CHECK_OUT') {
        daily.checkOutTime = nowTimeStr;
        daily.totalHours = 8.5; // Calculated session duration
      }
    }

    this.logAction(
      eventType, 
      'AttendanceEvent', 
      event.id, 
      `Recorded ${eventType} for ${employee.firstName} ${employee.lastName} (${geofenceStatus})`
    );
    this.saveToStorage();
    return { record: daily, event };
  }

  getAttendanceEvents(clientId?: string): AttendanceEvent[] {
    if (clientId) {
      return this.attendanceEvents.filter(e => e.clientId === clientId);
    }
    return this.attendanceEvents;
  }

  // --- Attendance Corrections ---
  getCorrections(clientId?: string): AttendanceCorrection[] {
    if (clientId) {
      return this.corrections.filter(c => c.clientId === clientId);
    }
    return this.corrections;
  }

  submitCorrection(corr: Omit<AttendanceCorrection, 'id' | 'status' | 'createdAt'>): AttendanceCorrection {
    const newCorr: AttendanceCorrection = {
      ...corr,
      id: `corr-${Date.now().toString(36)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.corrections.unshift(newCorr);
    this.logAction('REGULARISATION_SUBMIT', 'AttendanceCorrection', newCorr.id, `Correction requested by ${newCorr.employeeName} for ${newCorr.date}`);
    this.saveToStorage();
    return newCorr;
  }

  reviewCorrection(id: string, status: 'APPROVED' | 'REJECTED', managerRemarks: string) {
    const corr = this.corrections.find(c => c.id === id);
    if (corr) {
      corr.status = status;
      corr.managerRemarks = managerRemarks;

      if (status === 'APPROVED') {
        // Overlay update on daily record
        const daily = this.attendanceRecords.find(r => r.employeeId === corr.employeeId && r.date === corr.date);
        if (daily) {
          daily.checkInTime = corr.requestedCheckIn;
          daily.checkOutTime = corr.requestedCheckOut;
          daily.isRegularised = true;
          daily.status = 'PRESENT';
        }
      }

      this.logAction('REGULARISATION_REVIEW', 'AttendanceCorrection', id, `Marked regularisation ${status} with comment: ${managerRemarks}`);
      this.saveToStorage();
    }
  }

  // --- Leave Management ---
  getLeaveBalances(employeeId: string): LeaveBalance[] {
    return this.leaveBalances.filter(lb => lb.employeeId === employeeId);
  }

  addLeaveBalance(balance: LeaveBalance) {
    this.leaveBalances.push(balance);
  }

  getLeaveRequests(clientId?: string): LeaveRequest[] {
    if (clientId) {
      return this.leaveRequests.filter(lr => lr.clientId === clientId);
    }
    return this.leaveRequests;
  }

  submitLeaveRequest(lr: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>): LeaveRequest {
    const newReq: LeaveRequest = {
      ...lr,
      id: `lr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.leaveRequests.unshift(newReq);
    this.logAction('LEAVE_APPLY', 'LeaveRequest', newReq.id, `${newReq.employeeName} applied for ${newReq.totalDays} day(s) ${newReq.leaveType}`);
    this.saveToStorage();
    return newReq;
  }

  reviewLeaveRequest(id: string, status: 'APPROVED' | 'REJECTED', managerRemarks: string) {
    const req = this.leaveRequests.find(r => r.id === id);
    if (req) {
      // Balance solvency check before approval
      if (status === 'APPROVED' && req.leaveType !== 'LWP') {
        const empBals = this.leaveBalances.filter(b => b.employeeId === req.employeeId && b.leaveType === req.leaveType);
        if (empBals.length > 0) {
          const hasYearSpecific = empBals.some(b => b.year !== undefined);
          if (hasYearSpecific) {
            const clientPol = this.policies[req.clientId];
            const calc = calculateEffectiveLeaveDays({
              startDate: req.startDate,
              endDate: req.endDate,
              weeklyOffDays: clientPol?.weeklyOffDays || ['SUNDAY'],
              isHalfDay: req.totalDays === 0.5,
            });
            for (const [yrStr, days] of Object.entries(calc.daysByYear)) {
              const yr = Number(yrStr);
              const balYr = empBals.find(b => b.year === yr);
              if (balYr) {
                if (balYr.closing < days) {
                  throw new Error(`Insufficient ${req.leaveType} balance for year ${yr}. Available: ${balYr.closing}, Requested: ${days}`);
                }
                balYr.used += days;
                balYr.closing = balYr.opening + balYr.credited - balYr.used;
              }
            }
          } else {
            const bal = empBals[0];
            if (bal.closing < req.totalDays) {
              throw new Error(`Insufficient ${req.leaveType} balance. Available: ${bal.closing}, Requested: ${req.totalDays}`);
            }
            bal.used += req.totalDays;
            bal.closing = bal.opening + bal.credited - bal.used;
          }
        }
      }

      req.status = status;
      req.managerRemarks = managerRemarks;

      // Synchronize approved leave into attendance muster
      if (status === 'APPROVED') {
        const start = new Date(req.startDate);
        const end = new Date(req.endDate);
        const curr = new Date(start);
        const emp = this.getEmployee(req.employeeId);
        const targetStatus = req.leaveType === 'LWP' ? 'UNPAID_LEAVE' : 'PAID_LEAVE';
        const clientPol = this.policies[req.clientId];
        const weeklyOffs = new Set((clientPol?.weeklyOffDays || ['SUNDAY']).map(d => d.toUpperCase()));

        while (curr <= end) {
          const yyyy = curr.getFullYear();
          const mm = String(curr.getMonth() + 1).padStart(2, '0');
          const dd = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][curr.getDay()];
          const isWeeklyOff = weeklyOffs.has(dayName);

          const existingAtt = this.attendanceRecords.find(a => a.employeeId === req.employeeId && a.date === dateStr);
          if (existingAtt) {
            // Never overwrite actual punch telemetry or manual regularisation
            if (existingAtt.checkInTime || existingAtt.totalHours > 0 || existingAtt.isRegularised) {
              existingAtt.leaveRequestId = req.id;
            } else if (isWeeklyOff) {
              existingAtt.status = 'WEEKLY_OFF';
              existingAtt.leaveRequestId = req.id;
            } else {
              existingAtt.status = targetStatus;
              existingAtt.leaveRequestId = req.id;
            }
          } else {
            this.attendanceRecords.push({
              id: `att-l-${Math.random().toString(36).substring(2, 9)}`,
              clientId: req.clientId,
              employeeId: req.employeeId,
              employeeName: req.employeeName,
              employeeCode: emp?.employeeCode || 'EMP',
              date: dateStr,
              totalHours: 0,
              status: isWeeklyOff ? 'WEEKLY_OFF' : targetStatus,
              leaveRequestId: req.id,
              locationName: 'Approved Leave',
              isRegularised: false,
            });
          }
          curr.setDate(curr.getDate() + 1);
        }
      } else if (status === 'REJECTED') {
        // Safe muster reversion: unlink punches/regularisations, remove only synthetic rows
        for (const a of this.attendanceRecords) {
          if (a.leaveRequestId === req.id) {
            if (a.checkInTime || a.totalHours > 0 || a.isRegularised) {
              delete a.leaveRequestId;
            }
          }
        }
        this.attendanceRecords = this.attendanceRecords.filter(a => 
          a.leaveRequestId !== req.id || (a.checkInTime !== undefined || a.totalHours > 0 || a.isRegularised)
        );
      }

      this.logAction('LEAVE_REVIEW', 'LeaveRequest', id, `Reviewed leave request: ${status}`);
      this.saveToStorage();
    }
  }

  cancelLeaveRequest(id: string): LeaveRequest | null {
    const req = this.leaveRequests.find(r => r.id === id);
    if (req && req.status === 'PENDING') {
      req.status = 'CANCELLED';
      for (const a of this.attendanceRecords) {
        if (a.leaveRequestId === req.id && (a.checkInTime || a.totalHours > 0 || a.isRegularised)) {
          delete a.leaveRequestId;
        }
      }
      this.attendanceRecords = this.attendanceRecords.filter(a => 
        a.leaveRequestId !== req.id || (a.checkInTime !== undefined || a.totalHours > 0 || a.isRegularised)
      );
      this.logAction('LEAVE_CANCEL', 'LeaveRequest', id, `Cancelled leave request`);
      this.saveToStorage();
      return req;
    }
    return null;
  }

  // --- Payroll Engine & Calculations ---
  getPayrollRuns(clientId?: string): PayrollRun[] {
    if (clientId) {
      return this.payrollRuns.filter(pr => pr.clientId === clientId);
    }
    return this.payrollRuns;
  }

  verifyAttendanceFinalized(clientId: string, periodMonth: number, periodYear: number): { isFinalized: boolean; pendingCount: number; error?: string } {
    const monthPrefix = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
    const pendingCorrections = this.corrections.filter(
      c => c.clientId === clientId && c.status === 'PENDING' && c.date.startsWith(monthPrefix)
    );
    const pendingLeaves = this.leaveRequests.filter(
      l => l.clientId === clientId && l.status === 'PENDING' && (l.startDate.startsWith(monthPrefix) || l.endDate.startsWith(monthPrefix))
    );
    const totalPending = pendingCorrections.length + pendingLeaves.length;
    if (totalPending > 0) {
      return {
        isFinalized: false,
        pendingCount: totalPending,
        error: `ATTENDANCE_NOT_FINALIZED: Cannot process payroll. ${pendingCorrections.length} pending attendance regularisations and ${pendingLeaves.length} pending leave requests remain unresolved for period ${periodMonth}/${periodYear}.`,
      };
    }
    return { isFinalized: true, pendingCount: 0 };
  }

  getPayslips(filter?: { clientId?: string; employeeId?: string; periodMonth?: number; periodYear?: number }): Payslip[] {
    let list = this.payslips;
    if (filter?.clientId) list = list.filter(p => p.clientId === filter.clientId);
    if (filter?.employeeId) list = list.filter(p => p.employeeId === filter.employeeId);
    if (filter?.periodMonth) list = list.filter(p => p.periodMonth === filter.periodMonth);
    if (filter?.periodYear) list = list.filter(p => p.periodYear === filter.periodYear);
    return list;
  }

  calculatePayrollRun(
    clientId: string, 
    periodMonth: number, 
    periodYear: number, 
    options?: {
      legalEntityId?: string;
      overtimeOverrides?: Record<string, number>;
      incentiveOverrides?: Record<string, number>;
    }
  ): { run: PayrollRun; items: PayrollItem[] } {
    const client = this.getClient(clientId);
    if (!client) throw new Error('Client not found');
    const policy = this.getClientPolicy(clientId);

    if (!policy.isConfigured) {
      throw new Error(`Mandatory policy configuration missing for ${client.name}. Please configure client policies before running payroll.`);
    }

    // 1. Strict Attendance Finalization Gate
    const attCheck = this.verifyAttendanceFinalized(clientId, periodMonth, periodYear);
    if (!attCheck.isFinalized) {
      throw new Error(attCheck.error || 'Attendance not finalized');
    }

    let employees = this.getEmployees(clientId);
    if (options?.legalEntityId) {
      employees = employees.filter(e => e.legalEntityId === options.legalEntityId);
    }

    const daysInMonth = getDaysInMonth(periodMonth, periodYear);
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    const items: PayrollItem[] = employees.map(emp => {
      // Query real daily attendance records for this employee
      const empAttendance = this.attendanceRecords.filter(r => r.employeeId === emp.id);
      const attSummary = aggregateMonthlyAttendance(empAttendance, periodMonth, periodYear, emp.joiningDate);

      // Resolve work location state for PT
      const loc = this.locations.find(l => l.id === emp.workLocationId);
      const locationState = loc?.state || 'Maharashtra';

      const authorisedOvertime = options?.overtimeOverrides?.[emp.id] || 0;
      const authorisedIncentive = options?.incentiveOverrides?.[emp.id];

      const itemCalc = calculateEmployeePayrollItem(
        emp,
        {
          fixedMonthlyBase: emp.fixedMonthlySalary,
          hra: Math.round(emp.fixedMonthlySalary * 0.3),
          conveyance: 1600,
          specialAllowances: Math.round(emp.fixedMonthlySalary * 0.2),
          variableIncentives: emp.variableIncentive,
          tdsWithholdingAmount: (emp as any).tdsWithholdingAmount || (emp.fixedMonthlySalary >= 50000 ? 2500 : 0),
        },
        attSummary,
        policy,
        periodMonth,
        periodYear,
        locationState,
        authorisedOvertime,
        authorisedIncentive
      );

      totalGross += itemCalc.earnings.grossEarned;
      totalDeductions += itemCalc.deductions.totalDeductions;
      totalNet += itemCalc.netSalary;

      return {
        id: `pitem-${emp.id}-${periodMonth}-${periodYear}`,
        runId: `payrun-${clientId}-${periodMonth}-${periodYear}`,
        clientId,
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeCode: emp.employeeCode,
        designation: emp.designation,
        fixedSalary: emp.fixedMonthlySalary,
        incentives: itemCalc.earnings.authorisedIncentives,
        otherAllowances: itemCalc.earnings.otherAllowances,
        calendarDays: daysInMonth,
        paidDays: itemCalc.paidDays,
        unpaidDays: itemCalc.unpaidDays,
        grossEarned: itemCalc.earnings.grossEarned,
        unpaidDeduction: itemCalc.earnings.unpaidLeaveDeduction,
        pfDeduction: itemCalc.deductions.pfEmployee,
        esicDeduction: itemCalc.deductions.esicEmployee,
        ptDeduction: itemCalc.deductions.ptDeduction,
        tdsDeduction: itemCalc.deductions.tdsDeduction,
        totalDeductions: itemCalc.deductions.totalDeductions,
        netSalary: itemCalc.netSalary,
        basicPay: itemCalc.earnings.basicPay,
        hra: itemCalc.earnings.hra,
        conveyance: itemCalc.earnings.conveyance,
        specialAllowance: itemCalc.earnings.specialAllowance,
        overtimePay: itemCalc.earnings.authorisedOvertimePay,
        pfEmployer: itemCalc.deductions.pfEmployer,
        esicEmployer: itemCalc.deductions.esicEmployer,
      };
    });

    const run: PayrollRun = {
      id: `payrun-${clientId}-${periodMonth}-${periodYear}`,
      clientId,
      periodMonth,
      periodYear,
      totalEmployees: employees.length,
      totalGross,
      totalDeductions,
      totalNet,
      status: 'under_review' as any,
      processedAt: new Date().toISOString(),
      policySnapshot: { ...policy },
      items,
    };

    // Upsert run in working payroll runs registry
    const existingIdx = this.payrollRuns.findIndex(r => r.id === run.id);
    if (existingIdx >= 0) {
      if (this.payrollRuns[existingIdx].status !== 'locked') {
        this.payrollRuns[existingIdx] = run;
      }
    } else {
      this.payrollRuns.unshift(run);
    }

    return { run, items };
  }

  saveAndLockPayrollRun(run: PayrollRun, approvedBy: string) {
    const attCheck = this.verifyAttendanceFinalized(run.clientId, run.periodMonth, run.periodYear);
    if (!attCheck.isFinalized) {
      throw new Error(attCheck.error || 'Cannot lock payroll while attendance is unfinalized');
    }

    run.status = 'locked';
    run.approvedAt = new Date().toISOString();
    run.approvedBy = approvedBy;
    (run as any).lockedAt = new Date().toISOString();
    (run as any).lockedBy = approvedBy;

    // Upsert run
    const existingIdx = this.payrollRuns.findIndex(r => r.id === run.id);
    if (existingIdx >= 0) {
      this.payrollRuns[existingIdx] = run;
    } else {
      this.payrollRuns.unshift(run);
    }

    // Generate / update published Form XIX payslips
    if (run.items && run.items.length > 0) {
      run.items.forEach(item => {
        const existingPsIdx = this.payslips.findIndex(
          p => p.employeeId === item.employeeId && p.periodMonth === run.periodMonth && p.periodYear === run.periodYear
        );
        const payslip: Payslip = {
          id: `ps-${item.employeeId}-${run.periodMonth}-${run.periodYear}`,
          clientId: run.clientId,
          payrollItemId: item.id,
          employeeId: item.employeeId,
          periodMonth: run.periodMonth,
          periodYear: run.periodYear,
          revisionNumber: 1,
          storagePdfUrl: null,
          generatedAt: new Date().toISOString(),
          isPublished: true,
          employeeName: item.employeeName,
          employeeCode: item.employeeCode,
          designation: item.designation,
          netSalary: item.netSalary,
        };
        if (existingPsIdx >= 0) {
          this.payslips[existingPsIdx] = payslip;
        } else {
          this.payslips.unshift(payslip);
        }
      });
    }

    this.logAction(
      'PAYROLL_LOCKED', 
      'PayrollRun', 
      run.id, 
      `Authorized and locked payroll for period ${run.periodMonth}/${run.periodYear} (Net: ₹${run.totalNet.toLocaleString('en-IN')})`,
      'critical'
    );
    this.saveToStorage();
  }

  // --- Audit Logs ---
  getAuditLogs(clientId?: string): AuditLog[] {
    if (clientId) {
      return this.auditLogs.filter(l => l.clientId === clientId);
    }
    return this.auditLogs;
  }

  logAction(
    action: string, 
    targetEntity: string, 
    targetId: string, 
    details: string, 
    severity: 'info' | 'warning' | 'critical' = 'info',
    actorName = 'Avencis Global Administrator',
    actorRole: 'super_admin' | 'client_admin' | 'employee' = 'super_admin',
    clientId?: string
  ) {
    const entry: AuditLog = {
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      clientId,
      actorName,
      actorEmail: 'admin@avencis.com',
      actorRole,
      action,
      targetEntity,
      targetId,
      details,
      ipAddress: '103.21.124.5',
      timestamp: new Date().toISOString(),
      severity,
    };
    this.auditLogs.unshift(entry);
    this.saveToStorage();
  }

  // Helper
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const store = new AppStore();
