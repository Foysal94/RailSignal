import type { Job } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearRegisteredWorkers,
  closeAllManagedWorkers,
  createManagedWorker,
  getRegisteredWorker,
  getRegisteredWorkers,
  registerWorker,
} from '../../../src/workers/host.js';

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

describe('Worker Host (backend/src/workers/host.ts)', () => {
  afterEach(async () => {
    await closeAllManagedWorkers();
    clearRegisteredWorkers();
  });

  it('Should_configure_worker_with_upstash_quota_defaults_and_specified_queue_name', async () => {
    const mockConnection = createMockRedisConnection();
    const worker = createManagedWorker({
      queueName: 'test-queue',
      processor: async () => 'ok',
      connection: mockConnection as never,
      autorun: false,
    });

    try {
      expect(worker.name).toBe('test-queue');
      expect(worker.opts.concurrency).toBe(1);
      expect(worker.opts.drainDelay).toBe(60);
      expect(worker.opts.stalledInterval).toBe(60_000);
      expect(worker.opts.lockDuration).toBe(60_000);
      expect(worker.opts.maxStalledCount).toBe(2);
    } finally {
      await worker.close();
    }
  });

  it('Should_allow_overriding_worker_concurrency_and_timings', async () => {
    const mockConnection = createMockRedisConnection();
    const worker = createManagedWorker({
      queueName: 'custom-queue',
      processor: async () => 'ok',
      connection: mockConnection as never,
      concurrency: 5,
      drainDelay: 120,
      stalledInterval: 30_000,
      lockDuration: 45_000,
      maxStalledCount: 3,
      autorun: false,
    });

    try {
      expect(worker.opts.concurrency).toBe(5);
      expect(worker.opts.drainDelay).toBe(120);
      expect(worker.opts.stalledInterval).toBe(30_000);
      expect(worker.opts.lockDuration).toBe(45_000);
      expect(worker.opts.maxStalledCount).toBe(3);
    } finally {
      await worker.close();
    }
  });

  it('Should_bind_completed_failed_and_error_lifecycle_events_with_logging_and_custom_hooks', async () => {
    const mockConnection = createMockRedisConnection();
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    const onCompleted = vi.fn();
    const onFailed = vi.fn();
    const onError = vi.fn();

    const worker = createManagedWorker({
      queueName: 'events-queue',
      processor: async () => 'ok',
      connection: mockConnection as never,
      autorun: false,
      workerName: 'Custom Events Worker',
      logger: mockLogger,
      onCompleted,
      onFailed,
      onError,
    });

    try {
      const mockJob = { id: 'job-101' } as Job<unknown, unknown, string>;
      const result = { success: true };
      const testError = new Error('Process failure');

      worker.emit('completed', mockJob, result);
      expect(onCompleted).toHaveBeenCalledWith(mockJob, result);

      worker.emit('failed', mockJob, testError);
      expect(onFailed).toHaveBeenCalledWith(mockJob, testError);

      worker.emit('error', testError);
      expect(onError).toHaveBeenCalledWith(testError);
    } finally {
      await worker.close();
    }
  });

  it('Should_use_default_logging_when_custom_lifecycle_hooks_are_not_provided', async () => {
    const mockConnection = createMockRedisConnection();
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const worker = createManagedWorker({
      queueName: 'default-log-queue',
      processor: async () => 'ok',
      connection: mockConnection as never,
      autorun: false,
      workerName: 'Default Log Worker',
      logger: mockLogger,
    });

    try {
      const mockJob = { id: 'job-202' } as Job<unknown, unknown, string>;
      const testError = new Error('Network timeout');

      worker.emit('completed', mockJob, 'done');
      expect(mockLogger.info).toHaveBeenCalledWith('[Default Log Worker] Job job-202 completed');

      worker.emit('failed', mockJob, testError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[Default Log Worker] Job job-202 failed with error: Network timeout',
      );

      worker.emit('error', testError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[Default Log Worker] Internal worker error: Network timeout',
      );
    } finally {
      await worker.close();
    }
  });

  it('Should_register_workers_and_coordinate_graceful_shutdown_without_dangling_connections', async () => {
    const mockConnection = createMockRedisConnection();
    const worker1 = createManagedWorker({
      queueName: 'managed-1',
      processor: async () => 'ok',
      connection: mockConnection as never,
      autorun: false,
    });
    const worker2 = createManagedWorker({
      queueName: 'managed-2',
      processor: async () => 'ok',
      connection: mockConnection as never,
      autorun: false,
    });

    registerWorker('w1', worker1);
    registerWorker('w2', worker2);

    expect(getRegisteredWorker('w1')).toBe(worker1);
    expect(getRegisteredWorker('w2')).toBe(worker2);
    expect(getRegisteredWorkers().size).toBe(2);

    const closeSpy1 = vi.spyOn(worker1, 'close');
    const closeSpy2 = vi.spyOn(worker2, 'close');

    await closeAllManagedWorkers();

    expect(closeSpy1).toHaveBeenCalledOnce();
    expect(closeSpy2).toHaveBeenCalledOnce();
    expect(getRegisteredWorkers().size).toBe(0);
  });
});
