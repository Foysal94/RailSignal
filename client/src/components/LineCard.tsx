import type { WeekendStatusItem } from '@railsignal/shared';

export interface LineCardProps {
  line: WeekendStatusItem;
}

const PARTIAL_DISRUPTION_KEYWORDS = [
  'part closure',
  'part suspended',
  'minor delays',
  'bus service',
  'special service',
  'reduced service',
] as const;

const SEVERE_DISRUPTION_KEYWORDS = [
  'planned closure',
  'closure',
  'suspended',
  'no service',
  'severe delays',
] as const;

function getStatusBadgeClasses(line: WeekendStatusItem): string {
  const status = line.statusSeverityDescription.toLowerCase();

  if (PARTIAL_DISRUPTION_KEYWORDS.some((kw) => status.includes(kw))) {
    return 'bg-amber-950/80 text-amber-300 border-amber-800';
  }

  if (SEVERE_DISRUPTION_KEYWORDS.some((kw) => status.includes(kw))) {
    return 'bg-red-950/80 text-red-300 border-red-800';
  }

  if (line.hasDisruption) {
    return 'bg-amber-950/80 text-amber-300 border-amber-800';
  }

  return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
}

export function LineCard({ line }: LineCardProps) {
  const badgeClasses = getStatusBadgeClasses(line);
  const badgeText =
    !line.hasDisruption &&
    (line.statusSeverityDescription.trim().toLowerCase() === 'good service' ||
      line.statusSeverityDescription.trim().toLowerCase() === 'no planned closures')
      ? 'No Planned Closures'
      : line.statusSeverityDescription;

  return (
    <article
      aria-label={`${line.lineName} line status`}
      className="flex overflow-hidden rounded-lg border border-slate-800 bg-radar-card shadow-sm transition-colors hover:border-slate-700"
    >
      <div
        data-testid="line-accent-stripe"
        className={`w-1 shrink-0 ${line.contrastBorder ? 'ring-1 ring-neutral-500' : ''}`}
        style={{ backgroundColor: line.color }}
        aria-hidden="true"
      />

      <div className="flex flex-1 flex-col justify-between p-4 sm:flex-row sm:items-center gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100">{line.lineName}</h3>
            <span className="text-xs text-slate-400 capitalize">{line.mode.replace('-', ' ')}</span>
          </div>

          {line.disruptions.length > 0 ? (
            <div className="space-y-0.5">
              {line.disruptions.map((disruption) => (
                <p key={disruption.id} className="text-sm text-slate-300">
                  {disruption.corridorDescription}
                </p>
              ))}
            </div>
          ) : (
            line.corridorDescription && (
              <p className="text-sm text-slate-300">{line.corridorDescription}</p>
            )
          )}
        </div>

        <div className="flex items-center shrink-0">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClasses}`}
          >
            {badgeText}
          </span>
        </div>
      </div>
    </article>
  );
}
