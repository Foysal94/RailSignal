import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { purgeContaminatedDisruptions } from '../../../src/jobs/purgeContaminatedDisruptions.js';

describe('Purge Contaminated Disruptions Job', () => {
  it('Should_purge_minor_and_severe_delays_from_weekend_disruption_table', async () => {
    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 4 });
    const mockPrisma = {
      weekendDisruption: {
        deleteMany: mockDeleteMany,
      },
    } as unknown as PrismaClient;

    const result = await purgeContaminatedDisruptions(mockPrisma);

    expect(result.purgedCount).toBe(4);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        statusSeverityDescription: {
          in: ['Minor Delays', 'Severe Delays'],
        },
      },
    });
  });

  it('Should_return_zero_when_no_contaminated_records_exist', async () => {
    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockPrisma = {
      weekendDisruption: {
        deleteMany: mockDeleteMany,
      },
    } as unknown as PrismaClient;

    const result = await purgeContaminatedDisruptions(mockPrisma);

    expect(result.purgedCount).toBe(0);
  });
});
