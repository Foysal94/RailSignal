import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import { tflClient as defaultTflClient, type TflClient } from '../../clients/tfl/client.js';
import type { ParsedDisruption } from '../../clients/tfl/types.js';
import { type AppConfig, config as defaultConfig } from '../../config.js';
import { prisma as defaultPrisma } from '../../db.js';
import { serializeDisruptionNotice } from '../../domain/disruptionNotices.js';
import { getUpcomingWeekendWindow } from '../../domain/temporal.js';
import {
  notificationQueue as defaultNotificationQueue,
  type IngestJobResult,
  type NotificationJobData,
} from '../../queues/queues.js';
import type { WorkerLogger } from '../types.js';

export interface ProjectDisruptionsOptions {
  prisma: PrismaClient;
  disruptions: ParsedDisruption[];
  weekendDate?: string | undefined;
}

export interface ProjectDisruptionsResult {
  totalUpserted: number;
  totalDeleted: number;
  disruptions: ParsedDisruption[];
}

// Deduplicates and atomically reconciles weekend disruption read-model projections in Prisma.
// Upserts incoming disruptions and purges cancelled or stale records for the target weekend.
export async function projectDisruptions(
  options: ProjectDisruptionsOptions,
): Promise<ProjectDisruptionsResult> {
  const { prisma, disruptions } = options;
  const targetWeekendDate = options.weekendDate ?? disruptions[0]?.weekendDate;

  // Deduplicate records in memory by compound key to prevent unique constraint races
  const uniqueMap = new Map<string, ParsedDisruption>();
  const incomingLineCorridors = new Set<string>();

  for (const item of disruptions) {
    const compoundKey = `${item.lineId}::${item.weekendDate}::${item.corridorDescription}`;
    uniqueMap.set(compoundKey, item);
    incomingLineCorridors.add(`${item.lineId}::${item.corridorDescription}`);
  }

  const deduplicated = Array.from(uniqueMap.values());

  return prisma.$transaction(async (tx) => {
    let totalDeleted = 0;

    // 1. Reconcile cancelled disruptions and rewritten corridor texts for the target weekend
    if (targetWeekendDate) {
      const existing = await tx.weekendDisruption.findMany({
        where: { weekendDate: targetWeekendDate },
        select: { id: true, lineId: true, corridorDescription: true },
      });

      const staleIds = existing
        .filter((r) => !incomingLineCorridors.has(`${r.lineId}::${r.corridorDescription}`))
        .map((r) => r.id);

      if (staleIds.length > 0) {
        const deleteResult = await tx.weekendDisruption.deleteMany({
          where: { id: { in: staleIds } },
        });
        totalDeleted = deleteResult.count;
      }
    }

    // 2. Upsert incoming parsed disruptions
    for (const disruption of deduplicated) {
      const serializedNotices = (disruption.notices ?? []).map(serializeDisruptionNotice);

      await tx.weekendDisruption.upsert({
        where: {
          lineId_weekendDate_corridorDescription: {
            lineId: disruption.lineId,
            weekendDate: disruption.weekendDate,
            corridorDescription: disruption.corridorDescription,
          },
        },
        create: {
          lineId: disruption.lineId,
          lineName: disruption.lineName,
          mode: disruption.mode,
          statusSeverityDescription: disruption.statusSeverityDescription,
          corridorDescription: disruption.corridorDescription,
          weekendDate: disruption.weekendDate,
          validFrom: new Date(disruption.validFrom),
          validTo: new Date(disruption.validTo),
          sourceLastUpdated: new Date(disruption.sourceLastUpdated),
          notices: {
            create: serializedNotices,
          },
        },
        update: {
          lineName: disruption.lineName,
          mode: disruption.mode,
          statusSeverityDescription: disruption.statusSeverityDescription,
          validFrom: new Date(disruption.validFrom),
          validTo: new Date(disruption.validTo),
          sourceLastUpdated: new Date(disruption.sourceLastUpdated),
          projectedAt: new Date(),
          notices: {
            deleteMany: {},
            create: serializedNotices,
          },
        },
      });
    }

    return {
      totalUpserted: deduplicated.length,
      totalDeleted,
      disruptions: deduplicated,
    };
  });
}

export interface SyncWeekendDisruptionsPipelineOptions {
  referenceDate?: string | Date | undefined;
  logger?: WorkerLogger | undefined;
  tflClient?: Pick<TflClient, 'getWeekendDisruptions'> | undefined;
  prisma?: PrismaClient | undefined;
  notificationQueue?: Pick<Queue<NotificationJobData, void, string>, 'add'> | undefined;
  config?: AppConfig | undefined;
}

// Unified coordinator: fetches weekend disruptions from TfL client, atomically reconciles
// read model and notices in Prisma, and enqueues downstream notification digest dispatch.
export async function syncWeekendDisruptionsPipeline(
  options: SyncWeekendDisruptionsPipelineOptions = {},
): Promise<IngestJobResult> {
  const logger = options.logger ?? console;
  const client = options.tflClient ?? defaultTflClient;
  const db = options.prisma ?? defaultPrisma;
  const queue = options.notificationQueue ?? defaultNotificationQueue;
  const appConfig = options.config ?? defaultConfig;

  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : undefined;
  const targetWindow = getUpcomingWeekendWindow({ referenceDate });
  const weekendDate = targetWindow.weekendDate;

  logger.info(`[Ingestion Pipeline] Fetching disruptions for weekend ${weekendDate}...`);

  const disruptions = await client.getWeekendDisruptions({ referenceDate });

  logger.info(
    `[Ingestion Pipeline] Retrieved ${disruptions.length} disruptions for weekend ${weekendDate}`,
  );

  const projectionResult = await projectDisruptions({
    prisma: db,
    disruptions,
    weekendDate,
  });

  logger.info(
    `[Ingestion Pipeline] Successfully projected ${projectionResult.totalUpserted} records into database`,
  );

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
      weekendDate,
    });

    logger.info(`[Ingestion Pipeline] Notification job enqueued for weekend ${weekendDate}`);
  }

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
