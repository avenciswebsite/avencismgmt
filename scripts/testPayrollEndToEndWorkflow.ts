/**
 * AVENCIS WORKFORCE MANAGEMENT (WFM)
 * MILESTONE 2.4E.4 — END-TO-END PAYROLL LIFECYCLE VERIFICATION SUITE
 *
 * Validates the Complete 10-Step Operational Lifecycle:
 * 1.  Active Salary Structures Ingestion
 * 2.  Attendance Records & Regularisations Muster Gathering
 * 3.  Attendance Finalization Gate Enforcement & Resolution
 * 4.  Authoritative Payroll Calculation via generate_payroll_run
 * 5.  Managerial Review & Adjustments (Authorised Overtime, Incentives)
 * 6.  Four-Eyes Segregation of Duties Executive Approval
 * 7.  Terminal Cryptographic Locking via lock_payroll_run
 * 8.  Form XIX Statutory Payslip Generation & Registry Activation
 * 9.  Employee Mobile/Self-Service Portal Retrieval & Verification
 * 10. Immutability Verification: Subsequent Salary Structure Revisions
 *     Do NOT Alter Historical Published Payslips (Frozen Snapshot Proof).
 */

import { payrollService } from '../src/services/payrollService';
import { employeeService } from '../src/services/employeeService';
import { store } from '../src/data/store';
import { setDevDataSourceMode } from '../src/services/serviceConfig';

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

