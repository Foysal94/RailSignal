import { type ConnectionOptions, type Job, Worker, type WorkerOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRedisConnection, UPSTASH_WORKER_DEFAULTS } from '../queues/connection.js';
import type { WorkerLogger } from './types.js';

export interface ManagedWorkerHooks<TData = unknown, TResult = unknown> {
  onCompleted?: ((job: Job<TData, TResult, string>, result: TResult) => void) | undefined;
  onFailed?: ((job: Job<TData, TResult, string> | undefined, error: Error) => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
}

export interface ManagedWorkerOptions<TData = unknown, TResult = unknown>
  extends ManagedWorkerHooks<TData, TResult> {
  connection?: Redis | ConnectionOptions | undefined;
  concurrency?: number | undefined;
  drainDelay?: number | undefined;
  stalledInterval?: number | undefined;
  lockDuration?: number | undefined;
  maxStalledCount?: number | undefined;
  autorun?: boolean | undefined;
  logger?: WorkerLogger | undefined;
  workerName?: string | undefined;
}

export interface CreateManagedWorkerOptions<TData = unknown, TResult = unknown>
  extends ManagedWorkerOptions<TData, TResult> {
  queueName: string;
  processor: (job: Job<TData, TResult, string>) => Promise<TResult>;
}

export function createManagedWorker<TData = unknown, TResult = unknown>(
  queueName: string,
  processor: (job: Job<TData, TResult, string>) => Promise<TResult>,
  options?: ManagedWorkerOptions<TData, TResult>,
): Worker<TData, TResult, string>;
export function createManagedWorker<TData = unknown, TResult = unknown>(
  options: CreateManagedWorkerOptions<TData, TResult>,
): Worker<TData, TResult, string>;
export function createManagedWorker<TData = unknown, TResult = unknown>(
  queueNameOrOptions: string | CreateManagedWorkerOptions<TData, TResult>,
  processorArg?: (job: Job<TData, TResult, string>) => Promise<TResult>,
  optionsArg?: ManagedWorkerOptions<TData, TResult>,
): Worker<TData, TResult, string> {
  let queueName: string;
  let processor: (job: Job<TData, TResult, string>) => Promise<TResult>;
  let options: ManagedWorkerOptions<TData, TResult>;

  if (typeof queueNameOrOptions === 'string') {
    queueName = queueNameOrOptions;
    if (!processorArg) {
      throw new Error('Processor function must be supplied when queueName is passed as a string');
    }
    processor = processorArg;
    options = optionsArg ?? {};
  } else {
    queueName = queueNameOrOptions.queueName;
    processor = queueNameOrOptions.processor;
    options = queueNameOrOptions;
  }

  // Enforces ADR 0003: BullMQ polling frequency is throttled to preserve Upstash daily free-tier quotas.
  const workerOptions: WorkerOptions = {
    connection: options.connection ?? createRedisConnection(),
    concurrency: options.concurrency ?? 1,
    drainDelay: options.drainDelay ?? UPSTASH_WORKER_DEFAULTS.drainDelay,
    stalledInterval: options.stalledInterval ?? UPSTASH_WORKER_DEFAULTS.stalledInterval,
    lockDuration: options.lockDuration ?? UPSTASH_WORKER_DEFAULTS.lockDuration,
    maxStalledCount: options.maxStalledCount ?? UPSTASH_WORKER_DEFAULTS.maxStalledCount,
    autorun: options.autorun ?? true,
  };

  const worker = new Worker<TData, TResult, string>(queueName, processor, workerOptions);

  const logger = options.logger ?? console;
  const workerName = options.workerName ?? queueName;

  worker.on('completed', (job, result) => {
    if (options.onCompleted) {
      options.onCompleted(job, result);
    } else {
      logger.info(`[${workerName}] Job ${job.id} completed`);
    }
  });

  worker.on('failed', (job, error) => {
    if (options.onFailed) {
      options.onFailed(job, error);
    } else {
      logger.error(`[${workerName}] Job ${job?.id} failed with error: ${error.message}`);
    }
  });

  worker.on('error', (error) => {
    if (options.onError) {
      options.onError(error);
    } else {
      logger.error(`[${workerName}] Internal worker error: ${error.message}`);
    }
  });

  return worker;
}

const registeredWorkers = new Map<string, Worker>();

export function registerWorker<T extends Worker>(name: string, worker: T): T {
  registeredWorkers.set(name, worker);
  return worker;
}

export function getRegisteredWorker(name: string): Worker | undefined {
  return registeredWorkers.get(name);
}

export function getRegisteredWorkers(): ReadonlyMap<string, Worker> {
  return registeredWorkers;
}

export async function closeAllManagedWorkers(): Promise<void> {
  const workers = Array.from(registeredWorkers.values());
  registeredWorkers.clear();
  await Promise.allSettled(workers.map((worker) => worker.close()));
}

export function clearRegisteredWorkers(): void {
  registeredWorkers.clear();
}
