/**
 * Avencis Workforce Management (WFM)
 * Milestone 2.4E — Payroll Engine End-to-End Integration Test Suite
 *
 * Validates:
 * 1. Strict attendance finalization gating (unresolved regularisations block calculation/locking).
 * 2. Regularisation approval unblocks payroll generation.
 * 3. Complete payroll run calculation with Form XIX breakdowns & statutory separation.
 * 4. Manual authorised overtime and variable incentive overrides with dynamic recalculation.
 * 5. Approval lifecycle (draft -> under_review -> approved -> locked).
 * 6. Published Form XIX payslip registry persistence.
 * 7. Frontend & database tamper guards preventing mutations on locked runs.
 * 8. Employee self-service payslip retrieval.
 */

import { store } from '../src/data/store';
import { payrollService } from '../src/services/payrollService';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [Test ${String(totalTests).padStart(2, '0')}] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [Test ${String(totalTests).padStart(2, '0')}] ${testName}`);
    if (details) {
      console.error(`     Details: ${details}`);
    }
  }
}

async function runPayrollIntegrationTests() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — MILESTONE 2.4E PAYROLL INTEGRATION TEST SUITE');
  console.log('========================================================================\n');

  const testClientId = 'client-suman';
  const testMonth = 11;
  const testYear = 2026;

  // -------------------------------------------------------------------------
  // SECTION 1: ATTENDANCE FINALIZATION GATE
  // -------------------------------------------------------------------------
  console.log('--- 1. Attendance Finalization Gate & Strict Block ---');

  // Inject a synthetic pending attendance regularisation in November 2026
  const pendingCorrection = store.submitCorrection({
    clientId: testClientId,
    employeeId: 'emp-001',
    employeeName: 'Aarav Sharma',
    date: '2026-11-14',
    requestedCheckIn: '09:00',
    requestedCheckOut: '18:00',
    reason: 'Biometric device offline',
  });

  // Verify attendance gate detects pending regularisation
  const gateCheckBefore = await payrollService.verifyAttendanceFinalized(testClientId, testMonth, testYear);
  assert(
    gateCheckBefore.success && !gateCheckBefore.data?.isFinalized && gateCheckBefore.data?.pendingCount! > 0,
    'Attendance Gate Blocks Unfinalized Cycle',
    `Pending count: ${gateCheckBefore.data?.pendingCount}, isFinalized: ${gateCheckBefore.data?.isFinalized}`
  );

  // Attempting to calculate payroll while attendance is pending MUST fail
  const blockedCalc = await payrollService.calculatePayrollRun(testClientId, testMonth, testYear);
  assert(
    !blockedCalc.success && blockedCalc.error?.message.includes('ATTENDANCE_NOT_FINALIZED'),
    'Calculate Payroll Gated by Unfinalized Attendance',
    `Error returned: ${blockedCalc.error?.message}`
  );

  // Resolve the pending correction (Approve it)
  store.reviewCorrection(pendingCorrection.id, 'APPROVED', 'Verified by site supervisor');

  // Re-verify attendance gate after resolution
  const gateCheckAfter = await payrollService.verifyAttendanceFinalized(testClientId, testMonth, testYear);
  assert(
    gateCheckAfter.success && gateCheckAfter.data?.isFinalized === true && gateCheckAfter.data?.pendingCount === 0,
    'Attendance Gate Cleared After Regularisation Approval',
    `isFinalized: ${gateCheckAfter.data?.isFinalized}`
  );

  // -------------------------------------------------------------------------
  // SECTION 2: BATCH PAYROLL GENERATION & STATUTORY BREAKDOWN
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Batch Payroll Generation & Form XIX Item Breakdown ---');

  const calcResult = await payrollService.calculatePayrollRun(testClientId, testMonth, testYear);
  assert(
    calcResult.success && calcResult.data !== null,
    'Payroll Batch Calculation Successful',
    `Success: ${calcResult.success}`
  );

  const { run, items } = calcResult.data!;
  assert(
    run.total_employees > 0 && run.total_gross > 0 && run.total_net > 0,
    'Payroll Run Totals Invariants Satisfied',
    `Gross: ₹${run.total_gross}, Net: ₹${run.total_net}, Deductions: ₹${run.total_deductions}`
  );

  assert(
    items.length === run.total_employees,
    'Employee Headcount Matches Calculated Line Items Count',
    `Run count: ${run.total_employees}, Items length: ${items.length}`
  );

  // Inspect first line item for Form XIX compliance
  const firstItem = items[0];
  assert(
    firstItem.basic_pay !== undefined && firstItem.hra !== undefined && firstItem.conveyance !== undefined,
    'Line Item Contains Explicit Basic, HRA & Conveyance Breakdown',
    `Basic: ₹${firstItem.basic_pay}, HRA: ₹${firstItem.hra}, Conveyance: ₹${firstItem.conveyance}`
  );

  assert(
    firstItem.pf_employer !== undefined && firstItem.esic_employer !== undefined,
    'Line Item Contains Distinct Employer Statutory Contributions',
    `PF Employer: ₹${firstItem.pf_employer}, ESIC Employer: ₹${firstItem.esic_employer}`
  );

  assert(
    firstItem.gross_earned - firstItem.total_deductions === firstItem.net_salary,
    'Net Salary Mathematical Invariant (Gross - Total Deductions == Net)',
    `Gross: ${firstItem.gross_earned}, Deductions: ${firstItem.total_deductions}, Net: ${firstItem.net_salary}`
  );

  // -------------------------------------------------------------------------
  // SECTION 3: MANUAL AUTHORISED OVERTIME & REVIEWS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Authorised Overtime & Variable Overrides ---');

  const targetEmpId = firstItem.employee_id;
  const initialGross = firstItem.gross_earned;
  const initialNet = firstItem.net_salary;
  const authorisedOTPay = 4500;

  const overrideResult = await payrollService.updatePayrollItemOverrides(
    run.id,
    targetEmpId,
    authorisedOTPay,
    firstItem.incentives
  );

  assert(
    overrideResult.success && overrideResult.data?.overtime_pay === authorisedOTPay,
    'Authorised Overtime Pay Overridden on Line Item',
    `Overtime pay recorded: ₹${overrideResult.data?.overtime_pay}`
  );

  assert(
    overrideResult.data?.gross_earned === initialGross + authorisedOTPay,
    'Gross Earned Increases by Exact Authorised Overtime Amount',
    `New Gross: ₹${overrideResult.data?.gross_earned}, Expected: ₹${initialGross + authorisedOTPay}`
  );

  assert(
    overrideResult.data?.net_salary! > initialNet,
    'Net Take-Home Salary Positively Reflects Authorised Overtime',
    `New Net: ₹${overrideResult.data?.net_salary}, Previous Net: ₹${initialNet}`
  );

  // -------------------------------------------------------------------------
  // SECTION 4: SEGREGATION OF DUTIES & APPROVAL LIFECYCLE
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Segregation of Duties & Approval Lifecycle ---');

  // Step 1: Manager Review / Approval
  const approveResult = await payrollService.approvePayrollRun(run.id, 'Operations Manager');
  assert(
    approveResult.success && approveResult.data?.status === 'approved',
    'Payroll Run Status Transitions to APPROVED',
    `Status: ${approveResult.data?.status}, ApprovedBy: ${approveResult.data?.approved_by}`
  );

  // Step 2: Executive Final Locking
  const lockResult = await payrollService.lockPayrollRun(run.id, 'Chief Financial Officer');
  assert(
    lockResult.success && lockResult.data?.status === 'locked',
    'Payroll Run Terminal Lock Transitions to LOCKED',
    `Status: ${lockResult.data?.status}, LockedBy: ${lockResult.data?.locked_by}`
  );

  // -------------------------------------------------------------------------
  // SECTION 5: TAMPER GUARDS ON LOCKED RUNS
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Tamper Guard & Immutability Enforcement ---');

  // Attempting to modify line items on a locked run MUST be rejected
  const tamperAttempt = await payrollService.updatePayrollItemOverrides(
    run.id,
    targetEmpId,
    99999
  );
  assert(
    !tamperAttempt.success && tamperAttempt.error?.message.includes('TAMPER GUARD'),
    'Tamper Guard Strictly Blocks Modifications to Locked Batch',
    `Tamper result error: ${tamperAttempt.error?.message}`
  );

  // Frontend helper tamper assertion
  const guardAssert = payrollService.assertPayrollNotLocked(lockResult.data!);
  assert(
    !guardAssert.success && guardAssert.error?.message.includes('TAMPER GUARD'),
    'assertPayrollNotLocked Rejects Locked Run Row',
    `Assertion error: ${guardAssert.error?.message}`
  );

  // -------------------------------------------------------------------------
  // SECTION 6: PUBLISHED PAYSLIP REGISTRY & SELF-SERVICE ACCESS
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Published Payslip Registry & Employee Self-Service ---');

  const payslipsResult = await payrollService.getPayslips({
    clientId: testClientId,
    periodMonth: testMonth,
    periodYear: testYear,
  });

  assert(
    payslipsResult.success && payslipsResult.data!.length > 0,
    'Published Form XIX Payslips Created in Registry Upon Locking',
    `Payslips count: ${payslipsResult.data?.length}`
  );

  const empPayslipRes = await payrollService.getPublishedPayslip(targetEmpId, testMonth, testYear);
  assert(
    empPayslipRes.success && empPayslipRes.data?.payslip.is_published === true,
    'Employee Portal Successfully Retrieves Published Form XIX Payslip',
    `Payslip ID: ${empPayslipRes.data?.payslip.id}, Published: ${empPayslipRes.data?.payslip.is_published}`
  );

  assert(
    empPayslipRes.data?.item?.overtime_pay === authorisedOTPay,
    'Retrieved Employee Payslip Item Preserves Authorised Overtime Snapshot',
    `Overtime pay in snapshot: ₹${empPayslipRes.data?.item?.overtime_pay}`
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`TOTAL PAYROLL INTEGRATION TESTS: ${totalTests}`);
  console.log(`PASSED:                          ${passedTests}`);
  console.log(`FAILED:                          ${failedTests}`);
  console.log(`SUCCESS RATE:                    ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPayrollIntegrationTests().catch(err => {
  console.error('Fatal error in integration tests:', err);
  process.exit(1);
});
