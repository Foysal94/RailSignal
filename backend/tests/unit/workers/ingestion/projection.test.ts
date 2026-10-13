import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ParsedDisruption } from '../../../../src/clients/tfl/types.js';
import { prisma } from '../../../../src/db.js';
import { projectDisruptions } from '../../../../src/workers/ingestion/projection.js';

describe('Disruption Projection Persistence', () => {
  beforeEach(async () => {
    await prisma.weekendDisruption.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const mockDisruption: ParsedDisruption = {
    lineId: 'northern',
    lineName: 'Northern',
    mode: 'tube',
    statusSeverityDescription: 'Part Closure',
    corridorDescription: 'No service between Camden Town and High Barnet',
    weekendDate: '2026-10-17',
    validFrom: '2026-10-17T02:00:00.000Z',
    validTo: '2026-10-19T03:30:00.000Z',
    sourceLastUpdated: '2026-10-16T10:00:00.000Z',
  };

  it('Should_idempotently_upsert_weekend_disruptions_into_prisma_without_duplication', async () => {
    // First projection
    const firstResult = await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
    });

    expect(firstResult.totalUpserted).toBe(1);
    const countAfterFirst = await prisma.weekendDisruption.count();
    expect(countAfterFirst).toBe(1);

    // Second projection with identical data
    const secondResult = await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
    });

    expect(secondResult.totalUpserted).toBe(1);
    const countAfterSecond = await prisma.weekendDisruption.count();
    expect(countAfterSecond).toBe(1);
  });

  it('Should_update_existing_records_when_re_projecting_disruptions', async () => {
    await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
    });

    const updatedDisruption: ParsedDisruption = {
      ...mockDisruption,
      statusSeverityDescription: 'Planned Closure',
    };

    await projectDisruptions({
      prisma,
      disruptions: [updatedDisruption],
    });

    const persisted = await prisma.weekendDisruption.findFirst({
      where: {
        lineId: 'northern',
        weekendDate: '2026-10-17',
      },
    });

    expect(persisted?.statusSeverityDescription).toBe('Planned Closure');
  });

  it('Should_deduplicate_identical_disruptions_within_the_same_batch_payload', async () => {
    const duplicateBatch = [mockDisruption, { ...mockDisruption }];

    const result = await projectDisruptions({
      prisma,
      disruptions: duplicateBatch,
    });

    expect(result.totalUpserted).toBe(1);
    const count = await prisma.weekendDisruption.count();
    expect(count).toBe(1);
  });
});
