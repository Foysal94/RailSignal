import { useWeekendStatus } from '../hooks/useWeekendStatus';
import { LineCard } from './LineCard';
import { sortStatusItems } from './statusSorter';

export interface NetworkStatusGridProps {
  referenceDate?: string;
}

/**
 * Status grid container stream.
 * Automatically sorts disruptions to the top and normal service below.
 * Gates skeleton loaders strictly on TanStack Query's isFetching flag.
 */
export function NetworkStatusGrid({ referenceDate }: NetworkStatusGridProps) {
  const { data, isFetching, isError, error, refetch } = useWeekendStatus(referenceDate);

  if (isFetching && !data) {
    return (
      <div
        data-testid="status-grid-skeleton"
        role="status"
        className="flex flex-col gap-3"
        aria-busy="true"
        aria-label="Loading transit status"
      >
        {[...Array(6)].map((_, i) => (
          <div
            // Skeletons are static layout placeholders; index key is safe here
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder skeletons
            key={i}
            className="flex h-20 animate-pulse rounded-lg border border-slate-800 bg-[#111827]"
          >
            <div className="w-1 bg-slate-700" />
            <div className="flex flex-1 items-center justify-between p-4">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-slate-800" />
                <div className="h-3 w-48 rounded bg-slate-800/60" />
              </div>
              <div className="h-6 w-24 rounded-full bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-center text-slate-200"
      >
        <p className="font-semibold text-red-300">Unable to load weekend status</p>
        <p className="mt-1 text-sm text-slate-400">
          {error?.message || 'A network error occurred while contacting the server.'}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 inline-flex items-center rounded-lg bg-red-800/80 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 min-h-[44px]"
        >
          Retry
        </button>
      </div>
    );
  }

  const lines = data?.lines ?? [];
  const sortedLines = sortStatusItems(lines);

  if (sortedLines.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-[#111827] p-8 text-center text-slate-400">
        <p>No transit line data available for this weekend window.</p>
      </div>
    );
  }

  const disruptionCount = sortedLines.filter(
    (line) => line.hasDisruption || line.statusSeverityDescription.toLowerCase() !== 'good service',
  ).length;

  return (
    <section className="space-y-4" aria-label="London weekend transit status stream">
      {/* Overview Tracker */}
      <div className="flex items-center justify-between text-xs font-medium text-slate-400 px-1">
        <span>
          {disruptionCount > 0 ? (
            <strong className="text-amber-400">
              {disruptionCount} {disruptionCount === 1 ? 'disruption' : 'disruptions'} active
            </strong>
          ) : (
            <strong className="text-emerald-400">All monitored lines reporting normal</strong>
          )}
        </span>
        <span>
          {sortedLines.length} lines monitored
          {isFetching && <span className="ml-2 text-blue-400 animate-pulse">(updating...)</span>}
        </span>
      </div>

      {/* Disruption-first vertical stream */}
      <div className="flex flex-col gap-3">
        {sortedLines.map((line) => (
          <LineCard key={line.lineId} line={line} />
        ))}
      </div>
    </section>
  );
}
