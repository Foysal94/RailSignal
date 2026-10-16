import type { Queue, Worker } from 'bullmq';
import {
  type IngestJobData,
  type IngestJobResult,
  type NotificationJobData,
  QUEUE_NAMES,
} from '../queues/queues.js';
import { createManagedWorker, type ManagedWorkerOptions } from './host.js';
import { syncWeekendDisruptionsPipeline } from './ingestion/pipeline.js';

export interface IngestionWorkerOptions
  extends ManagedWorkerOptions<IngestJobData, IngestJobResult> {
  notificationQueue?: Pick<Queue<NotificationJobData, void, string>, 'add'> | undefined;
  pipeline?: typeof syncWeekendDisruptionsPipeline | undefined;
}

export function createIngestionWorker(
  options: IngestionWorkerOptions = {},
): Worker<IngestJobData, IngestJobResult, string> {
  const { pipeline, notificationQueue, ...managedOptions } = options;
  const executePipeline = pipeline ?? syncWeekendDisruptionsPipeline;
  const logger = options.logger ?? console;

  return createManagedWorker<IngestJobData, IngestJobResult>({
    queueName: QUEUE_NAMES.INGEST,
    processor: async (job) => {
      logger.info(`[Ingestion Worker] Processing job ${job.id}...`);

      return executePipeline({
        referenceDate: job.data?.referenceDate,
        notificationQueue,
        logger,
      });
    },
    workerName: 'Ingestion Worker',
    onCompleted: (job, result) => {
      logger.info(
        `[Ingestion Worker] Job ${job.id} completed. Projected ${result.totalUpserted} disruptions for weekend ${result.weekendDate}`,
      );
    },
    ...managedOptions,
  });
}
