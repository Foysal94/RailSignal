import type { Worker } from 'bullmq';
import { type DemoAlertJobData, QUEUE_NAMES } from '../queues/queues.js';
import { type ProcessDemoAlertJobResult, processDemoAlertJob } from './demo/processor.js';
import { createManagedWorker, type ManagedWorkerOptions } from './host.js';

export interface DemoAlertWorkerOptions
  extends ManagedWorkerOptions<DemoAlertJobData, ProcessDemoAlertJobResult> {
  processor?: typeof processDemoAlertJob | undefined;
}

export function createDemoAlertWorker(
  options: DemoAlertWorkerOptions = {},
): Worker<DemoAlertJobData, ProcessDemoAlertJobResult, string> {
  const executeProcessor = options.processor ?? processDemoAlertJob;
  const logger = options.logger ?? console;

  return createManagedWorker<DemoAlertJobData, ProcessDemoAlertJobResult>(
    QUEUE_NAMES.DEMO_ALERT,
    async (job) => {
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
    },
    {
      workerName: 'Demo Alert Worker',
      onCompleted: (job, result) => {
        logger.info(
          `[Demo Alert Worker] Job ${job.id} completed. Sent digest to ${result.email} for weekend ${result.weekendDate} (${result.totalDisruptions} disruptions)`,
        );
      },
      ...options,
    },
  );
}
