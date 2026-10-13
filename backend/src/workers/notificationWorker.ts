import { type ConnectionOptions, type Job, Worker, type WorkerOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection, UPSTASH_WORKER_DEFAULTS } from '../queues/connection.js';
import { type NotificationJobData, QUEUE_NAMES } from '../queues/queues.js';
import {
  type ProcessNotificationJobResult,
  processNotificationJob,
} from './notifications/processor.js';
import type { WorkerLogger } from './types.js';

export interface NotificationWorkerHandlerDependencies {
  processor?: typeof processNotificationJob | undefined;
  logger?: WorkerLogger | undefined;
}

export function createNotificationWorkerHandler(deps: NotificationWorkerHandlerDependencies = {}) {
  const executeProcessor = deps.processor ?? processNotificationJob;
  const logger = deps.logger ?? console;

  return async (
    job: Job<NotificationJobData, ProcessNotificationJobResult>,
  ): Promise<ProcessNotificationJobResult> => {
    logger.info(
      `[Notification Worker] Processing job ${job.id} for weekend ${job.data?.weekendDate}...`,
    );

    const result = await executeProcessor({
      weekendDate: job.data.weekendDate,
      logger,
    });

    logger.info(
      `[Notification Worker] Completed job ${job.id}. Dispatched: ${result.totalDispatched}, Skipped: ${result.totalSkipped}`,
    );

    return result;
  };
}

export interface NotificationWorkerOptions {
  connection?: Redis | ConnectionOptions | undefined;
  processor?: typeof processNotificationJob | undefined;
  autorun?: boolean | undefined;
  concurrency?: number | undefined;
  drainDelay?: number | undefined;
  stalledInterval?: number | undefined;
  lockDuration?: number | undefined;
  logger?: WorkerLogger | undefined;
}

export function createNotificationWorker(
  options: NotificationWorkerOptions = {},
): Worker<NotificationJobData, ProcessNotificationJobResult, string> {
  const handler = createNotificationWorkerHandler({
    processor: options.processor,
    logger: options.logger,
  });

  const workerOptions: WorkerOptions = {
    connection: options.connection ?? createRedisConnection(),
    concurrency: options.concurrency ?? 1,
    drainDelay: options.drainDelay ?? UPSTASH_WORKER_DEFAULTS.drainDelay,
    stalledInterval: options.stalledInterval ?? UPSTASH_WORKER_DEFAULTS.stalledInterval,
    lockDuration: options.lockDuration ?? UPSTASH_WORKER_DEFAULTS.lockDuration,
    maxStalledCount: UPSTASH_WORKER_DEFAULTS.maxStalledCount,
    autorun: options.autorun ?? true,
  };

  const worker = new Worker<NotificationJobData, ProcessNotificationJobResult, string>(
    QUEUE_NAMES.NOTIFICATION,
    handler,
    workerOptions,
  );

  const logger = options.logger ?? console;

  worker.on('completed', (job, result) => {
    logger.info(
      `[Notification Worker] Job ${job.id} completed. Dispatched ${result.totalDispatched} digests, skipped ${result.totalSkipped} for weekend ${result.weekendDate}`,
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(`[Notification Worker] Job ${job?.id} failed with error: ${error.message}`);
  });

  worker.on('error', (error) => {
    logger.error(`[Notification Worker] Internal worker error: ${error.message}`);
  });

  return worker;
}
