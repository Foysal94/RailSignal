import { describe, it, expect, vi } from 'vitest';
import {
  getUpcomingWeekendWindow,
  isDisruptionInWindow,
  parseTflDisruptions,
  TflClient,
  createTflResiliencePolicy,
  TflHttpError,
  BrokenCircuitError,
  TaskCancelledError,
} from '../../src/clients/tflClient.js';

describe('TfL Client - Weekend Window & Temporal Filtering', () => {
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
      })
    ).toBe(true);

    // 2. Starts before window, ends inside window
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-09T00:00:00Z',
        validTo: '2026-07-11T12:00:00Z',
        window,
      })
    ).toBe(true);

    // 3. Starts inside window, ends after window
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-12T12:00:00Z',
        validTo: '2026-07-15T00:00:00Z',
        window,
      })
    ).toBe(true);

    // 4. Completely before window (ended Friday afternoon)
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-08T00:00:00Z',
        validTo: '2026-07-10T17:00:00Z',
        window,
      })
    ).toBe(false);

    // 5. Completely after window (starts Monday noon)
    expect(
      isDisruptionInWindow({
        validFrom: '2026-07-13T12:00:00Z',
        validTo: '2026-07-14T00:00:00Z',
        window,
      })
    ).toBe(false);
  });
});

