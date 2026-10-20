import { describe, expect, it } from 'vitest';
import {
  getSeverityRank,
  pickHighestSeverityDescription,
  projectWeekendStatusBoard,
} from '../../../src/domain/statusBoard.js';

describe('Domain: Status Board Projection', () => {
  const targetWindow = {
    weekendDate: '2026-10-16',
    windowStart: new Date('2026-10-16T19:00:00Z'),
    windowEnd: new Date('2026-10-19T04:30:00Z'),
  };

  it('Should_assemble_weekend_status_board_with_empty_disruptions_fallback', () => {
    const result = projectWeekendStatusBoard({
      disruptions: [],
      targetWindow,
    });

    expect(result.weekendDate).toBe('2026-10-16');
    expect(result.lines).toHaveLength(19);
    expect(result.lines.every((line) => !line.hasDisruption)).toBe(true);
    expect(
      result.lines.every((line) => line.statusSeverityDescription === 'No Planned Closures'),
    ).toBe(true);
  });

  it('Should_sort_multiple_disrupted_lines_alphabetically_ahead_of_undisrupted_lines', () => {
    const disruptions = [
      {
        id: 'd-1',
        lineId: 'northern',
        lineName: 'Northern',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'Charing Cross branch closed',
        weekendDate: '2026-10-16',
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T04:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T12:00:00Z'),
        projectedAt: new Date('2026-10-16T12:05:00Z'),
      },
      {
        id: 'd-2',
        lineId: 'bakerloo',
        lineName: 'Bakerloo',
        mode: 'tube',
        statusSeverityDescription: 'Planned Closure',
        corridorDescription: 'Entire line closed',
        weekendDate: '2026-10-16',
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T04:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T12:00:00Z'),
        projectedAt: new Date('2026-10-16T12:10:00Z'),
      },
    ];

    const result = projectWeekendStatusBoard({
      disruptions,
      targetWindow,
    });

    // Bakerloo and Northern should be first and second (both disrupted, Bakerloo < Northern alphabetically)
    expect(result.lines[0].lineId).toBe('bakerloo');
    expect(result.lines[0].hasDisruption).toBe(true);

    expect(result.lines[1].lineId).toBe('northern');
    expect(result.lines[1].hasDisruption).toBe(true);

    // Third should be first non-disrupted alphabetically (Central)
    expect(result.lines[2].lineId).toBe('central');
    expect(result.lines[2].hasDisruption).toBe(false);

    expect(result.lastUpdated).toBe('2026-10-16T12:10:00.000Z');
  });

  it('Should_prioritize_highest_severity_when_a_line_has_multiple_disruptions', () => {
    const disruptions = [
      {
        id: 'd-1',
        lineId: 'district',
        lineName: 'District',
        mode: 'tube',
        statusSeverityDescription: 'Reduced Service',
        corridorDescription: 'A: Minor branch reduced service',
        weekendDate: '2026-10-16',
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T04:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T12:00:00Z'),
        projectedAt: new Date('2026-10-16T12:05:00Z'),
      },
      {
        id: 'd-2',
        lineId: 'district',
        lineName: 'District',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'Z: Main branch closed between Turnham Green and Richmond',
        weekendDate: '2026-10-16',
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T04:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T12:00:00Z'),
        projectedAt: new Date('2026-10-16T12:10:00Z'),
      },
    ];

    const result = projectWeekendStatusBoard({
      disruptions,
      targetWindow,
    });

    const district = result.lines.find((l) => l.lineId === 'district');
    expect(district).toBeDefined();
    expect(district?.statusSeverityDescription).toBe('Part Closure');
  });

  it('Should_project_materialized_child_notices_directly_onto_weekend_status_items', () => {
    const disruptions = [
      {
        id: 'd-1',
        lineId: 'northern',
        lineName: 'Northern',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'Camden Town to High Barnet',
        weekendDate: '2026-10-16',
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T04:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T12:00:00Z'),
        projectedAt: new Date('2026-10-16T12:05:00Z'),
        notices: [
          {
            id: 'n-1',
            disruptionId: 'd-1',
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
            rawFallback: 'Raw description fallback text',
          },
        ],
      },
    ];

    const result = projectWeekendStatusBoard({
      disruptions,
      targetWindow,
    });

    const northern = result.lines.find((l) => l.lineId === 'northern');
    expect(northern).toBeDefined();
    expect(northern?.notices).toHaveLength(1);
    expect(northern?.notices?.[0]?.headline).toBe('Camden Town ↔ High Barnet: No service');
    expect(northern?.notices?.[0]?.timeframe).toBe('Saturday & Sunday');
    expect(northern?.notices?.[0]?.busRoute?.serviceName).toBe('Replacement Bus Service A');
    expect(northern?.notices?.[0]?.details).toEqual(['Last through train at 23:45']);
  });

  it('Should_score_severity_ranking_hierarchy_correctly', () => {
    expect(getSeverityRank('planned closure')).toBe(100);
    expect(getSeverityRank('part closure')).toBe(80);
    expect(getSeverityRank('severe delays')).toBe(60);
    expect(getSeverityRank('reduced service')).toBe(50);
    expect(getSeverityRank('good service')).toBe(0);
    expect(getSeverityRank('unknown-custom-status')).toBe(10);
    expect(pickHighestSeverityDescription([])).toBe('No Planned Closures');
  });
});
