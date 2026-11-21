/**
 * Avencis Workforce Management (WFM)
 * Shared Service Layer Domain Types & Response Models
 */

import type { Database } from '../types/database.types';
import type { ServiceError } from './serviceErrors';

// Database Row Types
export type ClientRow = Database['public']['Tables']['clients']['Row'];
export type ClientInsert = Database['public']['Tables']['clients']['Insert'];
export type ClientUpdate = Database['public']['Tables']['clients']['Update'];

export type LegalEntityRow = Database['public']['Tables']['client_legal_entities']['Row'];
export type LegalEntityInsert = Database['public']['Tables']['client_legal_entities']['Insert'];
export type LegalEntityUpdate = Database['public']['Tables']['client_legal_entities']['Update'];

export type WorkLocationRow = Database['public']['Tables']['work_locations']['Row'];
export type WorkLocationInsert = Omit<Database['public']['Tables']['work_locations']['Insert'], 'state'> & { state?: string };
export type WorkLocationUpdate = Database['public']['Tables']['work_locations']['Update'];

export type DepartmentRow = Database['public']['Tables']['departments']['Row'];
export type DepartmentInsert = Database['public']['Tables']['departments']['Insert'];
export type DepartmentUpdate = Database['public']['Tables']['departments']['Update'];

export type ClientPolicyRow = Database['public']['Tables']['client_policies']['Row'];
export type ClientPolicyUpdate = Database['public']['Tables']['client_policies']['Update'];

export interface ClientCardSummary {
  client: ClientRow;
  legalEntitiesCount: number;
  locationsCount: number;
  employeeCount: number;
  isPolicyConfigured: boolean;
  primaryLegalEntityName: string;
}

export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
export type EmployeeRow = Database['public']['Tables']['employees']['Row'];
export type EmployeeInsert = Database['public']['Tables']['employees']['Insert'];
export type EmployeeUpdate = Database['public']['Tables']['employees']['Update'];

export type SalaryStructureRow = Database['public']['Tables']['employee_salary_structures']['Row'];
export type SalaryStructureInsert = Database['public']['Tables']['employee_salary_structures']['Insert'];
export type SalaryStructureUpdate = Database['public']['Tables']['employee_salary_structures']['Update'];

export type BankDetailsRow = Database['public']['Tables']['employee_bank_details']['Row'];
export type BankDetailsInsert = Database['public']['Tables']['employee_bank_details']['Insert'];
export type BankDetailsUpdate = Database['public']['Tables']['employee_bank_details']['Update'];

export interface CallerScope {
  role?: string;
  clientId?: string | null;
  employeeId?: string | null;
}

export type AttendanceEventRow = Database['public']['Tables']['attendance_events']['Row'];
export type DailyAttendanceRow = Database['public']['Tables']['daily_attendance_records']['Row'];
export type AttendanceCorrectionRow = Database['public']['Tables']['attendance_corrections']['Row'];

export type LeaveBalanceRow = Database['public']['Tables']['leave_balances']['Row'];
export type LeaveRequestRow = Database['public']['Tables']['leave_requests']['Row'];

export type PayrollRunRow = Database['public']['Tables']['payroll_runs']['Row'];
export type PayrollItemRow = Database['public']['Tables']['payroll_items']['Row'] & {
  basic_pay?: number;
  hra?: number;
  conveyance?: number;
  special_allowance?: number;
  overtime_pay?: number;
  pf_employer?: number;
  esic_employer?: number;
};
export type PayslipRow = Database['public']['Tables']['payslips']['Row'] & {
  employee_name?: string;
  employee_code?: string;
  designation?: string;
  net_salary?: number;
};

export interface AttendanceFinalizationResult {
  isFinalized: boolean;
  pendingCount: number;
  error?: string;
}

export type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];
export type StatutoryHolidayRow = Database['public']['Tables']['statutory_holidays']['Row'];
export type StatutoryPTSlabRow = Database['public']['Tables']['statutory_pt_slabs']['Row'];

/**
 * Standard Result Wrapper returned by every service operation
 */
export interface ServiceResponse<T> {
  data: T | null;
  error: ServiceError | null;
  success: boolean;
}

export function successResponse<T>(data: T): ServiceResponse<T> {
  return { data, error: null, success: true };
}

export function errorResponse<T>(error: ServiceError): ServiceResponse<T> {
  return { data: null, error, success: false };
}

// Domain Filters
export interface EmployeeFilter {
  clientId?: string;
  workLocationId?: string;
  departmentId?: string;
  status?: EmployeeRow['status'];
  employmentArrangement?: EmployeeRow['employment_arrangement'];
  searchQuery?: string;
}

export interface AttendanceFilter {
  clientId: string;
  employeeId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: DailyAttendanceRow['status'];
}

export interface LeaveFilter {
  clientId: string;
  employeeId?: string;
  year?: number;
  status?: LeaveRequestRow['status'];
  leaveType?: LeaveRequestRow['leave_type'];
}

export interface AuditLogFilter {
  clientId?: string;
  actorRole?: string;
  severity?: AuditLogRow['severity'];
  startDate?: string;
  endDate?: string;
  limit?: number;
}

// Telemetry & Geofence Types
export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface GeofenceEvaluation {
  isWithinGeofence: boolean;
  distanceMeters: number;
  thresholdRadiusMeters: number;
  geofenceStatus: 'WITHIN_GEOFENCE' | 'OUT_OF_BOUNDS';
}

export interface RecordPunchPayload {
  clientId: string;
  employeeId: string;
  eventType: 'CHECK_IN' | 'CHECK_OUT';
  coords: Coordinates;
  ipAddress?: string;
  deviceInfo?: string;
  selfieUrl?: string;
  accuracyMeters?: number;
  verificationSource?: string;
  bypassGeofence?: boolean;
}

export interface RegularisationRequestPayload {
  clientId: string;
  employeeId: string;
  date: string;
  originalCheckIn?: string;
  originalCheckOut?: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
}

export interface SubmitLeavePayload {
  clientId: string;
  employeeId: string;
  leaveType: 'PL' | 'CL' | 'SL' | 'COMP_OFF' | 'LWP';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  isHalfDay?: boolean;
}

/**
 * Calculates Great-Circle Distance between two GPS points using the Haversine formula.
 * Earth Radius = 6,371,000 meters.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of the Earth in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c); // Distance rounded to nearest meter
}
