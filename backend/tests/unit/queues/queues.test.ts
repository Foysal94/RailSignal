import { afterAll, describe, expect, it } from 'vitest';
import {
  closeAllQueues,
  createDemoAlertQueue,
  createIngestQueue,
  createNotificationQueue,
} from '../../../src/queues/queues.js';

describe('Queue Lifecycle & Factory Instances', () => {
  afterAll(async () => {
    await closeAllQueues();
  });

  it('Should_allow_creating_isolated_queue_instances_with_factory_methods', async () => {
    const customIngest = createIngestQueue();
    const customNotification = createNotificationQueue();
    const customDemoAlert = createDemoAlertQueue();

    try {
      expect(customIngest).toBeDefined();
      expect(customNotification).toBeDefined();
      expect(customDemoAlert).toBeDefined();
    } finally {
      await customIngest.close();
      await customNotification.close();
      await customDemoAlert.close();
    }
  });
});
