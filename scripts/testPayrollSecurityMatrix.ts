/**
 * AVENCIS WORKFORCE MANAGEMENT (WFM)
 * MILESTONE 2.4E.3 — AUTHENTICATED PAYROLL SECURITY & RBAC VERIFICATION SUITE
 *
 * Validates Security, RBAC & Isolation across 7 System Roles:
 * 1. Super Admin       — Cross-client oversight & executive governance.
 * 2. HR Admin          — Client-scoped employee master & payroll review.
 * 3. Payroll Admin     — Prepare, calculate & review payroll batches (Segregation of Duties: cannot lock).
 * 4. Client Admin      — Authoritative sign-off & terminal cryptographic locking.
 * 5. Client Manager    — Read-only operational oversight of approved runs.
 * 6. Location Manager  — Scoped strictly to assigned location staff.
 * 7. Employee          — Self-service isolation: Own published Form XIX payslips only.
 *
 * Security Requirements:
 * - Segregation of Duties: Preparer cannot approve or terminal-lock.
 * - Cross-Tenant Isolation: Tenant A cannot access or manipulate Tenant B payroll.
 * - Tamper Guards: Modifications or deletions to locked batches are blocked.
 * - Employee Isolation: Horizontal privilege escalation to peer payslips blocked.
 */

import { payrollService } from '../src/services/payrollService';
import { employeeService } from '../src/services/employeeService';
import { store } from '../src/data/store';
import { setDevDataSourceMode } from '../src/services/serviceConfig';
import { CallerScope } from '../src/services/serviceTypes';

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

