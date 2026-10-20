import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma as defaultPrisma } from '../db.js';
import { closeAllQueues as defaultCloseAllQueues, type IngestJobResult } from '../queues/queues.js';
import {
  type SyncWeekendDisruptionsPipelineOptions,
  syncWeekendDisruptionsPipeline,
} from '../workers/ingestion/pipeline.js';

export type SyncDisruptionsOptions = SyncWeekendDisruptionsPipelineOptions;

export interface SyncDisruptionsCliOptions extends SyncDisruptionsOptions {
  closeQueues?: (() => Promise<void>) | undefined;
  exit?: ((code: number) => void) | undefined;
}

export async function runSyncDisruptions(
  options: SyncDisruptionsOptions = {},
): Promise<IngestJobResult> {
  const logger = options.logger ?? console;

  logger.info('[Sync Disruptions Runner] Starting TfL weekend disruptions synchronization...');

  const result = await syncWeekendDisruptionsPipeline(options);

  logger.info(
    `[Sync Disruptions Runner] Ingested ${result.totalUpserted} disruptions across ${result.disruptions.length} lines for weekend ${result.weekendDate}`,
  );

  return result;
}

export async function runSyncDisruptionsCli(
  options: SyncDisruptionsCliOptions = {},
): Promise<number> {
  const logger = options.logger ?? console;
  const closeQueues = options.closeQueues ?? defaultCloseAllQueues;
  const db = options.prisma ?? defaultPrisma;
  const exit = options.exit ?? ((code: number) => process.exit(code));

  let exitCode = 0;

  try {
    const result = await runSyncDisruptions(options);

    logger.info(
      `[Sync Disruptions Runner] Synchronization completed successfully for weekend ${result.weekendDate}. (Fetched: ${result.totalFetched}, Upserted: ${result.totalUpserted})`,
    );
  } catch (error) {
    exitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    logger.error(`[Sync Disruptions Runner] Synchronization failed: ${message}`, {
      error,
      stack,
    });
  } finally {
    // Teardown connections cleanly in all cases, suppressing secondary teardown faults
    await Promise.allSettled([closeQueues().catch(() => {}), db.$disconnect().catch(() => {})]);
  }

  exit(exitCode);
  return exitCode;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void runSyncDisruptionsCli();
}
