import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/db.js';

describe('Prisma Persistence Unit Tests', () => {
  beforeEach(async () => {
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.weekendDisruption.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Should_create_and_read_subscription_with_associated_subscription_lines_via_relational_includes', async () => {
    const created = await prisma.subscription.create({
      data: {
        email: 'test@example.com',
        lines: {
          create: [
            { lineId: 'northern' },
            { lineId: 'victoria' },
          ],
        },
      },
      include: {
        lines: true,
      },
    });

    expect(created.id).toBeDefined();
    expect(created.email).toBe('test@example.com');
    expect(created.unsubscribeToken).toBeDefined();
    expect(created.lastNotifiedWeekendDate).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.lines).toHaveLength(2);
    expect(created.lines.map((l) => l.lineId)).toEqual(expect.arrayContaining(['northern', 'victoria']));

    const retrieved = await prisma.subscription.findUnique({
      where: { email: 'test@example.com' },
      include: {
        lines: true,
      },
    });

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.lines).toHaveLength(2);
    expect(retrieved?.lines[0].subscriptionId).toBe(created.id);
  });

  it('Should_cascade_delete_subscription_lines_when_parent_subscription_is_deleted', async () => {
    const created = await prisma.subscription.create({
      data: {
        email: 'cascade@example.com',
        lines: {
          create: [{ lineId: 'central' }, { lineId: 'jubilee' }],
        },
      },
    });

    const linesBefore = await prisma.subscriptionLine.findMany({
      where: { subscriptionId: created.id },
    });
    expect(linesBefore).toHaveLength(2);

    await prisma.subscription.delete({
      where: { id: created.id },
    });

    const linesAfter = await prisma.subscriptionLine.findMany({
      where: { subscriptionId: created.id },
    });
    expect(linesAfter).toHaveLength(0);
  });

  it('Should_create_and_read_weekend_disruption_record_when_persisted_to_sqlite', async () => {
    const now = new Date();
    const created = await prisma.weekendDisruption.create({
      data: {
        lineId: 'northern',
        lineName: 'Northern',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'No service between Camden Town and High Barnet',
        weekendDate: '2026-10-17',
        validFrom: now,
        validTo: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        sourceLastUpdated: now,
      },
    });

    expect(created.id).toBeDefined();
    expect(created.lineId).toBe('northern');
    expect(created.statusSeverityDescription).toBe('Part Closure');
    expect(created.weekendDate).toBe('2026-10-17');
    expect(created.projectedAt).toBeInstanceOf(Date);

    const retrieved = await prisma.weekendDisruption.findMany({
      where: { lineId: 'northern' },
    });

    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].id).toBe(created.id);
  });

  it('Should_support_idempotent_upsert_on_weekend_disruption_compound_unique_key', async () => {
    const now = new Date();
    const disruptionPayload = {
      lineId: 'piccadilly',
      lineName: 'Piccadilly',
      mode: 'tube',
      statusSeverityDescription: 'Part Closure',
      corridorDescription: 'No service between Acton Town and Uxbridge',
      weekendDate: '2026-10-17',
      validFrom: now,
      validTo: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      sourceLastUpdated: now,
    };

    const firstUpsert = await prisma.weekendDisruption.upsert({
      where: {
        lineId_weekendDate_corridorDescription: {
          lineId: 'piccadilly',
          weekendDate: '2026-10-17',
          corridorDescription: 'No service between Acton Town and Uxbridge',
        },
      },
      create: disruptionPayload,
      update: {
        statusSeverityDescription: 'Updated Closure',
      },
    });
    expect(firstUpsert.statusSeverityDescription).toBe('Part Closure');

    const secondUpsert = await prisma.weekendDisruption.upsert({
      where: {
        lineId_weekendDate_corridorDescription: {
          lineId: 'piccadilly',
          weekendDate: '2026-10-17',
          corridorDescription: 'No service between Acton Town and Uxbridge',
        },
      },
      create: disruptionPayload,
      update: {
        statusSeverityDescription: 'Updated Closure',
      },
    });
    expect(secondUpsert.id).toBe(firstUpsert.id);
    expect(secondUpsert.statusSeverityDescription).toBe('Updated Closure');

    const totalRecords = await prisma.weekendDisruption.count({
      where: { lineId: 'piccadilly' },
    });
    expect(totalRecords).toBe(1);
  });
});
