import type { WeekendStatusResponse } from '@railsignal/shared';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSubscription, fetchWeekendStatus, sendTestDigest } from './client';

const mockResponse: WeekendStatusResponse = {
  weekendDate: '2026-10-17',
  windowStart: '2026-10-16T19:00:00Z',
  windowEnd: '2026-10-19T04:30:00Z',
  lastUpdated: '2026-10-14T12:00:00Z',
  lines: [
    {
      lineId: 'victoria',
      lineName: 'Victoria',
      mode: 'tube',
      color: '#0098D4',
      statusSeverityDescription: 'Good Service',
      hasDisruption: false,
      disruptions: [],
    },
  ],
};

const server = setupServer(
  http.get('/api/lines/weekend-status', ({ request }) => {
    const url = new URL(request.url);
    const refDate = url.searchParams.get('referenceDate');

    if (refDate === 'invalid-date') {
      return HttpResponse.json(
        {
          type: 'https://datatracker.ietf.org/doc/html/rfc9457',
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid referenceDate parameter',
          instance: '/api/lines/weekend-status',
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      );
    }

    if (refDate === '500-error') {
      return new HttpResponse('Server Error', { status: 500 });
    }

    return HttpResponse.json(mockResponse);
  }),
);

describe('API Client: fetchWeekendStatus', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_fetch_weekend_status_successfully_without_reference_date', async () => {
    const data = await fetchWeekendStatus();
    expect(data.weekendDate).toBe('2026-10-17');
    expect(data.lines).toHaveLength(1);
    expect(data.lines[0]?.lineId).toBe('victoria');
  });

  it('Should_append_referenceDate_query_parameter_when_provided', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get('/api/lines/weekend-status', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(mockResponse);
      }),
    );

    await fetchWeekendStatus('2026-10-24');
    expect(capturedUrl).toContain('referenceDate=2026-10-24');
  });

  it('Should_throw_error_with_rfc_9457_detail_when_backend_rejects_with_problem_details', async () => {
    await expect(fetchWeekendStatus('invalid-date')).rejects.toThrow(
      'Invalid referenceDate parameter',
    );
  });

  it('Should_fallback_to_rfc_9457_title_when_detail_is_missing', async () => {
    server.use(
      http.get('/api/lines/weekend-status', () => {
        return HttpResponse.json(
          {
            type: 'https://datatracker.ietf.org/doc/html/rfc9457',
            title: 'Internal Service Unavailable',
            status: 503,
          },
          { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );

    await expect(fetchWeekendStatus()).rejects.toThrow('Internal Service Unavailable');
  });

  it('Should_throw_fallback_error_when_backend_fails_without_json_problem_details', async () => {
    await expect(fetchWeekendStatus('500-error')).rejects.toThrow('Request failed with status 500');
  });
});

describe('API Client: sendTestDigest', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_send_test_digest_successfully', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('/api/demo/send-test-digest', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { status: 'queued', email: 'commuter@example.com' },
          { status: 202 },
        );
      }),
    );

    const result = await sendTestDigest({
      email: 'commuter@example.com',
      lineIds: ['victoria', 'central'],
    });

    expect(capturedBody).toEqual({
      email: 'commuter@example.com',
      lineIds: ['victoria', 'central'],
    });
    expect(result).toEqual({ status: 'queued', email: 'commuter@example.com' });
  });

  it('Should_throw_error_with_rfc_9457_detail_when_send_test_digest_fails', async () => {
    server.use(
      http.post('/api/demo/send-test-digest', () => {
        return HttpResponse.json(
          {
            type: 'https://datatracker.ietf.org/doc/html/rfc9457',
            title: 'Bad Request',
            status: 400,
            detail: 'Invalid TfL line selected: "unknown-line"',
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );

    await expect(
      sendTestDigest({ email: 'test@example.com', lineIds: ['unknown-line'] }),
    ).rejects.toThrow('Invalid TfL line selected: "unknown-line"');
  });
});

describe('API Client: createSubscription', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_create_subscription_successfully', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('/api/subscriptions', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            id: 'sub-123',
            email: 'sub@example.com',
            subscribedLineIds: ['victoria'],
            createdAt: '2026-10-15T12:00:00Z',
          },
          { status: 201 },
        );
      }),
    );

    const result = await createSubscription({
      email: 'sub@example.com',
      lineIds: ['victoria'],
    });

    expect(capturedBody).toEqual({
      email: 'sub@example.com',
      lineIds: ['victoria'],
    });
    expect(result.id).toBe('sub-123');
    expect(result.subscribedLineIds).toEqual(['victoria']);
  });

  it('Should_throw_error_with_rfc_9457_detail_when_create_subscription_fails', async () => {
    server.use(
      http.post('/api/subscriptions', () => {
        return HttpResponse.json(
          {
            type: 'https://datatracker.ietf.org/doc/html/rfc9457',
            title: 'Bad Request',
            status: 400,
            detail: 'At least one line must be selected',
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );

    await expect(createSubscription({ email: 'sub@example.com', lineIds: [] })).rejects.toThrow(
      'At least one line must be selected',
    );
  });
});

describe('API Client: Base URL resolution', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });
  afterAll(() => server.close());

  it('Should_resolve_endpoints_against_VITE_API_URL_when_configured', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.railsignal.example.com');
    const capturedUrls: string[] = [];

    server.use(
      http.get('https://api.railsignal.example.com/api/lines/weekend-status', ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json(mockResponse);
      }),
      http.post('https://api.railsignal.example.com/api/demo/send-test-digest', ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({ status: 'queued', email: 'test@example.com' }, { status: 202 });
      }),
      http.post('https://api.railsignal.example.com/api/subscriptions', ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json(
          {
            id: 'sub-1',
            email: 'test@example.com',
            subscribedLineIds: ['central'],
            createdAt: '2026-10-15T12:00:00Z',
          },
          { status: 201 },
        );
      }),
    );

    await fetchWeekendStatus();
    await sendTestDigest({ email: 'test@example.com', lineIds: ['central'] });
    await createSubscription({ email: 'test@example.com', lineIds: ['central'] });

    expect(capturedUrls).toEqual([
      'https://api.railsignal.example.com/api/lines/weekend-status',
      'https://api.railsignal.example.com/api/demo/send-test-digest',
      'https://api.railsignal.example.com/api/subscriptions',
    ]);
  });

  it('Should_strip_trailing_slash_from_VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.railsignal.example.com/');
    let capturedUrl: string | undefined;

    server.use(
      http.get('https://api.railsignal.example.com/api/lines/weekend-status', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(mockResponse);
      }),
    );

    await fetchWeekendStatus();
    expect(capturedUrl).toBe('https://api.railsignal.example.com/api/lines/weekend-status');
  });

  it('Should_prefer_explicit_baseUrl_option_over_VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.railsignal.example.com');
    let capturedUrl: string | undefined;

    server.use(
      http.get('https://override.example.com/api/lines/weekend-status', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(mockResponse);
      }),
    );

    await fetchWeekendStatus(undefined, { baseUrl: 'https://override.example.com' });
    expect(capturedUrl).toBe('https://override.example.com/api/lines/weekend-status');
  });
});
