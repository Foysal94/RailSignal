import type { PrismaClient } from '@prisma/client';
import type { ParsedDisruption } from '../../clients/tfl/types.js';

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
    // 1. Purge stale transient delay contamination (e.g. real-time Minor Delays, Severe Delays)
    await tx.weekendDisruption.deleteMany({
      where: {
        statusSeverityDescription: {
          in: ['Minor Delays', 'Severe Delays'],
        },
      },
    });

    let totalDeleted = 0;

    // 2. Reconcile cancelled disruptions and rewritten corridor texts for the target weekend
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

    // 3. Upsert incoming parsed disruptions
    for (const disruption of deduplicated) {
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
      });
    }

    return {
      totalUpserted: deduplicated.length,
      totalDeleted,
      disruptions: deduplicated,
    };
  });
}
