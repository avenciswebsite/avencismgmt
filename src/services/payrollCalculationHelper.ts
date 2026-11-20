/**
 * Avencis Workforce Management (WFM)
 * Milestone 2.4E — Pure Domain Payroll Calculation & Attendance Aggregation Helper
 *
 * Implements:
 * 1. Policy-aware 9-status attendance aggregation (Paid, Unpaid, Half-Day).
 * 2. Strict omission of automatic late arrival wage deductions (decision 2).
 * 3. Omission of raw attendance hours overtime inference (decision 1).
 * 4. Mid-month joining and exit calendar proration math (decision 4).
 * 5. Configurable EPF rules (standard cap vs. opted uncapped) (decision 5).
 * 6. ESIC statutory wage threshold gating (<= 21,000).
 * 7. State-specific Professional Tax schedules (with February annual spike).
 * 8. Standardised TDS withholding integration (decision 3).
 * 9. Separation of employee deductions and employer contributions.
 * 10. Floor-bounded net pay (>= 0.00) and integer rounding.
 */

import { DailyAttendanceRecord, ClientPolicy, Employee } from '../types';

export type AttendanceRecord = DailyAttendanceRecord;

export interface EmployeeSalaryStructureInput {
  fixedMonthlyBase: number;
  hra?: number;
  conveyance?: number;
  specialAllowances?: number;
  variableIncentives?: number;
  tdsWithholdingAmount?: number;
}

export interface MonthlyAttendanceSummary {
  calendarDays: number;
  paidDays: number;
  unpaidDays: number;
  halfDays: number;
  absentDays: number;
  weeklyOffDays: number;
  holidays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateArrivalsCount: number;
  isComplete: boolean;
  discrepancyMessage?: string;
}

export interface CalculatedEarnings {
  fixedMonthlyBase: number;
  payableBase: number;
  basicPay: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  authorisedOvertimePay: number;
  authorisedIncentives: number;
  otherAllowances: number;
  grossEarned: number;
  unpaidLeaveDeduction: number;
  prorationRatio: number;
  effectiveDivisor: number;
}

export interface CalculatedStatutoryDeductions {
  pfEmployee: number;
  pfEmployer: number;
  pfWage: number;
  esicEmployee: number;
  esicEmployer: number;
  isEsicApplicable: boolean;
  ptDeduction: number;
  tdsDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  totalEmployerContributions: number;
}

export interface EmployeePayrollItemResult {
  employeeId: string;
  calendarDays: number;
  paidDays: number;
  unpaidDays: number;
  earnings: CalculatedEarnings;
  deductions: CalculatedStatutoryDeductions;
  netSalary: number;
  hasNegativeNetShortfall: boolean;
  unrecoveredShortfall: number;
}

/**
 * 1. Resolves total calendar days in a given month and year.
 */
export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 2. Ingests and aggregates daily attendance records for an employee over a month.
 * Strictly respects the 9-status taxonomy:
 * - Paid (1.0): PRESENT, ON_DUTY, WEEKLY_OFF, HOLIDAY, PAID_LEAVE, LATE
 * - Half-day (0.5 paid, 0.5 unpaid): HALF_DAY
 * - Unpaid (1.0 unpaid): UNPAID_LEAVE (LWP), ABSENT
 * - LATE marks incur ZERO automatic wage deduction (punctuality tracked separately).
 * - Mid-month joining caps maximum eligible days.
 */
