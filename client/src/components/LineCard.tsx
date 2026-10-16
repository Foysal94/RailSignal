import type { DisruptionNotice, ReplacementBusRoute, WeekendStatusItem } from '@railsignal/shared';
import type { ReactNode } from 'react';
import { useDisclosure } from '../hooks/useDisclosure';
import { isDisrupted } from './statusSorter';

export interface LineCardProps {
  line: WeekendStatusItem;
}

const PARTIAL_DISRUPTION_KEYWORDS = [
  'part closure',
  'part closed',
  'part suspended',
  'minor delays',
  'bus service',
  'special service',
  'reduced service',
] as const;

const SEVERE_DISRUPTION_KEYWORDS = [
  'planned closure',
  'closure',
  'closed',
  'service closed',
  'suspended',
  'not running',
  'no service',
  'severe delays',
] as const;

function getStatusBadgeClasses(line: WeekendStatusItem): string {
  if (!isDisrupted(line)) {
    return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
  }

  const status = line.statusSeverityDescription.toLowerCase();

  if (PARTIAL_DISRUPTION_KEYWORDS.some((kw) => status.includes(kw))) {
    return 'bg-amber-950/80 text-amber-300 border-amber-800';
  }

  if (SEVERE_DISRUPTION_KEYWORDS.some((kw) => status.includes(kw))) {
    return 'bg-red-950/80 text-red-300 border-red-800';
  }

  return 'bg-amber-950/80 text-amber-300 border-amber-800';
}

function formatMode(mode: string): string {
  if (mode.toLowerCase() === 'dlr') {
    return 'DLR';
  }
  const formatted = mode.replaceAll('-', ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// Masks directional transit glyphs with aria-hidden and provides screen-reader phrasing ('to')
function renderAccessibleHeadline(headline: string): ReactNode {
  if (headline.includes(' ↔ ')) {
    const [start, ...rest] = headline.split(' ↔ ');
    return (
      <>
        <span>{start}</span>
        <span className="sr-only"> to </span>
        <span className="text-slate-500 mx-1.5" aria-hidden="true">
          ↔
        </span>
        <span>{rest.join(' ↔ ')}</span>
      </>
    );
  }
  if (headline.includes(' → ')) {
    const [start, ...rest] = headline.split(' → ');
    return (
      <>
        <span>{start}</span>
        <span className="sr-only"> to </span>
        <span className="text-slate-500 mx-1.5" aria-hidden="true">
          →
        </span>
        <span>{rest.join(' → ')}</span>
      </>
    );
  }
  return headline;
}

interface ReplacementBusSectionProps {
  busRoute: ReplacementBusRoute;
  id: string;
  isOpen: boolean;
  onToggle: () => void;
}

function ReplacementBusSection({ busRoute, id, isOpen, onToggle }: ReplacementBusSectionProps) {
  return (
    <div className="space-y-1 pt-1">
      <button
        type="button"
        id={`${id}-btn`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-panel` : undefined}
        onClick={onToggle}
        className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-md bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs text-slate-300 transition text-left"
      >
        <span className="flex items-center gap-2 font-medium">
          <svg
            className="w-4 h-4 text-amber-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <span>
            {busRoute.serviceName} · {busRoute.summary}
          </span>
        </span>
        <span
          className={`text-slate-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <section
          id={`${id}-panel`}
          aria-labelledby={`${id}-btn`}
          className="pl-3 py-1.5 border-l-2 border-amber-500/40 ml-2 text-xs text-slate-300 leading-relaxed"
        >
          {busRoute.stops.map((stop, sIdx) => (
            <span key={stop}>
              {sIdx > 0 && (
                <>
                  <span className="sr-only">, to </span>
                  <span className="text-slate-500 mx-1.5" aria-hidden="true">
                    ↔
                  </span>
                </>
              )}
              {stop}
            </span>
          ))}
        </section>
      )}
    </div>
  );
}

interface NoticeItemProps {
  notice: DisruptionNotice;
  lineId: string;
}

function NoticeItem({ notice, lineId }: NoticeItemProps) {
  const busDisclosure = useDisclosure(false);
  const busId = `${lineId}-${notice.headline.replace(/[^a-zA-Z0-9]/g, '-')}-bus`;

  return (
    <div className="py-2.5 space-y-1.5 first:pt-2 last:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-2">
        <h4 className="text-sm font-bold text-slate-100 leading-snug">
          {renderAccessibleHeadline(notice.headline)}
        </h4>
        {notice.timeframe && (
          <span className="shrink-0 self-start text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700/60">
            {notice.timeframe}
          </span>
        )}
      </div>

      {notice.busRoute && (
        <ReplacementBusSection
          busRoute={notice.busRoute}
          id={busId}
          isOpen={busDisclosure.isOpen}
          onToggle={busDisclosure.toggle}
        />
      )}

      {notice.details && notice.details.length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-400 pl-3 list-disc marker:text-slate-600">
          {notice.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LineCard({ line }: LineCardProps) {
  const badgeClasses = getStatusBadgeClasses(line);
  const badgeText = !isDisrupted(line) ? 'No Planned Closures' : line.statusSeverityDescription;

  const notices = line.notices ?? line.disruptions.flatMap((d) => d.notices ?? []);
  const hasStructuredNotices = notices.length > 0;

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

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100">{line.lineName}</h3>
            <span className="text-xs text-slate-400">{formatMode(line.mode)}</span>
          </div>

          <div className="flex items-center shrink-0">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${badgeClasses}`}
            >
              {badgeText}
            </span>
          </div>
        </div>

        {hasStructuredNotices ? (
          <div className="divide-y divide-slate-800/80 border-t border-slate-800/80 mt-3 pt-1">
            {notices.map((notice) => (
              <NoticeItem
                key={`${line.lineId}-${notice.headline}-${notice.timeframe ?? 'active'}`}
                notice={notice}
                lineId={line.lineId}
              />
            ))}
          </div>
        ) : line.disruptions.length > 0 ? (
          <div className="space-y-1 mt-2">
            {line.disruptions.map((disruption) => (
              <p key={disruption.id} className="text-sm text-slate-300">
                {disruption.corridorDescription}
              </p>
            ))}
          </div>
        ) : (
          line.corridorDescription && (
            <p className="text-sm text-slate-300 mt-2">{line.corridorDescription}</p>
          )
        )}
      </div>
    </article>
  );
}
