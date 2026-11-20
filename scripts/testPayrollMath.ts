/**
 * Avencis Workforce Management (WFM)
 * Milestone 2.4E — Payroll Mathematical & Statutory Calculation Test Suite
 */

import {
  getDaysInMonth,
  aggregateMonthlyAttendance,
  calculateProrationRatio,
  calculateEarningsBreakdown,
  calculateStatutoryDeductions,
  calculateEmployeePayrollItem,
} from '../src/services/payrollCalculationHelper';
import { AttendanceRecord, ClientPolicy, Employee } from '../src/types';

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

async function runPayrollMathTests() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — MILESTONE 2.4E PAYROLL DOMAIN MATHEMATICAL TEST SUITE');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  console.log('--- 1. Calendar Days Resolution & Divisors ---');
  // ---------------------------------------------------------------------------
  assert(getDaysInMonth(2, 2024) === 29, '[Test 01] February Leap Year Days (2024)', '29 days');
  assert(getDaysInMonth(2, 2026) === 28, '[Test 02] February Standard Year Days (2026)', '28 days');
  assert(getDaysInMonth(10, 2026) === 31, '[Test 03] October Calendar Days (2026)', '31 days');
  assert(getDaysInMonth(11, 2026) === 30, '[Test 04] November Calendar Days (2026)', '30 days');

  const p30 = calculateProrationRatio(27, 30, '30');
  assert(p30.effectiveDivisor === 30 && p30.prorationRatio === 0.9, '[Test 05] 30-Day Divisor Proration Ratio', `27/30 = ${p30.prorationRatio}`);

  const p26 = calculateProrationRatio(26, 30, '26');
  assert(p26.effectiveDivisor === 26 && p26.prorationRatio === 1.0, '[Test 06] 26-Day Divisor Proration Ratio (Capped at 1.0)', `26/26 = ${p26.prorationRatio}`);

  const pCal = calculateProrationRatio(28, 31, 'calendar_days');
  assert(pCal.effectiveDivisor === 31 && Math.abs(pCal.prorationRatio - (28 / 31)) < 0.0001, '[Test 07] Calendar Days Dynamic Divisor', `28/31 = ${pCal.prorationRatio.toFixed(4)}`);

  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Upstream Attendance Muster Aggregation (9-Status) ---');
  // ---------------------------------------------------------------------------
  // Build 30 days attendance records for November 2026
  const dummyRecords: AttendanceRecord[] = [];
  // 20 PRESENT
  for (let d = 1; d <= 20; d++) {
    dummyRecords.push({
      id: `att-${d}`,
      employeeId: 'emp-01',
      clientId: 'client-01',
      date: `2026-11-${String(d).padStart(2, '0')}`,
      status: 'PRESENT',
      totalHours: 9.0,
      createdAt: '2026-11-01',
    });
  }
  // 2 LATE (Must incur ZERO wage deduction per decision 2)
  for (let d = 21; d <= 22; d++) {
    dummyRecords.push({
      id: `att-${d}`,
      employeeId: 'emp-01',
      clientId: 'client-01',
      date: `2026-11-${String(d).padStart(2, '0')}`,
      status: 'LATE',
      totalHours: 8.5,
      createdAt: '2026-11-01',
    });
  }
  // 2 HALF_DAY (1.0 paid, 1.0 unpaid)
  for (let d = 23; d <= 24; d++) {
    dummyRecords.push({
      id: `att-${d}`,
      employeeId: 'emp-01',
      clientId: 'client-01',
      date: `2026-11-${String(d).padStart(2, '0')}`,
      status: 'HALF_DAY',
      totalHours: 4.5,
      createdAt: '2026-11-01',
    });
  }
  // 2 UNPAID_LEAVE (LWP)
  for (let d = 25; d <= 26; d++) {
    dummyRecords.push({
      id: `att-${d}`,
      employeeId: 'emp-01',
      clientId: 'client-01',
      date: `2026-11-${String(d).padStart(2, '0')}`,
      status: 'UNPAID_LEAVE',
      totalHours: 0,
      createdAt: '2026-11-01',
    });
  }
  // 4 WEEKLY_OFF
  for (let d = 27; d <= 30; d++) {
    dummyRecords.push({
      id: `att-${d}`,
      employeeId: 'emp-01',
      clientId: 'client-01',
      date: `2026-11-${String(d).padStart(2, '0')}`,
      status: 'WEEKLY_OFF',
      totalHours: 0,
      createdAt: '2026-11-01',
    });
  }

  const attSummary = aggregateMonthlyAttendance(dummyRecords, 11, 2026);
  // Paid: 20 present + 2 late (1.0 each) + 2 half_day (0.5 each = 1.0) + 4 weekly_off (1.0 each) = 27.0
  // Unpaid: 2 unpaid_leave (1.0 each = 2.0) + 2 half_day (0.5 each = 1.0) = 3.0
  assert(attSummary.paidDays === 27.0, '[Test 08] Effective Paid Days Aggregation', `27.0 paid days (expected 27.0)`);
  assert(attSummary.unpaidDays === 3.0, '[Test 09] Effective Unpaid Days Aggregation', `3.0 unpaid days (expected 3.0)`);
  assert(attSummary.lateArrivalsCount === 2, '[Test 10] Late Marks Tracked Without Wage Penalties', `2 late marks counted, 0 salary penalty applied`);

  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Mid-Month Joining & Exit Calculations ---');
  // ---------------------------------------------------------------------------
  // Employee joining on November 16 (15 days inactive in 30-day month -> max 15 paid days)
  const midJoinSummary = aggregateMonthlyAttendance([], 11, 2026, '2026-11-16');
  assert(midJoinSummary.paidDays === 15.0, '[Test 11] Mid-Month Joining Active Days Cap', `Joined Nov 16 -> 15 paid days, 15 unpaid days`);

  // Employee exiting on November 10 (20 days inactive -> max 10 paid days)
  const midExitSummary = aggregateMonthlyAttendance([], 11, 2026, undefined, '2026-11-10');
  assert(midExitSummary.paidDays === 10.0, '[Test 12] Mid-Month Exit Active Days Cap', `Exited Nov 10 -> 10 paid days, 20 unpaid days`);

  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Authorised Overtime & Variable Earnings ---');
  // ---------------------------------------------------------------------------
  const earnings = calculateEarningsBreakdown(
    { fixedMonthlyBase: 30000, hra: 9000, conveyance: 2000, specialAllowances: 4000, variableIncentives: 1500 },
    0.9, // 27/30 days
    30,
    27,
    2500, // Authorised Overtime Pay (Decision 1)
    2000  // Authorised Incentive Override
  );

  assert(earnings.payableBase === 27000, '[Test 13] Prorated Payable Base (30000/30 * 27)', `₹${earnings.payableBase}`);
  assert(earnings.unpaidLeaveDeduction === 3000, '[Test 14] Unpaid Leave Deduction (30000 - 27000)', `₹${earnings.unpaidLeaveDeduction}`);
  assert(earnings.authorisedOvertimePay === 2500, '[Test 15] Authorised Overtime Incorporated into Earnings', `₹${earnings.authorisedOvertimePay}`);
  assert(earnings.grossEarned === (27000 + 2000 + 2500), '[Test 16] Gross Earned Total (Base + Incentives + OT)', `₹${earnings.grossEarned} (expected 31500)`);

  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Statutory Deductions (EPF, ESIC, PT, TDS) ---');
  // ---------------------------------------------------------------------------
  // Case A: Standard EPF Ceiling (₹15,000 cap)
  const dedStandard = calculateStatutoryDeductions(
    13500, // basic pay <= 15000
    25000, // gross > 21000 (ESIC exempt)
    11,
    'Maharashtra',
    { pfEnabled: true, esicEnabled: true, ptEnabled: true, tdsEnabled: true },
    1500 // standardised TDS withholding (Decision 3)
  );
  assert(dedStandard.pfEmployee === Math.round(13500 * 0.12), '[Test 17] EPF Employee Below Ceiling (12% of ₹13,500)', `₹${dedStandard.pfEmployee} (expected 1620)`);
  assert(dedStandard.pfEmployer === Math.round(13500 * 0.12), '[Test 18] EPF Employer Contribution (12% of ₹13,500)', `₹${dedStandard.pfEmployer} (expected 1620)`);
  assert(dedStandard.isEsicApplicable === false && dedStandard.esicEmployee === 0, '[Test 19] ESIC Exemption for Gross > ₹21,000', 'Gross ₹25,000 -> ESIC ₹0');
  assert(dedStandard.ptDeduction === 200, '[Test 20] Maharashtra PT Standard Month', '₹200');
  assert(dedStandard.tdsDeduction === 1500, '[Test 21] Standardised TDS Withholding Applied', '₹1500');

  // Case B: High Basic with Standard EPF Ceiling
  const dedHighBase = calculateStatutoryDeductions(
    30000, // basic pay > 15000
    60000,
    11,
    'Maharashtra',
    { pfEnabled: true, esicEnabled: true, ptEnabled: true, tdsEnabled: false }
  );
  assert(dedHighBase.pfEmployee === 1800, '[Test 22] EPF Employee Statutory Ceiling Cap (12% of ₹15,000 max)', `₹${dedHighBase.pfEmployee} (expected 1800)`);

  // Case C: Opted Uncapped Basic EPF (Decision 5)
  const dedUncapped = calculateStatutoryDeductions(
    30000,
    60000,
    11,
    'Maharashtra',
    { pfEnabled: true, pfUncappedBasic: true, esicEnabled: true, ptEnabled: true, tdsEnabled: false }
  );
  assert(dedUncapped.pfEmployee === Math.round(30000 * 0.12), '[Test 23] EPF Opted Uncapped Basic (12% of full ₹30,000)', `₹${dedUncapped.pfEmployee} (expected 3600)`);

  // Case D: Low Wage Eligible for ESIC
  const dedLowWage = calculateStatutoryDeductions(
    8000,
    16000, // Gross <= 21000
    11,
    'Maharashtra',
    { pfEnabled: true, esicEnabled: true, ptEnabled: true, tdsEnabled: false }
  );
  assert(dedLowWage.isEsicApplicable === true, '[Test 24] ESIC Applicable for Gross <= ₹21,000', 'Gross ₹16,000');
  assert(dedLowWage.esicEmployee === Math.round(16000 * 0.0075), '[Test 25] ESIC Employee Deduction (0.75% of ₹16,000)', `₹${dedLowWage.esicEmployee} (expected 120)`);
  assert(dedLowWage.esicEmployer === Math.round(16000 * 0.0325), '[Test 26] ESIC Employer Contribution (3.25% of ₹16,000)', `₹${dedLowWage.esicEmployer} (expected 520)`);

  // Case E: Maharashtra February PT Spike
  const dedFebPT = calculateStatutoryDeductions(
    10000,
    20000,
    2, // February!
    'Maharashtra',
    { pfEnabled: false, esicEnabled: false, ptEnabled: true, tdsEnabled: false }
  );
  assert(dedFebPT.ptDeduction === 300, '[Test 27] Maharashtra PT February Spike (₹300)', `February PT: ₹${dedFebPT.ptDeduction}`);

  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Net Salary & Zero-Floor Shortfall Invariant ---');
  // ---------------------------------------------------------------------------
  const sampleEmp: Employee = {
    id: 'emp-01',
    clientId: 'client-01',
    legalEntityId: 'le-01',
    workLocationId: 'loc-01',
    employeeCode: 'ST-01',
    firstName: 'Rahul',
    lastName: 'Sharma',
    email: 'rahul@example.com',
    mobile: '9876543210',
    designation: 'Senior Developer',
    joiningDate: '2024-01-01',
    employmentArrangement: 'DIRECT_PERMANENT',
    status: 'ACTIVE',
    panNumber: 'ABCDE1234F',
    aadhaarNumber: '123456789012',
    fixedMonthlySalary: 30000,
    variableIncentive: 0,
    otherAllowances: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  const samplePolicy: ClientPolicy = {
    id: 'pol-01',
    clientId: 'client-01',
    isConfigured: true,
    overtimeMethod: 'disabled',
    overtimeRate: 1.0,
    lateGraceMinutes: 15,
    latePenaltyRule: 'none',
    overnightShiftAttribution: 'shift_start_date',
    standardWorkingHours: 9.0,
    halfDayHours: 4.5,
    weeklyOffDays: ['SUNDAY'],
    attendanceTrackingMode: 'double_punch',
    requireGps: true,
    requireSelfie: false,
    enforceStrictGeofence: true,
    leaveTypesSupported: ['PL', 'CL', 'SL', 'LWP'],
    minServiceDaysForLeave: 30,
    monthlyPaidLeaveAccrual: 2.0,
    maxCarryForward: 30,
    allowLeaveEncashment: false,
    unpaidLeaveDeductionFormula: 'per_day_proration',
    salaryDivisor: '30',
    pfEnabled: true,
    pfEmployeePercent: 12.0,
    pfEmployerPercent: 12.0,
    esicEnabled: true,
    esicEmployeePercent: 0.75,
    esicEmployerPercent: 3.25,
    ptEnabled: true,
    tdsEnabled: true,
    updatedAt: '2024-01-01',
    updatedBy: 'Admin',
  };

  const itemNormal = calculateEmployeePayrollItem(
    sampleEmp,
    { fixedMonthlyBase: 30000, tdsWithholdingAmount: 1000 },
    attSummary,
    samplePolicy,
    11,
    2026,
    'Maharashtra',
    1000, // authorised overtime
    500   // authorised incentive
  );

  assert(itemNormal.netSalary > 0, '[Test 28] Standard Item Net Salary Positive', `Net: ₹${itemNormal.netSalary}`);
  assert(itemNormal.hasNegativeNetShortfall === false, '[Test 29] No Shortfall on Normal Salary', 'Shortfall: ₹0');

  // Extreme test: zero paid days, high deductions -> net salary must floor at 0.00
  const zeroDaysSummary: MonthlyAttendanceSummary = {
    calendarDays: 30,
    paidDays: 0,
    unpaidDays: 30,
    halfDays: 0,
    absentDays: 30,
    weeklyOffDays: 0,
    holidays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 30,
    lateArrivalsCount: 0,
    isComplete: true,
  };

  const itemZeroDays = calculateEmployeePayrollItem(
    sampleEmp,
    { fixedMonthlyBase: 30000, tdsWithholdingAmount: 2000 },
    zeroDaysSummary,
    samplePolicy,
    11,
    2026,
    'Maharashtra'
  );

  assert(itemZeroDays.netSalary === 0, '[Test 30] Zero-Floor Invariant on Extreme Absence', `Net salary strictly ₹${itemZeroDays.netSalary}`);
  assert(itemZeroDays.hasNegativeNetShortfall === true, '[Test 31] Shortfall Correctly Flagged for Recovery', `Unrecovered shortfall: ₹${itemZeroDays.unrecoveredShortfall}`);

  console.log('\n========================================================================');
  console.log(`TOTAL PAYROLL MATH TESTS: ${totalTests}`);
  console.log(`PASSED:                   ${passedTests}`);
  console.log(`FAILED:                   ${failedTests}`);
  console.log(`SUCCESS RATE:             ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPayrollMathTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
