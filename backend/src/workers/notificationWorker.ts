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
  const { processor, ...managedOptions } = options;
  const executeProcessor = processor ?? processNotificationJob;
  const logger = options.logger ?? console;

  return createManagedWorker<NotificationJobData, ProcessNotificationJobResult>({
    queueName: QUEUE_NAMES.NOTIFICATION,
    processor: async (job) => {
      if (!job.data?.weekendDate) {
        throw new Error(`[Notification Worker] Missing weekendDate in job data for job ${job.id}`);
      }

      logger.info(
        `[Notification Worker] Processing job ${job.id} for weekend ${job.data.weekendDate}...`,
      );

      return executeProcessor({
        weekendDate: job.data.weekendDate,
        logger,
      });
    },
    workerName: 'Notification Worker',
    onCompleted: (job, result) => {
      logger.info(
        `[Notification Worker] Job ${job.id} completed. Dispatched ${result.totalDispatched} digests, skipped ${result.totalSkipped} for weekend ${result.weekendDate}`,
      );
    },
    ...managedOptions,
  });
}
