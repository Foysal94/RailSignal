import {
  type BackoffOptions,
  type ConnectionOptions,
  type DefaultJobOptions,
  Queue,
  type QueueOptions,
} from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection } from './connection.js';

export const QUEUE_NAMES = {
  INGEST: 'ingest-disruptions-queue',
  NOTIFICATION: 'notification-dispatch-queue',
  DEMO_ALERT: 'demo-alert-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Standard retry policy for BullMQ jobs:
 * 3 attempts with exponential backoff and jitter to prevent thundering herds on Upstash.
 */
export const DEFAULT_RETRY_POLICY: BackoffOptions = {
  type: 'exponential',
  delay: 1000,
  jitter: 0.5,
};

export const DEFAULT_QUEUE_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: DEFAULT_RETRY_POLICY,
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600, // Retain completed metadata for 24h for auditability
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600, // Retain failed traces for 7 days for post-mortem analysis
  },
};

export interface QueueFactoryOptions {
  connection?: Redis | ConnectionOptions | undefined;
  defaultJobOptions?: DefaultJobOptions | undefined;
  prefix?: string | undefined;
}

export interface IngestJobData {
  referenceDate?: string | undefined;
  force?: boolean | undefined;
}

export interface IngestJobResult {
  weekendDate: string;
  totalFetched: number;
  totalUpserted: number;
  disruptions: Array<{
    lineId: string;
    corridorDescription: string;
  }>;
}

export interface NotificationJobData {
  weekendDate: string;
}

export interface DemoAlertJobData {
  email: string;
  lines: string[];
}

function resolveQueueOptions(options?: QueueFactoryOptions): QueueOptions {
  return {
    connection: options?.connection ?? createRedisConnection(),
    defaultJobOptions: {
      ...DEFAULT_QUEUE_JOB_OPTIONS,
      ...options?.defaultJobOptions,
    },
    ...(options?.prefix ? { prefix: options.prefix } : {}),
  };
}

export function createIngestQueue(
  options?: QueueFactoryOptions,
): Queue<IngestJobData, IngestJobResult, string> {
  return new Queue<IngestJobData, IngestJobResult, string>(
    QUEUE_NAMES.INGEST,
    resolveQueueOptions(options),
  );
}

export function createNotificationQueue(
  options?: QueueFactoryOptions,
): Queue<NotificationJobData, void, string> {
  return new Queue<NotificationJobData, void, string>(
    QUEUE_NAMES.NOTIFICATION,
    resolveQueueOptions(options),
  );
}

export function createDemoAlertQueue(
  options?: QueueFactoryOptions,
): Queue<DemoAlertJobData, void, string> {
  return new Queue<DemoAlertJobData, void, string>(
    QUEUE_NAMES.DEMO_ALERT,
    resolveQueueOptions(options),
  );
}

export const ingestQueue = createIngestQueue();
export const notificationQueue = createNotificationQueue();
export const demoAlertQueue = createDemoAlertQueue();

export async function closeAllQueues(): Promise<void> {
  await Promise.allSettled([
    ingestQueue.close(),
    notificationQueue.close(),
    demoAlertQueue.close(),
  ]);
}
