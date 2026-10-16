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

describe('Worker Host Lifecycle & Registration', () => {
  afterEach(async () => {
    await closeAllManagedWorkers();
    clearRegisteredWorkers();
  });

  it('Should_configure_worker_with_specified_queue_name_and_overrides', async () => {
    const mockConnection = createMockRedisConnection();
    const worker = createManagedWorker({
      queueName: 'custom-queue',
      processor: async () => 'ok',
      connection: mockConnection as never,
      concurrency: 5,
      drainDelay: 120,
      autorun: false,
    });

    try {
      expect(worker.name).toBe('custom-queue');
      expect(worker.opts.concurrency).toBe(5);
      expect(worker.opts.drainDelay).toBe(120);
      expect(worker.isRunning()).toBe(false);
    } finally {
      await worker.close();
    }
  });

  it('Should_bind_completed_failed_and_error_lifecycle_events_to_custom_hooks', async () => {
    const mockConnection = createMockRedisConnection();
    const onCompleted = vi.fn();
    const onFailed = vi.fn();
    const onError = vi.fn();

    const worker = createManagedWorker({
      queueName: 'events-queue',
      processor: async () => 'ok',
      connection: mockConnection as never,
      autorun: false,
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