export function aggregateMonthlyAttendance(
  records: AttendanceRecord[],
  month: number,
  year: number,
  joiningDateStr?: string,
  exitDateStr?: string
): MonthlyAttendanceSummary {
  const calendarDays = getDaysInMonth(month, year);
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  // Filter records strictly belonging to the target month
  const monthRecords = records.filter(r => r.date.startsWith(monthPrefix));

  let presentCount = 0;
  let onDutyCount = 0;
  let weeklyOffCount = 0;
  let holidayCount = 0;
  let paidLeaveCount = 0;
  let halfDayCount = 0;
  let unpaidLeaveCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  monthRecords.forEach(r => {
    switch (r.status) {
      case 'PRESENT':
        presentCount++;
        break;
      case 'ON_DUTY':
        onDutyCount++;
        break;
      case 'WEEKLY_OFF':
        weeklyOffCount++;
        break;
      case 'HOLIDAY':
        holidayCount++;
        break;
      case 'PAID_LEAVE':
        paidLeaveCount++;
        break;
      case 'HALF_DAY':
        halfDayCount++;
        break;
      case 'UNPAID_LEAVE':
        unpaidLeaveCount++;
        break;
      case 'ABSENT':
        absentCount++;
        break;
      case 'LATE':
        // Zero automatic wage deduction. LATE counts as full paid day.
        lateCount++;
        presentCount++;
        break;
      default:
        // Default safe handling
        presentCount++;
        break;
    }
  });

  // Derived paid and unpaid days from muster
  let derivedPaid = presentCount + onDutyCount + weeklyOffCount + holidayCount + paidLeaveCount + (halfDayCount * 0.5);
  let derivedUnpaid = unpaidLeaveCount + absentCount + (halfDayCount * 0.5);

  // Fallback: If zero records exist for this employee, assume full calendar days (no unpaid absences recorded)
  if (monthRecords.length === 0) {
    derivedPaid = calendarDays;
    derivedUnpaid = 0;
  }

  // Mid-month joining adjustment
  if (joiningDateStr) {
    const joiningDate = new Date(joiningDateStr);
    const joinYear = joiningDate.getFullYear();
    const joinMonth = joiningDate.getMonth() + 1;
    const joinDay = joiningDate.getDate();

    if (joinYear === year && joinMonth === month && joinDay > 1) {
      const activeDays = calendarDays - joinDay + 1;
      derivedPaid = Math.min(derivedPaid, activeDays);
      derivedUnpaid = Math.max(0, calendarDays - derivedPaid);
    }
  }

  // Mid-month exit adjustment
  if (exitDateStr) {
    const exitDate = new Date(exitDateStr);
    const exitYear = exitDate.getFullYear();
    const exitMonth = exitDate.getMonth() + 1;
    const exitDay = exitDate.getDate();

    if (exitYear === year && exitMonth === month && exitDay < calendarDays) {
      derivedPaid = Math.min(derivedPaid, exitDay);
      derivedUnpaid = Math.max(0, calendarDays - derivedPaid);
    }
  }

  return {
    calendarDays,
    paidDays: Number(derivedPaid.toFixed(1)),
    unpaidDays: Number(derivedUnpaid.toFixed(1)),
    halfDays: halfDayCount,
    absentDays: absentCount,
    weeklyOffDays: weeklyOffCount,
    holidays: holidayCount,
    paidLeaveDays: paidLeaveCount,
    unpaidLeaveDays: unpaidLeaveCount,
    lateArrivalsCount: lateCount,
    isComplete: monthRecords.length > 0,
  };
}

/**
 * 3. Resolves the effective salary divisor and computes the proration ratio.
 */
export function calculateProrationRatio(
  paidDays: number,
  calendarDays: number,
  divisorSetting: '26' | '30' | 'calendar_days'
): { effectiveDivisor: number; prorationRatio: number } {
  let effectiveDivisor: number;
  if (divisorSetting === '26') {
    effectiveDivisor = 26;
  } else if (divisorSetting === '30') {
    effectiveDivisor = 30;
  } else {
    effectiveDivisor = calendarDays;
  }

  const rawRatio = paidDays / effectiveDivisor;
  // Bounded between 0.0 and 1.0 (cannot exceed full salary for standard month)
  const prorationRatio = Math.max(0, Math.min(1.0, rawRatio));

  return { effectiveDivisor, prorationRatio };
}

/**
 * 4. Computes earnings breakdown using configured salary structure and proration ratio.
 * Payable overtime and incentives are explicitly provided via human authorization (decision 1).
 */
