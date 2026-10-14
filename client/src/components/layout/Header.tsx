export interface HeaderProps {
  onSendTestAlert?: () => void;
  onFridayAlerts?: () => void;
}

/**
 * Top application header adhering to ADR 0006 Clean Transit Radar design.
 * Features branding, temporal window badge, and the dual CTA action cluster.
 */
export function Header({ onSendTestAlert, onFridayAlerts }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-radar-bg/90 backdrop-blur sticky top-0 z-10 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"
              aria-hidden="true"
            />
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>RailSignal</span>
              <span className="text-slate-500 font-normal">|</span>
              <span className="text-slate-300 font-medium text-base">Weekend Closure Radar</span>
            </h1>
          </div>

          <div className="inline-flex items-center">
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
              <span>This Weekend: Friday 19:00 - Monday 04:30 London Time</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSendTestAlert}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 min-h-[44px]"
          >
            Send Test Alert
          </button>

          <button
            type="button"
            onClick={onFridayAlerts}
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-transparent px-4 py-2 text-sm font-semibold text-slate-200 shadow-sm transition hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 min-h-[44px]"
          >
            Friday Alerts
          </button>
        </div>
      </div>
    </header>
  );
}
