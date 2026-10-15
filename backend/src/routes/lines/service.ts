import type { WeekendDisruption as DbDisruption, PrismaClient } from '@prisma/client';
import {
  type LineMode,
  TFL_LINES,
  type WeekendDisruption,
  type WeekendStatusItem,
  type WeekendStatusResponse,
} from '@railsignal/shared';
import { prisma as defaultPrisma } from '../../db.js';
import { getUpcomingWeekendWindow } from '../../domain/temporal.js';

export interface FetchWeekendStatusOptions {
  prisma?: PrismaClient | undefined;
  referenceDate?: string | Date | undefined;
}

function mapDbDisruptionToContract(item: DbDisruption): WeekendDisruption {
  return {
    id: item.id,
    lineId: item.lineId,
    lineName: item.lineName,
    mode: item.mode as LineMode,
    statusSeverityDescription: item.statusSeverityDescription,
    corridorDescription: item.corridorDescription,
    weekendDate: item.weekendDate,
    validFrom: item.validFrom.toISOString(),
    validTo: item.validTo.toISOString(),
    sourceLastUpdated: item.sourceLastUpdated.toISOString(),
    projectedAt: item.projectedAt.toISOString(),
  };
}

// Rank hierarchy: Planned Closure / Closed / Suspended > Part Closure / Part Suspended > Reduced Service > Special Service > Good Service
const SEVERITY_RANK: Readonly<Record<string, number>> = Object.freeze({
  'planned closure': 100,
  closed: 100,
  suspended: 100,
  'service closed': 100,
  'not running': 100,
  'part closure': 80,
  'part closed': 80,
  'part suspended': 80,
  'severe delays': 60,
  'reduced service': 50,
  'bus service': 40,
  'special service': 30,
  'minor delays': 20,
  'good service': 0,
  'no planned closures': 0,
});

function getSeverityRank(description: string): number {
  const normalized = description.trim().toLowerCase();
  return SEVERITY_RANK[normalized] ?? 10;
}

export function pickHighestSeverityDescription(disruptions: readonly DbDisruption[]): string {
  if (disruptions.length === 0) return 'No Planned Closures';

  let highest = disruptions[0];
  let highestRank = getSeverityRank(highest.statusSeverityDescription);

  for (let i = 1; i < disruptions.length; i++) {
    const candidate = disruptions[i];
    const candidateRank = getSeverityRank(candidate.statusSeverityDescription);
    if (candidateRank > highestRank) {
      highest = candidate;
      highestRank = candidateRank;
    }
  }

  return highest.statusSeverityDescription;
}

// Pure domain service querying the WeekendDisruption read model and assembling
// the prioritized radar status board matching the target weekend window.
export async function fetchWeekendStatus(
  options: FetchWeekendStatusOptions = {},
): Promise<WeekendStatusResponse> {
  const db = options.prisma ?? defaultPrisma;
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : undefined;
  const targetWindow = getUpcomingWeekendWindow({ referenceDate });
  const weekendDate = targetWindow.weekendDate;

  // Single indexed read query against materialized read model (<5ms response target)
  const dbDisruptions = await db.weekendDisruption.findMany({
    where: { weekendDate },
    orderBy: [{ lineName: 'asc' }, { corridorDescription: 'asc' }],
  });

  // Group disruptions by lineId in O(N)
  const disruptionsByLineId = new Map<string, DbDisruption[]>();
  let latestProjectedAt: Date | undefined;

  for (const disruption of dbDisruptions) {
    const list = disruptionsByLineId.get(disruption.lineId) ?? [];
    list.push(disruption);
    disruptionsByLineId.set(disruption.lineId, list);

    if (!latestProjectedAt || disruption.projectedAt > latestProjectedAt) {
      latestProjectedAt = disruption.projectedAt;
    }
  }

  const items: WeekendStatusItem[] = TFL_LINES.map((line) => {
    const matched = disruptionsByLineId.get(line.id);

    if (matched && matched.length > 0) {
      return {
        lineId: line.id,
        lineName: line.name,
        mode: line.mode,
        color: line.color,
        ...(line.contrastBorder !== undefined ? { contrastBorder: line.contrastBorder } : {}),
        statusSeverityDescription: pickHighestSeverityDescription(matched),
        corridorDescription: matched.map((m) => m.corridorDescription).join('; '),
        hasDisruption: true,
        disruptions: matched.map(mapDbDisruptionToContract),
      };
    }

    return {
      lineId: line.id,
      lineName: line.name,
      mode: line.mode,
      color: line.color,
      ...(line.contrastBorder !== undefined ? { contrastBorder: line.contrastBorder } : {}),
      statusSeverityDescription: 'No Planned Closures',
      hasDisruption: false,
      disruptions: [],
    };
  });

  // Sort disrupted lines to the top per UI radar specification, then alphabetical
  items.sort((a, b) => {
    if (a.hasDisruption && !b.hasDisruption) return -1;
    if (!a.hasDisruption && b.hasDisruption) return 1;
    return a.lineName.localeCompare(b.lineName);
  });

  return {
    weekendDate,
    windowStart: targetWindow.windowStart.toISOString(),
    windowEnd: targetWindow.windowEnd.toISOString(),
    lines: items,
    lastUpdated: (latestProjectedAt ?? new Date()).toISOString(),
  };
}
