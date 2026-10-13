import { describe, expect, it } from 'vitest';
import {
  getUpcomingWeekendWindow,
  isDisruptionInWindow,
} from '../../../../src/clients/tfl/temporal.js';

describe('TfL Temporal - Weekend Window & Filtering', () => {
  it('Should_calculate_upcoming_weekend_window_during_weekday_midweek', () => {
    // Tuesday 14:00 UTC in BST (July 2026)
    const tuesday = new Date('2026-07-07T14:00:00Z');
    const window = getUpcomingWeekendWindow({ referenceDate: tuesday });

    expect(window.weekendDate).toBe('2026-07-10');
    // Friday 19:00 London time in BST (+01:00) is 18:00 UTC
    expect(window.windowStart.toISOString()).toBe('2026-07-10T19:00:00.000+01:00');
    expect(new Date(window.windowStart.getTime()).toISOString()).toBe('2026-07-10T18:00:00.000Z');
    // Monday 04:30 London time in BST (+01:00) is 03:30 UTC
    expect(window.windowEnd.toISOString()).toBe('2026-07-13T04:30:00.000+01:00');
    expect(new Date(window.windowEnd.getTime()).toISOString()).toBe('2026-07-13T03:30:00.000Z');
  });

  it('Should_calculate_current_weekend_window_on_Friday_morning_before_start', () => {
    // Friday 09:00 London time (when scheduled ingestion job runs)
    const fridayMorning = new Date('2026-07-10T08:00:00Z'); // 09:00 BST
    const window = getUpcomingWeekendWindow({ referenceDate: fridayMorning });

    expect(window.weekendDate).toBe('2026-07-10');
    expect(window.windowStart.toISOString()).toBe('2026-07-10T19:00:00.000+01:00');
    expect(window.windowEnd.toISOString()).toBe('2026-07-13T04:30:00.000+01:00');
  });

  it('Should_remain_in_active_weekend_window_on_Sunday', () => {
    // Sunday 14:00 London time
    const sunday = new Date('2026-07-12T13:00:00Z'); // 14:00 BST
    const window = getUpcomingWeekendWindow({ referenceDate: sunday });

    expect(window.weekendDate).toBe('2026-07-10');
    expect(window.windowStart.toISOString()).toBe('2026-07-10T19:00:00.000+01:00');
    expect(window.windowEnd.toISOString()).toBe('2026-07-13T04:30:00.000+01:00');
  });

  it('Should_remain_in_active_weekend_window_on_Monday_before_0430_London_time', () => {
    // Monday 03:00 BST (02:00 UTC)
    const mondayEarly = new Date('2026-07-13T02:00:00Z');
    const window = getUpcomingWeekendWindow({ referenceDate: mondayEarly });

    expect(window.weekendDate).toBe('2026-07-10');
    expect(window.windowStart.toISOString()).toBe('2026-07-10T19:00:00.000+01:00');
    expect(window.windowEnd.toISOString()).toBe('2026-07-13T04:30:00.000+01:00');
  });

  it('Should_advance_to_next_weekend_on_Monday_at_or_after_0430_London_time', () => {
    // Monday 05:00 BST (04:00 UTC)
    const mondayLater = new Date('2026-07-13T04:00:00Z');
    const window = getUpcomingWeekendWindow({ referenceDate: mondayLater });

    expect(window.weekendDate).toBe('2026-07-17');
    expect(window.windowStart.toISOString()).toBe('2026-07-17T19:00:00.000+01:00');
    expect(window.windowEnd.toISOString()).toBe('2026-07-20T04:30:00.000+01:00');
  });

  it('Should_accurately_calculate_weekend_window_during_winter_GMT', () => {
    // Wednesday in January 2026 (GMT: UTC+0)
    const winterWed = new Date('2026-01-07T12:00:00Z');
    const window = getUpcomingWeekendWindow({ referenceDate: winterWed });

    expect(window.weekendDate).toBe('2026-01-09');
    // In GMT, 19:00 London time is 19:00 UTC (+00:00)
    expect(window.windowStart.toISOString()).toBe('2026-01-09T19:00:00.000+00:00');
    // In GMT, 04:30 London time is 04:30 UTC (+00:00)
    expect(window.windowEnd.toISOString()).toBe('2026-01-12T04:30:00.000+00:00');
  });

  it('Should_seamlessly_handle_autumn_DST_transition_weekend_in_October', () => {
    // October 2026 transition: Friday 23 Oct (BST: UTC+1) -> Monday 26 Oct (GMT: UTC+0)
    const octFriday = new Date('2026-10-23T10:00:00Z');
    const window = getUpcomingWeekendWindow({ referenceDate: octFriday });

    expect(window.weekendDate).toBe('2026-10-23');
    // Friday 19:00 BST is +01:00
    expect(window.windowStart.toISOString()).toBe('2026-10-23T19:00:00.000+01:00');
    // Monday 04:30 GMT is +00:00
    expect(window.windowEnd.toISOString()).toBe('2026-10-26T04:30:00.000+00:00');
  });

  it('Should_correctly_identify_disruptions_overlapping_weekend_window', () => {
    const window = getUpcomingWeekendWindow({
      referenceDate: new Date('2026-07-10T10:00:00Z'),
    });

    // 1. Fully within window (Saturday to Sunday)
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-11T00:00:00Z',
        validTo: '2026-07-12T23:59:59Z',
        window,
      }),
    ).toBe(true);

    // 2. Starts before window, ends inside window
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-09T00:00:00Z',
        validTo: '2026-07-11T12:00:00Z',
        window,
      }),
    ).toBe(true);

    // 3. Starts inside window, ends after window
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-12T12:00:00Z',
        validTo: '2026-07-15T00:00:00Z',
        window,
      }),
    ).toBe(true);

    // 4. Completely before window (ended Friday afternoon)
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-08T00:00:00Z',
        validTo: '2026-07-10T17:00:00Z',
        window,
      }),
    ).toBe(false);

    // 5. Completely after window (starts Monday noon)
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-13T12:00:00Z',
        validTo: '2026-07-14T00:00:00Z',
        window,
      }),
    ).toBe(false);
  });
});
