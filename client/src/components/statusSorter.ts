import type { WeekendStatusItem } from '@railsignal/shared';

export function isUndisruptedStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === 'good service' || normalized === 'no planned closures';
}

export function isDisrupted(item: WeekendStatusItem): boolean {
  return item.hasDisruption || !isUndisruptedStatus(item.statusSeverityDescription);
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
