import type { Queue, Worker } from 'bullmq';
import {
  type IngestJobData,
  type IngestJobResult,
  type NotificationJobData,
  QUEUE_NAMES,
} from '../queues/queues.js';
import { createManagedWorker, type ManagedWorkerOptions } from './host.js';
import { syncWeekendDisruptionsPipeline } from './ingestion/pipeline.js';
import type { processIngestionJob } from './ingestion/processor.js';

export interface IngestionWorkerOptions
  extends ManagedWorkerOptions<IngestJobData, IngestJobResult> {
  notificationQueue?: Pick<Queue<NotificationJobData, void, string>, 'add'> | undefined;
  processor?: typeof processIngestionJob | undefined;
  pipeline?: typeof syncWeekendDisruptionsPipeline | undefined;
}

export function createIngestionWorker(
  options: IngestionWorkerOptions = {},
): Worker<IngestJobData, IngestJobResult, string> {
  const executePipeline = options.pipeline ?? syncWeekendDisruptionsPipeline;
  const logger = options.logger ?? console;

  return createManagedWorker<IngestJobData, IngestJobResult>(
    QUEUE_NAMES.INGEST,
    async (job) => {
      logger.info(`[Ingestion Worker] Processing job ${job.id}...`);

      return executePipeline({
        referenceDate: job.data?.referenceDate,
        notificationQueue: options.notificationQueue,
        processor: options.processor,
        logger,
      });
    },
    {
      workerName: 'Ingestion Worker',
      onCompleted: (job, result) => {
        logger.info(
          `[Ingestion Worker] Job ${job.id} completed. Projected ${result.totalUpserted} disruptions for weekend ${result.weekendDate}`,
        );
      },
      ...options,
    },
  );
}
