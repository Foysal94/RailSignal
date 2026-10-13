import type { WeekendDisruption } from '@prisma/client';
import { getTflLineById, type LineMode } from '@railsignal/shared';
import type { DisruptionDigestItem } from '../email/templates/DisruptionDigest.js';

/**
 * Pure domain presentation mapper transforming database disruption projections
 * into styled email digest template items with official TfL branding and contrast borders.
 */
export function mapDisruptionsToDigestItems(
  disruptions: WeekendDisruption[],
): DisruptionDigestItem[] {
  return disruptions.map((disruption) => {
    const lineMeta = getTflLineById(disruption.lineId);
    return {
      lineId: disruption.lineId,
      lineName: disruption.lineName,
      mode: (lineMeta?.mode ?? disruption.mode) as LineMode,
      ...(lineMeta?.color ? { color: lineMeta.color } : {}),
      ...(lineMeta?.contrastBorder !== undefined
        ? { contrastBorder: lineMeta.contrastBorder }
        : {}),
      statusSeverityDescription: disruption.statusSeverityDescription,
      corridorDescription: disruption.corridorDescription,
    };
  });
}
