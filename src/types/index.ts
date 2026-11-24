export type UserRole = 
  | 'super_admin' 
  | 'hr_admin' 
  | 'payroll_admin' 
  | 'client_admin' 
  | 'client_manager' 
  | 'location_manager' 
  | 'employee';

export interface User {
  id: string;
  email: string;
  fullName: string;
  name?: string;
  role: UserRole;
  clientId?: string;
  clientName?: string;
  employeeId?: string;
  avatarUrl?: string;
}

export interface Client {
  id: string;
  name: string;
  code: string;
  industry: string;
  status: 'onboarding' | 'active' | 'suspended';
  employeeCount: number;
  activeLocationsCount: number;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: string;
  logoUrl?: string;
}

export interface ClientLegalEntity {
  id: string;
  clientId: string;
  legalName: string;
  registrationNumber?: string;
  tradeName?: string;
  registrationType?: string;
  pan?: string;
  panNumber?: string;
  tan?: string;
  gstin?: string;
  pfEstablishmentCode?: string;
  esicRegistrationCode?: string;
  registeredAddress: string;
  isPrimary?: boolean;
}

export interface WorkLocation {
  id: string;
  clientId: string;
  name: string;
  code?: string;
  address: string;
  state?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  activeHeadcount: number;
}

export interface Department {
  id: string;
  clientId: string;
  name: string;
  code: string;
  headOfDepartment?: string;
  headEmployeeId?: string;
}

export interface ClientPolicy {
  id: string;
  clientId: string;
  isConfigured: boolean;
  
  // 1 & 2: Overtime
  overtimeMethod: 'multiplier' | 'flat_rate' | 'comp_off' | 'disabled';
  overtimeRate: number; // e.g. 1.5
  
  // 3 & 4: Late Arrival
  lateGraceMinutes: number; // e.g. 10
  latePenaltyRule: 'none' | 'deduct_half_day_per_3' | 'deduct_cl';
  
  // 5: Overnight Shift Handling
  overnightShiftAttribution: 'shift_start_date' | 'shift_end_date';
  
  // 6: Working Hours
  standardWorkingHours: number; // e.g. 9.0
  halfDayHours: number; // e.g. 4.5
  
  // 7: Weekly Offs
  weeklyOffDays: ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY')[];
  
  // 8, 9, 10, 11: Telemetry & Verification
  attendanceTrackingMode: 'double_punch' | 'single_punch';
  requireGps: boolean;
  requireSelfie: boolean;
  enforceStrictGeofence: boolean;
  
  // 12, 13, 14, 15, 16, 17: Leave Management
  leaveTypesSupported: ('PL' | 'CL' | 'SL' | 'COMP_OFF' | 'LWP')[];
  minServiceDaysForLeave: number;
  monthlyPaidLeaveAccrual: number; // e.g. 2.0
  maxCarryForward: number; // e.g. 30
  allowLeaveEncashment: boolean;
  unpaidLeaveDeductionFormula: 'per_day_proration';
  
  // 18, 19, 20: Payroll & Statutory
  salaryDivisor: '26' | '30' | 'calendar_days';
  pfEnabled: boolean;
  pfEmployeePercent: number; // 12%
  pfEmployerPercent: number; // 12%
  esicEnabled: boolean;
  esicEmployeePercent: number; // 0.75%
  esicEmployerPercent: number; // 3.25%
  ptEnabled: boolean;
  tdsEnabled: boolean;
  pfUncappedBasic?: boolean;
  
  updatedAt: string;
  updatedBy: string;
}

export interface UserWorkLocation {
  id: string;
  userId: string;
  workLocationId: string;
  createdAt?: string;
}

export interface Employee {
  id: string;
  clientId: string;
  legalEntityId: string;
  workLocationId: string;
  departmentId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  designation: string;
  joiningDate: string;
  employmentType: 'FULL_TIME' | 'CONTRACT' | 'INTERN';
  status: 'ACTIVE' | 'ON_NOTICE' | 'TERMINATED';
  managerId?: string;
  lastWorkingDay?: string;
  terminationReason?: string;
  
  // Compensation
  fixedMonthlySalary: number;
  variableIncentive: number;
  otherAllowances: number;
  
  // Bank & Statutory
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  panNumber: string;
  aadhaarNumber: string;
  uanNumber?: string;
  esicNumber?: string;
  
  avatarUrl?: string;
}

export interface AttendanceEvent {
  id: string;
  clientId: string;
  employeeId: string;
  employeeName: string;
  eventType: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END';
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  geofenceStatus: 'WITHIN_GEOFENCE' | 'OUT_OF_BOUNDS' | 'EXCEPTION_ALLOWED';
  ipAddress: string;
  deviceInfo: string;
  isSuspicious?: boolean;
}

export interface DailyAttendanceRecord {
  id: string;
  clientId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string;
  checkOutTime?: string;
  totalHours: number;
  status: 'PRESENT' | 'HALF_DAY' | 'LATE' | 'ON_DUTY' | 'ABSENT' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'WEEKLY_OFF' | 'HOLIDAY';
  leaveRequestId?: string;
  locationName: string;
  isRegularised: boolean;
}

export interface AttendanceCorrection {
  id: string;
  clientId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  managerRemarks?: string;
  createdAt: string;
}

export interface LeaveBalance {
  id: string;
  clientId: string;
  employeeId: string;
  leaveType: 'PL' | 'CL' | 'SL' | 'COMP_OFF';
  year?: number;
  opening: number;
  credited: number;
  used: number;
  closing: number;
}

export interface LeaveRequest {
  id: string;
  clientId: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'PL' | 'CL' | 'SL' | 'COMP_OFF' | 'LWP';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  managerRemarks?: string;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  clientId: string;
  periodMonth: number; // 1 - 12
  periodYear: number;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  status: 'draft' | 'validated' | 'under_review' | 'approved' | 'locked';
  processedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  policySnapshot?: Partial<ClientPolicy>;
  items?: PayrollItem[];
}

export interface PayrollItem {
  id: string;
  runId: string;
  clientId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  fixedSalary: number;
  incentives: number;
  otherAllowances: number;
  calendarDays: number;
  paidDays: number;
  unpaidDays: number;
  grossEarned: number;
  unpaidDeduction: number;
  pfDeduction: number;
  esicDeduction: number;
  ptDeduction: number;
  tdsDeduction: number;
  totalDeductions: number;
  netSalary: number;
  basicPay?: number;
  hra?: number;
  conveyance?: number;
  specialAllowance?: number;
  overtimePay?: number;
  pfEmployer?: number;
  esicEmployer?: number;
}

export interface Payslip {
  id: string;
  clientId: string;
  payrollItemId: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  revisionNumber: number;
  storagePdfUrl?: string | null;
  generatedAt: string;
  isPublished: boolean;
  employeeName?: string;
  employeeCode?: string;
  designation?: string;
  netSalary?: number;
}

export interface AuditLog {
  id: string;
  clientId?: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  targetEntity: string;
  targetId?: string;
  details: string;
  ipAddress: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}
