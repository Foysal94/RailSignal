import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import { config } from '../config.js';
import { prisma as defaultPrisma } from '../db.js';
import {
  closeAllQueues as defaultCloseAllQueues,
  notificationQueue as defaultNotificationQueue,
  type IngestJobResult,
  type NotificationJobData,
} from '../queues/queues.js';
import { processIngestionJob } from '../workers/ingestion/processor.js';
import type { WorkerLogger } from '../workers/types.js';

export interface SyncDisruptionsOptions {
  processor?: typeof processIngestionJob | undefined;
  notificationQueue?: Pick<Queue<NotificationJobData, void, string>, 'add'> | undefined;
  referenceDate?: string | Date | undefined;
  logger?: WorkerLogger | undefined;
}

export interface SyncDisruptionsCliOptions extends SyncDisruptionsOptions {
  closeQueues?: (() => Promise<void>) | undefined;
  prisma?: Pick<PrismaClient, '$disconnect'> | undefined;
  exit?: ((code: number) => void) | undefined;
}

/**
 * Executes the TfL disruptions ingestion pipeline directly and enqueues
 * the downstream notification digest job upon successful database projection.
 */
export async function runSyncDisruptions(
  options: SyncDisruptionsOptions = {},
): Promise<IngestJobResult> {
  const logger = options.logger ?? console;
  const executeProcessor = options.processor ?? processIngestionJob;
  const queue = options.notificationQueue ?? defaultNotificationQueue;

  logger.info('[Sync Disruptions Runner] Starting TfL weekend disruptions synchronization...');

  const result = await executeProcessor({
    referenceDate: options.referenceDate,
    logger,
  });

  logger.info(
    `[Sync Disruptions Runner] Ingested ${result.totalUpserted} disruptions across ${result.disruptions.length} lines for weekend ${result.weekendDate}`,
  );

  // In production or when Redis is configured, enqueue downstream notification digest.
  // In development environments without Redis, skip queue dispatch to allow local execution.
  if (!config.redisUrl && config.nodeEnv !== 'production' && !options.notificationQueue) {
    logger.info(
      `[Sync Disruptions Runner] REDIS_URL not configured; skipping downstream notification queue enqueue in ${config.nodeEnv}`,
    );
  } else {
    await queue.add('dispatch-weekend-digest', {
      weekendDate: result.weekendDate,
    });

    logger.info(
      `[Sync Disruptions Runner] Enqueued downstream notification digest job for weekend ${result.weekendDate}`,
    );
  }

  return result;
}

/**
 * CLI wrapper that executes the synchronization, formats output and error logs,
 * ensures all database and queue connection pools drain, and exits with code 0 or 1.
 */
export async function runSyncDisruptionsCli(
  options: SyncDisruptionsCliOptions = {},
): Promise<number> {
  const logger = options.logger ?? console;
  const closeQueues = options.closeQueues ?? defaultCloseAllQueues;
  const db = options.prisma ?? defaultPrisma;
  const exit = options.exit ?? ((code: number) => process.exit(code));

  try {
    const result = await runSyncDisruptions(options);

    logger.info(
      `[Sync Disruptions Runner] Synchronization completed successfully for weekend ${result.weekendDate}. (Fetched: ${result.totalFetched}, Upserted: ${result.totalUpserted})`,
    );

    await closeQueues();
    await db.$disconnect();

    exit(0);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    logger.error(`[Sync Disruptions Runner] Synchronization failed: ${message}`, {
      error,
      stack,
    });

    try {
      await closeQueues();
    } catch {
      // Suppress secondary queue teardown errors during failure reporting
    }

    try {
      await db.$disconnect();
    } catch {
      // Suppress secondary DB teardown errors during failure reporting
    }

    exit(1);
    return 1;
  }
}

// Allows direct script invocation: node dist/jobs/syncDisruptionsRunner.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void runSyncDisruptionsCli();
}
