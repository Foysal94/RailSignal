import { describe, expect, it } from 'vitest';
import { formatUtcWeekendLabel, formatWeekendRadarBadge, parseUtcDateString } from './date';

describe('UTC Date Utility', () => {
  it('Should_parse_valid_iso_date_string_without_timezone_shift', () => {
    const parsed = parseUtcDateString('2026-10-17');
    expect(parsed).toEqual({ year: 2026, month: 10, day: 17 });
  });

  it('Should_throw_error_on_invalid_format_or_out_of_bounds', () => {
    expect(() => parseUtcDateString('invalid')).toThrow('Invalid ISO date format');
    expect(() => parseUtcDateString('2026-aa-bb')).toThrow('Invalid ISO date format');
    expect(() => parseUtcDateString('2026-13-01')).toThrow('Invalid month: 13');
    expect(() => parseUtcDateString('2026-00-01')).toThrow('Invalid month: 0');
    expect(() => parseUtcDateString('2026-10-32')).toThrow('Invalid day: 32');
    expect(() => parseUtcDateString('2026-10-00')).toThrow('Invalid day: 0');
  });

  it('Should_format_utc_weekend_label_accurately', () => {
    expect(formatUtcWeekendLabel('2026-10-17')).toBe('17 October 2026');
    expect(formatUtcWeekendLabel('2026-01-03')).toBe('3 January 2026');
  });

  it('Should_format_weekend_radar_badge_with_active_dates', () => {
    expect(formatWeekendRadarBadge('2026-10-16')).toBe(
      'Weekend Radar: Fri 16 Oct 19:00 \u2013 Mon 19 Oct 04:30',
    );
    // Month rollover boundary test
    expect(formatWeekendRadarBadge('2026-10-30')).toBe(
      'Weekend Radar: Fri 30 Oct 19:00 \u2013 Mon 2 Nov 04:30',
    );
    // Graceful fallback on invalid date string
    expect(formatWeekendRadarBadge('not-a-date')).toBe(
      'This Weekend: Friday 19:00 - Monday 04:30 London Time',
    );
  });
});
