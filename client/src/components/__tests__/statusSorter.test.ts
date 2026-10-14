import type { WeekendStatusItem } from '@railsignal/shared';
import { describe, expect, it } from 'vitest';
import { sortStatusItems } from '../statusSorter';

describe('statusSorter: sortStatusItems', () => {
  it('Should_sort_disrupted_lines_to_top_and_good_service_below', () => {
    const items: WeekendStatusItem[] = [
      {
        lineId: 'bakerloo',
        lineName: 'Bakerloo',
        mode: 'tube',
        color: '#B36305',
        statusSeverityDescription: 'Good Service',
        hasDisruption: false,
        disruptions: [],
      },
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        mode: 'tube',
        color: '#0098D4',
        statusSeverityDescription: 'Planned Closure',
        hasDisruption: true,
        disruptions: [],
      },
      {
        lineId: 'central',
        lineName: 'Central',
        mode: 'tube',
        color: '#E32017',
        statusSeverityDescription: 'Good Service',
        hasDisruption: false,
        disruptions: [],
      },
      {
        lineId: 'district',
        lineName: 'District',
        mode: 'tube',
        color: '#00782A',
        statusSeverityDescription: 'Part Closure',
        hasDisruption: true,
        disruptions: [],
      },
    ];

    const sorted = sortStatusItems(items);
    const sortedNames = sorted.map((s) => s.lineName);

    // Both District and Victoria are disrupted -> appear first, alphabetical
    expect(sortedNames.slice(0, 2)).toEqual(['District', 'Victoria']);
    // Bakerloo and Central are good service -> appear after, alphabetical
    expect(sortedNames.slice(2)).toEqual(['Bakerloo', 'Central']);
  });

  it('Should_treat_part_suspended_as_a_disruption_even_if_hasDisruption_is_false', () => {
    const items: WeekendStatusItem[] = [
      {
        lineId: 'jubilee',
        lineName: 'Jubilee',
        mode: 'tube',
        color: '#A0A5A9',
        statusSeverityDescription: 'Good Service',
        hasDisruption: false,
        disruptions: [],
      },
      {
        lineId: 'piccadilly',
        lineName: 'Piccadilly',
        mode: 'tube',
        color: '#003688',
        statusSeverityDescription: 'Part Suspended',
        hasDisruption: false,
        disruptions: [],
      },
    ];

    const sorted = sortStatusItems(items);
    expect(sorted[0]?.lineName).toBe('Piccadilly');
    expect(sorted[1]?.lineName).toBe('Jubilee');
  });
});
