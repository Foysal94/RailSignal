import type { WeekendStatusItem } from '@railsignal/shared';

/**
 * Determines whether a line status item indicates active disruption.
 */
export function isDisrupted(item: WeekendStatusItem): boolean {
  return (
    item.hasDisruption || item.statusSeverityDescription.trim().toLowerCase() !== 'good service'
  );
}

/**
 * Sorts status items according to Clean Transit Radar information architecture:
 * Disrupted routes sort automatically to the top; Good Service lines follow below.
 * Items within the same disruption category are ordered alphabetically by line name.
 */
export function sortStatusItems(items: readonly WeekendStatusItem[]): WeekendStatusItem[] {
  return [...items].sort((a, b) => {
    const aDisrupted = isDisrupted(a);
    const bDisrupted = isDisrupted(b);

    if (aDisrupted && !bDisrupted) return -1;
    if (!aDisrupted && bDisrupted) return 1;

    return a.lineName.localeCompare(b.lineName);
  });
}
