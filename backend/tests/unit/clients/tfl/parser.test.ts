import { describe, it, expect } from 'vitest';
import { parseTflDisruptions } from '../../../../src/clients/tfl/parser.js';

describe('TfL Parser - Disruption Payload Normalization', () => {
  const mockWeekendWindow = {
    weekendDate: '2026-07-10',
    windowStart: new Date('2026-07-10T18:00:00.000Z'), // Friday 19:00 BST
    windowEnd: new Date('2026-07-13T03:30:00.000Z'),   // Monday 04:30 BST
  };

  it('Should_parse_raw_tfl_disruption_with_affected_routes_matching_canonical_line', () => {
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
      weekendWindow: mockWeekendWindow as any,
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

  it('Should_parse_raw_tfl_disruption_inferring_line_from_description_when_affected_routes_empty', () => {
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
      weekendWindow: mockWeekendWindow as any,
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

  it('Should_normalize_mode_aliases_such_as_elizabeth_and_dlr_and_overground_lines', () => {
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
      weekendWindow: mockWeekendWindow as any,
    });

    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.mode).toBe('elizabeth-line');
    expect(parsed[0]?.lineId).toBe('elizabeth');
    expect(parsed[1]?.mode).toBe('dlr');
    expect(parsed[1]?.lineId).toBe('dlr');
    expect(parsed[2]?.mode).toBe('overground');
    expect(parsed[2]?.lineId).toBe('lioness');
  });

  it('Should_filter_out_disruptions_that_do_not_overlap_weekend_window', () => {
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
      weekendWindow: mockWeekendWindow as any,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.lineId).toBe('central');
  });

  it('Should_deduplicate_disruptions_by_line_and_corridor_within_same_weekend', () => {
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
      weekendWindow: mockWeekendWindow as any,
    });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.lineId).toBe('victoria');
  });
});
