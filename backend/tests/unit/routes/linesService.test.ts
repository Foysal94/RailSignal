import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { fetchWeekendStatus } from '../../../src/routes/lines.service.js';

describe('Lines Domain Service', () => {
  it('Should_assemble_weekend_status_board_with_empty_disruptions_fallback', async () => {
    const mockPrisma = {
      weekendDisruption: {
        findMany: async () => [],
      },
    } as unknown as PrismaClient;

    const result = await fetchWeekendStatus({
      prisma: mockPrisma,
      referenceDate: '2026-10-16',
    });

    expect(result.weekendDate).toBe('2026-10-16');
    expect(result.lines).toHaveLength(19);
    expect(result.lines.every((line) => !line.hasDisruption)).toBe(true);
    expect(result.lines.every((line) => line.statusSeverityDescription === 'Good Service')).toBe(
      true,
    );
  });

  it('Should_sort_multiple_disrupted_lines_alphabetically_ahead_of_undisrupted_lines', async () => {
    const mockPrisma = {
      weekendDisruption: {
        findMany: async () => [
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
        ],
      },
    } as unknown as PrismaClient;

    const result = await fetchWeekendStatus({
      prisma: mockPrisma,
      referenceDate: '2026-10-16',
    });

    // Bakerloo and Northern should be first and second (both disrupted, Bakerloo < Northern)
    expect(result.lines[0].lineId).toBe('bakerloo');
    expect(result.lines[0].hasDisruption).toBe(true);

    expect(result.lines[1].lineId).toBe('northern');
    expect(result.lines[1].hasDisruption).toBe(true);

    // Third should be first non-disrupted alphabetically (Central)
    expect(result.lines[2].lineId).toBe('central');
    expect(result.lines[2].hasDisruption).toBe(false);

    expect(result.lastUpdated).toBe('2026-10-16T12:10:00.000Z');
  });
});
