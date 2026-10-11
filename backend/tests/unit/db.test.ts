import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/db.js';

describe('Prisma Persistence Unit Tests', () => {
  beforeEach(async () => {
    await prisma.subscription.deleteMany();
    await prisma.weekendDisruption.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Should_create_and_read_subscription_record_when_persisted_to_sqlite', async () => {
    const created = await prisma.subscription.create({
      data: {
        email: 'test@example.com',
        subscribedLineIds: JSON.stringify(['northern', 'victoria']),
      },
    });

    expect(created.id).toBeDefined();
    expect(created.email).toBe('test@example.com');
    expect(created.subscribedLineIds).toBe('["northern","victoria"]');
    expect(created.unsubscribeToken).toBeDefined();
    expect(created.lastNotifiedWeekendDate).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);

    const retrieved = await prisma.subscription.findUnique({
      where: { email: 'test@example.com' },
    });

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
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
});
