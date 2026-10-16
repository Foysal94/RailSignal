import type { Redis } from 'ioredis';
import { createDemoAlertWorker } from './demoAlertWorker.js';
import { closeAllManagedWorkers, registerWorker } from './host.js';
import { createIngestionWorker } from './ingestionWorker.js';
import { createNotificationWorker } from './notificationWorker.js';

export * from './demo/index.js';
export * from './demoAlertWorker.js';
export * from './digestMapper.js';
export * from './host.js';
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

// Boots all background BullMQ workers and registers them in the managed host
export function startAllWorkers(options?: WorkerLifecycleOptions): ActiveWorkers {
  if (activeWorkers) {
    return activeWorkers;
  }

  activeWorkers = {
    ingestionWorker: registerWorker('ingestionWorker', createIngestionWorker(options)),
    notificationWorker: registerWorker('notificationWorker', createNotificationWorker(options)),
    demoAlertWorker: registerWorker('demoAlertWorker', createDemoAlertWorker(options)),
  };

  return activeWorkers;
}

export function getActiveWorkers(): ActiveWorkers | null {
  return activeWorkers;
}

// Coordinates graceful shutdown across all active workers through the centralized host
export async function closeAllWorkers(): Promise<void> {
  activeWorkers = null;
  await closeAllManagedWorkers();
}
