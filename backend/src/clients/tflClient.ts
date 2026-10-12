import { type IPolicy } from 'cockatiel';
import {
  createTflResiliencePolicy,
  TflHttpError,
  type ResiliencePolicyOptions,
} from './tflResilience.js';
import {
  getUpcomingWeekendWindow,
  type WeekendWindowOptions,
} from './tflTemporal.js';
import {
  parseTflDisruptions,
  type RawTflDisruption,
  type ParsedDisruption,
} from './tflParser.js';

// Re-export cohesive sibling modules to preserve existing public contract & backward compatibility
export * from './tflResilience.js';
export * from './tflTemporal.js';
export * from './tflParser.js';

export interface TflClientOptions {
  baseUrl?: string | undefined;
  appKey?: string | undefined;
  fetchFn?: typeof fetch | undefined;
  policy?: IPolicy | undefined;
  policyOptions?: ResiliencePolicyOptions | undefined;
}

/**
 * Resilient HTTP client for the Transport for London (TfL) Unified API.
 * Delegates transport resilience to Cockatiel, date windowing to tflTemporal,
 * and payload normalization to tflParser.
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
