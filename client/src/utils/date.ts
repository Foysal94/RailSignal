const UK_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export interface ParsedUtcDate {
  year: number;
  month: number;
  day: number;
}

export function parseUtcDateString(isoDate: string): ParsedUtcDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid ISO date format: "${isoDate}", expected "YYYY-MM-DD"`);
  }

  const parts = isoDate.split('-');
  const year = Number.parseInt(parts[0] || '0', 10);
  const month = Number.parseInt(parts[1] || '0', 10);
  const day = Number.parseInt(parts[2] || '0', 10);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month} in "${isoDate}", expected 1-12`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day} in "${isoDate}", expected 1-31`);
  }

  return { year, month, day };
}

export function formatUtcWeekendLabel(isoDate: string): string {
  const { year, month, day } = parseUtcDateString(isoDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  return UK_DATE_FORMATTER.format(date);
}
