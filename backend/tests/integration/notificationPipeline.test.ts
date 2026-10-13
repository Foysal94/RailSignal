import { EventEmitter } from 'node:events';
import type { Job } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/db.js';
import type { ResendEmailClient, SendDisruptionDigestOptions } from '../../src/email/index.js';
import type { DemoAlertJobData, NotificationJobData } from '../../src/queues/queues.js';
import {
  closeAllWorkers,
  createDemoAlertWorkerHandler,
  createNotificationWorkerHandler,
  processDemoAlertJob,
  processNotificationJob,
  startAllWorkers,
} from '../../src/workers/index.js';

describe('Notification & Demo Pipeline Integration Tests', () => {
  const weekendDate = '2026-10-16';

  beforeEach(async () => {
    await prisma.subscription.deleteMany({
      where: { email: { contains: 'pipeline-notif' } },
    });
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: { startsWith: 'pipe-notif-' } },
    });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({
      where: { email: { contains: 'pipeline-notif' } },
    });
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: { startsWith: 'pipe-notif-' } },
    });
    await prisma.$disconnect();
  });

  it('Should_orchestrate_end_to_end_notification_dispatch_and_persist_idempotency_state', async () => {
    // 1. Seed disruptions
    await prisma.weekendDisruption.createMany({
      data: [
        {
          lineId: 'pipe-notif-central',
          lineName: 'Central',
          mode: 'tube',
          statusSeverityDescription: 'Part Closure',
          corridorDescription: 'No service between White City and Ealing Broadway',
          weekendDate,
          validFrom: new Date('2026-10-16T19:00:00Z'),
          validTo: new Date('2026-10-19T03:30:00Z'),
          sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
        },
        {
          lineId: 'pipe-notif-northern',
          lineName: 'Northern',
          mode: 'tube',
          statusSeverityDescription: 'Planned Closure',
          corridorDescription: 'No service between Camden Town and High Barnet',
          weekendDate,
          validFrom: new Date('2026-10-16T19:00:00Z'),
          validTo: new Date('2026-10-19T03:30:00Z'),
          sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
        },
      ],
    });

    // 2. Seed subscribers:
    // Sub 1: Central only
    const sub1 = await prisma.subscription.create({
      data: {
        email: 'pipeline-notif-1@example.com',
        lines: { create: [{ lineId: 'pipe-notif-central' }] },
      },
    });

    // Sub 2: Northern only
    const sub2 = await prisma.subscription.create({
      data: {
        email: 'pipeline-notif-2@example.com',
        lines: { create: [{ lineId: 'pipe-notif-northern' }] },
      },
    });

    // Sub 3: Victoria (not disrupted)
    const sub3 = await prisma.subscription.create({
      data: {
        email: 'pipeline-notif-3@example.com',
        lines: { create: [{ lineId: 'pipe-notif-victoria' }] },
      },
    });

    const sentEmails: SendDisruptionDigestOptions[] = [];
    const mockEmailClient: Pick<ResendEmailClient, 'sendDisruptionDigest'> = {
      sendDisruptionDigest: vi
        .fn()
        .mockImplementation(async (options: SendDisruptionDigestOptions) => {
          sentEmails.push(options);
          return { id: `mock-${sentEmails.length}`, delivered: true, mocked: false };
        }),
    };

    // 3. Instantiate worker handler bound to real DB and mock email transport
    const handler = createNotificationWorkerHandler({
      processor: (opts) =>
        processNotificationJob({
          ...opts,
          prisma,
          emailClient: mockEmailClient,
        }),
    });

    const mockJob = {
      id: 'pipeline-job-1',
      data: { weekendDate },
    } as unknown as Job<NotificationJobData>;

    const result = await handler(mockJob);

    expect(result.weekendDate).toBe(weekendDate);
    expect(result.totalMatched).toBe(2);
    expect(result.totalDispatched).toBe(2);
    expect(result.totalSkipped).toBe(0);
    expect(sentEmails).toHaveLength(2);

    // Verify sub1 received only Central disruption
    const emailSub1 = sentEmails.find((e) => e.to === 'pipeline-notif-1@example.com');
    expect(emailSub1).toBeDefined();
    expect(emailSub1?.digest.disruptions).toHaveLength(1);
    expect(emailSub1?.digest.disruptions?.[0].lineId).toBe('pipe-notif-central');
    expect(emailSub1?.digest.unsubscribeToken).toBe(sub1.unsubscribeToken);

    // Verify sub2 received only Northern disruption
    const emailSub2 = sentEmails.find((e) => e.to === 'pipeline-notif-2@example.com');
    expect(emailSub2).toBeDefined();
    expect(emailSub2?.digest.disruptions).toHaveLength(1);
    expect(emailSub2?.digest.disruptions?.[0].lineId).toBe('pipe-notif-northern');
    expect(emailSub2?.digest.unsubscribeToken).toBe(sub2.unsubscribeToken);

    // Verify DB state updated for sub1 and sub2
    const updatedSub1 = await prisma.subscription.findUnique({ where: { id: sub1.id } });
    expect(updatedSub1?.lastNotifiedWeekendDate).toBe(weekendDate);

    const updatedSub2 = await prisma.subscription.findUnique({ where: { id: sub2.id } });
    expect(updatedSub2?.lastNotifiedWeekendDate).toBe(weekendDate);

    // Sub 3 was unaffected and should not have been updated
    const updatedSub3 = await prisma.subscription.findUnique({ where: { id: sub3.id } });
    expect(updatedSub3?.lastNotifiedWeekendDate).toBeNull();
  });

  it('Should_safely_deduplicate_on_subsequent_pipeline_runs_without_sending_duplicate_emails', async () => {
    // 1. Seed disruption and subscriber
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'pipe-notif-central',
        lineName: 'Central',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'Suspension',
        weekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
      },
    });

    await prisma.subscription.create({
      data: {
        email: 'pipeline-notif-dedup@example.com',
        lines: { create: [{ lineId: 'pipe-notif-central' }] },
      },
    });

    const mockEmailClient: Pick<ResendEmailClient, 'sendDisruptionDigest'> = {
      sendDisruptionDigest: vi
        .fn()
        .mockResolvedValue({ id: 'mock-1', delivered: true, mocked: false }),
    };

    const handler = createNotificationWorkerHandler({
      processor: (opts) =>
        processNotificationJob({
          ...opts,
          prisma,
          emailClient: mockEmailClient,
        }),
    });

    const mockJob = {
      id: 'pipeline-job-replay',
      data: { weekendDate },
    } as unknown as Job<NotificationJobData>;

    // First run: dispatches
    const firstResult = await handler(mockJob);
    expect(firstResult.totalDispatched).toBe(1);
    expect(firstResult.totalSkipped).toBe(0);
    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledTimes(1);

    // Replay / second run: skips completely
    const secondResult = await handler(mockJob);
    expect(secondResult.totalDispatched).toBe(0);
    expect(secondResult.totalSkipped).toBe(1);
    // Still 1 total invocation across both runs
    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledTimes(1);
  });

  it('Should_execute_demo_alert_pipeline_end_to_end_without_modifying_database', async () => {
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'pipe-notif-central',
        lineName: 'Central',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'Engineering works',
        weekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
      },
    });

    const mockEmailClient: Pick<ResendEmailClient, 'sendDisruptionDigest'> = {
      sendDisruptionDigest: vi
        .fn()
        .mockResolvedValue({ id: 'demo-msg', delivered: true, mocked: false }),
    };

    const handler = createDemoAlertWorkerHandler({
      processor: (opts) =>
        processDemoAlertJob({
          ...opts,
          referenceDate: new Date('2026-10-15T12:00:00Z'),
          prisma,
          emailClient: mockEmailClient,
        }),
    });

    const mockJob = {
      id: 'demo-job-1',
      data: {
        email: 'pipeline-notif-demo@example.com',
        lines: ['pipe-notif-central'],
      },
    } as unknown as Job<DemoAlertJobData>;

    const initialSubscriptions = await prisma.subscription.findMany();

    const result = await handler(mockJob);

    expect(result.email).toBe('pipeline-notif-demo@example.com');
    expect(result.weekendDate).toBe(weekendDate);
    expect(result.totalDisruptions).toBe(1);
    expect(result.dispatched).toBe(true);
    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledTimes(1);

    // Confirm database subscriptions were untouched
    const currentSubscriptions = await prisma.subscription.findMany();
    expect(currentSubscriptions).toEqual(initialSubscriptions);
  });

  it('Should_coordinate_graceful_shutdown_across_all_workers_without_dangling_locks', async () => {
    const mockConnection = Object.assign(new EventEmitter(), {
      options: { maxRetriesPerRequest: null, enableReadyCheck: false },
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      duplicate: () => mockConnection,
      quit: vi.fn().mockResolvedValue('OK'),
      status: 'ready',
      info: vi.fn().mockResolvedValue('redis_version:7.0.0\r\nmaxmemory_policy:noeviction\r\n'),
      defineCommand: vi.fn(),
    });

    const active = startAllWorkers({
      connection: mockConnection as never,
    });

    expect(active.ingestionWorker).toBeDefined();
    expect(active.notificationWorker).toBeDefined();
    expect(active.demoAlertWorker).toBeDefined();

    await expect(closeAllWorkers()).resolves.toBeUndefined();
  });
});
