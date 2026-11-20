/**
 * Avencis Workforce Management (WFM)
 * Milestone 2.4E — Payroll Engine, Compensation Line Items & Form XIX Payslip Registry Service
 *
 * Implements:
 * 1. Attendance finalization gate (blocks payroll generation/locking if unfinalized regularisations exist).
 * 2. Multi-tier compensation calculation (proration, authorised overtime, statutory deductions).
 * 3. Review overrides (authorised manual overtime, variable incentives).
 * 4. Segregation of duties & approval lifecycle (draft -> under_review -> approved -> locked).
 * 5. Immutable snapshot persistence & Form XIX payslip registry.
 * 6. Strict frontend and trigger tamper guards.
 */

import { supabase } from '../lib/supabase';
import { isMockMode } from './serviceConfig';
import {
  ServiceResponse,
  PayrollRunRow,
  PayrollItemRow,
  PayslipRow,
  AttendanceFinalizationResult,
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
import {
  getDaysInMonth,
  aggregateMonthlyAttendance,
  calculateEmployeePayrollItem,
} from './payrollCalculationHelper';
import { PayrollItem } from '../types';

export interface ProrationCalculationResult {
  calendarDays: number;
  unpaidDays: number;
  paidDays: number;
  divisor: number;
  payableRatio: number;
}

export const payrollService = {
  /**
   * Retrieves all payroll runs for a client organisation.
   */
  async getPayrollRuns(clientId: string, year?: number): Promise<ServiceResponse<PayrollRunRow[]>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      const runs = store.getPayrollRuns(clientId);
      const mockRows: PayrollRunRow[] = runs.map(r => ({
        id: r.id,
        client_id: r.clientId,
        legal_entity_id: null,
        period_month: r.periodMonth,
        period_year: r.periodYear,
        total_employees: r.totalEmployees,
        total_gross: r.totalGross,
        total_deductions: r.totalDeductions,
        total_net: r.totalNet,
        status: (r.status === 'locked' ? 'locked' : r.status === 'approved' ? 'approved' : 'draft') as PayrollRunRow['status'],
        processed_at: r.processedAt || new Date().toISOString(),
        approved_at: r.approvedAt || null,
        approved_by: r.approvedBy || null,
        locked_at: (r as any).lockedAt || null,
        locked_by: (r as any).lockedBy || null,
        policy_snapshot: null,
      }));
      return successResponse(mockRows);
    }

    try {
      let query = supabase
        .from('payroll_runs')
        .select('*')
        .eq('client_id', clientId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (year) {
        query = query.eq('period_year', year);
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(handleSupabaseError(error, 'payrollService.getPayrollRuns'));
      }

      return successResponse((data || []) as PayrollRunRow[]);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.getPayrollRuns'));
    }
  },

  /**
   * Retrieves details for a specific payroll run.
   */
  async getPayrollRunById(runId: string): Promise<ServiceResponse<PayrollRunRow>> {
    if (!runId) {
      return errorResponse(createValidationError('Payroll Run ID is required.', 'runId'));
    }

    if (isMockMode()) {
      const run = store.getPayrollRuns().find(r => r.id === runId);
      if (!run) {
        return errorResponse(createNotFoundError('Payroll Run', runId));
      }
      return successResponse<PayrollRunRow>({
        id: run.id,
        client_id: run.clientId,
        legal_entity_id: null,
        period_month: run.periodMonth,
        period_year: run.periodYear,
        total_employees: run.totalEmployees,
        total_gross: run.totalGross,
        total_deductions: run.totalDeductions,
        total_net: run.totalNet,
        status: (run.status === 'locked' ? 'locked' : run.status === 'approved' ? 'approved' : 'draft') as PayrollRunRow['status'],
        processed_at: run.processedAt || new Date().toISOString(),
        approved_at: run.approvedAt || null,
        approved_by: run.approvedBy || null,
        locked_at: (run as any).lockedAt || null,
        locked_by: (run as any).lockedBy || null,
        policy_snapshot: null,
      });
    }

    try {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'payrollService.getPayrollRunById'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('Payroll Run', runId));
      }

      return successResponse(data as PayrollRunRow);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.getPayrollRunById'));
    }
  },

  /**
   * Retrieves line items for a specific payroll run.
   */
  async getPayrollItems(runId: string): Promise<ServiceResponse<PayrollItemRow[]>> {
    if (!runId) {
      return errorResponse(createValidationError('Payroll Run ID is required.', 'runId'));
    }

    if (isMockMode()) {
      const run = store.getPayrollRuns().find(r => r.id === runId);
      if (!run) {
        return errorResponse(createNotFoundError('Payroll Run', runId));
      }
      const rawItems = (run as any).items || [];
      const mockItems: PayrollItemRow[] = rawItems.map((item: any, idx: number) => ({
        id: item.id || `mock-pitem-${idx}`,
        run_id: runId,
        client_id: run.clientId,
        employee_id: item.employeeId,
        fixed_salary: item.fixedSalary,
        incentives: item.variableIncentives || item.incentives || 0,
        other_allowances: item.otherAllowances || 0,
        calendar_days: item.calendarDays || 31,
        paid_days: item.paidDays || 31,
        unpaid_days: item.unpaidDays || 0,
        gross_earned: item.grossEarned,
        unpaid_deduction: item.unpaidDeduction || 0,
        pf_deduction: item.pfDeduction || 0,
        esic_deduction: item.esicDeduction || 0,
        pt_deduction: item.ptDeduction || 0,
        tds_deduction: item.tdsDeduction || 0,
        total_deductions: item.totalDeductions,
        net_salary: item.netSalary,
        basic_pay: item.basicPay,
        hra: item.hra,
        conveyance: item.conveyance,
        special_allowance: item.specialAllowance,
        overtime_pay: item.overtimePay || 0,
        pf_employer: item.pfEmployer,
        esic_employer: item.esicEmployer,
      }));
      return successResponse(mockItems);
    }

    try {
      const { data, error } = await supabase
        .from('payroll_items')
        .select('*')
        .eq('run_id', runId)
        .order('net_salary', { ascending: false });

      if (error) {
        return errorResponse(handleSupabaseError(error, 'payrollService.getPayrollItems'));
      }

      return successResponse((data || []) as PayrollItemRow[]);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.getPayrollItems'));
    }
  },

  /**
   * Retrieves published payslips (Form XIX statutory registry).
   */
  async getPayslips(filter: {
    clientId?: string;
    employeeId?: string;
    periodMonth?: number;
    periodYear?: number;
  }): Promise<ServiceResponse<PayslipRow[]>> {
    if (isMockMode()) {
      const slips = store.getPayslips(filter);
      const rows: PayslipRow[] = slips.map(p => ({
        id: p.id,
        client_id: p.clientId,
        payroll_item_id: p.payrollItemId,
        employee_id: p.employeeId,
        period_month: p.periodMonth,
        period_year: p.periodYear,
        revision_number: p.revisionNumber,
        storage_pdf_url: p.storagePdfUrl || null,
        generated_at: p.generatedAt,
        is_published: p.isPublished,
        employee_name: p.employeeName,
        employee_code: p.employeeCode,
        designation: p.designation,
        net_salary: p.netSalary,
      }));
      return successResponse(rows);
    }

    try {
      let query = supabase.from('payslips').select('*').order('generated_at', { ascending: false });

      if (filter.clientId) {
        query = query.eq('client_id', filter.clientId);
      }
      if (filter.employeeId) {
        query = query.eq('employee_id', filter.employeeId);
      }
      if (filter.periodMonth) {
        query = query.eq('period_month', filter.periodMonth);
      }
      if (filter.periodYear) {
        query = query.eq('period_year', filter.periodYear);
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(handleSupabaseError(error, 'payrollService.getPayslips'));
      }

      return successResponse((data || []) as PayslipRow[]);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.getPayslips'));
    }
  },

  /**
   * Verifies that attendance is fully finalized for a client and period.
   * Strictly prevents payroll calculation/locking if unresolved regularisations exist.
   */
  async verifyAttendanceFinalized(
    clientId: string,
    periodMonth: number,
    periodYear: number
  ): Promise<ServiceResponse<AttendanceFinalizationResult>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }
    if (periodMonth < 1 || periodMonth > 12) {
      return errorResponse(createValidationError('Invalid period month.', 'periodMonth'));
    }

    if (isMockMode()) {
      const result = store.verifyAttendanceFinalized(clientId, periodMonth, periodYear);
      return successResponse(result);
    }

    try {
      const monthStr = String(periodMonth).padStart(2, '0');
      const startMonth = `${periodYear}-${monthStr}-01`;
      const endMonth = `${periodYear}-${monthStr}-${String(getDaysInMonth(periodMonth, periodYear)).padStart(2, '0')}`;

      const [corrRes, leaveRes] = await Promise.all([
        supabase
          .from('attendance_corrections')
          .select('id, employee_id, attendance_date, status')
          .eq('client_id', clientId)
          .eq('status', 'PENDING')
          .gte('attendance_date', startMonth)
          .lte('attendance_date', endMonth),
        supabase
          .from('leave_requests')
          .select('id, employee_id, start_date, status')
          .eq('client_id', clientId)
          .eq('status', 'PENDING')
          .gte('start_date', startMonth)
          .lte('start_date', endMonth)
      ]);

      if (corrRes.error) {
        return errorResponse(handleSupabaseError(corrRes.error, 'payrollService.verifyAttendanceFinalized'));
      }
      if (leaveRes.error) {
        return errorResponse(handleSupabaseError(leaveRes.error, 'payrollService.verifyAttendanceFinalized'));
      }

      const pendingCorr = corrRes.data?.length || 0;
      const pendingLeave = leaveRes.data?.length || 0;
      const totalPending = pendingCorr + pendingLeave;

      if (totalPending > 0) {
        return successResponse({
          isFinalized: false,
          pendingCount: totalPending,
          error: `ATTENDANCE_NOT_FINALIZED: Cannot process payroll. ${pendingCorr} regularisation requests and ${pendingLeave} leave requests remain unresolved for period ${periodMonth}/${periodYear}.`,
        });
      }

      return successResponse({ isFinalized: true, pendingCount: 0 });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.verifyAttendanceFinalized'));
    }
  },

  /**
   * Calculates a monthly payroll batch for an organization.
   * Gated by the attendance finalization check.
   */
  async calculatePayrollRun(
    clientId: string,
    periodMonth: number,
    periodYear: number,
    options?: {
      legalEntityId?: string;
      overtimeOverrides?: Record<string, number>;
      incentiveOverrides?: Record<string, number>;
    }
  ): Promise<ServiceResponse<{ run: PayrollRunRow; items: PayrollItemRow[] }>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    // 1. Enforce strict attendance finalization gate
    const attCheck = await this.verifyAttendanceFinalized(clientId, periodMonth, periodYear);
    if (!attCheck.success || !attCheck.data?.isFinalized) {
      return errorResponse(
        createValidationError(
          attCheck.data?.error || 'Attendance records must be finalized before generating payroll.',
          'attendanceGate'
        )
      );
    }

    if (isMockMode()) {
      try {
        const { run, items } = store.calculatePayrollRun(clientId, periodMonth, periodYear, options);
        const runRow: PayrollRunRow = {
          id: run.id,
          client_id: run.clientId,
          legal_entity_id: options?.legalEntityId || null,
          period_month: run.periodMonth,
          period_year: run.periodYear,
          total_employees: run.totalEmployees,
          total_gross: run.totalGross,
          total_deductions: run.totalDeductions,
          total_net: run.totalNet,
          status: 'under_review' as any,
          processed_at: run.processedAt || new Date().toISOString(),
          approved_at: run.approvedAt || null,
          approved_by: run.approvedBy || null,
          locked_at: null,
          locked_by: null,
          policy_snapshot: null,
        };

        const itemRows: PayrollItemRow[] = items.map(item => ({
          id: item.id,
          run_id: item.runId,
          client_id: item.clientId,
          employee_id: item.employeeId,
          fixed_salary: item.fixedSalary,
          incentives: item.incentives,
          other_allowances: item.otherAllowances,
          calendar_days: item.calendarDays,
          paid_days: item.paidDays,
          unpaid_days: item.unpaidDays,
          gross_earned: item.grossEarned,
          unpaid_deduction: item.unpaidDeduction,
          pf_deduction: item.pfDeduction,
          esic_deduction: item.esicDeduction,
          pt_deduction: item.ptDeduction,
          tds_deduction: item.tdsDeduction,
          total_deductions: item.totalDeductions,
          net_salary: item.netSalary,
          basic_pay: item.basicPay,
          hra: item.hra,
          conveyance: item.conveyance,
          special_allowance: item.specialAllowance,
          overtime_pay: item.overtimePay || 0,
          pf_employer: item.pfEmployer,
          esic_employer: item.esicEmployer,
        }));

        return successResponse({ run: runRow, items: itemRows });
      } catch (err: any) {
        return errorResponse(createValidationError(err.message || 'Error calculating payroll', 'calculation'));
      }
    }

    try {
      // 1. Invoke authoritative PostgreSQL RPC: generate_payroll_run
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('generate_payroll_run', {
        p_client_id: clientId,
        p_period_month: periodMonth,
        p_period_year: periodYear,
        p_legal_entity_id: options?.legalEntityId || null,
      });

      if (rpcError) {
        return errorResponse(handleSupabaseError(rpcError, 'payrollService.calculatePayrollRun.rpc'));
      }

      const generatedRunId = (rpcData as any)?.run_id || `payrun-${clientId}-${periodMonth}-${periodYear}`;

      // 2. Fetch the generated run record
      const { data: runData, error: runError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', generatedRunId)
        .single();

      if (runError || !runData) {
        return errorResponse(handleSupabaseError(runError, 'payrollService.calculatePayrollRun.fetchRun'));
      }

      // 3. Fetch generated items
      const { data: itemData, error: itemError } = await supabase
        .from('payroll_items')
        .select('*')
        .eq('run_id', generatedRunId);

      if (itemError) {
        return errorResponse(handleSupabaseError(itemError, 'payrollService.calculatePayrollRun.fetchItems'));
      }

      // 4. Apply any manual overtime or incentive overrides if provided
      if (options?.overtimeOverrides || options?.incentiveOverrides) {
        for (const item of (itemData || [])) {
          const ot = options.overtimeOverrides?.[item.employee_id];
          const inc = options.incentiveOverrides?.[item.employee_id];
          if (ot !== undefined || inc !== undefined) {
            await this.updatePayrollItemOverrides(generatedRunId, item.employee_id, ot ?? (item as any).overtime_pay ?? 0, inc);
          }
        }
        const { data: refreshedRun } = await supabase.from('payroll_runs').select('*').eq('id', generatedRunId).single();
        const { data: refreshedItems } = await supabase.from('payroll_items').select('*').eq('run_id', generatedRunId);
        return successResponse({
          run: (refreshedRun || runData) as PayrollRunRow,
          items: (refreshedItems || itemData || []) as PayrollItemRow[],
        });
      }

      return successResponse({
        run: runData as PayrollRunRow,
        items: (itemData || []) as PayrollItemRow[],
      });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.calculatePayrollRun'));
    }
  },

  /**
   * Updates line item adjustments (e.g. manual authorised overtime pay or variable incentives)
   * in an unfinalized payroll run during review stage.
   */
  async updatePayrollItemOverrides(
    runId: string,
    employeeId: string,
    overtimePay: number,
    incentives?: number
  ): Promise<ServiceResponse<PayrollItemRow>> {
    if (!runId || !employeeId) {
      return errorResponse(createValidationError('Run ID and Employee ID are required.', 'identifiers'));
    }

    if (isMockMode()) {
      const run = store.getPayrollRuns().find(r => r.id === runId);
      if (!run) {
        return errorResponse(createNotFoundError('Payroll Run', runId));
      }
      if (run.status === 'locked') {
        return errorResponse(createPermissionError('CRITICAL TAMPER GUARD: Cannot modify line items of a locked payroll run.'));
      }

      const items = (run as any).items as PayrollItem[];
      const item = items?.find(i => i.employeeId === employeeId);
      if (!item) {
        return errorResponse(createNotFoundError('Payroll Item', employeeId));
      }

      item.overtimePay = Math.max(0, Math.round(overtimePay));
      if (incentives !== undefined) {
        item.incentives = Math.max(0, Math.round(incentives));
      }

      // Recalculate gross and deductions
      const payableBase = Math.round(item.fixedSalary - item.unpaidDeduction);
      item.grossEarned = payableBase + item.incentives + item.overtimePay;
      item.totalDeductions = item.pfDeduction + item.esicDeduction + item.ptDeduction + item.tdsDeduction;
      item.netSalary = Math.max(0, item.grossEarned - item.totalDeductions);

      // Recalculate run totals
      run.totalGross = items.reduce((sum, i) => sum + i.grossEarned, 0);
      run.totalDeductions = items.reduce((sum, i) => sum + i.totalDeductions, 0);
      run.totalNet = items.reduce((sum, i) => sum + i.netSalary, 0);
      store.saveToStorage();

      return successResponse<PayrollItemRow>({
        id: item.id,
        run_id: runId,
        client_id: run.clientId,
        employee_id: item.employeeId,
        fixed_salary: item.fixedSalary,
        incentives: item.incentives,
        other_allowances: item.otherAllowances,
        calendar_days: item.calendarDays,
        paid_days: item.paidDays,
        unpaid_days: item.unpaidDays,
        gross_earned: item.grossEarned,
        unpaid_deduction: item.unpaidDeduction,
        pf_deduction: item.pfDeduction,
        esic_deduction: item.esicDeduction,
        pt_deduction: item.ptDeduction,
        tds_deduction: item.tdsDeduction,
        total_deductions: item.totalDeductions,
        net_salary: item.netSalary,
        basic_pay: item.basicPay,
        hra: item.hra,
        conveyance: item.conveyance,
        special_allowance: item.specialAllowance,
        overtime_pay: item.overtimePay,
        pf_employer: item.pfEmployer,
        esic_employer: item.esicEmployer,
      });
    }

    try {
      const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .select('status')
        .eq('id', runId)
        .single();

      if (runError || !run) {
        return errorResponse(handleSupabaseError(runError, 'payrollService.updatePayrollItemOverrides.checkRun'));
      }

      if (run.status === 'locked') {
        return errorResponse(createPermissionError('CRITICAL TAMPER GUARD: Cannot modify line items of a locked payroll run.'));
      }

      const updates: any = {
        overtime_pay: Math.max(0, Math.round(overtimePay)),
      };
      if (incentives !== undefined) {
        updates.incentives = Math.max(0, Math.round(incentives));
      }

      const { data, error } = await supabase
        .from('payroll_items')
        .update(updates)
        .eq('run_id', runId)
        .eq('employee_id', employeeId)
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'payrollService.updatePayrollItemOverrides'));
      }

      return successResponse(data as PayrollItemRow);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.updatePayrollItemOverrides'));
    }
  },

  /**
   * Approves a payroll run (Manager review / approval gate).
   */
  async approvePayrollRun(runId: string, approvedBy: string): Promise<ServiceResponse<PayrollRunRow>> {
    if (!runId) {
      return errorResponse(createValidationError('Run ID is required.', 'runId'));
    }

    if (isMockMode()) {
      const run = store.getPayrollRuns().find(r => r.id === runId);
      if (!run) {
        return errorResponse(createNotFoundError('Payroll Run', runId));
      }
      if (run.status === 'locked') {
        return errorResponse(createPermissionError('Cannot approve an already locked payroll run.'));
      }

      run.status = 'approved' as any;
      run.approvedAt = new Date().toISOString();
      run.approvedBy = approvedBy;
      store.logAction('PAYROLL_APPROVED', 'PayrollRun', runId, `Approved payroll by ${approvedBy}`);
      store.saveToStorage();

      return successResponse<PayrollRunRow>({
        id: run.id,
        client_id: run.clientId,
        legal_entity_id: null,
        period_month: run.periodMonth,
        period_year: run.periodYear,
        total_employees: run.totalEmployees,
        total_gross: run.totalGross,
        total_deductions: run.totalDeductions,
        total_net: run.totalNet,
        status: 'approved',
        processed_at: run.processedAt || new Date().toISOString(),
        approved_at: run.approvedAt,
        approved_by: run.approvedBy,
        locked_at: null,
        locked_by: null,
        policy_snapshot: null,
      });
    }

    try {
      const { data, error } = await supabase
        .from('payroll_runs')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: approvedBy,
        })
        .eq('id', runId)
        .neq('status', 'locked')
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'payrollService.approvePayrollRun'));
      }

      return successResponse(data as PayrollRunRow);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.approvePayrollRun'));
    }
  },

  /**
   * Authorizes and locks a payroll run.
   * Sealed into immutable state and generates published Form XIX payslips.
   */
  async lockPayrollRun(runId: string, lockedBy: string): Promise<ServiceResponse<PayrollRunRow>> {
    if (!runId) {
      return errorResponse(createValidationError('Run ID is required.', 'runId'));
    }

    if (isMockMode()) {
      const run = store.getPayrollRuns().find(r => r.id === runId);
      if (!run) {
        return errorResponse(createNotFoundError('Payroll Run', runId));
      }

      try {
        store.saveAndLockPayrollRun(run, lockedBy);
        return successResponse<PayrollRunRow>({
          id: run.id,
          client_id: run.clientId,
          legal_entity_id: null,
          period_month: run.periodMonth,
          period_year: run.periodYear,
          total_employees: run.totalEmployees,
          total_gross: run.totalGross,
          total_deductions: run.totalDeductions,
          total_net: run.totalNet,
          status: 'locked',
          processed_at: run.processedAt || new Date().toISOString(),
          approved_at: run.approvedAt || new Date().toISOString(),
          approved_by: run.approvedBy || lockedBy,
          locked_at: (run as any).lockedAt || new Date().toISOString(),
          locked_by: lockedBy,
          policy_snapshot: null,
        });
      } catch (err: any) {
        return errorResponse(createValidationError(err.message || 'Error locking payroll', 'lock'));
      }
    }

    try {
      // 1. Invoke authoritative PostgreSQL RPC: lock_payroll_run
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('lock_payroll_run', {
        p_run_id: runId,
        p_approved_by: lockedBy,
      });

      if (rpcError) {
        return errorResponse(handleSupabaseError(rpcError, 'payrollService.lockPayrollRun.rpc'));
      }

      // 2. Fetch the locked run record
      const { data: lockedRun, error: fetchError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (fetchError || !lockedRun) {
        return errorResponse(handleSupabaseError(fetchError, 'payrollService.lockPayrollRun.fetchLocked'));
      }

      return successResponse(lockedRun as PayrollRunRow);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.lockPayrollRun'));
    }
  },

  /**
   * Retrieves a published payslip and line item for an individual employee.
   */
  async getPublishedPayslip(
    employeeId: string,
    periodMonth: number,
    periodYear: number
  ): Promise<ServiceResponse<{ payslip: PayslipRow; item?: PayrollItemRow }>> {
    if (!employeeId) {
      return errorResponse(createValidationError('Employee ID is required.', 'employeeId'));
    }

    if (isMockMode()) {
      const slips = store.getPayslips({ employeeId, periodMonth, periodYear });
      const slip = slips[0];
      if (!slip) {
        return errorResponse(createNotFoundError('Published Payslip', `${employeeId}-${periodMonth}-${periodYear}`));
      }

      const runs = store.getPayrollRuns();
      let foundItem: PayrollItem | undefined;
      for (const r of runs) {
        const it = (r as any).items?.find((i: PayrollItem) => i.employeeId === employeeId);
        if (it) {
          foundItem = it;
          break;
        }
      }

      return successResponse({
        payslip: {
          id: slip.id,
          client_id: slip.clientId,
          payroll_item_id: slip.payrollItemId,
          employee_id: slip.employeeId,
          period_month: slip.periodMonth,
          period_year: slip.periodYear,
          revision_number: slip.revisionNumber,
          storage_pdf_url: slip.storagePdfUrl || null,
          generated_at: slip.generatedAt,
          is_published: slip.isPublished,
          employee_name: slip.employeeName,
          employee_code: slip.employeeCode,
          designation: slip.designation,
          net_salary: slip.netSalary,
        },
        item: foundItem ? {
          id: foundItem.id,
          run_id: foundItem.runId,
          client_id: foundItem.clientId,
          employee_id: foundItem.employeeId,
          fixed_salary: foundItem.fixedSalary,
          incentives: foundItem.incentives,
          other_allowances: foundItem.otherAllowances,
          calendar_days: foundItem.calendarDays,
          paid_days: foundItem.paidDays,
          unpaid_days: foundItem.unpaidDays,
          gross_earned: foundItem.grossEarned,
          unpaid_deduction: foundItem.unpaidDeduction,
          pf_deduction: foundItem.pfDeduction,
          esic_deduction: foundItem.esicDeduction,
          pt_deduction: foundItem.ptDeduction,
          tds_deduction: foundItem.tdsDeduction,
          total_deductions: foundItem.totalDeductions,
          net_salary: foundItem.netSalary,
          basic_pay: foundItem.basicPay,
          hra: foundItem.hra,
          conveyance: foundItem.conveyance,
          special_allowance: foundItem.specialAllowance,
          overtime_pay: foundItem.overtimePay,
          pf_employer: foundItem.pfEmployer,
          esic_employer: foundItem.esicEmployer,
        } : undefined,
      });
    }

    try {
      const { data: slip, error: slipError } = await supabase
        .from('payslips')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('period_month', periodMonth)
        .eq('period_year', periodYear)
        .eq('is_published', true)
        .order('revision_number', { ascending: false })
        .limit(1)
        .single();

      if (slipError || !slip) {
        return errorResponse(handleSupabaseError(slipError, 'payrollService.getPublishedPayslip'));
      }

      let itemRow: PayrollItemRow | undefined;
      if (slip.payroll_item_id) {
        const { data: item } = await supabase
          .from('payroll_items')
          .select('*')
          .eq('id', slip.payroll_item_id)
          .single();
        if (item) {
          itemRow = item as PayrollItemRow;
        }
      }

      return successResponse({ payslip: slip as PayslipRow, item: itemRow });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'payrollService.getPublishedPayslip'));
    }
  },

  /**
   * Calculation Helper: Computes paid days and proration ratio based on client policy divisor.
   * Does NOT modify database state or initiate financial transactions.
   */
  calculateProrationDays(
    calendarDays: number,
    unpaidDays: number,
    policyDivisor: '26' | '30' | 'calendar_days'
  ): ProrationCalculationResult {
    const validCalendarDays = Math.max(28, Math.min(31, calendarDays));
    const safeUnpaidDays = Math.max(0, Math.min(validCalendarDays, unpaidDays));
    const paidDays = validCalendarDays - safeUnpaidDays;

    let divisor: number;
    if (policyDivisor === '26') {
      divisor = 26;
    } else if (policyDivisor === '30') {
      divisor = 30;
    } else {
      divisor = validCalendarDays;
    }

    const payableRatio = Math.max(0, Math.min(1.0, paidDays / divisor));

    return {
      calendarDays: validCalendarDays,
      unpaidDays: safeUnpaidDays,
      paidDays,
      divisor,
      payableRatio,
    };
  },

  /**
   * Tamper Guard: Prevents attempting to modify a locked payroll run from the frontend.
   */
  assertPayrollNotLocked(run: PayrollRunRow): ServiceResponse<void> {
    if (run.status === 'locked') {
      return errorResponse(
        createPermissionError('CRITICAL TAMPER GUARD: This payroll run is finalized and locked. Modifications are prohibited.')
      );
    }
    return successResponse(undefined);
  },
};
