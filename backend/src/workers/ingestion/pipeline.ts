import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { TflClient } from '../../clients/tfl/client.js';
import { type AppConfig, config as defaultConfig } from '../../config.js';
import {
  notificationQueue as defaultNotificationQueue,
  type IngestJobResult,
  type NotificationJobData,
} from '../../queues/queues.js';
import type { WorkerLogger } from '../types.js';
import { processIngestionJob } from './processor.js';

export interface SyncWeekendDisruptionsPipelineOptions {
  processor?: typeof processIngestionJob | undefined;
  notificationQueue?: Pick<Queue<NotificationJobData, void, string>, 'add'> | undefined;
  referenceDate?: string | Date | undefined;
  logger?: WorkerLogger | undefined;
  tflClient?: Pick<TflClient, 'getWeekendDisruptions'> | undefined;
  prisma?: PrismaClient | undefined;
  config?: AppConfig | undefined;
}

export async function syncWeekendDisruptionsPipeline(
  options: SyncWeekendDisruptionsPipelineOptions = {},
): Promise<IngestJobResult> {
  const logger = options.logger ?? console;
  const executeProcessor = options.processor ?? processIngestionJob;
  const queue = options.notificationQueue ?? defaultNotificationQueue;
  const appConfig = options.config ?? defaultConfig;

  const result = await executeProcessor({
    referenceDate: options.referenceDate,
    logger,
    tflClient: options.tflClient,
    prisma: options.prisma,
  });

  // Standalone CLI executions or local developer machines without active Redis skip
  // queue enqueue; background BullMQ workers and Redis-backed runs dispatch downstream digests.
  const shouldSkipQueue =
    !options.notificationQueue && !appConfig.redisUrl && appConfig.nodeEnv !== 'production';

  if (shouldSkipQueue) {
    logger.info(
      `[Ingestion Pipeline] REDIS_URL not configured; skipping downstream notification queue enqueue in ${appConfig.nodeEnv}`,
    );
  } else {
    await queue.add('dispatch-weekend-digest', {
      weekendDate: result.weekendDate,
    });

    logger.info(`[Ingestion Pipeline] Notification job enqueued for weekend ${result.weekendDate}`);
  }

  return result;
}
