import {
  retry,
  timeout,
  circuitBreaker,
  wrap,
  handleWhen,
  ExponentialBackoff,
  decorrelatedJitterGenerator,
  ConsecutiveBreaker,
  BrokenCircuitError,
  TimeoutStrategy,
  type IPolicy,
} from 'cockatiel';
import { TZDate } from '@date-fns/tz';
import { format, addDays } from 'date-fns';
import {
  TFL_LINES,
  TFL_LINES_BY_ID,
  type LineMode,
  type TflLine,
} from '@railsignal/shared';

export { BrokenCircuitError };

export class TflHttpError extends Error {
  public readonly status: number;
  public readonly isTransient: boolean;

  constructor(status: number, statusText: string, body?: string) {
    const detail = body ? `: ${body}` : '';
    super(`TfL Unified API request failed with status ${status} (${statusText})${detail}`);
    this.name = 'TflHttpError';
    this.status = status;
    // 429 Too Many Requests and 5xx Server Errors are transient network/server conditions
    this.isTransient = status === 429 || (status >= 500 && status <= 599);
  }
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof TflHttpError) {
    return error.isTransient;
  }
  if (error instanceof BrokenCircuitError) {
    return false;
  }
  // Abort errors, timeouts (TaskCancelledError), and socket drops are transient
  return true;
}

export interface ResiliencePolicyOptions {
  maxRetries?: number;
  timeoutMs?: number;
  circuitBreakerConsecutiveFailures?: number;
  circuitBreakerHalfOpenMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Creates a composite Cockatiel resilience policy for TfL API calls mirroring .NET Polly architecture (ADR 0004).
 * Order of composition: CircuitBreaker (outer) -> Retry (middle) -> Timeout (inner).
 */
export function createTflResiliencePolicy(options?: ResiliencePolicyOptions): IPolicy {
  const maxRetries = options?.maxRetries ?? 3;
  const timeoutMs = options?.timeoutMs ?? 8000;
  const breakerFailures = options?.circuitBreakerConsecutiveFailures ?? 5;
  const halfOpenMs = options?.circuitBreakerHalfOpenMs ?? 30000;
  const initialDelay = options?.initialDelayMs ?? 200;
  const maxDelay = options?.maxDelayMs ?? 2000;

  const retryPolicy = retry(handleWhen(isTransientError), {
    maxAttempts: maxRetries,
    backoff: new ExponentialBackoff({
      generator: decorrelatedJitterGenerator,
      initialDelay,
      maxDelay,
    }),
  });

  const breakerPolicy = circuitBreaker(handleWhen(isTransientError), {
    halfOpenAfter: halfOpenMs,
    breaker: new ConsecutiveBreaker(breakerFailures),
  });

  const timeoutPolicy = timeout(timeoutMs, TimeoutStrategy.Aggressive);

  return wrap(breakerPolicy, retryPolicy, timeoutPolicy);
}

export interface WeekendWindow {
  weekendDate: string;
  windowStart: Date;
  windowEnd: Date;
}

export interface WeekendWindowOptions {
  referenceDate?: Date;
}

export interface RawTflAffectedRoute {
  id?: string;
  lineId?: string;
  routeCode?: string;
  name?: string;
  direction?: string;
  originationName?: string;
  destinationName?: string;
  validFrom?: string;
  validTo?: string;
}

export interface RawTflDisruption {
  $type?: string;
  category?: string;
  type?: string;
  categoryDescription?: string;
  description: string;
  summary?: string;
  additionalInfo?: string;
  created?: string;
  lastUpdate?: string;
  affectedRoutes?: RawTflAffectedRoute[];
  affectedStops?: unknown[];
  closureText?: string;
}

export interface ParsedDisruption {
  lineId: string;
  lineName: string;
  mode: LineMode;
  statusSeverityDescription: string;
  corridorDescription: string;
  weekendDate: string;
  validFrom: string;
  validTo: string;
  sourceLastUpdated: string;
}

/**
 * Calculates the Friday 19:00 to Monday 04:30 London local time weekend window,
 * taking UK Daylight Saving Time (BST/GMT) and transition boundaries into account.
 */
export function getUpcomingWeekendWindow(options?: WeekendWindowOptions): WeekendWindow {
  const ref = options?.referenceDate ?? new Date();
  const londonDate = new TZDate(ref, 'Europe/London');
  const day = londonDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const hours = londonDate.getHours();
  const minutes = londonDate.getMinutes();

  let daysToFriday = 0;
  if (day === 5) {
    // Friday: current/incoming weekend starts today at 19:00 London time
    daysToFriday = 0;
  } else if (day === 6) {
    // Saturday: active weekend started yesterday (Friday)
    daysToFriday = -1;
  } else if (day === 0) {
    // Sunday: active weekend started 2 days ago (Friday)
    daysToFriday = -2;
  } else if (day === 1) {
    // Monday: prior to 04:30 London time, the weekend window is still actively ongoing.
    // At or after 04:30 London time, the past weekend has closed; advance to coming Friday.
    if (hours < 4 || (hours === 4 && minutes < 30)) {
      daysToFriday = -3;
    } else {
      daysToFriday = 4;
    }
  } else if (day === 2) {
    daysToFriday = 3;
  } else if (day === 3) {
    daysToFriday = 2;
  } else if (day === 4) {
    daysToFriday = 1;
  }

  const targetFriday = addDays(londonDate, daysToFriday);
  const y = targetFriday.getFullYear();
  const m = targetFriday.getMonth();
  const d = targetFriday.getDate();

  // Friday 19:00 to Monday 04:30 UK local time
  const windowStart = new TZDate(y, m, d, 19, 0, 0, 'Europe/London');
  const windowEnd = new TZDate(y, m, d + 3, 4, 30, 0, 'Europe/London');
  const weekendDate = format(windowStart, 'yyyy-MM-dd');

  return {
    weekendDate,
    windowStart,
    windowEnd,
  };
}

export interface IsDisruptionInWindowOptions {
  validFrom?: string | Date;
  validTo?: string | Date;
  window: WeekendWindow;
}

/**
 * Checks whether a disruption interval overlaps with the designated weekend window.
 */
export function isDisruptionInWindow(options: IsDisruptionInWindowOptions): boolean {
  const { validFrom, validTo, window } = options;
  const startMs = window.windowStart.getTime();
  const endMs = window.windowEnd.getTime();

  if (!validFrom && !validTo) {
    return true;
  }

  const fromMs = validFrom ? new Date(validFrom).getTime() : Number.NEGATIVE_INFINITY;
  const toMs = validTo ? new Date(validTo).getTime() : Number.POSITIVE_INFINITY;

  return fromMs <= endMs && toMs >= startMs;
}

const LINE_ID_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'hammersmith-and-city': 'hammersmith-city',
  'waterloo-and-city': 'waterloo-city',
  'elizabeth-line': 'elizabeth',
  'london-overground': 'overground',
});

