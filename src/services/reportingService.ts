/**
 * Avencis Workforce Management (WFM)
 * Governance Audit Trail & Compliance Reporting Service
 *
 * Implements immutable audit logging, attendance summaries,
 * leave metrics, and structured Form XIX statutory registry exports.
 */

import { supabase } from '../lib/supabase';
import { isMockMode } from './serviceConfig';
import {
  ServiceResponse,
  AuditLogRow,
  AuditLogFilter,
  DailyAttendanceRow,
  successResponse,
  errorResponse,
} from './serviceTypes';
import {
  handleSupabaseError,
  createValidationError,
} from './serviceErrors';
import { store } from '../data/store';

export interface AttendanceSummaryReport {
  clientId: string;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  leaveCount: number;
  regularisedCount: number;
  presenceRatePercent: number;
}

export interface FormXIXRow {
  employeeCode: string;
  employeeName: string;
  designation: string;
  calendarDays: number;
  workedDays: number;
  unpaidDays: number;
  grossEarned: number;
  pfDeduction: number;
  esicDeduction: number;
  ptDeduction: number;
  netPayable: number;
}

export interface FormXIXRegisterData {
  clientId: string;
  periodMonth: number;
  periodYear: number;
  records: FormXIXRow[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}

export const reportingService = {
  /**
   * Retrieves security and compliance audit logs.
   * Scoped by RLS: Super Admin views global logs; Client Admin views tenant-scoped logs.
   */
  async getAuditLogs(filter?: AuditLogFilter): Promise<ServiceResponse<AuditLogRow[]>> {
    if (isMockMode()) {
      let logs = store.getAuditLogs();
      if (filter?.clientId) {
        logs = logs.filter(l => l.clientId === filter.clientId);
      }
      const mockRows: AuditLogRow[] = logs.slice(0, filter?.limit || 50).map(l => ({
        id: l.id,
        client_id: l.clientId || null,
        actor_name: l.actorName,
        actor_email: l.actorName.toLowerCase().replace(/\s+/g, '.') + '@demo.test',
        actor_role: l.actorRole,
        action: l.action,
        target_entity: 'SystemEntity',
        target_id: 'target-01',
        details: l.details,
        ip_address: l.ipAddress || '127.0.0.1',
        timestamp: l.timestamp,
        severity: (l.action.includes('LOCKED') ? 'critical' : 'info') as AuditLogRow['severity'],
      }));
      return successResponse(mockRows);
    }

    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(filter?.limit || 100);

      if (filter?.clientId) {
        query = query.eq('client_id', filter.clientId);
      }
      if (filter?.actorRole) {
        query = query.eq('actor_role', filter.actorRole);
      }
      if (filter?.severity) {
        query = query.eq('severity', filter.severity);
      }
      if (filter?.startDate) {
        query = query.gte('timestamp', filter.startDate);
      }
      if (filter?.endDate) {
        query = query.lte('timestamp', filter.endDate);
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(handleSupabaseError(error, 'reportingService.getAuditLogs'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'reportingService.getAuditLogs'));
    }
  },

  /**
   * Appends an audit event to the immutable compliance ledger.
   */
  async logAuditEvent(event: {
    clientId?: string;
    actorName: string;
    actorEmail: string;
    actorRole: string;
    action: string;
    targetEntity: string;
    targetId: string;
    details: string;
    severity?: 'info' | 'warning' | 'critical';
    ipAddress?: string;
  }): Promise<ServiceResponse<AuditLogRow>> {
    if (!event.action || !event.actorName || !event.targetEntity) {
      return errorResponse(createValidationError('Actor, action, and target entity are required for audit logging.'));
    }

    const eventId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (isMockMode()) {
      const mockLog: AuditLogRow = {
        id: eventId,
        client_id: event.clientId || null,
        actor_name: event.actorName,
        actor_email: event.actorEmail,
        actor_role: event.actorRole,
        action: event.action,
        target_entity: event.targetEntity,
        target_id: event.targetId,
        details: event.details,
        ip_address: event.ipAddress || '127.0.0.1',
        timestamp: new Date().toISOString(),
        severity: event.severity || 'info',
      };
      return successResponse(mockLog);
    }

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          id: eventId,
          client_id: event.clientId || null,
          actor_name: event.actorName,
          actor_email: event.actorEmail,
          actor_role: event.actorRole,
          action: event.action,
          target_entity: event.targetEntity,
          target_id: event.targetId,
          details: event.details,
          severity: event.severity || 'info',
          ip_address: event.ipAddress || '127.0.0.1',
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'reportingService.logAuditEvent'));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'reportingService.logAuditEvent'));
    }
  },

  /**
   * Computes an attendance summary report for a given date range.
   */
  async getAttendanceSummary(
    clientId: string,
    startDate: string,
    endDate: string
  ): Promise<ServiceResponse<AttendanceSummaryReport>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      const records = store.getAttendanceRecords();
      const total = records.length;
      const present = records.filter(r => r.status === 'PRESENT').length;
      const absent = records.filter(r => r.status === 'ABSENT').length;
      const halfDay = records.filter(r => r.status === 'HALF_DAY').length;
      const leave = records.filter(r => r.status === 'PAID_LEAVE').length;
      const regularised = records.filter(r => r.isRegularised).length;

      return successResponse<AttendanceSummaryReport>({
        clientId,
        totalRecords: total,
        presentCount: present,
        absentCount: absent,
        halfDayCount: halfDay,
        leaveCount: leave,
        regularisedCount: regularised,
        presenceRatePercent: total > 0 ? Math.round(((present + halfDay * 0.5) / total) * 100) : 0,
      });
    }

    try {
      const { data, error } = await supabase
        .from('daily_attendance_records')
        .select('status, is_regularised')
        .eq('client_id', clientId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        return errorResponse(handleSupabaseError(error, 'reportingService.getAttendanceSummary'));
      }

      const records = (data || []) as DailyAttendanceRow[];
      const total = records.length;
      const present = records.filter(r => r.status === 'PRESENT').length;
      const absent = records.filter(r => r.status === 'ABSENT').length;
      const halfDay = records.filter(r => r.status === 'HALF_DAY').length;
      const leave = records.filter(r => r.status === 'PAID_LEAVE').length;
      const regularised = records.filter(r => r.is_regularised).length;

      return successResponse<AttendanceSummaryReport>({
        clientId,
        totalRecords: total,
        presentCount: present,
        absentCount: absent,
        halfDayCount: halfDay,
        leaveCount: leave,
        regularisedCount: regularised,
        presenceRatePercent: total > 0 ? Math.round(((present + halfDay * 0.5) / total) * 100) : 0,
      });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'reportingService.getAttendanceSummary'));
    }
  },

  /**
   * Prepares structured register data for statutory Form XIX muster and wage roll exports.
   */
  async getFormXIXData(
    clientId: string,
    periodMonth: number,
    periodYear: number
  ): Promise<ServiceResponse<FormXIXRegisterData>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      return successResponse<FormXIXRegisterData>({
        clientId,
        periodMonth,
        periodYear,
        records: [],
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
      });
    }

    try {
      // 1. Locate the payroll run for this period
      const { data: run, error: runErr } = await supabase
        .from('payroll_runs')
        .select('id, total_gross, total_deductions, total_net')
        .eq('client_id', clientId)
        .eq('period_month', periodMonth)
        .eq('period_year', periodYear)
        .maybeSingle();

      if (runErr) {
        return errorResponse(handleSupabaseError(runErr, 'reportingService.getFormXIXData.run'));
      }

      const payrollRun = run as any;
      if (!payrollRun) {
        return successResponse<FormXIXRegisterData>({
          clientId,
          periodMonth,
          periodYear,
          records: [],
          totalGross: 0,
          totalDeductions: 0,
          totalNet: 0,
        });
      }

      // 2. Query payroll line items joined with employee metadata
      const { data: items, error: itemsErr } = await supabase
        .from('payroll_items')
        .select(`
          fixed_salary,
          calendar_days,
          paid_days,
          unpaid_days,
          gross_earned,
          pf_deduction,
          esic_deduction,
          pt_deduction,
          net_salary,
          employees (employee_code, first_name, last_name, designation)
        `)
        .eq('run_id', payrollRun.id);

      if (itemsErr) {
        return errorResponse(handleSupabaseError(itemsErr, 'reportingService.getFormXIXData.items'));
      }

      const rows: FormXIXRow[] = (items || []).map((item: any) => ({
        employeeCode: item.employees?.employee_code || 'N/A',
        employeeName: `${item.employees?.first_name || ''} ${item.employees?.last_name || ''}`.trim(),
        designation: item.employees?.designation || 'Staff',
        calendarDays: item.calendar_days,
        workedDays: Number(item.paid_days),
        unpaidDays: Number(item.unpaid_days),
        grossEarned: Number(item.gross_earned),
        pfDeduction: Number(item.pf_deduction),
        esicDeduction: Number(item.esic_deduction),
        ptDeduction: Number(item.pt_deduction),
        netPayable: Number(item.net_salary),
      }));

      return successResponse<FormXIXRegisterData>({
        clientId,
        periodMonth,
        periodYear,
        records: rows,
        totalGross: Number(payrollRun.total_gross),
        totalDeductions: Number(payrollRun.total_deductions),
        totalNet: Number(payrollRun.total_net),
      });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'reportingService.getFormXIXData'));
    }
  },
};
