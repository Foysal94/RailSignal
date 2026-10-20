import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';
import { parseTflDisruptions } from '../../../../src/clients/tfl/parser.js';
import type { RawTflLineStatus } from '../../../../src/clients/tfl/types.js';
import type { WeekendWindow } from '../../../../src/domain/temporal.js';

describe('TfL Parser - Date-Scoped Status Payload Normalization', () => {
  const mockWeekendWindow: WeekendWindow = {
    weekendDate: '2026-07-10',
    windowStart: new TZDate('2026-07-10T18:00:00.000Z', 'Europe/London'), // Friday 19:00 BST
    windowEnd: new TZDate('2026-07-13T03:30:00.000Z', 'Europe/London'), // Monday 04:30 BST
  };

  it('Should_parse_valid_planned_weekend_closure_with_validity_periods', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'district',
        name: 'District',
        modeName: 'tube',
        lineStatuses: [
          {
            id: 101,
            statusSeverity: 9,
            statusSeverityDescription: 'Part Closure',
            reason:
              'District Line: Saturday 11 and Sunday 12 July, no service between Earls Court and Wimbledon.',
            validityPeriods: [
              {
                fromDate: '2026-07-11T03:30:00Z',
                toDate: '2026-07-13T02:00:00Z',
                isNow: false,
              },
            ],
            disruption: {
              category: 'PlannedWork',
              categoryDescription: 'PlannedWork',
              description:
                'District Line: Saturday 11 and Sunday 12 July, no service between Earls Court and Wimbledon.',
              created: '2026-06-25T10:00:00Z',
              lastUpdate: '2026-07-01T12:00:00Z',
            },
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      lineId: 'district',
      lineName: 'District',
      mode: 'tube',
      statusSeverityDescription: 'Part Closure',
      corridorDescription:
        'Saturday 11 and Sunday 12 July, no service between Earls Court and Wimbledon.',
      weekendDate: '2026-07-10',
      validFrom: '2026-07-11T03:30:00Z',
      validTo: '2026-07-13T02:00:00Z',
      sourceLastUpdated: '2026-07-01T12:00:00Z',
      notices: [
        {
          headline: 'Earls Court ↔ Wimbledon: No service',
          corridor: 'Earls Court ↔ Wimbledon: No service',
          timeframe: 'Saturday 11 & Sunday 12 July',
          rawFallback:
            'Saturday 11 and Sunday 12 July, no service between Earls Court and Wimbledon.',
        },
      ],
    });
  });

  it('Should_ignore_undisrupted_lines_reporting_good_service', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'victoria',
        name: 'Victoria',
        modeName: 'tube',
        lineStatuses: [
          {
            id: 0,
            statusSeverity: 10,
            statusSeverityDescription: 'Good Service',
            validityPeriods: [],
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(0);
  });

  it('Should_discard_midweek_transient_delays_and_realtime_incidents', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'central',
        name: 'Central',
        modeName: 'tube',
        lineStatuses: [
          {
            id: 201,
            statusSeverity: 2,
            statusSeverityDescription: 'Minor Delays',
            reason: 'Central Line: Minor delays due to train cancellations.',
            validityPeriods: [],
            disruption: {
              category: 'RealTime',
              categoryDescription: 'RealTime',
              description: 'Central Line: Minor delays due to train cancellations.',
            },
          },
        ],
      },
      {
        id: 'northern',
        name: 'Northern',
        modeName: 'tube',
        lineStatuses: [
          {
            id: 202,
            statusSeverity: 3,
            statusSeverityDescription: 'Severe Delays',
            reason: 'Northern Line: Severe delays due to a signal failure at Kennington.',
            validityPeriods: [],
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(0);
  });

  it('Should_normalize_mode_aliases_such_as_elizabeth_dlr_and_overground_named_lines', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'elizabeth',
        name: 'Elizabeth line',
        modeName: 'elizabeth-line',
        lineStatuses: [
          {
            statusSeverityDescription: 'Part Closure',
            reason: 'Elizabeth line: Sunday 12 July, no service between Paddington and Abbey Wood.',
            validityPeriods: [{ fromDate: '2026-07-12T03:00:00Z', toDate: '2026-07-13T01:00:00Z' }],
            disruption: { category: 'PlannedWork' },
          },
        ],
      },
      {
        id: 'dlr',
        name: 'DLR',
        modeName: 'dlr',
        lineStatuses: [
          {
            statusSeverityDescription: 'Planned Closure',
            reason: 'DLR: Saturday 11 and Sunday 12 July, no service between Bank and Poplar.',
            validityPeriods: [{ fromDate: '2026-07-11T03:30:00Z', toDate: '2026-07-13T02:00:00Z' }],
            disruption: { category: 'PlannedWork' },
          },
        ],
      },
      {
        id: 'weaver',
        name: 'Weaver',
        modeName: 'overground',
        lineStatuses: [
          {
            statusSeverityDescription: 'Part Closure',
            reason: 'Weaver line: No service between Edmonton Green and Cheshunt.',
            validityPeriods: [{ fromDate: '2026-07-11T03:30:00Z', toDate: '2026-07-13T00:30:00Z' }],
            disruption: { category: 'PlannedWork' },
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.mode).toBe('elizabeth-line');
    expect(parsed[0]?.lineId).toBe('elizabeth');
    expect(parsed[1]?.mode).toBe('dlr');
    expect(parsed[1]?.lineId).toBe('dlr');
    expect(parsed[2]?.mode).toBe('overground');
    expect(parsed[2]?.lineId).toBe('weaver');
  });

  it('Should_filter_out_disruptions_that_do_not_overlap_weekend_window', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'bakerloo',
        name: 'Bakerloo',
        modeName: 'tube',
        lineStatuses: [
          {
            statusSeverityDescription: 'Part Closure',
            reason: 'Bakerloo line: Weekday engineering repair on Thursday night.',
            validityPeriods: [
              {
                fromDate: '2026-07-09T22:00:00Z',
                toDate: '2026-07-10T04:30:00Z', // Ends Friday morning, before Friday 19:00
              },
            ],
            disruption: { category: 'PlannedWork' },
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(0);
  });

  it('Should_deduplicate_disruptions_by_line_and_corridor_within_same_weekend', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'piccadilly',
        name: 'Piccadilly',
        modeName: 'tube',
        lineStatuses: [
          {
            statusSeverityDescription: 'Part Closure',
            reason: 'Piccadilly Line: No service between Rayners Lane and Uxbridge.',
            validityPeriods: [{ fromDate: '2026-07-11T03:00:00Z', toDate: '2026-07-12T03:00:00Z' }],
            disruption: { category: 'PlannedWork' },
          },
          {
            statusSeverityDescription: 'Part Closure',
            reason: 'Piccadilly Line: No service between Rayners Lane and Uxbridge.',
            validityPeriods: [{ fromDate: '2026-07-12T03:00:00Z', toDate: '2026-07-13T02:00:00Z' }],
            disruption: { category: 'PlannedWork' },
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.lineId).toBe('piccadilly');
    expect(parsed[0]?.corridorDescription).toBe('No service between Rayners Lane and Uxbridge.');
  });

  it('Should_fall_back_to_weekend_window_bounds_when_planned_work_omits_validity_periods', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'waterloo-city',
        name: 'Waterloo & City',
        modeName: 'tube',
        lineStatuses: [
          {
            statusSeverityDescription: 'Planned Closure',
            reason: 'Waterloo & City line: Planned closure across the weekend.',
            validityPeriods: [],
            disruption: {
              category: 'PlannedWork',
              description: 'Waterloo & City line: Planned closure across the weekend.',
            },
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.lineId).toBe('waterloo-city');
    expect(parsed[0]?.validFrom).toBe(mockWeekendWindow.windowStart.toISOString());
    expect(parsed[0]?.validTo).toBe(mockWeekendWindow.windowEnd.toISOString());
  });

  it('Should_discard_disruptions_with_empty_validity_periods_lacking_weekend_relevance_and_planned_work_category', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'waterloo-city',
        name: 'Waterloo & City',
        modeName: 'tube',
        lineStatuses: [
          {
            statusSeverityDescription: 'Planned Closure',
            reason: 'Waterloo & City line: Planned maintenance on Wednesday afternoon.',
            validityPeriods: [],
            disruption: {
              category: 'Information',
              description: 'Waterloo & City line: Planned maintenance on Wednesday afternoon.',
            },
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(0);
  });

  it('Should_permit_fallback_to_weekend_bounds_for_PlannedWork_category_even_without_day_names_in_text', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'piccadilly',
        name: 'Piccadilly',
        modeName: 'tube',
        lineStatuses: [
          {
            statusSeverityDescription: 'Part Closure',
            reason: 'Piccadilly line: Track renewal between Acton Town and Uxbridge.',
            validityPeriods: [],
            disruption: {
              category: 'PlannedWork',
              description: 'Piccadilly line: Track renewal between Acton Town and Uxbridge.',
            },
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.lineId).toBe('piccadilly');
    expect(parsed[0]?.validFrom).toBe(mockWeekendWindow.windowStart.toISOString());
    expect(parsed[0]?.validTo).toBe(mockWeekendWindow.windowEnd.toISOString());
  });

  it('Should_accept_expanded_severities_and_information_category_with_weekend_relevance', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'waterloo-city',
        name: 'Waterloo & City',
        modeName: 'tube',
        lineStatuses: [
          {
            statusSeverityDescription: 'Service Closed',
            reason:
              'Waterloo & City line: service operates Monday to Friday only. There is no service on Saturdays and Sundays.',
            validityPeriods: [],
            disruption: {
              category: 'Information',
              categoryDescription: 'Information',
              description:
                'Waterloo & City line: service operates Monday to Friday only. There is no service on Saturdays and Sundays.',
            },
          },
        ],
      },
      {
        id: 'bakerloo',
        name: 'Bakerloo',
        modeName: 'tube',
        lineStatuses: [
          {
            statusSeverityDescription: 'Part Closed',
            reason:
              'Bakerloo line: Part closed Saturday and Sunday between Queen’s Park and Harrow & Wealdstone.',
            validityPeriods: [
              {
                fromDate: '2026-07-11T04:00:00Z',
                toDate: '2026-07-12T22:00:00Z',
              },
            ],
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.lineId).toBe('waterloo-city');
    expect(parsed[0]?.statusSeverityDescription).toBe('Service Closed');
    expect(parsed[1]?.lineId).toBe('bakerloo');
    expect(parsed[1]?.statusSeverityDescription).toBe('Part Closed');
  });

  it('Should_parse_and_materialize_multiple_structured_notices_with_bus_routes_during_ingestion', () => {
    const rawStatusResponse: RawTflLineStatus[] = [
      {
        id: 'mildmay',
        name: 'Mildmay line',
        modeName: 'overground',
        lineStatuses: [
          {
            statusSeverityDescription: 'Part Closure',
            reason:
              'Mildmay line: Saturday 11 and Sunday 12 July, no service between Stratford and Richmond. Replacement bus service DL1: Camden Road - Richmond.',
            validityPeriods: [{ fromDate: '2026-07-11T03:30:00Z', toDate: '2026-07-13T02:00:00Z' }],
            disruption: { category: 'PlannedWork' },
          },
        ],
      },
    ];

    const parsed = parseTflDisruptions({
      disruptions: rawStatusResponse,
      weekendWindow: mockWeekendWindow,
    });

    expect(parsed).toHaveLength(1);
    const notices = parsed[0]?.notices;
    expect(notices).toBeDefined();
    expect(notices).toHaveLength(1);
    expect(notices?.[0]?.headline).toBe('Stratford ↔ Richmond: No service');
    expect(notices?.[0]?.timeframe).toBe('Saturday 11 & Sunday 12 July');
    expect(notices?.[0]?.busRoute).toBeDefined();
    expect(notices?.[0]?.busRoute?.serviceName).toBe('Replacement Bus Service DL1');
    expect(notices?.[0]?.busRoute?.stops).toEqual(['Camden Road', 'Richmond']);
  });
});
