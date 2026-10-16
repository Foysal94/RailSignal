import type { PrismaClient } from '@prisma/client';
import { getTflLineById, type LineMode, TFL_MODES } from '@railsignal/shared';
import { prisma as defaultPrisma } from '../db.js';
import {
  deserializeDisruptionNotice,
  type WeekendDisruptionWithNotices,
} from '../domain/disruptionNotices.js';
import type { DisruptionDigestItem } from '../email/templates/DisruptionDigest.js';

export type { DisruptionDigestItem, WeekendDisruptionWithNotices };

function isValidLineMode(mode: string): mode is LineMode {
  return (TFL_MODES as readonly string[]).includes(mode);
}

export function mapDisruptionsToDigestItems(
  disruptions: WeekendDisruptionWithNotices[],
): DisruptionDigestItem[] {
  return disruptions.map((disruption) => {
    const lineMeta = getTflLineById(disruption.lineId);
    const candidateMode = lineMeta?.mode ?? disruption.mode;
    const mode: LineMode = isValidLineMode(candidateMode) ? candidateMode : 'tube';
    const notices = (disruption.notices ?? []).map(deserializeDisruptionNotice);

    return {
      lineId: disruption.lineId,
      lineName: disruption.lineName,
      mode,
      ...(lineMeta?.color ? { color: lineMeta.color } : {}),
      ...(lineMeta?.contrastBorder !== undefined
        ? { contrastBorder: lineMeta.contrastBorder }
        : {}),
      statusSeverityDescription: disruption.statusSeverityDescription,
      corridorDescription: disruption.corridorDescription,
      ...(notices.length > 0 ? { notices } : {}),
    };
  });
}

export interface AssembleDigestOptions {
  prisma?: PrismaClient | undefined;
  weekendDate: string;
  lineIds?: string[] | undefined;
}

export async function assembleDigestDisruptions(
  options: AssembleDigestOptions,
): Promise<WeekendDisruptionWithNotices[]> {
  const db = options.prisma ?? defaultPrisma;
  return db.weekendDisruption.findMany({
    where: {
      weekendDate: options.weekendDate,
      ...(options.lineIds ? { lineId: { in: options.lineIds } } : {}),
    },
    include: { notices: true },
    orderBy: [{ lineName: 'asc' }, { corridorDescription: 'asc' }],
  });
}

export async function assembleDigestItems(
  options: AssembleDigestOptions,
): Promise<DisruptionDigestItem[]> {
  const disruptions = await assembleDigestDisruptions(options);
  return mapDisruptionsToDigestItems(disruptions);
}