describe('TfL Client - Disruption Payload Parsing', () => {
  const mockWeekendWindow = {
    weekendDate: '2026-07-10',
    windowStart: new Date('2026-07-10T18:00:00.000Z'), // Friday 19:00 BST
    windowEnd: new Date('2026-07-13T03:30:00.000Z'),   // Monday 04:30 BST
  };

  it('Should_parse_raw_tfl_disruption_with_affected_routes_matching_canonical_line', async () => {
    const { parseTflDisruptions } = await import('../../src/clients/tflClient.js');

    const rawDisruptions = [
      {
        $type: 'Tfl.Api.Presentation.Entities.Disruption, Tfl.Api.Presentation.Entities',
        category: 'PlannedWork',
        categoryDescription: 'PlannedWork',
        description: 'Piccadilly Line: No service between Acton Town and Uxbridge due to track renewal.',
        closureText: 'partClosure',
        created: '2026-07-01T10:00:00Z',
        lastUpdate: '2026-07-05T12:00:00Z',
        affectedRoutes: [
          {
            id: '1',
            lineId: 'piccadilly',
            name: 'Acton Town to Uxbridge',
            validFrom: '2026-07-11T02:00:00Z',
            validTo: '2026-07-12T22:00:00Z',
          },
        ],
        affectedStops: [],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawDisruptions,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      lineId: 'piccadilly',
      lineName: 'Piccadilly',
      mode: 'tube',
      statusSeverityDescription: 'Part Closure',
      corridorDescription: 'No service between Acton Town and Uxbridge due to track renewal.',
      weekendDate: '2026-07-10',
      validFrom: '2026-07-11T02:00:00.000Z',
      validTo: '2026-07-12T22:00:00.000Z',
      sourceLastUpdated: '2026-07-05T12:00:00Z',
    });
  });

  it('Should_parse_raw_tfl_disruption_inferring_line_from_description_when_affected_routes_empty', async () => {
    const { parseTflDisruptions } = await import('../../src/clients/tflClient.js');

    const rawDisruptions = [
      {
        $type: 'Tfl.Api.Presentation.Entities.Disruption, Tfl.Api.Presentation.Entities',
        category: 'PlannedWork',
        categoryDescription: 'PlannedWork',
        description: 'Northern Line: No service between Camden Town and High Barnet due to station improvements.',
        closureText: 'partClosure',
        created: '2026-07-01T10:00:00Z',
        lastUpdate: '2026-07-05T12:00:00Z',
        affectedRoutes: [],
        affectedStops: [],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawDisruptions,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.lineId).toBe('northern');
    expect(parsed[0]?.lineName).toBe('Northern');
    expect(parsed[0]?.mode).toBe('tube');
    expect(parsed[0]?.statusSeverityDescription).toBe('Part Closure');
    expect(parsed[0]?.corridorDescription).toBe(
      'No service between Camden Town and High Barnet due to station improvements.'
    );
  });

  it('Should_normalize_mode_aliases_such_as_elizabeth_and_dlr_and_overground_lines', async () => {
    const { parseTflDisruptions } = await import('../../src/clients/tflClient.js');

    const rawDisruptions = [
      {
        description: 'Elizabeth line: Reduced service between Paddington and Abbey Wood.',
        closureText: 'partClosure',
        affectedRoutes: [{ lineId: 'elizabeth' }],
      },
      {
        description: 'DOCKLANDS LIGHT RAILWAY: Planned closure between Bank and Poplar.',
        closureText: 'plannedClosure',
        affectedRoutes: [{ lineId: 'dlr' }],
      },
      {
        description: 'Lioness line: Part closure between Watford Junction and Euston.',
        closureText: 'partClosure',
        affectedRoutes: [{ lineId: 'lioness' }],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawDisruptions,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.mode).toBe('elizabeth-line');
    expect(parsed[0]?.lineId).toBe('elizabeth');
    expect(parsed[1]?.mode).toBe('dlr');
    expect(parsed[1]?.lineId).toBe('dlr');
    expect(parsed[2]?.mode).toBe('overground');
    expect(parsed[2]?.lineId).toBe('lioness');
  });

  it('Should_filter_out_disruptions_that_do_not_overlap_weekend_window', async () => {
    const { parseTflDisruptions } = await import('../../src/clients/tflClient.js');

    const rawDisruptions = [
      {
        description: 'Central line: Weekend closure between White City and Ealing Broadway.',
        closureText: 'partClosure',
        affectedRoutes: [
          {
            lineId: 'central',
            validFrom: '2026-07-11T00:00:00Z',
            validTo: '2026-07-12T23:59:00Z',
          },
        ],
      },
      {
        description: 'Bakerloo line: Weekday track repair completed on Wednesday.',
        closureText: 'partClosure',
        affectedRoutes: [
          {
            lineId: 'bakerloo',
            validFrom: '2026-07-06T00:00:00Z',
            validTo: '2026-07-08T18:00:00Z',
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawDisruptions,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.lineId).toBe('central');
  });

  it('Should_deduplicate_disruptions_by_line_and_corridor_within_same_weekend', async () => {
    const { parseTflDisruptions } = await import('../../src/clients/tflClient.js');

    const duplicateRaw = [
      {
        description: 'Victoria Line: Part closure between Victoria and Brixton.',
        closureText: 'partClosure',
        affectedRoutes: [{ lineId: 'victoria' }],
      },
      {
        description: 'Victoria Line: Part closure between Victoria and Brixton.',
        closureText: 'partClosure',
        affectedRoutes: [{ lineId: 'victoria' }],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: duplicateRaw,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.lineId).toBe('victoria');
  });
});

describe('TfL Client - Cockatiel HTTP Resilience & Transport', () => {
  function createTestClient(mockFetch: typeof fetch, policyOptions?: Record<string, unknown>) {
    const fastPolicy = createTflResiliencePolicy({
      maxRetries: 3,
      initialDelayMs: 1,
      maxDelayMs: 10,
      ...policyOptions,
    });
    return new TflClient({
      fetchFn: mockFetch,
      policy: fastPolicy,
    });
  }

  it('Should_retry_3_times_with_exponential_backoff_on_simulated_503_Service_Unavailable_and_succeed', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return new Response(JSON.stringify({ message: 'Service Unavailable' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = createTestClient(mockFetch as unknown as typeof fetch);
    const result = await client.fetchRawDisruptions();
    expect(result).toEqual([]);
    expect(callCount).toBe(3);
  });

  it('Should_retry_on_simulated_429_Too_Many_Requests_and_succeed', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ message: 'Rate limited' }), {
          status: 429,
          statusText: 'Too Many Requests',
        });
      }
      return new Response(JSON.stringify([{ description: 'Good' }]), {
        status: 200,
        statusText: 'OK',
      });
    });

    const client = createTestClient(mockFetch as unknown as typeof fetch);
    const result = await client.fetchRawDisruptions();
    expect(result).toHaveLength(1);
    expect(callCount).toBe(2);
  });

  it('Should_exhaust_all_3_retries_and_throw_TflHttpError_when_503_persists', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return new Response('Down', { status: 503, statusText: 'Service Unavailable' });
    });

    const client = createTestClient(mockFetch as unknown as typeof fetch);
    await expect(client.fetchRawDisruptions()).rejects.toThrow(TflHttpError);
    // 1 initial try + 3 retries = 4 total calls
    expect(callCount).toBe(4);
  });

  it('Should_not_retry_non_transient_client_errors_such_as_400_Bad_Request', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return new Response('Bad request', { status: 400, statusText: 'Bad Request' });
    });

    const client = createTestClient(mockFetch as unknown as typeof fetch);
    await expect(client.fetchRawDisruptions()).rejects.toThrow(TflHttpError);
    // Non-transient errors must fail immediately without retrying
    expect(callCount).toBe(1);
  });

  it('Should_open_circuit_breaker_after_5_consecutive_failed_requests_and_fast_fail_further_calls', async () => {
    let fetchCalls = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      fetchCalls++;
      return new Response('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    });

    // Policy configured with breaker tripping after 5 consecutive failures
    const client = createTestClient(mockFetch as unknown as typeof fetch, {
      maxRetries: 0,
      circuitBreakerConsecutiveFailures: 5,
      circuitBreakerHalfOpenMs: 30000,
    });

    // Execute 5 consecutive failing requests
    for (let i = 0; i < 5; i++) {
      await expect(client.fetchRawDisruptions()).rejects.toThrow(TflHttpError);
    }
    expect(fetchCalls).toBe(5);

    // 6th call should trip the open circuit breaker immediately (fast-fail, no fetch attempted)
    await expect(client.fetchRawDisruptions()).rejects.toThrow(BrokenCircuitError);
    expect(fetchCalls).toBe(5); // Did not increase!
  });

  it('Should_abort_request_via_timeout_policy_signal_when_request_stalls', async () => {
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      return new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new TaskCancelledError('Cancelled by policy timeout'));
        });
      });
    });

    const client = createTestClient(mockFetch as unknown as typeof fetch, {
      maxRetries: 0,
      timeoutMs: 30, // 30ms timeout
    });

    await expect(client.fetchRawDisruptions()).rejects.toThrow(TaskCancelledError);
  });

  it('Should_fetch_and_return_parsed_weekend_disruptions_end_to_end', async () => {
    const sampleDisruptions = [
      {
        description: 'Jubilee Line: No service between Waterloo and Stanmore.',
        closureText: 'partClosure',
        affectedRoutes: [
          {
            lineId: 'jubilee',
            validFrom: '2026-07-11T00:00:00Z',
            validTo: '2026-07-12T23:59:00Z',
          },
        ],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleDisruptions), {
        status: 200,
        statusText: 'OK',
      })
    );

    const client = new TflClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const disruptions = await client.getWeekendDisruptions({
      referenceDate: new Date('2026-07-10T10:00:00Z'),
    });

    expect(disruptions).toHaveLength(1);
    expect(disruptions[0]?.lineId).toBe('jubilee');
    expect(disruptions[0]?.mode).toBe('tube');
    expect(disruptions[0]?.statusSeverityDescription).toBe('Part Closure');
    expect(disruptions[0]?.corridorDescription).toBe(
      'No service between Waterloo and Stanmore.'
    );
  });
});