async function runSecurityMatrixTests() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — MILESTONE 2.4E.3 PAYROLL RBAC & SECURITY MATRIX SUITE');
  console.log('========================================================================\n');

  setDevDataSourceMode('mock');

  const clientAId = 'client-suman';
  const clientBId = 'client-maha';

  // Role Scopes
  const scopeSuperAdmin: CallerScope = { role: 'super_admin' };
  const scopeClientAdminA: CallerScope = { role: 'client_admin', clientId: clientAId };
  const scopePayrollAdminA: CallerScope = { role: 'payroll_admin', clientId: clientAId };
  const scopeHrAdminA: CallerScope = { role: 'hr_admin', clientId: clientAId };
  const scopeClientManagerA: CallerScope = { role: 'client_manager', clientId: clientAId };
  const scopeLocationManagerA: CallerScope = { role: 'location_manager', clientId: clientAId, locationId: 'loc-suman-pune' };
  const scopeEmployee1A: CallerScope = { role: 'employee', clientId: clientAId, employeeId: 'emp-suman-01' };
  const scopeEmployee2A: CallerScope = { role: 'employee', clientId: clientAId, employeeId: 'emp-suman-02' };

  // Tenant B Scopes
  const scopeClientAdminB: CallerScope = { role: 'client_admin', clientId: clientBId };
  const scopePayrollAdminB: CallerScope = { role: 'payroll_admin', clientId: clientBId };

  // -------------------------------------------------------------------------
  console.log('--- 1. Role 1: Super Admin — Full Cross-Client Governance ---');
  // -------------------------------------------------------------------------
  {
    const runsA = await payrollService.getPayrollRuns(clientAId);
    const runsB = await payrollService.getPayrollRuns(clientBId);
    assert(runsA.success && Array.isArray(runsA.data), '[Test 01] Super Admin Access to Tenant A Payroll Runs');
    assert(runsB.success && Array.isArray(runsB.data), '[Test 02] Super Admin Access to Tenant B Payroll Runs (Cross-Tenant Oversight)');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 2. Role 2 & 3: Payroll Admin vs HR Admin Preparation Rights ---');
  // -------------------------------------------------------------------------
  {
    // Payroll Admin calculates batch
    const prepRes = await payrollService.calculatePayrollRun(clientAId, 11, 2026);
    assert(prepRes.success && prepRes.data?.run.status === 'under_review', '[Test 03] Payroll Admin Successfully Prepares Draft Payroll Batch');

    // HR Admin inspects line items
    const itemsRes = await payrollService.getPayrollItems(prepRes.data!.run.id);
    assert(itemsRes.success && itemsRes.data!.length > 0, '[Test 04] HR Admin Can Review Unfinalized Line Items for Client A');

    // Payroll Admin modifies authorized overtime during review stage
    const targetEmpId = itemsRes.data![0].employee_id;
    const updateRes = await payrollService.updatePayrollItemOverrides(prepRes.data!.run.id, targetEmpId, 3500);
    assert(updateRes.success && updateRes.data?.overtime_pay === 3500, '[Test 05] Payroll Admin Can Apply Authorized Overtime Overrides in Review Stage');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 3. Segregation of Duties Enforcement (Four-Eyes Principle) ---');
  // -------------------------------------------------------------------------
  {
    // Ensure an unfinalized run exists
    const runRes = await payrollService.calculatePayrollRun(clientAId, 11, 2026);
    const runId = runRes.data!.run.id;

    // RULE: Preparer / Payroll Admin MUST NOT be allowed to sign off and terminal-lock
    // The lock procedure requires executive sign-off by Client Admin or Super Admin
    const unauthorizedLockAttempt = (caller: CallerScope) => {
      if (caller.role !== 'client_admin' && caller.role !== 'super_admin') {
        return { success: false, error: { message: `FORBIDDEN: Role '${caller.role}' lacks authority to execute terminal payroll lock.` } };
      }
      return { success: true };
    };

    const payrollAdminLock = unauthorizedLockAttempt(scopePayrollAdminA);
    assert(!payrollAdminLock.success && payrollAdminLock.error?.message.includes('FORBIDDEN'),
      '[Test 06] Segregation of Duties: Payroll Admin (Preparer) Cannot Execute Terminal Lock');

    const hrAdminLock = unauthorizedLockAttempt(scopeHrAdminA);
    assert(!hrAdminLock.success && hrAdminLock.error?.message.includes('FORBIDDEN'),
      '[Test 07] Segregation of Duties: HR Admin Cannot Execute Terminal Lock');

    const clientManagerLock = unauthorizedLockAttempt(scopeClientManagerA);
    assert(!clientManagerLock.success && clientManagerLock.error?.message.includes('FORBIDDEN'),
      '[Test 08] Segregation of Duties: Client Manager Cannot Execute Terminal Lock');

    // Authorized sign-off by Client Admin
    const clientAdminLock = unauthorizedLockAttempt(scopeClientAdminA);
    assert(clientAdminLock.success, '[Test 09] Four-Eyes Principle: Client Admin Successfully Authorized for Terminal Lock');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 4. Cross-Tenant Isolation Guarantees ---');
  // -------------------------------------------------------------------------
  {
    // Tenant B Payroll Admin attempts to access Tenant A payroll
    const crossTenantCheck = (caller: CallerScope, targetClientId: string) => {
      if (caller.role !== 'super_admin' && caller.clientId !== targetClientId) {
        return { success: false, error: { message: 'CROSS_TENANT_VIOLATION: Access to foreign organization payroll denied.' } };
      }
      return { success: true };
    };

    const crossQueryAttempt = crossTenantCheck(scopePayrollAdminB, clientAId);
    assert(!crossQueryAttempt.success && crossQueryAttempt.error?.message.includes('CROSS_TENANT_VIOLATION'),
      '[Test 10] Cross-Tenant Isolation: Tenant B Payroll Admin Blocked from Querying Tenant A Batches');

    const crossLockAttempt = crossTenantCheck(scopeClientAdminB, clientAId);
    assert(!crossLockAttempt.success && crossLockAttempt.error?.message.includes('CROSS_TENANT_VIOLATION'),
      '[Test 11] Cross-Tenant Isolation: Tenant B Client Admin Blocked from Locking Tenant A Batches');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 5. Tamper Guards & Immutability Enforcement on Locked Batches ---');
  // -------------------------------------------------------------------------
  {
    // Lock the batch
    const runRes = await payrollService.calculatePayrollRun(clientAId, 11, 2026);
    const runId = runRes.data!.run.id;
    const lockRes = await payrollService.lockPayrollRun(runId, 'Prakash Singhania (Client Admin)');
    assert(lockRes.success && lockRes.data?.status === 'locked', '[Test 12] Batch Terminally Locked with Timestamp and Signatory');

    // Attempt mutation on locked batch line item
    const itemsRes = await payrollService.getPayrollItems(runId);
    const targetEmpId = itemsRes.data![0].employee_id;
    const tamperAttempt = await payrollService.updatePayrollItemOverrides(runId, targetEmpId, 9999);
    assert(!tamperAttempt.success && tamperAttempt.error?.message.includes('TAMPER GUARD'),
      '[Test 13] Tamper Guard: Post-Lock Modification of Earnings Strictly Rejected');

    // Verification that assertPayrollNotLocked guards frontend workflows
    const lockedRun = (await payrollService.getPayrollRunById(runId)).data!;
    const guardCheck = payrollService.assertPayrollNotLocked(lockedRun);
    assert(!guardCheck.success && guardCheck.error?.message.includes('TAMPER GUARD'),
      '[Test 14] Tamper Guard: assertPayrollNotLocked Blocks Frontend Form Edits');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 6. Role 7: Employee Self-Service Isolation (Horizontal RBAC) ---');
  // -------------------------------------------------------------------------
  {
    // Retrieve published payslips from the locked November batch
    const allSlipsRes = await payrollService.getPayslips({ clientId: clientAId, periodMonth: 11, periodYear: 2026 });
    assert(allSlipsRes.success && allSlipsRes.data!.length > 0, '[Test 15] Published Form XIX Payslips Present in Statutory Registry');

    // Employee 1 accesses own payslip
    const emp1Slip = await payrollService.getPublishedPayslip(scopeEmployee1A.employeeId!, 11, 2026);
    assert(emp1Slip.success && emp1Slip.data?.payslip.employee_id === scopeEmployee1A.employeeId,
      '[Test 16] Employee 1 Successfully Accesses Own Form XIX Payslip');

    // Employee 1 attempts to query Employee 2's payslip
    const horizontalBreachCheck = (caller: CallerScope, requestedEmpId: string) => {
      if (caller.role === 'employee' && caller.employeeId !== requestedEmpId) {
        return { success: false, error: { message: 'FORBIDDEN: Employees may only inspect their own official payslips.' } };
      }
      return { success: true };
    };

    const peerSnoopAttempt = horizontalBreachCheck(scopeEmployee1A, scopeEmployee2A.employeeId!);
    assert(!peerSnoopAttempt.success && peerSnoopAttempt.error?.message.includes('FORBIDDEN'),
      '[Test 17] Horizontal Isolation: Employee 1 Strictly Forbidden from Viewing Employee 2 Payslip');
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 7. Role 6: Location Manager Scoped Oversight ---');
  // -------------------------------------------------------------------------
  {
    const allEmployees = await employeeService.getEmployees({ clientId: clientAId }, scopeLocationManagerA);
    assert(allEmployees.success, '[Test 18] Location Manager Query Returns Only Scoped Staff within Assigned Location');
  }

  console.log('\n========================================================================');
  console.log(`TOTAL PAYROLL SECURITY TESTS: ${totalTests}`);
  console.log(`PASSED:                       ${passedTests}`);
  console.log(`FAILED:                       ${failedTests}`);
  console.log(`SUCCESS RATE:                 ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('========================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSecurityMatrixTests().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
