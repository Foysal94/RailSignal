import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../../src/db.js';
import type { ResendEmailClient } from '../../../../src/email/resendClient.js';
import { processNotificationJob } from '../../../../src/workers/notifications/processor.js';

describe('Notification Processor Idempotency & Dispatch Tests', () => {
  const weekendDate = '2026-10-16';

  beforeEach(async () => {
    await prisma.subscription.deleteMany({
      where: { email: { contains: 'proc-test' } },
    });
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: { startsWith: 'proc-' } },
    });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({
      where: { email: { contains: 'proc-test' } },
    });
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: { startsWith: 'proc-' } },
    });
    await prisma.$disconnect();
  });

  it('Should_compile_digest_dispatch_email_and_atomically_update_lastNotifiedWeekendDate', async () => {
    // 1. Seed disruption
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'proc-central',
        lineName: 'Central',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'No service between White City and Ealing Broadway',
        weekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
      },
    });

    // 2. Seed subscriber without prior notification
    const sub = await prisma.subscription.create({
      data: {
        email: 'proc-test-1@example.com',
        lastNotifiedWeekendDate: null,
        lines: {
          create: [{ lineId: 'proc-central' }],
        },
      },
    });

    const mockEmailClient: Pick<ResendEmailClient, 'sendDisruptionDigest'> = {
      sendDisruptionDigest: vi.fn().mockResolvedValue({
        id: 'msg-123',
        delivered: true,
        mocked: false,
      }),
    };

    // 3. Process notification job
    const result = await processNotificationJob({
      weekendDate,
      prisma,
      emailClient: mockEmailClient,
    });

    expect(result.weekendDate).toBe(weekendDate);
    expect(result.totalMatched).toBe(1);
    expect(result.totalDispatched).toBe(1);
    expect(result.totalSkipped).toBe(0);

    // Assert email client was invoked with personalized digest and unsubscribe token
    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledTimes(1);
    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'proc-test-1@example.com',
        digest: expect.objectContaining({
          recipientEmail: 'proc-test-1@example.com',
          weekendDate,
          unsubscribeToken: sub.unsubscribeToken,
          disruptions: expect.arrayContaining([
            expect.objectContaining({
              lineId: 'proc-central',
              corridorDescription: 'No service between White City and Ealing Broadway',
            }),
          ]),
        }),
      }),
    );

    // Assert atomic update of lastNotifiedWeekendDate in Prisma
    const updatedSub = await prisma.subscription.findUnique({
      where: { id: sub.id },
    });
    expect(updatedSub?.lastNotifiedWeekendDate).toBe(weekendDate);
  });

  it('Should_skip_dispatch_if_subscriber_was_already_notified_for_current_weekend_date', async () => {
    // 1. Seed disruption
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'proc-central',
        lineName: 'Central',
        mode: 'tube',
        statusSeverityDescription: 'Planned Closure',
        corridorDescription: 'Suspended between Leytonstone and Loughton',
        weekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
      },
    });

    // 2. Seed subscriber already notified for this weekend
    const sub = await prisma.subscription.create({
      data: {
        email: 'proc-test-2@example.com',
        lastNotifiedWeekendDate: weekendDate, // Already notified!
        lines: {
          create: [{ lineId: 'proc-central' }],
        },
      },
    });

    const mockEmailClient: Pick<ResendEmailClient, 'sendDisruptionDigest'> = {
      sendDisruptionDigest: vi.fn(),
    };

    // 3. Process notification job
    const result = await processNotificationJob({
      weekendDate,
      prisma,
      emailClient: mockEmailClient,
    });

    expect(result.totalMatched).toBe(1);
    expect(result.totalDispatched).toBe(0);
    expect(result.totalSkipped).toBe(1);

    // Email dispatch must NOT be called for already notified subscriber
    expect(mockEmailClient.sendDisruptionDigest).not.toHaveBeenCalled();

    const checkSub = await prisma.subscription.findUnique({
      where: { id: sub.id },
    });
    expect(checkSub?.lastNotifiedWeekendDate).toBe(weekendDate);
  });

  it('Should_propagate_email_client_error_and_not_update_lastNotifiedWeekendDate_on_failure', async () => {
    // 1. Seed disruption
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'proc-central',
        lineName: 'Central',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'Engineering work',
        weekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
      },
    });

    // 2. Seed subscriber
    const sub = await prisma.subscription.create({
      data: {
        email: 'proc-test-error@example.com',
        lastNotifiedWeekendDate: '2026-10-09', // Previous weekend
        lines: {
          create: [{ lineId: 'proc-central' }],
        },
      },
    });

    const mockEmailClient: Pick<ResendEmailClient, 'sendDisruptionDigest'> = {
      sendDisruptionDigest: vi.fn().mockRejectedValue(new Error('Resend upstream timeout')),
    };

    // 3. Process notification job - must propagate error so BullMQ triggers retries
    await expect(
      processNotificationJob({
        weekendDate,
        prisma,
        emailClient: mockEmailClient,
      }),
    ).rejects.toThrow('Resend upstream timeout');

    // Assert lastNotifiedWeekendDate was NOT updated upon failure
    const checkSub = await prisma.subscription.findUnique({
      where: { id: sub.id },
    });
    expect(checkSub?.lastNotifiedWeekendDate).toBe('2026-10-09');
  });

  it('Should_process_batch_with_mixed_notified_and_unnotified_subscribers_idempotently', async () => {
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'proc-central',
        lineName: 'Central',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'Engineering work',
        weekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
      },
    });

    // Sub A: already notified
    await prisma.subscription.create({
      data: {
        email: 'proc-test-a@example.com',
        lastNotifiedWeekendDate: weekendDate,
        lines: { create: [{ lineId: 'proc-central' }] },
      },
    });

    // Sub B: not notified
    const subB = await prisma.subscription.create({
      data: {
        email: 'proc-test-b@example.com',
        lastNotifiedWeekendDate: null,
        lines: { create: [{ lineId: 'proc-central' }] },
      },
    });

    const mockEmailClient: Pick<ResendEmailClient, 'sendDisruptionDigest'> = {
      sendDisruptionDigest: vi.fn().mockResolvedValue({
        id: 'msg-sub-b',
        delivered: true,
        mocked: false,
      }),
    };

    const firstRunResult = await processNotificationJob({
      weekendDate,
      prisma,
      emailClient: mockEmailClient,
    });

    expect(firstRunResult.totalMatched).toBe(2);
    expect(firstRunResult.totalDispatched).toBe(1);
    expect(firstRunResult.totalSkipped).toBe(1);
    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledTimes(1);
    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'proc-test-b@example.com' }),
    );

    const updatedSubB = await prisma.subscription.findUnique({
      where: { id: subB.id },
    });
    expect(updatedSubB?.lastNotifiedWeekendDate).toBe(weekendDate);

    // Second run: both are now notified, zero emails should be dispatched
    const secondRunResult = await processNotificationJob({
      weekendDate,
      prisma,
      emailClient: mockEmailClient,
    });

    expect(secondRunResult.totalMatched).toBe(2);
    expect(secondRunResult.totalDispatched).toBe(0);
    expect(secondRunResult.totalSkipped).toBe(2);
    // Still 1 total invocation from first run
    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledTimes(1);
  });
});
