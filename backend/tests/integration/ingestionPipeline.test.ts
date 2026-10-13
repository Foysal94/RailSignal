import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TflClient } from '../../src/clients/tfl/client.js';
import type { ParsedDisruption } from '../../src/clients/tfl/types.js';
import { prisma } from '../../src/db.js';
import type {
  IngestJobData,
  IngestJobResult,
  NotificationJobData,
} from '../../src/queues/queues.js';
import { processIngestionJob } from '../../src/workers/ingestion/processor.js';
import { createIngestionWorkerHandler } from '../../src/workers/ingestionWorker.js';

interface EnqueuedNotificationJob {
  name: string;
  data: NotificationJobData;
  opts?: { jobId?: string };
}

/**
 * In-memory BullMQ Queue double simulating Redis queue persistence and job enqueuing.
 */
class InMemoryQueueDouble {
  public readonly jobs: EnqueuedNotificationJob[] = [];

  public async add(
    name: string,
    data: NotificationJobData,
    opts?: { jobId?: string },
  ): Promise<{ id: string; name: string; data: NotificationJobData }> {
    const jobEntry = { name, data, opts };
    this.jobs.push(jobEntry);
    return {
      id: opts?.jobId ?? `mock-job-${this.jobs.length}`,
      name,
      data,
    };
  }

  public clear(): void {
    this.jobs.length = 0;
  }
}

describe('Ingestion Pipeline Integration Tests (In-Memory Queue Double + Prisma SQLite)', () => {
  let notificationQueueDouble: InMemoryQueueDouble;

  beforeEach(async () => {
    notificationQueueDouble = new InMemoryQueueDouble();
    await prisma.weekendDisruption.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const sampleDisruptions: ParsedDisruption[] = [
    {
      lineId: 'central',
      lineName: 'Central',
      mode: 'tube',
      statusSeverityDescription: 'Part Closure',
      corridorDescription: 'No service between White City and Ealing Broadway',
      weekendDate: '2026-10-16',
      validFrom: '2026-10-16T19:00:00.000Z',
      validTo: '2026-10-19T03:30:00.000Z',
      sourceLastUpdated: '2026-10-16T08:00:00.000Z',
    },
    {
      lineId: 'northern',
      lineName: 'Northern',
      mode: 'tube',
      statusSeverityDescription: 'Planned Closure',
      corridorDescription: 'No service between Camden Town and High Barnet',
      weekendDate: '2026-10-16',
      validFrom: '2026-10-16T19:00:00.000Z',
      validTo: '2026-10-19T03:30:00.000Z',
      sourceLastUpdated: '2026-10-16T08:30:00.000Z',
    },
  ];

  it('Should_execute_ingestion_pipeline_upsert_weekend_disruptions_to_sqlite_and_enqueue_downstream_notification_job', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockResolvedValue(sampleDisruptions),
    };

    const handler = createIngestionWorkerHandler({
      notificationQueue: notificationQueueDouble,
      processor: async (opts) =>
        processIngestionJob({
          ...opts,
          tflClient: mockTflClient,
          prisma,
          referenceDate: new Date('2026-10-15T12:00:00Z'),
        }),
    });

    const mockJob = {
      id: 'ingest-run-1',
      data: { referenceDate: '2026-10-15T12:00:00Z' } as IngestJobData,
    };

    const result = (await handler(mockJob as never)) as IngestJobResult;

    // Verify ingestion execution result
    expect(result.weekendDate).toBe('2026-10-16');
    expect(result.totalFetched).toBe(2);
    expect(result.totalUpserted).toBe(2);

    // Verify observable Prisma SQLite persistence
    const persisted = await prisma.weekendDisruption.findMany({
      orderBy: { lineId: 'asc' },
    });
    expect(persisted).toHaveLength(2);
    expect(persisted[0].lineId).toBe('central');
    expect(persisted[0].corridorDescription).toBe(
      'No service between White City and Ealing Broadway',
    );
    expect(persisted[1].lineId).toBe('northern');
    expect(persisted[1].statusSeverityDescription).toBe('Planned Closure');

    // Verify downstream notification job was enqueued
    expect(notificationQueueDouble.jobs).toHaveLength(1);
    const downstreamJob = notificationQueueDouble.jobs[0];
    expect(downstreamJob.name).toBe('dispatch-weekend-digest');
    expect(downstreamJob.data.weekendDate).toBe('2026-10-16');
    expect(downstreamJob.opts?.jobId).toBe('notification-digest-2026-10-16');
  });

  it('Should_maintain_strict_idempotency_when_ingestion_pipeline_runs_repeatedly_for_the_same_weekend', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockResolvedValue(sampleDisruptions),
    };

    const handler = createIngestionWorkerHandler({
      notificationQueue: notificationQueueDouble,
      processor: async (opts) =>
        processIngestionJob({
          ...opts,
          tflClient: mockTflClient,
          prisma,
          referenceDate: new Date('2026-10-15T12:00:00Z'),
        }),
    });

    const mockJob = {
      id: 'ingest-run-idempotency',
      data: { referenceDate: '2026-10-15T12:00:00Z' } as IngestJobData,
    };

    // First execution
    await handler(mockJob as never);
    expect(await prisma.weekendDisruption.count()).toBe(2);

    // Second execution with identical payload
    await handler(mockJob as never);
    expect(await prisma.weekendDisruption.count()).toBe(2);

    // Third execution with updated disruption status for existing compound key
    const modifiedDisruptions: ParsedDisruption[] = [
      {
        ...sampleDisruptions[0],
        statusSeverityDescription: 'Suspended (Updated)',
      },
    ];
    mockTflClient.getWeekendDisruptions = vi.fn().mockResolvedValue(modifiedDisruptions);

    await handler(mockJob as never);

    const central = await prisma.weekendDisruption.findFirst({
      where: { lineId: 'central' },
    });
    expect(central?.statusSeverityDescription).toBe('Suspended (Updated)');

    // Ensure downstream job enqueuing retains deterministic deduplication ID
    expect(notificationQueueDouble.jobs).toHaveLength(3);
    for (const job of notificationQueueDouble.jobs) {
      expect(job.opts?.jobId).toBe('notification-digest-2026-10-16');
    }
  });

  it('Should_handle_empty_disruptions_gracefully_and_still_trigger_notification_pipeline_for_weekend', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockResolvedValue([]),
    };

    const handler = createIngestionWorkerHandler({
      notificationQueue: notificationQueueDouble,
      processor: async (opts) =>
        processIngestionJob({
          ...opts,
          tflClient: mockTflClient,
          prisma,
          referenceDate: new Date('2026-10-15T12:00:00Z'),
        }),
    });

    const mockJob = {
      id: 'ingest-run-empty',
      data: { referenceDate: '2026-10-15T12:00:00Z' } as IngestJobData,
    };

    const result = (await handler(mockJob as never)) as IngestJobResult;

    expect(result.totalFetched).toBe(0);
    expect(result.totalUpserted).toBe(0);
    expect(await prisma.weekendDisruption.count()).toBe(0);

    // Downstream notification worker is still notified so subscribers receive normal service status
    expect(notificationQueueDouble.jobs).toHaveLength(1);
    expect(notificationQueueDouble.jobs[0].data.weekendDate).toBe('2026-10-16');
  });
});
