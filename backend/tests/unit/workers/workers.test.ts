import { describe, expect, it, vi } from 'vitest';
import { QUEUE_NAMES } from '../../../src/queues/queues.js';
import { createDemoAlertWorker } from '../../../src/workers/demoAlertWorker.js';
import { createIngestionWorker } from '../../../src/workers/ingestionWorker.js';
import { createNotificationWorker } from '../../../src/workers/notificationWorker.js';

function createMockRedisConnection() {
  return {
    status: 'ready',
    options: {},
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
  };
}

describe('Worker Factories (backend/src/workers/*Worker.ts)', () => {
  it('Should_instantiate_ingestion_worker_on_correct_queue_with_upstash_defaults', async () => {
    const mockConnection = createMockRedisConnection();
    const worker = createIngestionWorker({
      connection: mockConnection as never,
      autorun: false,
    });

    try {
      expect(worker.name).toBe(QUEUE_NAMES.INGEST);
      expect(worker.opts.drainDelay).toBe(60);
      expect(worker.opts.stalledInterval).toBe(60_000);
      expect(worker.opts.lockDuration).toBe(60_000);
      expect(worker.opts.maxStalledCount).toBe(2);
    } finally {
      await worker.close();
    }
  });

  it('Should_instantiate_demo_alert_worker_on_correct_queue_with_upstash_defaults', async () => {
    const mockConnection = createMockRedisConnection();
    const worker = createDemoAlertWorker({
      connection: mockConnection as never,
      autorun: false,
    });

    try {
      expect(worker.name).toBe(QUEUE_NAMES.DEMO_ALERT);
      expect(worker.opts.drainDelay).toBe(60);
      expect(worker.opts.stalledInterval).toBe(60_000);
      expect(worker.opts.lockDuration).toBe(60_000);
      expect(worker.opts.maxStalledCount).toBe(2);
    } finally {
      await worker.close();
    }
  });

  it('Should_instantiate_notification_worker_on_correct_queue_with_upstash_defaults', async () => {
    const mockConnection = createMockRedisConnection();
    const worker = createNotificationWorker({
      connection: mockConnection as never,
      autorun: false,
    });

    try {
      expect(worker.name).toBe(QUEUE_NAMES.NOTIFICATION);
      expect(worker.opts.drainDelay).toBe(60);
      expect(worker.opts.stalledInterval).toBe(60_000);
      expect(worker.opts.lockDuration).toBe(60_000);
      expect(worker.opts.maxStalledCount).toBe(2);
    } finally {
      await worker.close();
    }
  });
});
