import { type ConnectionOptions, type Job, type Queue, Worker, type WorkerOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection, UPSTASH_WORKER_DEFAULTS } from '../queues/connection.js';
import {
  notificationQueue as defaultNotificationQueue,
  type IngestJobData,
  type IngestJobResult,
  type NotificationJobData,
  QUEUE_NAMES,
} from '../queues/queues.js';
import { processIngestionJob } from './ingestion/processor.js';
import type { WorkerLogger } from './types.js';

export interface IngestionWorkerHandlerDependencies {
  notificationQueue?: Pick<Queue<NotificationJobData, void, string>, 'add'> | undefined;
  processor?: typeof processIngestionJob | undefined;
  logger?: WorkerLogger | undefined;
}

export function createIngestionWorkerHandler(deps: IngestionWorkerHandlerDependencies = {}) {
  const targetNotificationQueue = deps.notificationQueue ?? defaultNotificationQueue;
  const executeProcessor = deps.processor ?? processIngestionJob;
  const logger = deps.logger ?? console;

  return async (job: Job<IngestJobData, IngestJobResult>): Promise<IngestJobResult> => {
    logger.info(`[Ingestion Worker] Processing job ${job.id}...`);

    const result = await executeProcessor({
      referenceDate: job.data?.referenceDate,
      logger,
    });

    logger.info(
      `[Ingestion Worker] Ingestion successful for weekend ${result.weekendDate}. Enqueuing notification job...`,
    );

    await targetNotificationQueue.add('dispatch-weekend-digest', {
      weekendDate: result.weekendDate,
    });

    logger.info(`[Ingestion Worker] Notification job enqueued for weekend ${result.weekendDate}`);

    return result;
  };
}

export interface IngestionWorkerOptions {
  connection?: Redis | ConnectionOptions | undefined;
  notificationQueue?: Pick<Queue<NotificationJobData, void, string>, 'add'> | undefined;
  processor?: typeof processIngestionJob | undefined;
  autorun?: boolean | undefined;
  concurrency?: number | undefined;
  drainDelay?: number | undefined;
  stalledInterval?: number | undefined;
  lockDuration?: number | undefined;
  logger?: WorkerLogger | undefined;
}

export function createIngestionWorker(
  options: IngestionWorkerOptions = {},
): Worker<IngestJobData, IngestJobResult, string> {
  const handler = createIngestionWorkerHandler({
    notificationQueue: options.notificationQueue,
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

  const worker = new Worker<IngestJobData, IngestJobResult, string>(
    QUEUE_NAMES.INGEST,
    handler,
    workerOptions,
  );

  const logger = options.logger ?? console;

  worker.on('completed', (job, result) => {
    logger.info(
      `[Ingestion Worker] Job ${job.id} completed. Projected ${result.totalUpserted} disruptions for weekend ${result.weekendDate}`,
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(`[Ingestion Worker] Job ${job?.id} failed with error: ${error.message}`);
  });

  worker.on('error', (error) => {
    logger.error(`[Ingestion Worker] Internal worker error: ${error.message}`);
  });

  return worker;
}
