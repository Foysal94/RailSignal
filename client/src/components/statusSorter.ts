import type { WeekendStatusItem } from '@railsignal/shared';

export function isDisrupted(item: WeekendStatusItem): boolean {
  return (
    item.hasDisruption || item.statusSeverityDescription.trim().toLowerCase() !== 'good service'
  );
}

export function sortStatusItems(items: readonly WeekendStatusItem[]): WeekendStatusItem[] {
  return [...items].sort((a, b) => {
    const aDisrupted = isDisrupted(a);
    const bDisrupted = isDisrupted(b);

    if (aDisrupted && !bDisrupted) return -1;
    if (!aDisrupted && bDisrupted) return 1;

    return a.lineName.localeCompare(b.lineName);
  });
}
