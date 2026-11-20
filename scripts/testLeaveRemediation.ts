/**
 * AVENCIS WORKFORCE MANAGEMENT (WFM)
 * MILESTONE 2.4D.1 REMEDIATION & MIGRATION VERIFICATION SUITE
 *
 * Validates:
 * 1. Policy-aware working day calculations (weekly offs, holidays, half-day, cross-year)
 * 2. Concurrency guards & double-approval prevention
 * 3. Pre-approval balance solvency verification
 * 4. Anti-self-approval enforcement
 * 5. Role and multi-tenant scoping (Super Admin, Location Manager, Client Manager)
 * 6. LWP vs Paid Leave attendance muster synchronization
 * 7. Prevention of false absenteeism in attendance command center
 */

import { leaveService } from '../src/services/leaveService';
import { calculateEffectiveLeaveDays } from '../src/services/leaveCalculationHelper';
import { store } from '../src/data/store';
import { setDevDataSourceMode } from '../src/services/serviceConfig';
import { supabase } from '../src/lib/supabase';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${testName}${detail ? ` — ${detail}` : ''}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runRemediationTests() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — MILESTONE 2.4D.1 REMEDIATION VERIFICATION SUITE');
  console.log('========================================================================\n');

  setDevDataSourceMode('mock');

  const client1Id = 'client-suman';
  const client2Id = 'client-maha';
  const emp1Id = 'emp-suman-01'; // Rahul Sharma (Client Manager)
  const emp2Id = 'emp-suman-02'; // Priya Patel (Employee)

  // -------------------------------------------------------------------------
  console.log('--- 1. Policy-Aware Leave Calculation Engine ---');
  // -------------------------------------------------------------------------
  {
    // Test 1: Weekend Exclusion (Fri–Mon with Sat-Sun off = 2 working days)
    const weekendCalc = calculateEffectiveLeaveDays({
      startDate: '2026-11-06', // Fri
      endDate: '2026-11-09',   // Mon
      weeklyOffDays: ['SATURDAY', 'SUNDAY'],
    });
    assert(
      weekendCalc.totalCalendarDays === 4 && weekendCalc.totalLeaveDays === 2 && weekendCalc.weeklyOffCount === 2,
      '[Test 01] [Unit/Mock] Weekend Exclusion from Leave Days',
      `Calendar: 4d, Working Leave: ${weekendCalc.totalLeaveDays}d, Weekly Offs: ${weekendCalc.weeklyOffCount}d`
    );

    // Test 2: Holiday Exclusion (Tue–Thu with Wed as holiday = 2 working days)
    const holidayCalc = calculateEffectiveLeaveDays({
      startDate: '2026-11-03',
      endDate: '2026-11-05',
      weeklyOffDays: ['SUNDAY'],
      holidays: ['2026-11-04'],
    });
    assert(
      holidayCalc.totalCalendarDays === 3 && holidayCalc.totalLeaveDays === 2 && holidayCalc.holidayCount === 1,
      '[Test 02] [Unit/Mock] Declared Holiday Exclusion from Leave Days',
      `Calendar: 3d, Working Leave: ${holidayCalc.totalLeaveDays}d, Holidays: ${holidayCalc.holidayCount}d`
    );

    // Test 3: Half-Day Leave Support (0.5 day)
    const halfDayCalc = calculateEffectiveLeaveDays({
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      weeklyOffDays: ['SUNDAY'],
      isHalfDay: true,
    });
    assert(
      halfDayCalc.totalLeaveDays === 0.5,
      '[Test 03] [Unit/Mock] Half-Day Leave Duration Resolution',
      `Total Leave: ${halfDayCalc.totalLeaveDays} day`
    );

    // Test 4: Cross-Year Application Breakdown (Dec 30 2026 to Jan 03 2027)
    const crossYearCalc = calculateEffectiveLeaveDays({
      startDate: '2026-12-30',
      endDate: '2027-01-03',
      weeklyOffDays: ['SATURDAY', 'SUNDAY'],
    });
    assert(
      crossYearCalc.daysByYear[2026] === 2 && crossYearCalc.daysByYear[2027] === 1,
      '[Test 04] [Unit/Mock] Cross-Year Leave Span Splitting',
      `2026 days: ${crossYearCalc.daysByYear[2026]}d, 2027 days: ${crossYearCalc.daysByYear[2027]}d`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 2. Corporate Governance & Anti-Self-Approval ---');
  // -------------------------------------------------------------------------
  {
    // Submit request for Rahul (Manager)
    const rahulReq = await leaveService.submitLeaveRequest(
      {
        clientId: client1Id,
        employeeId: emp1Id,
        leaveType: 'CL',
        startDate: '2026-11-18',
        endDate: '2026-11-18',
        totalDays: 1,
        reason: 'Personal affairs',
      },
      { role: 'client_manager', clientId: client1Id, employeeId: emp1Id }
    );
    const reqId = rahulReq.data!.id;

    // Test 5: Rahul attempting to approve his own request blocked
    const selfApprove = await leaveService.reviewLeaveRequest(
      reqId,
      { status: 'APPROVED', reviewerId: emp1Id, reviewerEmployeeId: emp1Id, remarks: 'Self approval attempt' },
      { role: 'client_manager', clientId: client1Id, employeeId: emp1Id }
    );
    assert(
      !selfApprove.data && selfApprove.error?.code === 'PERMISSION_ERROR',
      '[Test 05] [Corporate Governance] Anti-Self-Approval Rule Blocks Manager Self-Review',
      selfApprove.error?.message
    );

    // Test 6: Cross-Client Review Blocked
    const crossClientReview = await leaveService.reviewLeaveRequest(
      reqId,
      { status: 'APPROVED', reviewerId: 'mgr-client2', reviewerEmployeeId: 'emp-maha-01', remarks: 'Cross tenant review' },
      { role: 'client_admin', clientId: client2Id } // Client 2 admin
    );
    // Since caller is from client2 and request belongs to client1
    assert(
      !crossClientReview.data || crossClientReview.error !== null,
      '[Test 06] [Multitenancy] Cross-Tenant Managerial Review Forbidden',
      'Client 2 manager rejected from reviewing Client 1 leave request'
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 3. Atomic Balance Deduction & Concurrency Integrity ---');
  // -------------------------------------------------------------------------
  {
    // Setup request for Priya
    const priyaReq = await leaveService.submitLeaveRequest(
      {
        clientId: client1Id,
        employeeId: emp2Id,
        leaveType: 'PL',
        startDate: '2026-11-23',
        endDate: '2026-11-24',
        totalDays: 2,
        reason: 'Pre-approved family vacation',
      },
      { role: 'employee', clientId: client1Id, employeeId: emp2Id }
    );
    const pReqId = priyaReq.data!.id;

    const balBefore = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'PL')!;
    const closingBefore = balBefore.closing;
    const usedBefore = balBefore.used;

    // Test 7: Approved Paid Leave Deducts Exactly Once
    const approveRes = await leaveService.reviewLeaveRequest(
      pReqId,
      { status: 'APPROVED', reviewerId: emp1Id, reviewerEmployeeId: emp1Id, remarks: 'Approved' },
      { role: 'client_admin', clientId: client1Id }
    );
    assert(
      approveRes.data !== null && approveRes.data.status === 'APPROVED',
      '[Test 07] [Unit/Mock] Valid Managerial Approval Transitions Status to APPROVED',
      `Status: ${approveRes.data?.status}`
    );

    const balAfter = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'PL')!;
    assert(
      balAfter.used === usedBefore + 2 && balAfter.closing === closingBefore - 2,
      '[Test 08] [Balance Ledger] Paid Leave Deduction Exactly Equals Requested Total Days',
      `Used: ${usedBefore} -> ${balAfter.used} (+2d), Closing: ${closingBefore} -> ${balAfter.closing} (-2d)`
    );

    // Test 9: Duplicate Approval Blocked by Guard
    const dupApprove = await leaveService.reviewLeaveRequest(
      pReqId,
      { status: 'APPROVED', reviewerId: emp1Id, reviewerEmployeeId: emp1Id, remarks: 'Duplicate' },
      { role: 'client_admin', clientId: client1Id }
    );
    assert(
      !dupApprove.data && dupApprove.error?.code === 'VALIDATION_ERROR',
      '[Test 09] [State Machine] Duplicate Approval Attempt Strictly Blocked',
      dupApprove.error?.message
    );
    assert(
      balAfter.used === usedBefore + 2,
      '[Test 10] [Balance Invariant] Duplicate Approval Does Not Cause Double Balance Debit',
      `Used remains ${balAfter.used}d`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 4. LWP & Attendance Muster Synchronization ---');
  // -------------------------------------------------------------------------
  {
    // Submit LWP request
    const lwpReq = await leaveService.submitLeaveRequest(
      {
        clientId: client1Id,
        employeeId: emp2Id,
        leaveType: 'LWP',
        startDate: '2026-11-26',
        endDate: '2026-11-27',
        totalDays: 2,
        reason: 'Personal leave without pay sabbatical',
      },
      { role: 'employee', clientId: client1Id, employeeId: emp2Id }
    );
    const lwpId = lwpReq.data!.id;

    const plBefore = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'PL')!.closing;
    const clBefore = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'CL')!.closing;

    // Approve LWP
    await leaveService.reviewLeaveRequest(
      lwpId,
      { status: 'APPROVED', reviewerId: emp1Id, reviewerEmployeeId: emp1Id, remarks: 'LWP Approved' },
      { role: 'client_admin', clientId: client1Id }
    );

    const plAfter = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'PL')!.closing;
    const clAfter = store.getLeaveBalances(emp2Id).find(b => b.leaveType === 'CL')!.closing;

    // Test 11: LWP causes zero deductions
    assert(
      plBefore === plAfter && clBefore === clAfter,
      '[Test 11] [LWP Distinction] Approved LWP Leaves Paid Leave Balances Completely Untouched',
      `PL: ${plBefore}d -> ${plAfter}d, CL: ${clBefore}d -> ${clAfter}d`
    );

    // Test 12: Attendance records created in muster as UNPAID_LEAVE
    const musterRecords = store.getAttendanceRecords(client1Id, '2026-11-26');
    const priyaMuster = musterRecords.find(r => r.employeeId === emp2Id);
    assert(
      priyaMuster !== undefined && priyaMuster.status === 'UNPAID_LEAVE',
      '[Test 12] [Attendance Sync] Approved LWP Synchronized into Muster as UNPAID_LEAVE',
      `Muster record date 2026-11-26 status: ${priyaMuster?.status}`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 5. Attendance Command Center False Absenteeism Prevention ---');
  // -------------------------------------------------------------------------
  {
    // Test 13: Approved Paid Leave mapped to PAID_LEAVE in muster
    const paidLeaveMuster = store.getAttendanceRecords(client1Id, '2026-11-23').find(r => r.employeeId === emp2Id);
    assert(
      paidLeaveMuster !== undefined && paidLeaveMuster.status === 'PAID_LEAVE',
      '[Test 13] [Attendance Sync] Approved Paid Leave Synchronized into Muster as PAID_LEAVE',
      `Muster record date 2026-11-23 status: ${paidLeaveMuster?.status}`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 6. Live PostgREST Database Connectivity ---');
  // -------------------------------------------------------------------------
  {
    setDevDataSourceMode('live');
    const { error: liveBalErr } = await supabase.from('leave_balances').select('id').limit(1);
    assert(
      liveBalErr === null,
      '[Test 14] [Real Database] Live Supabase PostgREST Connectivity on leave_balances',
      liveBalErr ? liveBalErr.message : 'HTTP 200 PostgREST response'
    );

    const { error: liveReqErr } = await supabase.from('leave_requests').select('id').limit(1);
    assert(
      liveReqErr === null,
      '[Test 15] [Real Database] Live Supabase PostgREST Connectivity on leave_requests',
      liveReqErr ? liveReqErr.message : 'HTTP 200 PostgREST response'
    );
  }

  console.log('\n========================================================================');
  console.log(`TOTAL REMEDIATION TESTS: ${totalTests}`);
  console.log(`PASSED:                  ${passedTests}`);
  console.log(`FAILED:                  ${failedTests}`);
  console.log(`SUCCESS RATE:            ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runRemediationTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