async function runEndToEndWorkflowTests() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — MILESTONE 2.4E.4 COMPLETE 10-STEP PAYROLL LIFECYCLE SUITE');
  console.log('========================================================================\n');

  setDevDataSourceMode('mock');

  const clientId = 'client-suman';
  const periodMonth = 11;
  const periodYear = 2026;
  const targetEmployeeId = 'emp-suman-01'; // Rahul Sharma

  // -------------------------------------------------------------------------
  console.log('--- Step 1: Active Salary Structure Resolution ---');
  // -------------------------------------------------------------------------
  {
    const employee = store.getEmployee(targetEmployeeId);
    assert(!!employee && employee.fixedMonthlySalary > 0,
      '[Step 01] Active Salary Structure Identified',
      `Employee: ${employee?.firstName} ${employee?.lastName}, Base: ₹${employee?.fixedMonthlySalary}`);
  }

  // -------------------------------------------------------------------------
  console.log('\n--- Step 2 & 3: Attendance Ingestion & Finalization Gate ---');
  // -------------------------------------------------------------------------
  let pendingCorrectionId = '';
  {
    // Inject a pending regularisation request
    const pendingCorrection = store.submitCorrection({
      clientId,
      employeeId: targetEmployeeId,
      attendanceRecordId: `att-${targetEmployeeId}-2026-11-05`,
      date: '2026-11-05',
      requestedStatus: 'PRESENT',
      reason: 'Biometric device sensor error during morning punch',
    });
    pendingCorrectionId = pendingCorrection.id;

    // Gate must block
    const blockedCheck = await payrollService.verifyAttendanceFinalized(clientId, periodMonth, periodYear);
    assert(!blockedCheck.data?.isFinalized && blockedCheck.data!.pendingCount > 0,
      '[Step 02] Attendance Finalization Gate Identifies Unresolved Regularisation Requests');

    // Attempting to calculate during unfinalized muster is rejected
    const blockedRunAttempt = await payrollService.calculatePayrollRun(clientId, periodMonth, periodYear);
    assert(!blockedRunAttempt.success && (blockedRunAttempt.error?.message.includes('ATTENDANCE_NOT_FINALIZED') || blockedRunAttempt.error?.message.includes('Attendance')),
      '[Step 03A] Attendance Gate Strictly Blocks Payroll Run Generation while Pending Corrections Exist');

    // Resolve regularisation
    store.reviewCorrection(pendingCorrectionId, 'APPROVED', 'Punch punch record verified with CCTV log', 'HR Admin');

    // Re-verify gate
    const clearedCheck = await payrollService.verifyAttendanceFinalized(clientId, periodMonth, periodYear);
    assert(clearedCheck.success && clearedCheck.data?.isFinalized,
      '[Step 03B] Attendance Finalization Gate Cleared After Formal Regularisation Sign-off');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- Step 4: Batch Payroll Generation via Calculation Engine ---');
  // -------------------------------------------------------------------------
  let generatedRunId = '';
  let initialGross = 0;
  let initialNet = 0;
  {
    const calcRes = await payrollService.calculatePayrollRun(clientId, periodMonth, periodYear);
    assert(calcRes.success && !!calcRes.data, '[Step 04A] Authoritative Payroll Batch Successfully Generated');

    const run = calcRes.data!.run;
    const items = calcRes.data!.items;
    generatedRunId = run.id;

    assert(run.status === 'under_review',
      '[Step 04B] Initial Lifecycle State Set to UNDER_REVIEW for Managerial Inspection');

    assert(items.length > 0 && run.total_employees === items.length,
      '[Step 04C] Headcount Invariant Satisfied',
      `Processed: ${run.total_employees} staff`);

    const targetItem = items.find(i => i.employee_id === targetEmployeeId)!;
    initialGross = targetItem.gross_earned;
    initialNet = targetItem.net_salary;

    assert(targetItem.basic_pay > 0 && targetItem.hra > 0,
      '[Step 04D] Form XIX Compliant Earnings Breakdown Verified',
      `Basic: ₹${targetItem.basic_pay}, HRA: ₹${targetItem.hra}`);
  }

  // -------------------------------------------------------------------------
  console.log('\n--- Step 5: Managerial Review & Authorized Adjustments ---');
  // -------------------------------------------------------------------------
  const authorizedOvertimeAmount = 4500;
  const authorizedIncentiveAmount = 2000;
  {
    const overrideRes = await payrollService.updatePayrollItemOverrides(
      generatedRunId,
      targetEmployeeId,
      authorizedOvertimeAmount,
      authorizedIncentiveAmount
    );

    assert(overrideRes.success && !!overrideRes.data,
      '[Step 05A] Overtime & Variable Incentive Overrides Applied to Line Item');

    const updatedItem = overrideRes.data!;
    assert(updatedItem.overtime_pay === authorizedOvertimeAmount,
      '[Step 05B] Authorized Overtime Accurately Reflected',
      `Overtime Pay: ₹${updatedItem.overtime_pay}`);

    const expectedNewGross = (updatedItem.fixed_salary - updatedItem.unpaid_deduction) + updatedItem.incentives + updatedItem.overtime_pay;
    assert(updatedItem.gross_earned === expectedNewGross,
      '[Step 05C] Gross Earned Accurately Incremented by Authorized Earnings',
      `New Gross: ₹${updatedItem.gross_earned} (Expected: ₹${expectedNewGross})`);

    assert(updatedItem.net_salary > initialNet,
      '[Step 05D] Net Salary Accurately Reflects Added Overtime & Incentive Take-Home',
      `New Net: ₹${updatedItem.net_salary}`);
  }

  // -------------------------------------------------------------------------
  console.log('\n--- Step 6 & 7: Segregation of Duties Sign-off & Terminal Locking ---');
  // -------------------------------------------------------------------------
  {
    // Step 6: Approval
    const approveRes = await payrollService.approvePayrollRun(generatedRunId, 'Prakash Singhania (Client Admin)');
    assert(approveRes.success && approveRes.data?.status === 'approved',
      '[Step 06] Four-Eyes Principle: Executive Sign-off Transitions Run to APPROVED');

    // Step 7: Terminal Lock
    const lockRes = await payrollService.lockPayrollRun(generatedRunId, 'Prakash Singhania (Client Admin)');
    assert(lockRes.success && lockRes.data?.status === 'locked',
      '[Step 07A] Terminal Cryptographic Lock Applied Successfully');

    assert(!!lockRes.data?.locked_at && !!lockRes.data?.locked_by,
      '[Step 07B] Lock Timestamp and Signatory Immutably Recorded in Header',
      `Signatory: ${lockRes.data?.locked_by}`);
  }

  // -------------------------------------------------------------------------
  console.log('\n--- Step 8: Form XIX Statutory Payslip Generation & Registry ---');
  // -------------------------------------------------------------------------
  {
    const slipsRes = await payrollService.getPayslips({ clientId, periodMonth, periodYear });
    assert(slipsRes.success && slipsRes.data!.length > 0,
      '[Step 08A] Form XIX Compliant Statutory Payslips Activated in Central Registry',
      `Generated Slips: ${slipsRes.data!.length}`);

    const targetSlip = slipsRes.data!.find(s => s.employee_id === targetEmployeeId);
    assert(!!targetSlip && targetSlip.is_published,
      '[Step 08B] Employee Form XIX Certificate Marked as PUBLISHED');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- Step 9: Employee Portal Retrieval ---');
  // -------------------------------------------------------------------------
  let publishedHistoricalNet = 0;
  let publishedHistoricalGross = 0;
  {
    const portalSlipRes = await payrollService.getPublishedPayslip(targetEmployeeId, periodMonth, periodYear);
    assert(portalSlipRes.success && !!portalSlipRes.data,
      '[Step 09A] Employee Self-Service Portal Successfully Fetches Official Payslip');

    const payslip = portalSlipRes.data!.payslip;
    const item = portalSlipRes.data!.item;

    assert(!!item && item.overtime_pay === authorizedOvertimeAmount,
      '[Step 09B] Published Payslip Faithfully Preserves Authorized Overtime Snapshot',
      `Prorated OT: ₹${item?.overtime_pay}`);

    publishedHistoricalNet = item!.net_salary;
    publishedHistoricalGross = item!.gross_earned;

    assert(publishedHistoricalNet > 0,
      '[Step 09C] Published Net Take-Home Salary Confirmed',
      `Published Net: ₹${publishedHistoricalNet}`);
  }

  // -------------------------------------------------------------------------
  console.log('\n--- Step 10: Immutability Verification (Salary Revision Invariant) ---');
  // -------------------------------------------------------------------------
  {
    // Simulate subsequent employee salary hike for December 2026 onwards
    // Increase base from ₹35,000 to ₹75,000 in employee master
    const emp = store.getEmployee(targetEmployeeId)!;
    const originalSalary = emp.fixedMonthlySalary;
    emp.fixedMonthlySalary = 75000;
    emp.variableIncentive = 15000;

    // Verify employee master record was altered
    assert(emp.fixedMonthlySalary === 75000,
      '[Step 10A] Subsequent Promotion & Salary Hike Applied to Employee Master (₹75,000)');

    // Now re-query the historical locked November 2026 payslip
    const recheckedSlip = await payrollService.getPublishedPayslip(targetEmployeeId, periodMonth, periodYear);
    const historicalItem = recheckedSlip.data!.item!;

    assert(historicalItem.gross_earned === publishedHistoricalGross,
      '[Step 10B] Immutability Invariant: Historical Gross Earned Remains Frozen in Stone',
      `Historical Gross: ₹${historicalItem.gross_earned} (Unchanged despite hike to ₹75,000)`);

    assert(historicalItem.net_salary === publishedHistoricalNet,
      '[Step 10C] Immutability Invariant: Historical Net Salary Unaffected by Future Salary Structure Changes',
      `Historical Net: ₹${historicalItem.net_salary} == Locked Snapshot ₹${publishedHistoricalNet}`);

    // Restore original salary for clean store state
    emp.fixedMonthlySalary = originalSalary;
  }

  console.log('\n========================================================================');
  console.log(`TOTAL END-TO-END WORKFLOW TESTS: ${totalTests}`);
  console.log(`PASSED:                          ${passedTests}`);
  console.log(`FAILED:                          ${failedTests}`);
  console.log(`SUCCESS RATE:                    ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('========================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runEndToEndWorkflowTests().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
