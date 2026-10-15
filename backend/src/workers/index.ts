import type { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { createDemoAlertWorker } from './demoAlertWorker.js';
import { createIngestionWorker } from './ingestionWorker.js';
import { createNotificationWorker } from './notificationWorker.js';

export * from './demo/index.js';
export * from './demoAlertWorker.js';
export * from './digestMapper.js';
export * from './ingestion/index.js';
export * from './ingestionWorker.js';
export * from './notifications/index.js';
export * from './notificationWorker.js';
export * from './types.js';

export interface ActiveWorkers {
  ingestionWorker: ReturnType<typeof createIngestionWorker>;
  notificationWorker: ReturnType<typeof createNotificationWorker>;
  demoAlertWorker: ReturnType<typeof createDemoAlertWorker>;
}

export interface WorkerLifecycleOptions {
  connection?: Redis | undefined;
}

let activeWorkers: ActiveWorkers | null = null;

/**
 * Explicitly boots all background BullMQ workers.
 * Called exclusively by the host process composition root (backend/src/index.ts).
 * Workers are never instantiated automatically on file import.
 */
export function startAllWorkers(options?: WorkerLifecycleOptions): ActiveWorkers {
  if (activeWorkers) {
    return activeWorkers;
  }

  activeWorkers = {
    ingestionWorker: createIngestionWorker(options),
    notificationWorker: createNotificationWorker(options),
    demoAlertWorker: createDemoAlertWorker(options),
  };

  return activeWorkers;
}

/**
 * Returns the currently active workers, or null if workers have not been booted.
 */
export function getActiveWorkers(): ActiveWorkers | null {
  return activeWorkers;
}

/**
 * Coordinates graceful shutdown across all active BullMQ workers to avoid
 * leaving locked jobs during container scale-to-zero or process termination.
 */
export async function closeAllWorkers(): Promise<void> {
  if (!activeWorkers) {
    return;
  }

  const workers: Worker[] = [
    activeWorkers.ingestionWorker,
    activeWorkers.notificationWorker,
    activeWorkers.demoAlertWorker,
  ];

  activeWorkers = null;

  await Promise.allSettled(workers.map((worker) => worker.close()));
}
