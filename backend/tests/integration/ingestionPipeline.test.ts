import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TflClient } from '../../src/clients/tfl/client.js';
import type { ParsedDisruption } from '../../src/clients/tfl/types.js';
import { prisma } from '../../src/db.js';
import type { NotificationJobData } from '../../src/queues/queues.js';
import { syncWeekendDisruptionsPipeline } from '../../src/workers/ingestion/pipeline.js';
import { processIngestionJob } from '../../src/workers/ingestion/processor.js';
import { InMemoryQueueDouble } from '../support/inMemoryQueueDouble.js';

describe('Ingestion Pipeline Integration Tests (In-Memory Queue Double + Prisma SQLite)', () => {
  let notificationQueueDouble: InMemoryQueueDouble<NotificationJobData, void>;

  beforeEach(async () => {
    notificationQueueDouble = new InMemoryQueueDouble<NotificationJobData, void>();
    await prisma.weekendDisruption.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const sampleDisruptions: ParsedDisruption[] = [
    {
      lineId: 'pipeline-central',
      lineName: 'Central',
      mode: 'tube',
      statusSeverityDescription: 'Part Closure',
      corridorDescription: 'No service between White City and Ealing Broadway',
      weekendDate: '2026-10-16',
      validFrom: '2026-10-16T19:00:00.000Z',
      validTo: '2026-10-19T03:30:00.000Z',
      sourceLastUpdated: '2026-10-16T08:00:00.000Z',
      notices: [
        {
          headline: 'White City ↔ Ealing Broadway: No service',
          corridor: 'White City ↔ Ealing Broadway: No service',
          rawFallback: 'No service between White City and Ealing Broadway',
        },
      ],
    },
    {
      lineId: 'pipeline-northern',
      lineName: 'Northern',
      mode: 'tube',
      statusSeverityDescription: 'Planned Closure',
      corridorDescription: 'No service between Camden Town and High Barnet',
      weekendDate: '2026-10-16',
      validFrom: '2026-10-16T19:00:00.000Z',
      validTo: '2026-10-19T03:30:00.000Z',
      sourceLastUpdated: '2026-10-16T08:30:00.000Z',
      notices: [
        {
          headline: 'Camden Town ↔ High Barnet: No service',
          corridor: 'Camden Town ↔ High Barnet: No service',
          rawFallback: 'No service between Camden Town and High Barnet',
        },
      ],
    },
  ];

  it('Should_execute_ingestion_pipeline_upsert_weekend_disruptions_to_sqlite_and_enqueue_downstream_notification_job', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockResolvedValue(sampleDisruptions),
    };

    const result = await syncWeekendDisruptionsPipeline({
      referenceDate: '2026-10-15T12:00:00Z',
      notificationQueue: notificationQueueDouble,
      processor: async (opts) =>
        processIngestionJob({
          ...opts,
          tflClient: mockTflClient,
          prisma,
          referenceDate: new Date('2026-10-15T12:00:00Z'),
        }),
    });

    // Verify ingestion execution result
    expect(result.weekendDate).toBe('2026-10-16');
    expect(result.totalFetched).toBe(2);
    expect(result.totalUpserted).toBe(2);

    // Verify observable Prisma SQLite persistence
    const persisted = await prisma.weekendDisruption.findMany({
      where: { lineId: { startsWith: 'pipeline-' } },
      include: { notices: true },
      orderBy: { lineId: 'asc' },
    });
    expect(persisted).toHaveLength(2);
    expect(persisted[0].lineId).toBe('pipeline-central');
    expect(persisted[0].corridorDescription).toBe(
      'No service between White City and Ealing Broadway',
    );
    expect(persisted[0].notices).toHaveLength(1);
    expect(persisted[0].notices[0].headline).toBe('White City ↔ Ealing Broadway: No service');
    expect(persisted[1].lineId).toBe('pipeline-northern');
    expect(persisted[1].statusSeverityDescription).toBe('Planned Closure');
    expect(persisted[1].notices).toHaveLength(1);
    expect(persisted[1].notices[0].headline).toBe('Camden Town ↔ High Barnet: No service');

    expect(notificationQueueDouble.jobs).toHaveLength(1);
    const downstreamJob = notificationQueueDouble.jobs[0];
    expect(downstreamJob.name).toBe('dispatch-weekend-digest');
    expect(downstreamJob.data.weekendDate).toBe('2026-10-16');
  });

  it('Should_maintain_strict_idempotency_when_ingestion_pipeline_runs_repeatedly_for_the_same_weekend', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockResolvedValue(sampleDisruptions),
    };

    const runPipeline = () =>
      syncWeekendDisruptionsPipeline({
        referenceDate: '2026-10-15T12:00:00Z',
        notificationQueue: notificationQueueDouble,
        processor: async (opts) =>
          processIngestionJob({
            ...opts,
            tflClient: mockTflClient,
            prisma,
            referenceDate: new Date('2026-10-15T12:00:00Z'),
          }),
      });

    await runPipeline();
    expect(
      await prisma.weekendDisruption.count({
        where: { lineId: { startsWith: 'pipeline-' } },
      }),
    ).toBe(2);

    await runPipeline();
    expect(
      await prisma.weekendDisruption.count({
        where: { lineId: { startsWith: 'pipeline-' } },
      }),
    ).toBe(2);

    const modifiedDisruptions: ParsedDisruption[] = [
      {
        ...sampleDisruptions[0],
        statusSeverityDescription: 'Suspended (Updated)',
      },
    ];
    mockTflClient.getWeekendDisruptions = vi.fn().mockResolvedValue(modifiedDisruptions);

    await runPipeline();

    const central = await prisma.weekendDisruption.findFirst({
      where: { lineId: 'pipeline-central' },
    });
    expect(central?.statusSeverityDescription).toBe('Suspended (Updated)');

    expect(notificationQueueDouble.jobs).toHaveLength(3);
    for (const job of notificationQueueDouble.jobs) {
      expect(job.name).toBe('dispatch-weekend-digest');
      expect(job.data.weekendDate).toBe('2026-10-16');
    }
  });

  it('Should_handle_empty_disruptions_gracefully_and_still_trigger_notification_pipeline_for_weekend', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockResolvedValue([]),
    };

    const result = await syncWeekendDisruptionsPipeline({
      referenceDate: '2026-10-15T12:00:00Z',
      notificationQueue: notificationQueueDouble,
      processor: async (opts) =>
        processIngestionJob({
          ...opts,
          tflClient: mockTflClient,
          prisma,
          referenceDate: new Date('2026-10-15T12:00:00Z'),
        }),
    });

    expect(result.totalFetched).toBe(0);
    expect(result.totalUpserted).toBe(0);
    expect(
      await prisma.weekendDisruption.count({
        where: { lineId: { startsWith: 'pipeline-' } },
      }),
    ).toBe(0);

    // Downstream notification worker is still notified so subscribers receive normal service status
    expect(notificationQueueDouble.jobs).toHaveLength(1);
    expect(notificationQueueDouble.jobs[0].data.weekendDate).toBe('2026-10-16');
  });
});
