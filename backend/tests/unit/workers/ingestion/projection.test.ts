import type { DisruptionNotice } from '@railsignal/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ParsedDisruption } from '../../../../src/clients/tfl/types.js';
import { prisma } from '../../../../src/db.js';
import { projectDisruptions } from '../../../../src/workers/ingestion/projection.js';

describe('Disruption Projection Persistence', () => {
  beforeEach(async () => {
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: 'projection-northern' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const mockNotice: DisruptionNotice = {
    headline: 'Camden Town ↔ High Barnet: No service',
    corridor: 'Camden Town ↔ High Barnet: No service',
    timeframe: 'Saturday & Sunday',
    rawFallback: 'No service between Camden Town and High Barnet',
  };

  const mockDisruption: ParsedDisruption = {
    lineId: 'projection-northern',
    lineName: 'Northern',
    mode: 'tube',
    statusSeverityDescription: 'Part Closure',
    corridorDescription: 'No service between Camden Town and High Barnet',
    weekendDate: '2026-10-17',
    validFrom: '2026-10-17T02:00:00.000Z',
    validTo: '2026-10-19T03:30:00.000Z',
    sourceLastUpdated: '2026-10-16T10:00:00.000Z',
    notices: [mockNotice],
  };

  it('Should_idempotently_upsert_weekend_disruptions_into_prisma_without_duplication', async () => {
    const firstResult = await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
    });

    expect(firstResult.totalUpserted).toBe(1);
    const countAfterFirst = await prisma.weekendDisruption.count({
      where: { lineId: 'projection-northern' },
    });
    expect(countAfterFirst).toBe(1);

    const secondResult = await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
    });

    expect(secondResult.totalUpserted).toBe(1);
    const countAfterSecond = await prisma.weekendDisruption.count({
      where: { lineId: 'projection-northern' },
    });
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
        lineId: 'projection-northern',
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
    const count = await prisma.weekendDisruption.count({
      where: { lineId: 'projection-northern' },
    });
    expect(count).toBe(1);
  });

  it('Should_delete_stale_disruptions_for_weekendDate_when_not_in_incoming_payload', async () => {
    // Initial projection with 1 disruption
    await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
      weekendDate: '2026-10-17',
    });

    const countBefore = await prisma.weekendDisruption.count({
      where: { lineId: 'projection-northern', weekendDate: '2026-10-17' },
    });
    expect(countBefore).toBe(1);

    // Re-project with an empty array for that weekend (works cancelled)
    const reconcileResult = await projectDisruptions({
      prisma,
      disruptions: [],
      weekendDate: '2026-10-17',
    });

    expect(reconcileResult.totalDeleted).toBe(1);
    const countAfter = await prisma.weekendDisruption.count({
      where: { lineId: 'projection-northern', weekendDate: '2026-10-17' },
    });
    expect(countAfter).toBe(0);
  });

  it('Should_reconcile_and_purge_unreported_disruptions_for_target_weekend_without_affecting_other_weekends', async () => {
    // Insert a stale disruption for the target weekend
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'projection-northern',
        lineName: 'Northern',
        mode: 'tube',
        statusSeverityDescription: 'Minor Delays',
        corridorDescription: 'Minor delays due to train cancellations',
        weekendDate: '2026-10-17',
        validFrom: new Date('2026-10-17T02:00:00.000Z'),
        validTo: new Date('2026-10-19T03:30:00.000Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00.000Z'),
      },
    });

    // Insert an engineering work for another future weekend
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'projection-northern',
        lineName: 'Northern',
        mode: 'tube',
        statusSeverityDescription: 'Severe Delays',
        corridorDescription: 'Future scheduled maintenance',
        weekendDate: '2026-10-24',
        validFrom: new Date('2026-10-24T02:00:00.000Z'),
        validTo: new Date('2026-10-26T03:30:00.000Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00.000Z'),
      },
    });

    // Run projection for target weekend 2026-10-17
    await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
      weekendDate: '2026-10-17',
    });

    // Stale record for 2026-10-17 should have been deleted via reconciliation
    const staleCount = await prisma.weekendDisruption.count({
      where: {
        lineId: 'projection-northern',
        weekendDate: '2026-10-17',
        statusSeverityDescription: 'Minor Delays',
      },
    });
    expect(staleCount).toBe(0);

    // Record for other weekend 2026-10-24 must remain intact
    const futureCount = await prisma.weekendDisruption.count({
      where: {
        lineId: 'projection-northern',
        weekendDate: '2026-10-24',
      },
    });
    expect(futureCount).toBe(1);
  });

  it('Should_materialize_child_disruption_notices_when_projecting_disruptions', async () => {
    await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
      weekendDate: '2026-10-17',
    });

    const persisted = await prisma.weekendDisruption.findFirst({
      where: { lineId: 'projection-northern', weekendDate: '2026-10-17' },
      include: { notices: true },
    });

    expect(persisted).toBeDefined();
    expect(persisted?.notices).toHaveLength(1);
    expect(persisted?.notices[0]?.headline).toBe('Camden Town ↔ High Barnet: No service');
    expect(persisted?.notices[0]?.timeframe).toBe('Saturday & Sunday');
    expect(persisted?.notices[0]?.disruptionId).toBe(persisted?.id);
  });

  it('Should_atomically_replace_child_notices_when_re_projecting_disruptions', async () => {
    await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
      weekendDate: '2026-10-17',
    });

    const updatedDisruption: ParsedDisruption = {
      ...mockDisruption,
      notices: [
        {
          headline: 'Camden Town ↔ Archway: Reduced service',
          corridor: 'Camden Town ↔ Archway: Reduced service',
          timeframe: 'Sunday only',
        },
      ],
    };

    await projectDisruptions({
      prisma,
      disruptions: [updatedDisruption],
      weekendDate: '2026-10-17',
    });

    const persisted = await prisma.weekendDisruption.findFirst({
      where: { lineId: 'projection-northern', weekendDate: '2026-10-17' },
      include: { notices: true },
    });

    expect(persisted?.notices).toHaveLength(1);
    expect(persisted?.notices[0]?.headline).toBe('Camden Town ↔ Archway: Reduced service');
    expect(persisted?.notices[0]?.timeframe).toBe('Sunday only');
  });

  it('Should_cascade_delete_child_notices_when_parent_disruption_is_purged', async () => {
    await projectDisruptions({
      prisma,
      disruptions: [mockDisruption],
      weekendDate: '2026-10-17',
    });

    const savedDisruption = await prisma.weekendDisruption.findFirst({
      where: { lineId: 'projection-northern', weekendDate: '2026-10-17' },
    });
    expect(savedDisruption).toBeDefined();

    const noticeCountBefore = await prisma.disruptionNotice.count({
      where: { disruptionId: savedDisruption?.id },
    });
    expect(noticeCountBefore).toBe(1);

    // Reconcile with empty payload to purge
    await projectDisruptions({
      prisma,
      disruptions: [],
      weekendDate: '2026-10-17',
    });

    const noticeCountAfter = await prisma.disruptionNotice.count({
      where: { disruptionId: savedDisruption?.id },
    });
    expect(noticeCountAfter).toBe(0);
  });
});
