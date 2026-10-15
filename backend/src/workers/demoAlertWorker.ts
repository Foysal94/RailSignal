import { type ConnectionOptions, type Job, Worker, type WorkerOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection, UPSTASH_WORKER_DEFAULTS } from '../queues/connection.js';
import { type DemoAlertJobData, QUEUE_NAMES } from '../queues/queues.js';
import { type ProcessDemoAlertJobResult, processDemoAlertJob } from './demo/processor.js';
import type { WorkerLogger } from './types.js';

export interface DemoAlertWorkerHandlerDependencies {
  processor?: typeof processDemoAlertJob | undefined;
  logger?: WorkerLogger | undefined;
}

export function createDemoAlertWorkerHandler(deps: DemoAlertWorkerHandlerDependencies = {}) {
  const executeProcessor = deps.processor ?? processDemoAlertJob;
  const logger = deps.logger ?? console;

  return async (
    job: Job<DemoAlertJobData, ProcessDemoAlertJobResult>,
  ): Promise<ProcessDemoAlertJobResult> => {
    logger.info(
      `[Demo Alert Worker] Processing demo alert job ${job.id} for ${job.data?.email}...`,
    );

    const result = await executeProcessor({
      email: job.data.email,
      lines: job.data.lines,
      logger,
    });

    logger.info(`[Demo Alert Worker] Completed job ${job.id} for ${job.data?.email}`);

    return result;
  };
}

export interface DemoAlertWorkerOptions {
  connection?: Redis | ConnectionOptions | undefined;
  processor?: typeof processDemoAlertJob | undefined;
  autorun?: boolean | undefined;
  concurrency?: number | undefined;
  drainDelay?: number | undefined;
  stalledInterval?: number | undefined;
  lockDuration?: number | undefined;
  logger?: WorkerLogger | undefined;
}

export function createDemoAlertWorker(
  options: DemoAlertWorkerOptions = {},
): Worker<DemoAlertJobData, ProcessDemoAlertJobResult, string> {
  const handler = createDemoAlertWorkerHandler({
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

  const worker = new Worker<DemoAlertJobData, ProcessDemoAlertJobResult, string>(
    QUEUE_NAMES.DEMO_ALERT,
    handler,
    workerOptions,
  );

  const logger = options.logger ?? console;

  worker.on('completed', (job, result) => {
    logger.info(
      `[Demo Alert Worker] Job ${job.id} completed. Sent digest to ${result.email} for weekend ${result.weekendDate} (${result.totalDisruptions} disruptions)`,
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(`[Demo Alert Worker] Job ${job?.id} failed with error: ${error.message}`);
  });

  worker.on('error', (error) => {
    logger.error(`[Demo Alert Worker] Internal worker error: ${error.message}`);
  });

  return worker;
}
