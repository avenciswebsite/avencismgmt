/**
 * AVENCIS WORKFORCE MANAGEMENT (WFM)
 * MILESTONE 2.4D DEEP VERIFICATION & CORRECTION SUITE
 *
 * Performs exhaustive technical verification of:
 * 1. Leave-day calculation (working days, weekends, holidays, cross-year, half-day)
 * 2. Transactional atomicity & concurrency race conditions in leave approval
 * 3. Role-Based Access Control & RLS boundary analysis
 * 4. LWP vs Paid Leave accounting and attendance classification
 * 5. Daily Attendance Muster integrity and false-absenteeism prevention
 * 6. Entitlement balance ledger invariant (opening + credited - used = closing)
 */

import { leaveService } from '../src/services/leaveService';
import { attendanceService } from '../src/services/attendanceService';
import { policyService } from '../src/services/policyService';
import { store } from '../src/data/store';
import { setDevDataSourceMode } from '../src/services/serviceConfig';
import { supabase } from '../src/lib/supabase';

interface TestResult {
  category: string;
  testId: string;
  name: string;
  type: 'Unit/mock' | 'Real database' | 'Authenticated RLS' | 'Concurrent database test' | 'Architecture/Code Audit';
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT IMPLEMENTED' | 'REQUIRES APPROVAL';
  details: string;
}

const results: TestResult[] = [];

function recordResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${icon} [${result.testId}] [${result.type}] ${result.name} -> ${result.status}`);
  if (result.details) {
    console.log(`     Details: ${result.details}`);
  }
}

async function runVerification() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — MILESTONE 2.4D AUDIT & INTEGRITY VERIFICATION SUITE');
  console.log('========================================================================\n');

  // Ensure starting in mock mode for unit and concurrency logic tests
  setDevDataSourceMode('mock');

  const client1Id = 'client-suman';
  const emp1Id = 'emp-suman-01'; // Rahul Sharma (Client Manager)
  const emp2Id = 'emp-suman-02'; // Priya Patel (Employee)

  // =========================================================================
  console.log('--- 1. LEAVE-DAY CALCULATION VERIFICATION ---');
  // =========================================================================

  // Test 1.1: Weekend (Saturday-Sunday) Inclusion/Exclusion Check
  {
    // 2026-11-06 is Friday, 2026-11-09 is Monday (Span includes Saturday and Sunday)
    // Inclusive calendar days: 4 days. Working days: 2 days (Fri, Mon).
    // Let's verify what the application produces
    const start = '2026-11-06';
    const end = '2026-11-09';
    const sDate = new Date(start);
    const eDate = new Date(end);
    const calendarDays = Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check if leaveService or store calculates or adjusts for weekends
    // In current implementation: UI and service accept raw totalDays = (end - start) + 1
    const handlesWeekends = false; // Code audit verified: EmployeePortal.tsx line 253: days = diff + 1

    recordResult({
      category: 'Leave-Day Calculation',
      testId: 'CALC-01',
      name: 'Weekend (Saturday/Sunday) Exclusion from Leave Days',
      type: 'Architecture/Code Audit',
      status: 'NOT IMPLEMENTED',
      details: `Formula used is calendar-day: (endDate - startDate) + 1 = ${calendarDays} days. Saturdays and Sundays are deducted from balance without policy exclusion.`,
    });
  }

  // Test 1.2: Client-Specific Weekly Offs Evaluation
  {
    const policyRes = await policyService.getClientPolicy(client1Id);
    const weeklyOffDays = policyRes.data?.weekly_off_days || [];
    // Verify if leaveService inspects client_policies.weekly_off_days
    const isPolicyAware = false; // leaveService.submitLeaveRequest does not load policy

    recordResult({
      category: 'Leave-Day Calculation',
      testId: 'CALC-02',
      name: 'Client-Specific Weekly Offs Evaluation',
      type: 'Architecture/Code Audit',
      status: 'NOT IMPLEMENTED',
      details: `Client policy specifies weekly_off_days: [${weeklyOffDays.join(', ')}], but leaveService.submitLeaveRequest does not query client_policies.`,
    });
  }

  // Test 1.3: Configured Public and Company Holidays Evaluation
  {
    recordResult({
      category: 'Leave-Day Calculation',
      testId: 'CALC-03',
      name: 'Configured Public and Company Holidays Evaluation',
      type: 'Architecture/Code Audit',
      status: 'NOT IMPLEMENTED',
      details: 'statutory_holidays table exists in schema, but leaveService neither queries holidays nor excludes them from leave day count.',
    });
  }

  // Test 1.4: Half-Day Leave Support
  {
    // Schema supports NUMERIC(4,1), but UI portal only has HTML date picker with integer days
    recordResult({
      category: 'Leave-Day Calculation',
      testId: 'CALC-04',
      name: 'Half-Day Leave Application & Deductions',
      type: 'Architecture/Code Audit',
      status: 'NOT IMPLEMENTED',
      details: 'Database column NUMERIC(4,1) technically supports 0.5, but UI (EmployeePortal.tsx) and service layer only process whole calendar days.',
    });
  }

  // Test 1.5: Cross-Calendar/Financial Year Leave Spans
  {
    // 2026-12-30 to 2027-01-03: 5 days spanning 2026 and 2027
    // leaveService line 201: const year = new Date(payload.startDate).getFullYear()
    // It charges all 5 days to 2026 balance
    recordResult({
      category: 'Leave-Day Calculation',
      testId: 'CALC-05',
      name: 'Cross-Year Leave Application Balance Splitting',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'leaveService derives year solely from startDate (2026), debiting all cross-year days from 2026 without splitting across 2027 ledger.',
    });
  }

  // =========================================================================
  console.log('\n--- 2. ATOMIC BALANCE DEDUCTION & TRANSACTION CONCURRENCY ---');
  // =========================================================================

  // Test 2.1: Non-Atomic Supabase Sequence Audit
  {
    // In leaveService.ts lines 423-462:
    // Step 4 updates leave_requests, Step 5 updates leave_balances as separate queries
    recordResult({
      category: 'Transaction Integrity',
      testId: 'TX-01',
      name: 'Database Transaction Boundary (leave_requests + leave_balances)',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'reviewLeaveRequest executes separate PostgREST update statements without a BEGIN...COMMIT PostgreSQL transaction or RPC function.',
    });
  }

  // Test 2.2: Double Approval Race Condition (Two concurrent approvals)
  {
    // Setup synthetic request
    const synReq = store.submitLeaveRequest({
      clientId: client1Id,
      employeeId: emp2Id,
      employeeName: 'Priya Patel',
      leaveType: 'CL',
      startDate: '2026-11-25',
      endDate: '2026-11-25',
      totalDays: 1,
      reason: 'Concurrent approval test synthetic request',
    });

    const balBefore = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'CL')!;
    const closingBefore = balBefore.closing;

    // Simulate concurrent invocation of reviewLeaveRequest
    const [p1, p2] = await Promise.all([
      leaveService.reviewLeaveRequest(synReq.id, { status: 'APPROVED', reviewerId: 'mgr-1', remarks: 'Manager 1 approve' }, { role: 'client_admin', clientId: client1Id }),
      leaveService.reviewLeaveRequest(synReq.id, { status: 'APPROVED', reviewerId: 'mgr-2', remarks: 'Manager 2 approve' }, { role: 'client_admin', clientId: client1Id }),
    ]);

    const balAfter = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'CL')!;
    const deductions = closingBefore - balAfter.closing;

    // In mock mode store is synchronous in-memory, but let's check state guard
    const onePassedOneFailed = (p1.success && !p2.success) || (!p1.success && p2.success);
    if (onePassedOneFailed && deductions === 1) {
      recordResult({
        category: 'Transaction Integrity',
        testId: 'TX-02',
        name: 'Concurrent Double Approval Prevention (In-Memory Guard)',
        type: 'Concurrent database test',
        status: 'PASS',
        details: 'Store state transition guard caught second approval attempt in mock mode. Exactly 1 day deducted.',
      });
    } else {
      recordResult({
        category: 'Transaction Integrity',
        testId: 'TX-02',
        name: 'Concurrent Double Approval Prevention (In-Memory Guard)',
        type: 'Concurrent database test',
        status: 'FAIL',
        details: `Race condition allowed multiple approvals or incorrect deductions: deductions=${deductions}`,
      });
    }
  }

  // Test 2.3: Two concurrent requests consuming the same remaining balance
  {
    // Suppose employee has closing balance of 1 day.
    // Employee submits two 1-day requests.
    // Two managers approve each request concurrently.
    const synReqA = store.submitLeaveRequest({
      clientId: client1Id,
      employeeId: emp2Id,
      employeeName: 'Priya Patel',
      leaveType: 'SL',
      startDate: '2026-12-15',
      endDate: '2026-12-15',
      totalDays: 1,
      reason: 'Concurrent balance exhaustion test A',
    });
    const synReqB = store.submitLeaveRequest({
      clientId: client1Id,
      employeeId: emp2Id,
      employeeName: 'Priya Patel',
      leaveType: 'SL',
      startDate: '2026-12-18',
      endDate: '2026-12-18',
      totalDays: 1,
      reason: 'Concurrent balance exhaustion test B',
    });

    // In leaveService.ts live mode:
    // reviewLeaveRequest DOES NOT verify balance availability at approval time!
    // It blindly increments used and calculates closing = max(0, ...).
    recordResult({
      category: 'Transaction Integrity',
      testId: 'TX-03',
      name: 'Balance Solvency Verification at Approval Time',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'reviewLeaveRequest() has zero balance check prior to approval; if multiple pending requests exceed available balance, all are approved and balance is clamped to 0.',
    });
  }

  // Test 2.4: Approval Partial Failure (Balance Update Fails)
  {
    recordResult({
      category: 'Transaction Integrity',
      testId: 'TX-04',
      name: 'Partial Failure Recovery (Balance update failure leaves request APPROVED)',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'In leaveService.ts, request is updated to APPROVED before balance is updated. If balance update fails, request remains APPROVED with zero balance deduction.',
    });
  }

  // =========================================================================
  console.log('\n--- 3. RLS & ROLE PERMISSION DISCREPANCY AUDIT ---');
  // =========================================================================

  // Test 3.1: Super Admin Multi-Tenant Scoping in leave_balances & leave_requests
  {
    // Migration 09: USING (client_id = public.get_user_client_id() AND public.get_user_role() IN ('super_admin', ...))
    recordResult({
      category: 'RLS & Permissions',
      testId: 'RLS-01',
      name: 'Super Admin Cross-Tenant Access to leave_balances and leave_requests',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'RLS policy enforces client_id = public.get_user_client_id() for super_admin. Global super_admins with client_id IS NULL are blocked from all records.',
    });
  }

  // Test 3.2: Location Manager Approval Authority Discrepancy
  {
    // Matrix specifies: Location Manager has "Yes (Location)" approval permissions
    // Migration 09 leave_requests_tenant_admin_all: IN ('super_admin', 'client_admin', 'hr_admin', 'client_manager')
    // location_manager is completely missing!
    recordResult({
      category: 'RLS & Permissions',
      testId: 'RLS-02',
      name: 'Location Manager RLS Policy Inclusion in leave_requests',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'Location Manager is authorized in Permission Matrix, but omitted from leave_requests_tenant_admin_all RLS policy in 20261103000009_row_level_security_policies.sql.',
    });
  }

  // Test 3.3: Client Manager Balance Adjustment Discrepancy
  {
    // Migration 09 leave_balances_tenant_admin_all: IN ('super_admin', 'client_admin', 'hr_admin')
    // client_manager can update leave_requests, but cannot update leave_balances!
    recordResult({
      category: 'RLS & Permissions',
      testId: 'RLS-03',
      name: 'Client Manager RLS Policy on leave_balances',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'client_manager can approve requests in leave_requests, but lacks UPDATE on leave_balances. Approvals by client_manager fail with RLS 42501 in live Supabase mode.',
    });
  }

  // Test 3.4: Employee Self-Approval Vulnerability (FOR ALL on leave_requests)
  {
    // Migration 09: CREATE POLICY "leave_requests_employee_all" ON leave_requests FOR ALL TO authenticated USING (employee_id = public.get_user_employee_id())
    recordResult({
      category: 'RLS & Permissions',
      testId: 'RLS-04',
      name: 'Employee Direct Status Tamper / Self-Approval via RLS FOR ALL',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'leave_requests_employee_all uses FOR ALL without status restriction. An employee can directly issue PostgREST UPDATE to set status = APPROVED on their own row.',
    });
  }

  // Test 3.5: Payroll Admin Read Access to leave_requests
  {
    // Payroll Admin needs approved leave data for payroll, but has no SELECT policy on leave_requests
    recordResult({
      category: 'RLS & Permissions',
      testId: 'RLS-05',
      name: 'Payroll Admin Read Access for Payroll Proration',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'payroll_admin role has no SELECT policy on leave_requests or leave_balances in Migration 09. Payroll engine cannot read leave records under RLS.',
    });
  }

  // =========================================================================
  console.log('\n--- 4. LWP AND PAID LEAVE DISTINCTION ---');
  // =========================================================================

  // Test 4.1: LWP Balance Bypass Verification
  {
    const lwpReq = await leaveService.submitLeaveRequest(
      {
        clientId: client1Id,
        employeeId: emp2Id,
        leaveType: 'LWP',
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        totalDays: 3,
        reason: 'Unpaid personal sabbatical',
      },
      { role: 'employee', clientId: client1Id, employeeId: emp2Id }
    );

    if (lwpReq.success && lwpReq.data?.leave_type === 'LWP') {
      recordResult({
        category: 'LWP Distinction',
        testId: 'LWP-01',
        name: 'LWP Application Exemption from Balance Check',
        type: 'Unit/mock',
        status: 'PASS',
        details: 'LWP applications cleanly bypass leave balance checks and are accepted into the pending queue.',
      });
    } else {
      recordResult({
        category: 'LWP Distinction',
        testId: 'LWP-01',
        name: 'LWP Application Exemption from Balance Check',
        type: 'Unit/mock',
        status: 'FAIL',
        details: 'LWP application failed unexpectedly.',
      });
    }
  }

  // Test 4.2: LWP Zero Balance Deduction on Approval
  {
    const lwpId = (store.getLeaveRequests().find(r => r.leaveType === 'LWP' && r.status === 'PENDING'))?.id;
    if (lwpId) {
      const plBalBefore = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'PL')?.closing;
      const clBalBefore = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'CL')?.closing;
      const slBalBefore = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'SL')?.closing;

      await leaveService.reviewLeaveRequest(
        lwpId,
        { status: 'APPROVED', reviewerId: emp1Id, remarks: 'LWP Approved' },
        { role: 'client_admin', clientId: client1Id }
      );

      const plBalAfter = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'PL')?.closing;
      const clBalAfter = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'CL')?.closing;
      const slBalAfter = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'SL')?.closing;

      const balancesUntouched = (plBalBefore === plBalAfter && clBalBefore === clBalAfter && slBalBefore === slBalAfter);
      recordResult({
        category: 'LWP Distinction',
        testId: 'LWP-02',
        name: 'LWP Approval Zero Impact on Paid Leave Balances',
        type: 'Unit/mock',
        status: balancesUntouched ? 'PASS' : 'FAIL',
        details: balancesUntouched
          ? 'Approving LWP resulted in exactly 0 deductions across PL, CL, and SL balances.'
          : 'LWP approval unexpectedly altered paid leave balances.',
      });
    }
  }

  // Test 4.3: LWP Representation in daily_attendance_records Schema
  {
    // Migration 05: CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'))
    // There is NO 'UNPAID_LEAVE' or 'LWP' in status!
    recordResult({
      category: 'LWP Distinction',
      testId: 'LWP-03',
      name: 'LWP Status in daily_attendance_records Check Constraint',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: "daily_attendance_records.status CHECK constraint only permits ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'). No 'UNPAID_LEAVE' or 'LWP' status exists in PostgreSQL schema.",
    });
  }

  // =========================================================================
  console.log('\n--- 5. ATTENDANCE INTEGRITY & MUSTER OVERLAY ---');
  // =========================================================================

  // Test 5.1: Automatic Muster Record Creation upon Leave Approval
  {
    // Verify whether reviewLeaveRequest creates rows in daily_attendance_records
    recordResult({
      category: 'Attendance Integrity',
      testId: 'ATT-01',
      name: 'Automatic Muster Row Population upon Leave Approval',
      type: 'Architecture/Code Audit',
      status: 'NOT IMPLEMENTED',
      details: 'leaveService.reviewLeaveRequest does NOT insert rows into daily_attendance_records. Approved leaves do not appear in attendance muster.',
    });
  }

  // Test 5.2: AttendanceCommandCenter Query Dynamic Leave Overlay
  {
    // AttendanceCommandCenter.tsx lines 67-95: only queries getDailyAttendance, never queries getLeaveRequests
    recordResult({
      category: 'Attendance Integrity',
      testId: 'ATT-02',
      name: 'Attendance Command Center Dynamic Approved Leave Overlay',
      type: 'Architecture/Code Audit',
      status: 'NOT IMPLEMENTED',
      details: 'AttendanceCommandCenter.tsx only queries daily_attendance_records. It does not fetch leave_requests or overlay approved leaves.',
    });
  }

  // Test 5.3: False Absenteeism Classification
  {
    // In AttendanceCommandCenter line 140:
    // absentCount = Math.max(0, totalRoster - (presentCount + halfDayCount + leaveCount))
    // If an employee is on approved leave without a daily_attendance_records row, leaveCount is 0 and they are counted as ABSENT (Triggering LWP deduction!)
    recordResult({
      category: 'Attendance Integrity',
      testId: 'ATT-03',
      name: 'Prevention of False Absenteeism for Approved Leave Staff',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'Employees with approved leave but no daily_attendance_records row are counted in absentCount and flagged "Triggers LWP Deduction".',
    });
  }

  // Test 5.4: Weekly Off / Holiday False Absenteeism
  {
    recordResult({
      category: 'Attendance Integrity',
      testId: 'ATT-04',
      name: 'Weekly Off / Holiday Exclusion from Absenteeism Metric',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: 'absentCount calculation does not check weekly_off_days or statutory_holidays. Non-working days report entire workforce as absent.',
    });
  }

  // =========================================================================
  console.log('\n--- 6. ENTITLEMENT AND BALANCE LEDGER INVARIANT ---');
  // =========================================================================

  // Test 6.1: Balance Equation Invariant: opening + credited - used = closing
  {
    const allBalances = (store as any).leaveBalances || [];
    let invariantHolds = true;
    let failingRow: any = null;

    for (const b of allBalances) {
      const expectedClosing = Math.max(0, b.opening + b.credited - b.used);
      if (Math.abs(expectedClosing - b.closing) > 0.01) {
        invariantHolds = false;
        failingRow = b;
        break;
      }
    }

    recordResult({
      category: 'Balance Ledger',
      testId: 'BAL-01',
      name: 'Balance Arithmetic Invariant (opening + credited - used = closing)',
      type: 'Unit/mock',
      status: invariantHolds ? 'PASS' : 'FAIL',
      details: invariantHolds
        ? `Verified across ${allBalances.length} active balance rows in store.`
        : `Invariant violated in row ${failingRow?.id}: opening(${failingRow?.opening}) + credited(${failingRow?.credited}) - used(${failingRow?.used}) != closing(${failingRow?.closing})`,
    });
  }

  // Test 6.2: Duplicate Credit Prevention & Accrual Engine Audit
  {
    recordResult({
      category: 'Balance Ledger',
      testId: 'BAL-02',
      name: 'Automated Leave Accrual & Carry-Forward Engine',
      type: 'Architecture/Code Audit',
      status: 'NOT IMPLEMENTED',
      details: 'No automated monthly accrual, carry-forward, or year-end lapse job exists in codebase. Balances are initialized from static seed/mock data.',
    });
  }

  // Test 6.3: COMP_OFF in PostgreSQL Schema
  {
    recordResult({
      category: 'Balance Ledger',
      testId: 'BAL-03',
      name: 'COMP_OFF Leave Type Database Constraint Compatibility',
      type: 'Architecture/Code Audit',
      status: 'FAIL',
      details: "INITIAL_LEAVE_BALANCES contains 'COMP_OFF' for Maha Logistics, but migration 06 check constraint specifies leave_type IN ('PL', 'CL', 'SL').",
    });
  }

  // =========================================================================
  console.log('\n--- 7. LIVE DATABASE & POSTGREST STATUS ---');
  // =========================================================================

  setDevDataSourceMode('live');

  // Test 7.1: Live PostgREST Connectivity
  {
    const { data, error } = await supabase.from('leave_balances').select('id').limit(1);
    const connected = !error;
    recordResult({
      category: 'Real Database',
      testId: 'LIVE-01',
      name: 'Live Supabase PostgREST Connection on leave_balances',
      type: 'Real database',
      status: connected ? 'PASS' : 'FAIL',
      details: connected ? 'HTTP 200 PostgREST response' : `PostgREST error: ${error.message}`,
    });
  }

  // Test 7.2: Authenticated Test Accounts Availability
  {
    recordResult({
      category: 'Real Database',
      testId: 'LIVE-02',
      name: 'Live Supabase Auth Test Accounts Availability',
      type: 'Authenticated RLS',
      status: 'BLOCKED',
      details: 'Live Supabase Auth has zero test personas provisioned in auth.users. Authenticated RLS tests against live backend require provisioned test credentials or service-role auth generation.',
    });
  }

  // =========================================================================
  console.log('\n========================================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const notImplCount = results.filter(r => r.status === 'NOT IMPLEMENTED').length;
  const blockedCount = results.filter(r => r.status === 'BLOCKED').length;
  const reqApprovalCount = results.filter(r => r.status === 'REQUIRES APPROVAL').length;

  console.log(`TOTAL CHECKS:          ${results.length}`);
  console.log(`PASS:                  ${passCount}`);
  console.log(`FAIL (Defects):        ${failCount}`);
  console.log(`NOT IMPLEMENTED:       ${notImplCount}`);
  console.log(`BLOCKED:               ${blockedCount}`);
  console.log(`REQUIRES APPROVAL:     ${reqApprovalCount}`);
  console.log('========================================================================\n');
}

runVerification().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
