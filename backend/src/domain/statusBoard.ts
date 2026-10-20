import type {
  LineMode,
  WeekendDisruption,
  WeekendStatusItem,
  WeekendStatusResponse,
} from '@railsignal/shared';
import { TFL_LINES } from '@railsignal/shared';
import {
  deserializeDisruptionNotice,
  type WeekendDisruptionWithNotices,
} from './disruptionNotices.js';
import type { WeekendWindow } from './temporal.js';

export interface ProjectWeekendStatusBoardOptions {
  disruptions: readonly WeekendDisruptionWithNotices[];
  targetWindow: WeekendWindow;
}

export const SEVERITY_RANK: Readonly<Record<string, number>> = Object.freeze({
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

export function getSeverityRank(description?: string | null): number {
  if (!description) return 10;
  const normalized = description.trim().toLowerCase();
  return SEVERITY_RANK[normalized] ?? 10;
}

export function pickHighestSeverityDescription(
  disruptions: readonly { statusSeverityDescription: string }[],
): string {
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

export function mapDbDisruptionToContract(item: WeekendDisruptionWithNotices): WeekendDisruption {
  const notices = (item.notices ?? []).map(deserializeDisruptionNotice);
  return {
    id: item.id,
    lineId: item.lineId,
    lineName: item.lineName,
    mode: item.mode as LineMode,
    statusSeverityDescription: item.statusSeverityDescription,
    corridorDescription: item.corridorDescription,
    ...(notices.length > 0 ? { notices } : {}),
    weekendDate: item.weekendDate,
    validFrom: new Date(item.validFrom).toISOString(),
    validTo: new Date(item.validTo).toISOString(),
    sourceLastUpdated: new Date(item.sourceLastUpdated).toISOString(),
    projectedAt: new Date(item.projectedAt).toISOString(),
  };
}

export function projectWeekendStatusBoard(
  options: ProjectWeekendStatusBoardOptions,
): WeekendStatusResponse {
  const { disruptions, targetWindow } = options;
  const weekendDate = targetWindow.weekendDate;

  const disruptionsByLineId = new Map<string, WeekendDisruptionWithNotices[]>();
  let latestProjectedAt: Date | undefined;

  for (const disruption of disruptions) {
    const list = disruptionsByLineId.get(disruption.lineId) ?? [];
    list.push(disruption);
    disruptionsByLineId.set(disruption.lineId, list);

    const projectedDate = new Date(disruption.projectedAt);
    if (!latestProjectedAt || projectedDate > latestProjectedAt) {
      latestProjectedAt = projectedDate;
    }
  }

  const items: WeekendStatusItem[] = TFL_LINES.map((line) => {
    const matched = disruptionsByLineId.get(line.id);

    if (matched && matched.length > 0) {
      const mappedDisruptions = matched.map(mapDbDisruptionToContract);
      const allNotices = mappedDisruptions.flatMap((d) => d.notices ?? []);
      const combinedNotices = Array.from(
        new Map(
          allNotices.map((n) => [`${n.headline}|${n.timeframe ?? ''}|${n.corridor ?? ''}`, n]),
        ).values(),
      );

      const uniqueCorridors = Array.from(new Set(matched.map((m) => m.corridorDescription)));

      return {
        lineId: line.id,
        lineName: line.name,
        mode: line.mode,
        color: line.color,
        ...(line.contrastBorder !== undefined ? { contrastBorder: line.contrastBorder } : {}),
        statusSeverityDescription: pickHighestSeverityDescription(matched),
        corridorDescription: uniqueCorridors.join('; '),
        ...(combinedNotices.length > 0 ? { notices: combinedNotices } : {}),
        hasDisruption: true,
        disruptions: mappedDisruptions,
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
    lastUpdated: (latestProjectedAt ?? targetWindow.windowStart).toISOString(),
  };
}
