/**
 * Avencis Workforce Management (WFM)
 * Policy-Aware Working Day & Leave Calculation Engine
 *
 * Replaces naive calendar-day formula with statutory working-day logic:
 * - Excludes client-configured weekly rest days (e.g. Sunday, or Sat-Sun).
 * - Excludes declared statutory and company holidays.
 * - Supports half-day leave increments (0.5 day).
 * - Partitions cross-year spans into per-year entitlement buckets.
 */

export interface LeaveCalculationOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  weeklyOffDays?: string[]; // e.g. ['SUNDAY'] or ['SATURDAY', 'SUNDAY']
  holidays?: string[]; // Array of 'YYYY-MM-DD' holiday dates
  isHalfDay?: boolean;
}

export interface DayBreakdown {
  date: string;
  dayOfWeek: string;
  isWeeklyOff: boolean;
  isHoliday: boolean;
  isWorkingDay: boolean;
  leaveDays: number;
  year: number;
}

export interface LeaveCalculationResult {
  totalCalendarDays: number;
  totalLeaveDays: number;
  weeklyOffCount: number;
  holidayCount: number;
  daysByYear: Record<number, number>;
  breakdown: DayBreakdown[];
}

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * Calculates effective leave days between start and end dates according to client policy.
 */
export function calculateEffectiveLeaveDays(options: LeaveCalculationOptions): LeaveCalculationResult {
  const {
    startDate,
    endDate,
    weeklyOffDays = ['SUNDAY'],
    holidays = [],
    isHalfDay = false,
  } = options;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return {
      totalCalendarDays: 0,
      totalLeaveDays: 0,
      weeklyOffCount: 0,
      holidayCount: 0,
      daysByYear: {},
      breakdown: [],
    };
  }

  const normalizedWeeklyOffs = new Set(weeklyOffDays.map(d => d.toUpperCase()));
  const holidaySet = new Set(holidays);

  const breakdown: DayBreakdown[] = [];
  const daysByYear: Record<number, number> = {};
  let weeklyOffCount = 0;
  let holidayCount = 0;
  let totalLeaveDays = 0;

  // Single date half-day special case
  const isSingleDay = startDate === endDate;
  const isActualHalfDay = isHalfDay && isSingleDay;

  const current = new Date(start);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayName = DAY_NAMES[current.getDay()];

    const isWeeklyOff = normalizedWeeklyOffs.has(dayName);
    const isHoliday = holidaySet.has(dateStr);
    const isWorkingDay = !isWeeklyOff && !isHoliday;

    let dayLeaveAmount = 0;
    if (isWorkingDay) {
      dayLeaveAmount = isActualHalfDay ? 0.5 : 1.0;
      totalLeaveDays += dayLeaveAmount;
      daysByYear[yyyy] = (daysByYear[yyyy] || 0) + dayLeaveAmount;
    } else {
      if (isWeeklyOff) weeklyOffCount++;
      if (isHoliday) holidayCount++;
    }

    breakdown.push({
      date: dateStr,
      dayOfWeek: dayName,
      isWeeklyOff,
      isHoliday,
      isWorkingDay,
      leaveDays: dayLeaveAmount,
      year: yyyy,
    });

    current.setDate(current.getDate() + 1);
  }

  // If entire range was weekly offs / holidays, ensure non-negative total
  totalLeaveDays = Math.round(totalLeaveDays * 10) / 10;

  return {
    totalCalendarDays: breakdown.length,
    totalLeaveDays,
    weeklyOffCount,
    holidayCount,
    daysByYear,
    breakdown,
  };
}
