import { afterAll, describe, expect, it } from 'vitest';
import {
  closeAllQueues,
  createDemoAlertQueue,
  createIngestQueue,
  createNotificationQueue,
  DEFAULT_QUEUE_JOB_OPTIONS,
  DEFAULT_RETRY_POLICY,
  demoAlertQueue,
  ingestQueue,
  notificationQueue,
  QUEUE_NAMES,
} from '../../../src/queues/queues.js';

describe('Queue Topology & Retry Policy', () => {
  afterAll(async () => {
    await closeAllQueues();
  });

  it('Should_define_queue_topology_with_expected_queue_names', () => {
    expect(QUEUE_NAMES.INGEST).toBe('ingest-disruptions-queue');
    expect(QUEUE_NAMES.NOTIFICATION).toBe('notification-dispatch-queue');
    expect(QUEUE_NAMES.DEMO_ALERT).toBe('demo-alert-queue');

    expect(ingestQueue.name).toBe(QUEUE_NAMES.INGEST);
    expect(notificationQueue.name).toBe(QUEUE_NAMES.NOTIFICATION);
    expect(demoAlertQueue.name).toBe(QUEUE_NAMES.DEMO_ALERT);
  });

  it('Should_configure_default_job_options_with_3_attempts_and_exponential_backoff_with_jitter', () => {
    expect(DEFAULT_RETRY_POLICY.type).toBe('exponential');
    expect(DEFAULT_RETRY_POLICY.delay).toBe(1000);
    expect(DEFAULT_RETRY_POLICY.jitter).toBeGreaterThan(0);

    expect(DEFAULT_QUEUE_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_QUEUE_JOB_OPTIONS.backoff).toEqual(DEFAULT_RETRY_POLICY);

    expect(ingestQueue.defaultJobOptions.attempts).toBe(3);
    expect(ingestQueue.defaultJobOptions.backoff).toEqual(DEFAULT_RETRY_POLICY);

    expect(notificationQueue.defaultJobOptions.attempts).toBe(3);
    expect(notificationQueue.defaultJobOptions.backoff).toEqual(DEFAULT_RETRY_POLICY);

    expect(demoAlertQueue.defaultJobOptions.attempts).toBe(3);
    expect(demoAlertQueue.defaultJobOptions.backoff).toEqual(DEFAULT_RETRY_POLICY);
  });

  it('Should_allow_creating_isolated_queue_instances_with_factory_methods', async () => {
    const customIngest = createIngestQueue();
    const customNotification = createNotificationQueue();
    const customDemoAlert = createDemoAlertQueue();

    try {
      expect(customIngest.name).toBe(QUEUE_NAMES.INGEST);
      expect(customNotification.name).toBe(QUEUE_NAMES.NOTIFICATION);
      expect(customDemoAlert.name).toBe(QUEUE_NAMES.DEMO_ALERT);
    } finally {
      await customIngest.close();
      await customNotification.close();
      await customDemoAlert.close();
    }
  });
});