function resolveTflLine(rawLineId?: string, description?: string): TflLine | undefined {
  if (rawLineId) {
    const normalized = rawLineId.toLowerCase().trim();
    const canonicalId = LINE_ID_ALIASES[normalized] ?? normalized;
    if (TFL_LINES_BY_ID[canonicalId]) {
      return TFL_LINES_BY_ID[canonicalId];
    }
  }

  if (description) {
    const desc = description.toLowerCase();

    // Specific multi-word or alias checks first to avoid ambiguous substrings
    if (desc.includes('docklands light railway') || /\bdlr\b/.test(desc)) {
      return TFL_LINES_BY_ID['dlr'];
    }
    if (desc.includes('elizabeth line') || /\belizabeth\b/.test(desc)) {
      return TFL_LINES_BY_ID['elizabeth'];
    }
    if (desc.includes('hammersmith & city') || desc.includes('hammersmith and city')) {
      return TFL_LINES_BY_ID['hammersmith-city'];
    }
    if (desc.includes('waterloo & city') || desc.includes('waterloo and city')) {
      return TFL_LINES_BY_ID['waterloo-city'];
    }

    for (const line of TFL_LINES) {
      const lineNameLower = line.name.toLowerCase();
      const regex = new RegExp(`\\b${lineNameLower}(\\s+line)?\\b`, 'i');
      if (regex.test(description)) {
        return line;
      }
    }
  }

  return undefined;
}

function resolveStatusSeverityDescription(closureText?: string, description?: string): string {
  if (closureText) {
    const lower = closureText.toLowerCase();
    if (lower === 'partclosure') return 'Part Closure';
    if (lower === 'partsuspended') return 'Part Suspended';
    if (lower === 'plannedclosure' || lower === 'fullclosure' || lower === 'closure') {
      return 'Planned Closure';
    }
  }

  if (description) {
    const lower = description.toLowerCase();
    if (lower.includes('part closure') || lower.includes('part-closure')) return 'Part Closure';
    if (lower.includes('planned closure') || lower.includes('closed between')) return 'Planned Closure';
    if (lower.includes('part suspended')) return 'Part Suspended';
    if (lower.includes('reduced service')) return 'Reduced Service';
    if (lower.includes('minor delays')) return 'Minor Delays';
    if (lower.includes('severe delays')) return 'Severe Delays';
  }

  return 'Planned Closure';
}