export function calculateEarningsBreakdown(
  salary: {
    fixedMonthlyBase: number;
    hra?: number;
    conveyance?: number;
    specialAllowances?: number;
    variableIncentives?: number;
  },
  prorationRatio: number,
  effectiveDivisor: number,
  paidDays: number,
  authorisedOvertimePay: number = 0,
  authorisedIncentivesOverride?: number
): CalculatedEarnings {
  const fixedBase = salary.fixedMonthlyBase || 0;
  const payableBase = Math.round((fixedBase / effectiveDivisor) * paidDays);

  // Standard component proportions
  const basicPay = Math.round(fixedBase * 0.50 * prorationRatio);
  const hra = Math.round((salary.hra ?? fixedBase * 0.30) * prorationRatio);
  const conveyance = Math.round((salary.conveyance ?? 0) * prorationRatio);
  
  // Special allowance balances the prorated fixed base
  const specialAllowance = Math.max(0, payableBase - (basicPay + hra + conveyance));
  const unpaidLeaveDeduction = Math.max(0, fixedBase - payableBase);

  // Variable components: use explicit override if entered during review stage
  const incentives = authorisedIncentivesOverride !== undefined
    ? authorisedIncentivesOverride
    : (salary.variableIncentives || 0);

  const overtimePay = Math.max(0, Math.round(authorisedOvertimePay));
  const otherAllowances = conveyance + specialAllowance;
  const grossEarned = basicPay + hra + conveyance + specialAllowance + incentives + overtimePay;

  return {
    fixedMonthlyBase: fixedBase,
    payableBase,
    basicPay,
    hra,
    conveyance,
    specialAllowance,
    authorisedOvertimePay: overtimePay,
    authorisedIncentives: incentives,
    otherAllowances,
    grossEarned,
    unpaidLeaveDeduction,
    prorationRatio,
    effectiveDivisor,
  };
}

/**
 * 5. Computes statutory deductions and employer contributions.
 * Implements configurable EPF, ESIC threshold, state PT schedules, and standardised TDS.
 */
export function calculateStatutoryDeductions(
  basicPay: number,
  grossEarned: number,
  month: number,
  locationState: string = 'Maharashtra',
  policy: {
    pfEnabled: boolean;
    pfEmployeePercent?: number;
    pfEmployerPercent?: number;
    pfUncappedBasic?: boolean;
    esicEnabled: boolean;
    esicEmployeePercent?: number;
    esicEmployerPercent?: number;
    ptEnabled: boolean;
    tdsEnabled: boolean;
  },
  tdsWithholdingAmount: number = 0
): CalculatedStatutoryDeductions {
  // 1. Employee Provident Fund (EPF — 12%)
  let pfEmployee = 0;
  let pfEmployer = 0;
  let pfWage = 0;

  if (policy.pfEnabled) {
    const pfEmpPct = (policy.pfEmployeePercent ?? 12.0) / 100.0;
    const pfEmplrPct = (policy.pfEmployerPercent ?? 12.0) / 100.0;

    if (policy.pfUncappedBasic) {
      pfWage = basicPay;
    } else {
      pfWage = Math.min(basicPay, 15000);
    }

    pfEmployee = Math.round(pfWage * pfEmpPct);
    pfEmployer = Math.round(pfWage * pfEmplrPct);
  }

  // 2. Employees' State Insurance (ESIC — 0.75%)
  // Applicable only if monthly gross remuneration <= ₹21,000
  let esicEmployee = 0;
  let esicEmployer = 0;
  const isEsicApplicable = policy.esicEnabled && grossEarned <= 21000 && grossEarned > 0;

  if (isEsicApplicable) {
    const esicEmpPct = (policy.esicEmployeePercent ?? 0.75) / 100.0;
    const esicEmplrPct = (policy.esicEmployerPercent ?? 3.25) / 100.0;

    esicEmployee = Math.round(grossEarned * esicEmpPct);
    esicEmployer = Math.round(grossEarned * esicEmplrPct);
  }

  // 3. Professional Tax (PT — State Slabs)
  let ptDeduction = 0;
  if (policy.ptEnabled) {
    const normState = locationState.trim().toLowerCase();

    if (normState.includes('maharashtra')) {
      if (grossEarned <= 7500) {
        ptDeduction = 0;
      } else if (grossEarned <= 10000) {
        ptDeduction = 175;
      } else {
        // Standard ₹200, with ₹300 February annual adjustment spike
        ptDeduction = (month === 2) ? 300 : 200;
      }
    } else if (normState.includes('karnataka')) {
      ptDeduction = grossEarned > 15000 ? 200 : 0;
    } else if (normState.includes('gujarat')) {
      if (grossEarned > 12000) ptDeduction = 200;
      else if (grossEarned > 9000) ptDeduction = 150;
      else if (grossEarned > 6000) ptDeduction = 80;
      else ptDeduction = 0;
    } else {
      // Default standard fallback
      ptDeduction = grossEarned > 10000 ? 200 : 0;
    }
  }

  // 4. Tax Deducted at Source (TDS — Standardised from salary structure)
  const tdsDeduction = policy.tdsEnabled ? Math.max(0, Math.round(tdsWithholdingAmount)) : 0;

  const totalDeductions = pfEmployee + esicEmployee + ptDeduction + tdsDeduction;
  const totalEmployerContributions = pfEmployer + esicEmployer;

  return {
    pfEmployee,
    pfEmployer,
    pfWage,
    esicEmployee,
    esicEmployer,
    isEsicApplicable,
    ptDeduction,
    tdsDeduction,
    otherDeductions: 0,
    totalDeductions,
    totalEmployerContributions,
  };
}

