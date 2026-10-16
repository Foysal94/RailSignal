import { useMemo } from 'react';
import { useWeekendStatus } from '../hooks/useWeekendStatus';
import { formatWeekendRadarBadge } from '../utils/date';
import { LineCard } from './LineCard';
import { isDisrupted, sortStatusItems } from './statusSorter';

export interface NetworkStatusGridProps {
  referenceDate?: string;
}

export function NetworkStatusGrid({ referenceDate }: NetworkStatusGridProps) {
  const { data, isFetching, isError, error, refetch } = useWeekendStatus(referenceDate);

  const lines = data?.lines;
  const sortedLines = useMemo(() => sortStatusItems(lines ?? []), [lines]);
  const disruptionCount = useMemo(() => sortedLines.filter(isDisrupted).length, [sortedLines]);

  if (isFetching && !data) {
    return (
      <div
        data-testid="status-grid-skeleton"
        role="status"
        className="flex flex-col gap-3"
        aria-busy="true"
        aria-label="Loading transit status"
      >
        <span className="sr-only">Loading weekend transit statuses...</span>
        {[...Array(6)].map((_, i) => (
          <div
            // Skeletons are static layout placeholders; index key is safe here
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder skeletons
            key={i}
            className="flex h-20 animate-pulse rounded-lg border border-slate-800 bg-radar-card"
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

  if (isError && !data) {
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

  if (sortedLines.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-radar-card p-8 text-center text-slate-400">
        <p>No transit line data available for this weekend window.</p>
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-label="London weekend transit status stream">
      <div className="text-center py-2 space-y-2 sm:py-4">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Weekend Disruption Radar
        </h2>
        <div className="inline-flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-xs font-medium text-slate-300">
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              {data?.weekendDate
                ? formatWeekendRadarBadge(data.weekendDate)
                : 'This Weekend: Friday 19:00 - Monday 04:30 London Time'}
            </span>
          </span>
        </div>
      </div>

      {isError && data && (
        <div
          role="status"
          className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-4 py-2 text-xs text-amber-200 flex items-center justify-between"
        >
          <span>Background sync failed. Displaying cached data.</span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center min-h-[44px] px-2 underline hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-medium text-slate-400 px-1">
        <span>
          {disruptionCount > 0 ? (
            <strong className="text-amber-400">
              {disruptionCount} Planned {disruptionCount === 1 ? 'Disruption' : 'Disruptions'} This
              Weekend
            </strong>
          ) : (
            <strong className="text-emerald-400">No planned closures this weekend</strong>
          )}
        </span>
        <span>
          {sortedLines.length} lines monitored
          {isFetching && <span className="ml-2 text-blue-400 animate-pulse">(updating...)</span>}
        </span>
      </div>

      <ul className="flex flex-col gap-3">
        {sortedLines.map((line) => (
          <li key={line.lineId}>
            <LineCard line={line} />
          </li>
        ))}
      </ul>
    </section>
  );
}
