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
  AuditLog, 
  User 
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user-super-admin',
    email: 'admin@avencis.com',
    fullName: 'Avencis Master Super Admin',
    role: 'super_admin',
  },
  {
    id: 'user-superadmin-test',
    email: 'superadmin@avencis.test',
    fullName: 'Avencis Master Super Admin',
    role: 'super_admin',
  },
];

export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_LEGAL_ENTITIES: ClientLegalEntity[] = [];
export const INITIAL_LOCATIONS: WorkLocation[] = [];
export const INITIAL_DEPARTMENTS: Department[] = [];
export const INITIAL_POLICIES: Record<string, ClientPolicy> = {};
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_ATTENDANCE_RECORDS: DailyAttendanceRecord[] = [];
export const INITIAL_CORRECTIONS: AttendanceCorrection[] = [];
export const INITIAL_LEAVE_BALANCES: LeaveBalance[] = [];
export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];
export const INITIAL_PAYROLL_RUNS: PayrollRun[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
