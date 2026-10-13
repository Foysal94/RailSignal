import type { PrismaClient } from '@prisma/client';
import type { ParsedDisruption } from '../../clients/tfl/types.js';

export interface ProjectDisruptionsOptions {
  prisma: PrismaClient;
  disruptions: ParsedDisruption[];
}

export interface ProjectDisruptionsResult {
  totalUpserted: number;
  disruptions: ParsedDisruption[];
}

/**
 * Deduplicates and idempotently upserts weekend disruption read-model projections into Prisma.
 * Uses the compound unique constraint `@@unique([lineId, weekendDate, corridorDescription])`
 * to guarantee atomic updates without duplicate records across successive ingestion runs.
 */
export async function projectDisruptions(
  options: ProjectDisruptionsOptions,
): Promise<ProjectDisruptionsResult> {
  const { prisma, disruptions } = options;

  if (disruptions.length === 0) {
    return {
      totalUpserted: 0,
      disruptions: [],
    };
  }

  // Deduplicate records in memory by compound key to prevent unique constraint races in batch execution
  const uniqueMap = new Map<string, ParsedDisruption>();
  for (const item of disruptions) {
    const key = `${item.lineId}::${item.weekendDate}::${item.corridorDescription}`;
    uniqueMap.set(key, item);
  }

  const deduplicated = Array.from(uniqueMap.values());

  // Execute upserts sequentially or in a transaction to guarantee deterministic idempotency
  await prisma.$transaction(
    deduplicated.map((disruption) =>
      prisma.weekendDisruption.upsert({
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
        },
        update: {
          lineName: disruption.lineName,
          mode: disruption.mode,
          statusSeverityDescription: disruption.statusSeverityDescription,
          validFrom: new Date(disruption.validFrom),
          validTo: new Date(disruption.validTo),
          sourceLastUpdated: new Date(disruption.sourceLastUpdated),
          projectedAt: new Date(),
        },
      }),
    ),
  );

  return {
    totalUpserted: deduplicated.length,
    disruptions: deduplicated,
  };
}
