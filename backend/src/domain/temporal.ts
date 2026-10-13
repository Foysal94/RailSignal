import { TZDate } from '@date-fns/tz';
import { addDays, format } from 'date-fns';

export interface WeekendWindowOptions {
  referenceDate?: Date | undefined;
}

export interface WeekendWindow {
  weekendDate: string; // ISO date 'YYYY-MM-DD' representing target Friday
  windowStart: TZDate; // Friday 19:00 Europe/London
  windowEnd: TZDate; // Monday 04:30 Europe/London
}

export interface IsDisruptionInWindowOptions {
  validFrom?: string | Date | undefined;
  validTo?: string | Date | undefined;
  window: WeekendWindow;
}

/**
 * Calculates the operational weekend disruption window pinned strictly to Europe/London local time.
 *
 * Rationale:
 * - Friday 19:00: TfL weekend engineering works and planned line suspensions begin Friday evening.
 * - Monday 04:30: London Underground operating day terminates at 04:30, after which regular weekday commuter service begins.
 * - On Monday before 04:30, ongoing disruptions still belong to the weekend service period.
 */
export function getUpcomingWeekendWindow(options?: WeekendWindowOptions): WeekendWindow {
  const ref = options?.referenceDate ?? new Date();
  const londonDate = new TZDate(ref, 'Europe/London');
  const day = londonDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const hours = londonDate.getHours();
  const minutes = londonDate.getMinutes();

  // Days offset to target Friday
  const weekdayOffsets: Record<number, number> = {
    5: 0, // Friday
    6: -1, // Saturday
    0: -2, // Sunday
    2: 3, // Tuesday
    3: 2, // Wednesday
    4: 1, // Thursday
  };

  let daysToFriday: number;
  if (day === 1) {
    // Before 04:30 London time, Monday is still active engineering weekend; after 04:30 advance to next Friday
    daysToFriday = hours < 4 || (hours === 4 && minutes < 30) ? -3 : 4;
  } else {
    daysToFriday = weekdayOffsets[day] ?? 0;
  }

  const targetFriday = addDays(londonDate, daysToFriday);
  const targetMonday = addDays(targetFriday, 3);

  // Pinned explicitly to Europe/London to preserve local boundaries across BST/GMT transitions
  const windowStart = new TZDate(
    targetFriday.getFullYear(),
    targetFriday.getMonth(),
    targetFriday.getDate(),
    19,
    0,
    0,
    'Europe/London',
  );
  const windowEnd = new TZDate(
    targetMonday.getFullYear(),
    targetMonday.getMonth(),
    targetMonday.getDate(),
    4,
    30,
    0,
    'Europe/London',
  );
  const weekendDate = format(windowStart, 'yyyy-MM-dd');

  return {
    weekendDate,
    windowStart,
    windowEnd,
  };
}

/**
 * Determines whether a disruption time interval overlaps with the target weekend window.
 * Formula: disruptionStart <= windowEnd AND disruptionEnd >= windowStart
 */
export function isDisruptionInWindow(options: IsDisruptionInWindowOptions): boolean {
  const { validFrom, validTo, window } = options;
  const startMs = window.windowStart.getTime();
  const endMs = window.windowEnd.getTime();

  // If TfL omits both validity bounds, treat as actively current
  if (!validFrom && !validTo) {
    return true;
  }

  const fromMs = validFrom ? new Date(validFrom).getTime() : Number.NEGATIVE_INFINITY;
  const toMs = validTo ? new Date(validTo).getTime() : Number.POSITIVE_INFINITY;

  return fromMs <= endMs && toMs >= startMs;
}
