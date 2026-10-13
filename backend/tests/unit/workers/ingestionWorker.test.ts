import { EventEmitter } from 'node:events';
import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { QUEUE_NAMES } from '../../../src/queues/queues.js';
import {
  createIngestionWorker,
  createIngestionWorkerHandler,
} from '../../../src/workers/ingestionWorker.js';

describe('Ingestion Worker Lifecycle & Downstream Orchestration', () => {
  it('Should_configure_worker_with_upstash_quota_safeguards_and_correct_queue_name', async () => {
    const mockConnection = Object.assign(new EventEmitter(), {
      options: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      duplicate: () => mockConnection,
      quit: vi.fn().mockResolvedValue('OK'),
      status: 'ready',
      info: vi.fn().mockResolvedValue('redis_version:7.0.0\r\nmaxmemory_policy:noeviction\r\n'),
      defineCommand: vi.fn(),
    });

    const worker = createIngestionWorker({
      connection: mockConnection as never,
      autorun: false,
    });

    try {
      expect(worker.name).toBe(QUEUE_NAMES.INGEST);
      expect(worker.opts.drainDelay).toBe(60);
      expect(worker.opts.stalledInterval).toBe(60_000);
      expect(worker.opts.concurrency).toBe(1);
    } finally {
      await worker.close();
    }
  });

  it('Should_orchestrate_ingestion_processor_and_enqueue_downstream_notification_job_upon_completion', async () => {
    const mockNotificationQueue = {
      add: vi.fn().mockResolvedValue({ id: 'mock-notification-job' }),
    };

    const mockProcessorResult = {
      weekendDate: '2026-10-16',
      totalFetched: 2,
      totalUpserted: 2,
      disruptions: [
        { lineId: 'central', corridorDescription: 'Part Closure' },
        { lineId: 'district', corridorDescription: 'Part Suspended' },
      ],
    };

    const mockProcessor = vi.fn().mockResolvedValue(mockProcessorResult);

    const handler = createIngestionWorkerHandler({
      notificationQueue: mockNotificationQueue,
      processor: mockProcessor,
    });

    const mockJob = {
      id: 'job-123',
      data: { referenceDate: '2026-10-15T10:00:00Z' },
    } as unknown as Job;

    const result = await handler(mockJob);

    expect(result).toEqual(mockProcessorResult);
    expect(mockNotificationQueue.add).toHaveBeenCalledWith('dispatch-weekend-digest', {
      weekendDate: '2026-10-16',
    });
  });

  it('Should_propagate_processor_errors_without_enqueuing_downstream_notification_jobs', async () => {
    const mockNotificationQueue = {
      add: vi.fn(),
    };

    const mockProcessor = vi.fn().mockRejectedValue(new Error('Ingestion upstream failure'));

    const handler = createIngestionWorkerHandler({
      notificationQueue: mockNotificationQueue,
      processor: mockProcessor,
    });

    const mockJob = {
      id: 'job-error',
      data: {},
    } as unknown as Job;

    await expect(handler(mockJob)).rejects.toThrow('Ingestion upstream failure');
    expect(mockNotificationQueue.add).not.toHaveBeenCalled();
  });
});
