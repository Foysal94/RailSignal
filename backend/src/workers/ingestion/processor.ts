import type { PrismaClient } from '@prisma/client';
import { tflClient as defaultTflClient, type TflClient } from '../../clients/tfl/client.js';
import { getUpcomingWeekendWindow } from '../../domain/temporal.js';
import { prisma as defaultPrisma } from '../../db.js';
import type { IngestJobResult } from '../../queues/queues.js';
import type { WorkerLogger } from '../types.js';
import { projectDisruptions } from './projection.js';

export interface ProcessIngestionJobOptions {
  tflClient?: Pick<TflClient, 'getWeekendDisruptions'> | undefined;
  prisma?: PrismaClient | undefined;
  referenceDate?: Date | string | undefined;
  logger?: WorkerLogger | undefined;
}

/**
 * Propagates TfL and database errors upward so BullMQ triggers its configured retry policy.
 */
export async function processIngestionJob(
  options: ProcessIngestionJobOptions = {},
): Promise<IngestJobResult> {
  const client = options.tflClient ?? defaultTflClient;
  const db = options.prisma ?? defaultPrisma;
  const logger = options.logger ?? console;

  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : undefined;

  const targetWindow = getUpcomingWeekendWindow({ referenceDate });
  const weekendDate = targetWindow.weekendDate;

  logger.info(`[Ingestion Processor] Fetching disruptions for weekend ${weekendDate}...`);

  const disruptions = await client.getWeekendDisruptions({ referenceDate });

  logger.info(
    `[Ingestion Processor] Retrieved ${disruptions.length} disruptions for weekend ${weekendDate}`,
  );

  const projectionResult = await projectDisruptions({
    prisma: db,
    disruptions,
  });

  logger.info(
    `[Ingestion Processor] Successfully projected ${projectionResult.totalUpserted} records into database`,
  );

  return {
    weekendDate,
    totalFetched: disruptions.length,
    totalUpserted: projectionResult.totalUpserted,
    disruptions: projectionResult.disruptions.map((d) => ({
      lineId: d.lineId,
      corridorDescription: d.corridorDescription,
    })),
  };
}
