/**
 * Avencis Workforce Management (WFM)
 * Leave Entitlement, Application & Managerial Approval Service
 *
 * Enforces leave balance tracking (PL, CL, SL), date range validation,
 * overlapping leave prevention, anti-self-approval restrictions, and balance
 * deduction upon approval.
 */

import { supabase } from '../lib/supabase';
import { isMockMode } from './serviceConfig';
import {
  ServiceResponse,
  LeaveBalanceRow,
  LeaveRequestRow,
  SubmitLeavePayload,
  LeaveFilter,
  CallerScope,
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
import { calculateEffectiveLeaveDays } from './leaveCalculationHelper';

const LEAVE_REVIEW_ROLES = ['super_admin', 'client_admin', 'hr_admin', 'client_manager', 'location_manager'];

export const leaveService = {
  /**
   * Retrieves leave balances for an employee in a given entitlement year.
   */
  async getLeaveBalances(
    employeeId: string, 
    year?: number, 
    callerScope?: CallerScope
  ): Promise<ServiceResponse<LeaveBalanceRow[]>> {
    if (!employeeId) {
      return errorResponse(createValidationError('Employee ID is required.', 'employeeId'));
    }

    // Role-based peer boundary check: Employees can only view their own leave balances
    if (callerScope?.role === 'employee' && callerScope.employeeId && callerScope.employeeId !== employeeId) {
      return errorResponse(createPermissionError('Access Denied: You may only view your own leave balances.'));
    }

    const currentYear = year || new Date().getFullYear();

    if (isMockMode()) {
      const balances = store.getLeaveBalances(employeeId);
      const mockRows: LeaveBalanceRow[] = balances.map(b => ({
        id: b.id,
        client_id: (b as any).clientId || callerScope?.clientId || '10000000-0000-0000-0000-000000000001',
        employee_id: b.employeeId,
        leave_type: b.leaveType as LeaveBalanceRow['leave_type'],
        year: (b as any).year || currentYear,
        opening: b.opening || 0,
        credited: b.credited || 0,
        used: b.used || 0,
        closing: b.closing || 0,
        updated_at: new Date().toISOString(),
      }));
      return successResponse(mockRows);
    }

    try {
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('year', currentYear)
        .order('leave_type');

      if (error) {
        return errorResponse(handleSupabaseError(error, 'leaveService.getLeaveBalances'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'leaveService.getLeaveBalances'));
    }
  },

  /**
   * Submits a formal leave application with strict input, date range, overlap, and balance validation.
   */
  async submitLeaveRequest(
    payload: SubmitLeavePayload,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<LeaveRequestRow>> {
    // 1. Mandatory Field Validations
    if (!payload.clientId || !payload.employeeId) {
      return errorResponse(createValidationError('Client ID and Employee ID are required.'));
    }
    if (!payload.startDate || !payload.endDate) {
      return errorResponse(createValidationError('Both Start Date and End Date are required.'));
    }
    if (new Date(payload.endDate) < new Date(payload.startDate)) {
      return errorResponse(createValidationError('End Date cannot be before Start Date.', 'endDate'));
    }
    if (payload.totalDays <= 0) {
      return errorResponse(createValidationError('Total Days must be greater than zero.', 'totalDays'));
    }
    if (!payload.reason || payload.reason.trim().length < 5) {
      return errorResponse(createValidationError('A substantive reason (at least 5 characters) is required.', 'reason'));
    }

    // 2. Caller Scope Authorization & Cross-Tenant Guards
    if (callerScope?.role === 'employee' && callerScope.employeeId && callerScope.employeeId !== payload.employeeId) {
      return errorResponse(createPermissionError('Access Denied: You may only submit leave applications for yourself.'));
    }
    if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== payload.clientId) {
      return errorResponse(createPermissionError('Cross-tenant access forbidden. You cannot apply for leave in an external organization.'));
    }

    if (isMockMode()) {
      // 3. Overlapping Leave Application Guard
      const existingRequests = store.getLeaveRequests().filter(
        r => r.employeeId === payload.employeeId && (r.status === 'PENDING' || r.status === 'APPROVED')
      );

      const hasOverlap = existingRequests.some(r => {
        const reqStart = new Date(r.startDate).getTime();
        const reqEnd = new Date(r.endDate).getTime();
        const newStart = new Date(payload.startDate).getTime();
        const newEnd = new Date(payload.endDate).getTime();
        return (newStart <= reqEnd && newEnd >= reqStart);
      });

      if (hasOverlap) {
        return errorResponse(createValidationError('An active leave application already exists overlapping this date span.', 'startDate'));
      }

      // 4. Locked Payroll Period Immutability Guard
      const startMonth = new Date(payload.startDate).getMonth() + 1;
      const startYear = new Date(payload.startDate).getFullYear();
      const isPeriodLocked = store.getPayrollRuns(payload.clientId).some(
        r => r.periodMonth === startMonth && r.periodYear === startYear && r.status === 'locked'
      );
      if (isPeriodLocked) {
        return errorResponse(createValidationError(
          `Cannot apply for leave in ${startMonth}/${startYear}: Payroll period has already been finalized and locked.`,
          'startDate'
        ));
      }

      // 5. Leave Balance Check (for non-LWP leave types)
      if (payload.leaveType !== 'LWP') {
        const balances = store.getLeaveBalances(payload.employeeId);
        const targetBal = balances.find(b => b.leaveType === payload.leaveType);
        if (targetBal && targetBal.closing < payload.totalDays) {
          return errorResponse(
            createValidationError(
              `Insufficient ${payload.leaveType} balance. Available: ${targetBal.closing} day(s), Requested: ${payload.totalDays} day(s).`,
              'totalDays'
            )
          );
        }
      }

      const emp = store.getEmployee(payload.employeeId);
      const mockReq = store.submitLeaveRequest({
        clientId: payload.clientId,
        employeeId: payload.employeeId,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Demo Employee',
        leaveType: payload.leaveType,
        startDate: payload.startDate,
        endDate: payload.endDate,
        totalDays: payload.totalDays,
        reason: payload.reason,
      });

      return successResponse<LeaveRequestRow>({
        id: mockReq.id,
        client_id: payload.clientId,
        employee_id: payload.employeeId,
        leave_type: payload.leaveType,
        start_date: payload.startDate,
        end_date: payload.endDate,
        total_days: payload.totalDays,
        reason: payload.reason,
        manager_remarks: null,
        status: 'PENDING',
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      });
    }

    try {
      // Check for overlapping pending or approved leave requests in Supabase
      const { data: overlapping, error: overlapErr } = await supabase
        .from('leave_requests')
        .select('id, start_date, end_date, status')
        .eq('employee_id', payload.employeeId)
        .in('status', ['PENDING', 'APPROVED'])
        .lte('start_date', payload.endDate)
        .gte('end_date', payload.startDate);

      if (!overlapErr && overlapping && overlapping.length > 0) {
        return errorResponse(
          createValidationError(
            `An active leave application (${overlapping[0].start_date} to ${overlapping[0].end_date}) already overlaps this date range.`,
            'startDate'
          )
        );
      }

      // Balance check in Supabase
      if (payload.leaveType !== 'LWP') {
        const year = new Date(payload.startDate).getFullYear();
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('closing')
          .eq('employee_id', payload.employeeId)
          .eq('leave_type', payload.leaveType)
          .eq('year', year)
          .maybeSingle();

        if (balance && Number(balance.closing) < payload.totalDays) {
          return errorResponse(
            createValidationError(
              `Insufficient ${payload.leaveType} balance. Available: ${balance.closing} day(s), Requested: ${payload.totalDays} day(s).`,
              'totalDays'
            )
          );
        }
      }

      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          client_id: payload.clientId,
          employee_id: payload.employeeId,
          leave_type: payload.leaveType,
          start_date: payload.startDate,
          end_date: payload.endDate,
          total_days: payload.totalDays,
          reason: payload.reason,
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'leaveService.submitLeaveRequest'));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'leaveService.submitLeaveRequest'));
    }
  },

  /**
   * Retrieves leave applications matching filter criteria.
   */
  async getLeaveRequests(
    filter: LeaveFilter,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<LeaveRequestRow[]>> {
    if (!filter.clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    // Role-based scoping: Employees can only view their own leave requests
    if (callerScope?.role === 'employee') {
      if (!callerScope.employeeId) return successResponse([]);
      filter.employeeId = callerScope.employeeId;
    }

    // Cross-tenant guard
    if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== filter.clientId) {
      return errorResponse(createPermissionError('Cross-tenant access forbidden. You cannot view leave requests outside your client organization.'));
    }

    if (isMockMode()) {
      let requests = store.getLeaveRequests(filter.clientId);
      if (filter.employeeId) {
        requests = requests.filter(r => r.employeeId === filter.employeeId);
      }
      if (filter.status) {
        requests = requests.filter(r => r.status === filter.status);
      }
      if (filter.leaveType) {
        requests = requests.filter(r => r.leaveType === filter.leaveType);
      }
      const mockRows: LeaveRequestRow[] = requests.map(r => ({
        id: r.id,
        client_id: filter.clientId,
        employee_id: r.employeeId,
        leave_type: r.leaveType as LeaveRequestRow['leave_type'],
        start_date: r.startDate,
        end_date: r.endDate,
        total_days: r.totalDays,
        reason: r.reason,
        manager_remarks: r.managerRemarks || null,
        status: r.status as LeaveRequestRow['status'],
        reviewed_by: (r as any).reviewedBy || null,
        reviewed_at: (r as any).reviewedAt || null,
        created_at: (r as any).createdAt || new Date().toISOString(),
      }));
      return successResponse(mockRows);
    }

    try {
      let query = supabase
        .from('leave_requests')
        .select('*')
        .eq('client_id', filter.clientId)
        .order('created_at', { ascending: false });

      if (filter.employeeId) {
        query = query.eq('employee_id', filter.employeeId);
      }
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      if (filter.leaveType) {
        query = query.eq('leave_type', filter.leaveType);
      }

      const { data, error } = await query;
      if (error) {
        return errorResponse(handleSupabaseError(error, 'leaveService.getLeaveRequests'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'leaveService.getLeaveRequests'));
    }
  },

  /**
   * Reviews a leave request (Managerial Action).
   * Enforces corporate governance anti-self-approval restrictions, duplicate approval guards,
   * and deducts approved leave from the balance ledger.
   */
  async reviewLeaveRequest(
    id: string,
    decision: {
      status: 'APPROVED' | 'REJECTED';
      reviewerId: string;
      reviewerEmployeeId?: string;
      remarks?: string;
    },
    callerScope?: CallerScope
  ): Promise<ServiceResponse<LeaveRequestRow>> {
    if (!id) return errorResponse(createValidationError('Leave request ID is required.', 'id'));
    if (!decision.reviewerId) return errorResponse(createValidationError('Reviewer ID is required.', 'reviewerId'));

    // Role-based permission check: Only manager/admin roles can review leave requests
    if (callerScope?.role && !LEAVE_REVIEW_ROLES.includes(callerScope.role)) {
      return errorResponse(createPermissionError('Access Denied: Only authorized managers or HR administrators may review leave applications.'));
    }

    if (isMockMode()) {
      const existing = store.getLeaveRequests().find(r => r.id === id);
      if (!existing) return errorResponse(createNotFoundError('Leave Request', id));

      // Corporate Governance Anti-Self-Approval Enforcement
      if (decision.reviewerEmployeeId && decision.reviewerEmployeeId === existing.employeeId) {
        return errorResponse(createPermissionError('Corporate Governance Violation: Employees are prohibited from approving their own leave requests.'));
      }
      if (callerScope?.employeeId && callerScope.employeeId === existing.employeeId) {
        return errorResponse(createPermissionError('Corporate Governance Violation: Employees are prohibited from approving their own leave requests.'));
      }

      // Cross-Tenant Isolation Guard
      if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== existing.clientId) {
        return errorResponse(createPermissionError('Cross-tenant access forbidden. You cannot review leave requests outside your organization.'));
      }

      // State Transition Guards: Already approved, rejected, or cancelled
      if (existing.status === 'APPROVED') {
        return errorResponse(createValidationError('Leave request has already been approved.', 'status'));
      }
      if (existing.status === 'REJECTED') {
        return errorResponse(createValidationError('Leave request has already been rejected.', 'status'));
      }
      if (existing.status === 'CANCELLED') {
        return errorResponse(createValidationError('Cancelled leave requests cannot be reviewed.', 'status'));
      }

      // Locked Payroll Period Immutability Guard
      if (decision.status === 'APPROVED') {
        const leaveMonth = new Date(existing.startDate).getMonth() + 1;
        const leaveYear = new Date(existing.startDate).getFullYear();
        const isPeriodLocked = store.getPayrollRuns(existing.clientId).some(
          r => r.periodMonth === leaveMonth && r.periodYear === leaveYear && r.status === 'locked'
        );
        if (isPeriodLocked) {
          return errorResponse(createValidationError(
            `Cannot approve leave for ${leaveMonth}/${leaveYear}: Payroll period has already been finalized and locked.`,
            'status'
          ));
        }
      }

      store.reviewLeaveRequest(id, decision.status, decision.remarks || '');
      const updated = store.getLeaveRequests().find(r => r.id === id);
      if (!updated) return errorResponse(createNotFoundError('Leave Request', id));

      return successResponse<LeaveRequestRow>({
        id: updated.id,
        client_id: updated.clientId,
        employee_id: updated.employeeId,
        leave_type: updated.leaveType as LeaveRequestRow['leave_type'],
        start_date: updated.startDate,
        end_date: updated.endDate,
        total_days: updated.totalDays,
        reason: updated.reason,
        manager_remarks: decision.remarks || null,
        status: decision.status,
        reviewed_by: decision.reviewerId,
        reviewed_at: new Date().toISOString(),
        created_at: (updated as any).createdAt || new Date().toISOString(),
      });
    }

    try {
      // 1. Transactional RPC Path: Call PostgreSQL atomic review function
      const { data: rpcRes, error: rpcErr } = await (supabase.rpc as any)(
        'review_leave_request_atomic',
        {
          p_request_id: id,
          p_decision: decision.status,
          p_manager_remarks: decision.remarks || null,
        }
      );

      if (!rpcErr && rpcRes && rpcRes.success) {
        const { data: updated } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('id', id)
          .single();
        return successResponse(updated || (rpcRes as any));
      }

      // 2. Fetch current leave request to verify self-approval restriction & state
      const { data: request, error: fetchErr } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !request) {
        return errorResponse(createNotFoundError('Leave Request', id));
      }

      // Anti-Self-Approval Enforcement
      if (decision.reviewerEmployeeId && decision.reviewerEmployeeId === request.employee_id) {
        return errorResponse(createPermissionError('Corporate Governance Violation: Employees are prohibited from approving their own leave requests.'));
      }
      if (callerScope?.employeeId && callerScope.employeeId === request.employee_id) {
        return errorResponse(createPermissionError('Corporate Governance Violation: Employees are prohibited from approving their own leave requests.'));
      }

      // Cross-Tenant Isolation Guard
      if (callerScope?.role && callerScope.role !== 'super_admin' && callerScope.clientId && callerScope.clientId !== request.client_id) {
        return errorResponse(createPermissionError('Cross-tenant access forbidden. You cannot review leave requests outside your organization.'));
      }

      // State Transition Guards
      if (request.status === 'APPROVED') {
        return errorResponse(createValidationError('Leave request has already been approved.', 'status'));
      }
      if (request.status === 'REJECTED') {
        return errorResponse(createValidationError('Leave request has already been rejected.', 'status'));
      }
      if (request.status === 'CANCELLED') {
        return errorResponse(createValidationError('Cancelled leave requests cannot be reviewed.', 'status'));
      }

      // Cross-Year Balance Partitioning & Solvency Pre-Check
      const yearDeductions: { balanceId: string; year: number; deductedDays: number; newUsed: number; newClosing: number }[] = [];
      if (decision.status === 'APPROVED' && request.leave_type !== 'LWP') {
        const calcRes = calculateEffectiveLeaveDays({
          startDate: request.start_date,
          endDate: request.end_date,
          isHalfDay: Number(request.total_days) === 0.5,
        });

        // Determine years involved in ascending order
        const years = Object.keys(calcRes.daysByYear).map(Number).sort((a, b) => a - b);
        if (years.length === 0) {
          years.push(new Date(request.start_date).getFullYear());
        }

        for (const yr of years) {
          const reqDaysInYear = calcRes.daysByYear[yr] ?? Number(request.total_days);
          const { data: balance } = await supabase
            .from('leave_balances')
            .select('*')
            .eq('employee_id', request.employee_id)
            .eq('leave_type', request.leave_type)
            .eq('year', yr)
            .maybeSingle();

          if (balance) {
            if (Number(balance.closing) < reqDaysInYear) {
              return errorResponse(
                createValidationError(
                  `Insufficient ${request.leave_type} balance for year ${yr}. Available: ${balance.closing} day(s), Requested: ${reqDaysInYear} day(s).`,
                  'totalDays'
                )
              );
            }
            const newUsed = Number(balance.used) + reqDaysInYear;
            const newClosing = Number(balance.opening) + Number(balance.credited) - newUsed;
            yearDeductions.push({
              balanceId: balance.id,
              year: yr,
              deductedDays: reqDaysInYear,
              newUsed,
              newClosing,
            });
          }
        }
      }

      // Update Request Status
      const { data: updated, error: updateErr } = await supabase
        .from('leave_requests')
        .update({
          status: decision.status,
          reviewed_by: decision.reviewerId,
          reviewed_at: new Date().toISOString(),
          manager_remarks: decision.remarks || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) {
        return errorResponse(handleSupabaseError(updateErr, 'leaveService.reviewLeaveRequest'));
      }

      // If approved and leave type is PL/CL/SL/COMP_OFF, adjust leave_balances with rollback safety
      if (decision.status === 'APPROVED' && request.leave_type !== 'LWP' && yearDeductions.length > 0) {
        for (const yd of yearDeductions) {
          const { error: balErr } = await supabase
            .from('leave_balances')
            .update({
              used: yd.newUsed,
              closing: yd.newClosing,
              updated_at: new Date().toISOString(),
            })
            .eq('id', yd.balanceId);

          if (balErr) {
            // Revert request status to PENDING if balance deduction fails to prevent orphaned approvals
            await supabase
              .from('leave_requests')
              .update({ status: 'PENDING', reviewed_by: null, reviewed_at: null })
              .eq('id', id);
            return errorResponse(handleSupabaseError(balErr, 'leaveService.reviewLeaveRequest.balanceDeduction'));
          }
        }
      }

      return successResponse(updated);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'leaveService.reviewLeaveRequest'));
    }
  },

  /**
   * Cancels a pending leave application (Employee Self-Service Action).
   */
  async cancelLeaveRequest(
    id: string,
    employeeId: string,
    callerScope?: CallerScope
  ): Promise<ServiceResponse<LeaveRequestRow>> {
    if (!id || !employeeId) {
      return errorResponse(createValidationError('Request ID and Employee ID are required.'));
    }

    if (callerScope?.role === 'employee' && callerScope.employeeId && callerScope.employeeId !== employeeId) {
      return errorResponse(createPermissionError('Access Denied: You may only cancel your own leave requests.'));
    }

    if (isMockMode()) {
      const existing = store.getLeaveRequests().find(r => r.id === id);
      if (!existing) return errorResponse(createNotFoundError('Leave Request', id));
      if (existing.employeeId !== employeeId) {
        return errorResponse(createPermissionError('Access Denied: Cannot cancel leave for another employee.'));
      }
      if (existing.status !== 'PENDING') {
        return errorResponse(createValidationError('Only pending leave requests can be cancelled.', 'status'));
      }

      const cancelled = store.cancelLeaveRequest(id);
      if (!cancelled) return errorResponse(createNotFoundError('Leave Request', id));

      return successResponse<LeaveRequestRow>({
        id: cancelled.id,
        client_id: cancelled.clientId,
        employee_id: cancelled.employeeId,
        leave_type: cancelled.leaveType as LeaveRequestRow['leave_type'],
        start_date: cancelled.startDate,
        end_date: cancelled.endDate,
        total_days: cancelled.totalDays,
        reason: cancelled.reason,
        manager_remarks: cancelled.managerRemarks || null,
        status: 'CANCELLED',
        reviewed_by: null,
        reviewed_at: null,
        created_at: (cancelled as any).createdAt || new Date().toISOString(),
      });
    }

    try {
      const { data: request, error: fetchErr } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !request) {
        return errorResponse(createNotFoundError('Leave Request', id));
      }

      if (request.employee_id !== employeeId) {
        return errorResponse(createPermissionError('Access Denied: Cannot cancel leave for another employee.'));
      }

      if (request.status !== 'PENDING') {
        return errorResponse(createValidationError('Only pending leave requests can be cancelled.', 'status'));
      }

      const { data: updated, error: updateErr } = await supabase
        .from('leave_requests')
        .update({
          status: 'CANCELLED',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) {
        return errorResponse(handleSupabaseError(updateErr, 'leaveService.cancelLeaveRequest'));
      }

      return successResponse(updated);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'leaveService.cancelLeaveRequest'));
    }
  },
};
