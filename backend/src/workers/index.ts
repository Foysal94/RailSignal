import { closeDemoAlertWorker } from './demoAlertWorker.js';
import { closeIngestionWorker } from './ingestionWorker.js';
import { closeNotificationWorker } from './notificationWorker.js';

export * from './demo/index.js';
export * from './demoAlertWorker.js';
export * from './ingestion/index.js';
export * from './ingestionWorker.js';
export * from './notifications/index.js';
export * from './notificationWorker.js';
export * from './types.js';

/**
 * Coordinates graceful shutdown across all active BullMQ workers to avoid
 * leaving locked jobs during container scale-to-zero or process termination.
 */
export async function closeAllWorkers(): Promise<void> {
  await Promise.allSettled([
    closeIngestionWorker(),
    closeNotificationWorker(),
    closeDemoAlertWorker(),
  ]);
}
