import { type IPolicy, noop } from 'cockatiel';
import { format } from 'date-fns';
import { getUpcomingWeekendWindow, type WeekendWindowOptions } from '../../domain/temporal.js';
import { parseTflDisruptions } from './parser.js';
import { createTflResiliencePolicy, TflHttpError } from './resilience.js';
import type { ParsedDisruption, RawTflLineStatus } from './types.js';

export interface TflClientOptions {
  baseUrl?: string | undefined;
  appKey?: string | undefined;
  fetchFn?: typeof fetch | undefined;
  disableResilience?: boolean | undefined;
}

// Resilient HTTP client for the Transport for London (TfL) Unified API.
// Encapsulates date-scoped line status fetching, delegating resilience,
// temporal calculation, and parsing to focused sibling modules.
export class TflClient {
  private readonly baseUrl: string;
  private readonly appKey: string | undefined;
  private readonly fetchFn: typeof fetch;
  private readonly policy: IPolicy;

  constructor(options?: TflClientOptions) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.tfl.gov.uk').replace(/\/+$/, '');
    this.appKey = options?.appKey;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.policy = options?.disableResilience ? noop : createTflResiliencePolicy();
  }

  private async fetchRawLineStatuses(
    startDate: string,
    endDate: string,
  ): Promise<RawTflLineStatus[]> {
    const url = new URL(
      `${this.baseUrl}/Line/Mode/tube,elizabeth-line,overground,dlr/Status?startDate=${startDate}&endDate=${endDate}`,
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

      return (await response.json()) as RawTflLineStatus[];
    });
  }

  public async getWeekendDisruptions(options?: WeekendWindowOptions): Promise<ParsedDisruption[]> {
    const weekendWindow = getUpcomingWeekendWindow(options);
    const startDate = weekendWindow.weekendDate;
    const endDate = format(weekendWindow.windowEnd, 'yyyy-MM-dd');
    const rawLineStatuses = await this.fetchRawLineStatuses(startDate, endDate);
    return parseTflDisruptions({ disruptions: rawLineStatuses, weekendWindow });
  }
}

export const tflClient = new TflClient();
