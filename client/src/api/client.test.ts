import type { WeekendStatusResponse } from '@railsignal/shared';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchWeekendStatus } from './client';

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

  it('Should_throw_fallback_error_when_backend_fails_without_json_problem_details', async () => {
    await expect(fetchWeekendStatus('500-error')).rejects.toThrow('Request failed with status 500');
  });
});