/**
 * 6. Composite calculation for an employee line item.
 * Guarantees zero negative net pay and tracks shortfalls.
 */
export function calculateEmployeePayrollItem(
  employee: Employee,
  salaryStructure: {
    fixedMonthlyBase: number;
    hra?: number;
    conveyance?: number;
    specialAllowances?: number;
    variableIncentives?: number;
    tdsWithholdingAmount?: number;
  },
  attendanceSummary: MonthlyAttendanceSummary,
  clientPolicy: Partial<ClientPolicy>,
  month: number,
  year: number,
  locationState: string = 'Maharashtra',
  authorisedOvertimePay: number = 0,
  authorisedIncentivesOverride?: number
): EmployeePayrollItemResult {
  const { effectiveDivisor, prorationRatio } = calculateProrationRatio(
    attendanceSummary.paidDays,
    attendanceSummary.calendarDays,
    clientPolicy.salaryDivisor as any
  );

  const earnings = calculateEarningsBreakdown(
    salaryStructure,
    prorationRatio,
    effectiveDivisor,
    attendanceSummary.paidDays,
    authorisedOvertimePay,
    authorisedIncentivesOverride
  );

  const deductions = calculateStatutoryDeductions(
    earnings.basicPay,
    earnings.grossEarned,
    month,
    locationState,
    {
      pfEnabled: Boolean(clientPolicy.pfEnabled),
      pfEmployeePercent: clientPolicy.pfEmployeePercent ?? 12,
      pfEmployerPercent: clientPolicy.pfEmployerPercent ?? 12,
      pfUncappedBasic: Boolean((clientPolicy as any).pfUncappedBasic),
      esicEnabled: Boolean(clientPolicy.esicEnabled),
      esicEmployeePercent: clientPolicy.esicEmployeePercent ?? 0.75,
      esicEmployerPercent: clientPolicy.esicEmployerPercent ?? 3.25,
      ptEnabled: Boolean(clientPolicy.ptEnabled),
      tdsEnabled: Boolean(clientPolicy.tdsEnabled),
    },
    salaryStructure.tdsWithholdingAmount || 0
  );

  const calculatedNet = earnings.grossEarned - deductions.totalDeductions;
  const netSalary = Math.max(0, calculatedNet);
  const hasNegativeNetShortfall = calculatedNet < 0;
  const unrecoveredShortfall = hasNegativeNetShortfall ? Math.abs(calculatedNet) : 0;

  return {
    employeeId: employee.id,
    calendarDays: attendanceSummary.calendarDays,
    paidDays: attendanceSummary.paidDays,
    unpaidDays: attendanceSummary.unpaidDays,
    earnings,
    deductions,
    netSalary,
    hasNegativeNetShortfall,
    unrecoveredShortfall,
  };
}
