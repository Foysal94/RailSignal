import { EventEmitter } from 'node:events';
import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { type NotificationJobData, QUEUE_NAMES } from '../../../src/queues/queues.js';
import type { ProcessNotificationJobResult } from '../../../src/workers/notifications/processor.js';
import {
  createNotificationWorker,
  createNotificationWorkerHandler,
} from '../../../src/workers/notificationWorker.js';

describe('Notification Worker Lifecycle & Orchestration Tests', () => {
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

    const worker = createNotificationWorker({
      connection: mockConnection as never,
      autorun: false,
    });

    try {
      expect(worker.name).toBe(QUEUE_NAMES.NOTIFICATION);
      expect(worker.opts.drainDelay).toBe(60);
      expect(worker.opts.stalledInterval).toBe(60_000);
      expect(worker.opts.concurrency).toBe(1);
    } finally {
      await worker.close();
    }
  });

  it('Should_orchestrate_notification_processor_when_processing_job', async () => {
    const mockProcessorResult: ProcessNotificationJobResult = {
      weekendDate: '2026-10-16',
      totalMatched: 2,
      totalDispatched: 2,
      totalSkipped: 0,
      recipients: [
        {
          email: 'user1@example.com',
          subscriptionId: 'sub-1',
          dispatched: true,
          reason: 'dispatched',
        },
        {
          email: 'user2@example.com',
          subscriptionId: 'sub-2',
          dispatched: true,
          reason: 'dispatched',
        },
      ],
    };

    const mockProcessor = vi.fn().mockResolvedValue(mockProcessorResult);

    const handler = createNotificationWorkerHandler({
      processor: mockProcessor,
    });

    const mockJob = {
      id: 'job-notif-1',
      data: { weekendDate: '2026-10-16' },
    } as unknown as Job<NotificationJobData, ProcessNotificationJobResult>;

    const result = await handler(mockJob);

    expect(result).toEqual(mockProcessorResult);
    expect(mockProcessor).toHaveBeenCalledWith(
      expect.objectContaining({
        weekendDate: '2026-10-16',
      }),
    );
  });

  it('Should_propagate_processor_errors_for_bullmq_retry', async () => {
    const mockProcessor = vi.fn().mockRejectedValue(new Error('Downstream email gateway error'));

    const handler = createNotificationWorkerHandler({
      processor: mockProcessor,
    });

    const mockJob = {
      id: 'job-notif-error',
      data: { weekendDate: '2026-10-16' },
    } as unknown as Job<NotificationJobData, ProcessNotificationJobResult>;

    await expect(handler(mockJob)).rejects.toThrow('Downstream email gateway error');
  });
});