function cleanCorridorDescription(description: string, lineName?: string): string {
  let cleaned = description.trim();
  if (lineName) {
    // Strip leading line prefix e.g. "Northern line: " or "PICCADILLY LINE: "
    const prefixRegex = new RegExp(`^${lineName}(\\s+line)?\\s*:\\s*`, 'i');
    cleaned = cleaned.replace(prefixRegex, '').trim();
  }
  return cleaned || description.trim();
}

export interface ParseTflDisruptionsOptions {
  disruptions: RawTflDisruption[];
  weekendWindow: WeekendWindow;
}

/**
 * Parses raw TfL disruption items into normalized domain models strictly filtered
 * to the upcoming weekend window, deduplicating records on (lineId, weekendDate, corridorDescription).
 */
export function parseTflDisruptions(options: ParseTflDisruptionsOptions): ParsedDisruption[] {
  const { disruptions, weekendWindow } = options;
  const results: ParsedDisruption[] = [];
  const seenKeys = new Set<string>();

  for (const raw of disruptions) {
    const routes = raw.affectedRoutes && raw.affectedRoutes.length > 0 ? raw.affectedRoutes : [undefined];

    for (const route of routes) {
      const line = resolveTflLine(route?.lineId, raw.description);
      if (!line) {
        continue;
      }

      const validFromStr = route?.validFrom || raw.created || weekendWindow.windowStart.toISOString();
      const validToStr = route?.validTo || weekendWindow.windowEnd.toISOString();

      const overlaps = isDisruptionInWindow({
        validFrom: validFromStr,
        validTo: validToStr,
        window: weekendWindow,
      });

      if (!overlaps) {
        continue;
      }

      const severity = resolveStatusSeverityDescription(raw.closureText, raw.description);
      const corridor = cleanCorridorDescription(raw.description, line.name);
      const dedupeKey = `${line.id}:${weekendWindow.weekendDate}:${corridor}`;

      if (seenKeys.has(dedupeKey)) {
        continue;
      }
      seenKeys.add(dedupeKey);

      results.push({
        lineId: line.id,
        lineName: line.name,
        mode: line.mode,
        statusSeverityDescription: severity,
        corridorDescription: corridor,
        weekendDate: weekendWindow.weekendDate,
        validFrom: new Date(validFromStr).toISOString(),
        validTo: new Date(validToStr).toISOString(),
        sourceLastUpdated: raw.lastUpdate || raw.created || new Date().toISOString(),
      });
    }
  }

  return results;
}

export interface TflClientOptions {
  baseUrl?: string;
  appKey?: string;
  fetchFn?: typeof fetch;
  policy?: IPolicy;
  policyOptions?: ResiliencePolicyOptions;
}

/**
 * Resilient HTTP client calling the TfL Unified API wrapped in Cockatiel resilience policies.
 */
export class TflClient {
  private readonly baseUrl: string;
  private readonly appKey: string | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly policy: IPolicy;

  constructor(options?: TflClientOptions) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.tfl.gov.uk').replace(/\/+$/, '');
    this.appKey = options?.appKey;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.policy = options?.policy ?? createTflResiliencePolicy(options?.policyOptions);
  }

  public async fetchRawDisruptions(): Promise<RawTflDisruption[]> {
    const url = new URL(
      `${this.baseUrl}/Line/Mode/tube,elizabeth-line,overground,dlr/Disruption`
    );
    if (this.appKey) {
      url.searchParams.set('app_key', this.appKey);
    }

    return this.policy.execute(async ({ signal }) => {
      const response = await this.fetchFn(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal,
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new TflHttpError(response.status, response.statusText, bodyText);
      }

      return (await response.json()) as RawTflDisruption[];
    });
  }

  public async getWeekendDisruptions(options?: WeekendWindowOptions): Promise<ParsedDisruption[]> {
    const weekendWindow = getUpcomingWeekendWindow(options);
    const rawDisruptions = await this.fetchRawDisruptions();
    return parseTflDisruptions({ disruptions: rawDisruptions, weekendWindow });
  }
}

export const tflClient = new TflClient();
