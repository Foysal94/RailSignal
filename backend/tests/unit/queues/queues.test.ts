import type { Redis } from 'ioredis';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  closeAllQueues,
  createDemoAlertQueue,
  createIngestQueue,
  createNotificationQueue,
  QUEUE_NAMES,
} from '../../../src/queues/queues.js';

describe('Queue Lifecycle & Factory Instances', () => {
  afterAll(async () => {
    await closeAllQueues();
  });

  it('Should_allow_creating_isolated_queue_instances_with_factory_methods', async () => {
    const mockConnection = {
      status: 'ready',
      options: {},
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    } as unknown as Redis;

    const customIngest = createIngestQueue({ connection: mockConnection });
    const customNotification = createNotificationQueue({ connection: mockConnection });
    const customDemoAlert = createDemoAlertQueue({ connection: mockConnection });

    try {
      expect(customIngest.name).toBe(QUEUE_NAMES.INGEST);
      expect(customNotification.name).toBe(QUEUE_NAMES.NOTIFICATION);
      expect(customDemoAlert.name).toBe(QUEUE_NAMES.DEMO_ALERT);
    } finally {
      await Promise.all([
        customIngest.close(),
        customNotification.close(),
        customDemoAlert.close(),
      ]);
    }
  });
});
