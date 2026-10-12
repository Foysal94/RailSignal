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
  TaskCancelledError,
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

export { BrokenCircuitError, TaskCancelledError };

export interface TflHttpErrorOptions {
  status: number;
  statusText: string;
  body?: string | undefined;
}

export class TflHttpError extends Error {
  public readonly status: number;
  public readonly isTransient: boolean;

  constructor(options: TflHttpErrorOptions) {
    const detail = options.body ? `: ${options.body}` : '';
    super(`TfL Unified API request failed with status ${options.status} (${options.statusText})${detail}`);
    this.name = 'TflHttpError';
    this.status = options.status;
    // 429 Too Many Requests and 5xx Server Errors represent transient downstream capacity issues
    this.isTransient = options.status === 429 || (options.status >= 500 && options.status <= 599);
  }
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof TflHttpError) {
    return error.isTransient;
  }
  if (error instanceof BrokenCircuitError) {
    return false;
  }
  if (error instanceof TaskCancelledError) {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return true;
    }
    // Network drops, socket timeouts, and connection aborts from Undici/Node fetch
    if (
      error.message.includes('fetch failed') ||
      error.message.includes('network') ||
      error.message.includes('ECONN') ||
      error.message.includes('ETIMEDOUT')
    ) {
      return true;
    }
    // Deterministic programming errors must never be retried
    if (error instanceof TypeError || error instanceof SyntaxError || error instanceof RangeError) {
      return false;
    }
  }
  return false;
}

export interface ResiliencePolicyOptions {
  maxRetries?: number | undefined;
  timeoutMs?: number | undefined;
  circuitBreakerConsecutiveFailures?: number | undefined;
  circuitBreakerHalfOpenMs?: number | undefined;
  initialDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
}

/**
 * Creates a composite Cockatiel resilience policy for TfL API calls mirroring .NET Polly v8 pipeline.
 * Order of composition: Retry (outer) -> CircuitBreaker (middle) -> Timeout (inner).
 * This ensures the circuit breaker observes every individual network attempt and fast-fails downstream calls when tripped.
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

  return wrap(retryPolicy, breakerPolicy, timeoutPolicy);
}

export interface WeekendWindow {
  weekendDate: string;
  windowStart: Date;
  windowEnd: Date;
}

export interface WeekendWindowOptions {
  referenceDate?: Date | undefined;
}

export interface RawTflAffectedRoute {
  id?: string | undefined;
  lineId?: string | undefined;
  routeCode?: string | undefined;
  name?: string | undefined;
  direction?: string | undefined;
  originationName?: string | undefined;
  destinationName?: string | undefined;
  validFrom?: string | undefined;
  validTo?: string | undefined;
}

export interface RawTflDisruption {
  $type?: string | undefined;
  category?: string | undefined;
  type?: string | undefined;
  categoryDescription?: string | undefined;
  description: string;
  summary?: string | undefined;
  additionalInfo?: string | undefined;
  created?: string | undefined;
  lastUpdate?: string | undefined;
  affectedRoutes?: RawTflAffectedRoute[] | undefined;
  affectedStops?: unknown[] | undefined;
  closureText?: string | undefined;
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

export function getUpcomingWeekendWindow(options?: WeekendWindowOptions): WeekendWindow {
  const ref = options?.referenceDate ?? new Date();
  const londonDate = new TZDate(ref, 'Europe/London');
  const day = londonDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const hours = londonDate.getHours();
  const minutes = londonDate.getMinutes();

  // Days offset to upcoming/current Friday
  const weekdayOffsets: Record<number, number> = {
    5: 0,  // Friday
    6: -1, // Saturday
    0: -2, // Sunday
    2: 3,  // Tuesday
    3: 2,  // Wednesday
    4: 1,  // Thursday
  };

  let daysToFriday: number;
  if (day === 1) {
    // Monday prior to 04:30 London time is still active weekend; after 04:30 advance to next Friday
    daysToFriday = (hours < 4 || (hours === 4 && minutes < 30)) ? -3 : 4;
  } else {
    daysToFriday = weekdayOffsets[day] ?? 0;
  }

  const targetFriday = addDays(londonDate, daysToFriday);
  const targetMonday = addDays(targetFriday, 3);

  // Friday 19:00 to Monday 04:30 UK local time
  const windowStart = new TZDate(
    targetFriday.getFullYear(),
    targetFriday.getMonth(),
    targetFriday.getDate(),
    19,
    0,
    0,
    'Europe/London'
  );
  const windowEnd = new TZDate(
    targetMonday.getFullYear(),
    targetMonday.getMonth(),
    targetMonday.getDate(),
    4,
    30,
    0,
    'Europe/London'
  );
  const weekendDate = format(windowStart, 'yyyy-MM-dd');

  return {
    weekendDate,
    windowStart,
    windowEnd,
  };
}

export interface IsDisruptionInWindowOptions {
  validFrom?: string | Date | undefined;
  validTo?: string | Date | undefined;
  window: WeekendWindow;
}

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
  baseUrl?: string | undefined;
  appKey?: string | undefined;
  fetchFn?: typeof fetch | undefined;
  policy?: IPolicy | undefined;
  policyOptions?: ResiliencePolicyOptions | undefined;
}

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
        throw new TflHttpError({
          status: response.status,
          statusText: response.statusText,
          body: bodyText,
        });
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
