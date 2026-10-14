/**
 * Pure date parsing utilities adhering to client/AGENTS.md.
 * Strictly uses string splitting and UTC getters to prevent browser timezone shift bugs.
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface ParsedUtcDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Splits an ISO date string (YYYY-MM-DD) into UTC numerical parts without Date object timezone shift.
 */
export function parseUtcDateString(isoDate: string): ParsedUtcDate {
  const parts = isoDate.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid ISO date format: "${isoDate}", expected "YYYY-MM-DD"`);
  }
  const year = Number.parseInt(parts[0] || '0', 10);
  const month = Number.parseInt(parts[1] || '0', 10);
  const day = Number.parseInt(parts[2] || '0', 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new Error(`Non-numeric date components in "${isoDate}"`);
  }

  return { year, month, day };
}

/**
 * Formats a YYYY-MM-DD weekend date into human-readable British format e.g. "17 October 2026".
 */
export function formatUtcWeekendLabel(isoDate: string): string {
  const { year, month, day } = parseUtcDateString(isoDate);
  const monthName = MONTH_NAMES[month - 1] ?? '';
  return `${day} ${monthName} ${year}`;
}
