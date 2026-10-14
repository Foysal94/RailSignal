import type { WeekendStatusItem } from '@railsignal/shared';

export interface LineCardProps {
  line: WeekendStatusItem;
}

function getStatusBadgeClasses(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('planned closure') || normalized.includes('suspended')) {
    return 'bg-red-950/80 text-red-300 border-red-800';
  }
  if (
    normalized.includes('part') ||
    normalized.includes('delay') ||
    normalized.includes('special')
  ) {
    return 'bg-amber-950/80 text-amber-300 border-amber-800';
  }
  return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
}

/**
 * Pure leaf component presenting a single transit line's weekend status.
 * Renders TfL canonical colors, Northern line dark-mode contrast outline,
 * and high-contrast status badge with disruption corridors.
 */
export function LineCard({ line }: LineCardProps) {
  const badgeClasses = getStatusBadgeClasses(line.statusSeverityDescription);

  return (
    <article
      aria-label={`${line.lineName} line status`}
      className="flex overflow-hidden rounded-lg border border-slate-800 bg-[#111827] shadow-sm transition-colors hover:border-slate-700"
    >
      {/* 4px canonical TfL accent stripe with Northern line dark-mode contrast outline */}
      <div
        data-testid="line-accent-stripe"
        className={`w-1 shrink-0 ${line.contrastBorder ? 'border border-neutral-500' : ''}`}
        style={{ backgroundColor: line.color }}
        aria-hidden="true"
      />

      <div className="flex flex-1 flex-col justify-between p-4 sm:flex-row sm:items-center gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100">{line.lineName}</h3>
            <span className="text-xs text-slate-400 capitalize">{line.mode.replace('-', ' ')}</span>
          </div>

          {line.corridorDescription && (
            <p className="text-sm text-slate-300">{line.corridorDescription}</p>
          )}

          {!line.corridorDescription && line.disruptions.length > 0 && (
            <div className="space-y-0.5">
              {line.disruptions.map((disruption) => (
                <p key={disruption.id} className="text-sm text-slate-300">
                  {disruption.corridorDescription}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center shrink-0">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClasses}`}
          >
            {line.statusSeverityDescription}
          </span>
        </div>
      </div>
    </article>
  );
}
