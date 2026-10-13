import { EventEmitter } from 'node:events';
import type { Job } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { type DemoAlertJobData, QUEUE_NAMES } from '../../../src/queues/queues.js';
import type { ProcessDemoAlertJobResult } from '../../../src/workers/demo/processor.js';
import {
  createDemoAlertWorker,
  createDemoAlertWorkerHandler,
} from '../../../src/workers/demoAlertWorker.js';

describe('Demo Alert Worker Lifecycle & Execution Tests', () => {
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

    const worker = createDemoAlertWorker({
      connection: mockConnection as never,
      autorun: false,
    });

    try {
      expect(worker.name).toBe(QUEUE_NAMES.DEMO_ALERT);
      expect(worker.opts.drainDelay).toBe(60);
      expect(worker.opts.stalledInterval).toBe(60_000);
      expect(worker.opts.concurrency).toBe(1);
    } finally {
      await worker.close();
    }
  });

  it('Should_orchestrate_demo_processor_when_processing_job', async () => {
    const mockResult: ProcessDemoAlertJobResult = {
      email: 'visitor@example.com',
      weekendDate: '2026-10-16',
      totalDisruptions: 1,
      dispatched: true,
    };

    const mockProcessor = vi.fn().mockResolvedValue(mockResult);

    const handler = createDemoAlertWorkerHandler({
      processor: mockProcessor,
    });

    const mockJob = {
      id: 'job-demo-1',
      data: {
        email: 'visitor@example.com',
        lines: ['central', 'district'],
      },
    } as unknown as Job<DemoAlertJobData, ProcessDemoAlertJobResult>;

    const result = await handler(mockJob);

    expect(result).toEqual(mockResult);
    expect(mockProcessor).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'visitor@example.com',
        lines: ['central', 'district'],
      }),
    );
  });

  it('Should_propagate_processor_errors_for_bullmq_retry', async () => {
    const mockProcessor = vi.fn().mockRejectedValue(new Error('Resend network down'));

    const handler = createDemoAlertWorkerHandler({
      processor: mockProcessor,
    });

    const mockJob = {
      id: 'job-demo-err',
      data: {
        email: 'visitor@example.com',
        lines: ['central'],
      },
    } as unknown as Job<DemoAlertJobData, ProcessDemoAlertJobResult>;

    await expect(handler(mockJob)).rejects.toThrow('Resend network down');
  });
});
