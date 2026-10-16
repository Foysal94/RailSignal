import type { Worker } from 'bullmq';
import { type NotificationJobData, QUEUE_NAMES } from '../queues/queues.js';
import { createManagedWorker, type ManagedWorkerOptions } from './host.js';
import {
  type ProcessNotificationJobResult,
  processNotificationJob,
} from './notifications/processor.js';

export interface NotificationWorkerOptions
  extends ManagedWorkerOptions<NotificationJobData, ProcessNotificationJobResult> {
  processor?: typeof processNotificationJob | undefined;
}

export function createNotificationWorker(
  options: NotificationWorkerOptions = {},
): Worker<NotificationJobData, ProcessNotificationJobResult, string> {
  const executeProcessor = options.processor ?? processNotificationJob;
  const logger = options.logger ?? console;

  return createManagedWorker<NotificationJobData, ProcessNotificationJobResult>(
    QUEUE_NAMES.NOTIFICATION,
    async (job) => {
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
    },
    {
      workerName: 'Notification Worker',
      onCompleted: (job, result) => {
        logger.info(
          `[Notification Worker] Job ${job.id} completed. Dispatched ${result.totalDispatched} digests, skipped ${result.totalSkipped} for weekend ${result.weekendDate}`,
        );
      },
      ...options,
    },
  );
}
