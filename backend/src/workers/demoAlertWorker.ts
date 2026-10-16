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
  const { processor, ...managedOptions } = options;
  const executeProcessor = processor ?? processDemoAlertJob;
  const logger = options.logger ?? console;

  return createManagedWorker<DemoAlertJobData, ProcessDemoAlertJobResult>({
    queueName: QUEUE_NAMES.DEMO_ALERT,
    processor: async (job) => {
      if (!job.data?.email || !Array.isArray(job.data?.lines)) {
        throw new Error(`[Demo Alert Worker] Invalid job payload for job ${job.id}`);
      }

      logger.info(
        `[Demo Alert Worker] Processing demo alert job ${job.id} for ${job.data.email}...`,
      );

      return executeProcessor({
        email: job.data.email,
        lines: job.data.lines,
        logger,
      });
    },
    workerName: 'Demo Alert Worker',
    onCompleted: (job, result) => {
      logger.info(
        `[Demo Alert Worker] Job ${job.id} completed. Sent digest to ${result.email} for weekend ${result.weekendDate} (${result.totalDisruptions} disruptions)`,
      );
    },
    ...managedOptions,
  });
}
