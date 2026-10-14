import type { ProblemDetails, WeekendStatusResponse } from '@railsignal/shared';

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Fetches London rail weekend closure status from the backend API.
 * Never calls third-party vendor APIs directly from the browser.
 */
export async function fetchWeekendStatus(
  referenceDate?: string,
  options?: ApiClientOptions,
): Promise<WeekendStatusResponse> {
  const fetcher = options?.fetchFn ?? fetch;
  const base = options?.baseUrl ?? '';
  const search = referenceDate ? `?referenceDate=${encodeURIComponent(referenceDate)}` : '';
  const url = `${base}/api/lines/weekend-status${search}`;

  const requestInit: RequestInit = {
    headers: {
      Accept: 'application/json',
    },
  };

  if (options?.signal) {
    requestInit.signal = options.signal;
  }

  const response = await fetcher(url, requestInit);

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const data = (await response.json()) as ProblemDetails;
      if (data?.detail) {
        detail = data.detail;
      } else if (data?.title) {
        detail = data.title;
      }
    } catch {
      // Body was not JSON; keep status code fallback message
    }
    throw new Error(detail);
  }

  return (await response.json()) as WeekendStatusResponse;
}
