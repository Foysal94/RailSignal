import type {
  CreateSubscriptionRequest,
  ProblemDetails,
  SendTestDigestRequest,
  SendTestDigestResponse,
  SubscriptionResponse,
  WeekendStatusResponse,
} from '@railsignal/shared';

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}

async function handleResponse<T>(response: Response): Promise<T> {
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

  return (await response.json()) as T;
}

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
      Accept: 'application/json, application/problem+json',
    },
  };

  if (options?.signal) {
    requestInit.signal = options.signal;
  }

  const response = await fetcher(url, requestInit);
  return handleResponse<WeekendStatusResponse>(response);
}

export async function sendTestDigest(
  request: SendTestDigestRequest,
  options?: ApiClientOptions,
): Promise<SendTestDigestResponse> {
  const fetcher = options?.fetchFn ?? fetch;
  const base = options?.baseUrl ?? '';
  const url = `${base}/api/demo/send-test-digest`;

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, application/problem+json',
    },
    body: JSON.stringify(request),
  };

  if (options?.signal) {
    requestInit.signal = options.signal;
  }

  const response = await fetcher(url, requestInit);
  return handleResponse<SendTestDigestResponse>(response);
}

export async function createSubscription(
  request: CreateSubscriptionRequest,
  options?: ApiClientOptions,
): Promise<SubscriptionResponse> {
  const fetcher = options?.fetchFn ?? fetch;
  const base = options?.baseUrl ?? '';
  const url = `${base}/api/subscriptions`;

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, application/problem+json',
    },
    body: JSON.stringify(request),
  };

  if (options?.signal) {
    requestInit.signal = options.signal;
  }

  const response = await fetcher(url, requestInit);
  return handleResponse<SubscriptionResponse>(response);
}
