import type { WeekendDisruption } from '@prisma/client';
import { getTflLineById, type LineMode, TFL_MODES } from '@railsignal/shared';
import type { DisruptionDigestItem } from '../email/templates/DisruptionDigest.js';

function isValidLineMode(mode: string): mode is LineMode {
  return (TFL_MODES as readonly string[]).includes(mode);
}

/**
 * Pure domain presentation mapper transforming database disruption projections
 * into styled email digest template items with official TfL branding and contrast borders.
 */
export function mapDisruptionsToDigestItems(
  disruptions: WeekendDisruption[],
): DisruptionDigestItem[] {
  return disruptions.map((disruption) => {
    const lineMeta = getTflLineById(disruption.lineId);
    const candidateMode = lineMeta?.mode ?? disruption.mode;
    const mode: LineMode = isValidLineMode(candidateMode) ? candidateMode : 'tube';

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
    };
  });
}
