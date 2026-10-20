import { describe, expect, it } from 'vitest';
import {
  mapDisruptionsToDigestItems,
  type WeekendDisruptionWithNotices,
} from '../../../src/workers/digestMapper.js';

describe('Disruption Digest Mapper Seam', () => {
  it('Should_map_disruptions_and_deserialize_child_notices_without_regex', () => {
    const mockDisruptions: WeekendDisruptionWithNotices[] = [
      {
        id: 'disruption-1',
        lineId: 'northern',
        lineName: 'Northern',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'No service between Camden Town and High Barnet',
        weekendDate: '2026-10-17',
        validFrom: new Date('2026-10-17T02:00:00.000Z'),
        validTo: new Date('2026-10-19T03:30:00.000Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00.000Z'),
        projectedAt: new Date('2026-10-16T10:05:00.000Z'),
        notices: [
          {
            id: 'notice-1',
            disruptionId: 'disruption-1',
            headline: 'Camden Town ↔ High Barnet: No service',
            corridor: 'Camden Town ↔ High Barnet: No service',
            timeframe: 'Saturday & Sunday',
            busRouteJson: JSON.stringify({
              serviceName: 'Replacement Bus Service A',
              stops: ['Camden Town', 'High Barnet'],
              summary: '2 stops',
              rawRoute: 'Camden Town - High Barnet',
            }),
            detailsJson: JSON.stringify(['Last through train at 23:45']),
            rawFallback: 'Raw fallback text',
          },
        ],
      },
    ];

    const digestItems = mapDisruptionsToDigestItems(mockDisruptions);

    expect(digestItems).toHaveLength(1);
    const item = digestItems[0];
    expect(item.lineId).toBe('northern');
    expect(item.lineName).toBe('Northern');
    expect(item.mode).toBe('tube');
    expect(item.statusSeverityDescription).toBe('Part Closure');
    expect(item.notices).toHaveLength(1);
    expect(item.notices?.[0]?.headline).toBe('Camden Town ↔ High Barnet: No service');
    expect(item.notices?.[0]?.timeframe).toBe('Saturday & Sunday');
    expect(item.notices?.[0]?.busRoute?.serviceName).toBe('Replacement Bus Service A');
    expect(item.notices?.[0]?.details).toEqual(['Last through train at 23:45']);
  });

  it('Should_omit_notices_field_when_disruption_has_no_child_notices', () => {
    const mockDisruptions: WeekendDisruptionWithNotices[] = [
      {
        id: 'disruption-2',
        lineId: 'victoria',
        lineName: 'Victoria',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'No service between Victoria and Brixton',
        weekendDate: '2026-10-17',
        validFrom: new Date('2026-10-17T02:00:00.000Z'),
        validTo: new Date('2026-10-19T03:30:00.000Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00.000Z'),
        projectedAt: new Date('2026-10-16T10:05:00.000Z'),
        notices: [],
      },
    ];

    const digestItems = mapDisruptionsToDigestItems(mockDisruptions);

    expect(digestItems).toHaveLength(1);
    expect(digestItems[0].notices).toBeUndefined();
  });
});
