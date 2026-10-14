import type { WeekendStatusResponse } from '@railsignal/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useWeekendStatus } from './useWeekendStatus';

const mockResponse: WeekendStatusResponse = {
  weekendDate: '2026-10-17',
  windowStart: '2026-10-16T19:00:00Z',
  windowEnd: '2026-10-19T04:30:00Z',
  lastUpdated: '2026-10-14T12:00:00Z',
  lines: [
    {
      lineId: 'jubilee',
      lineName: 'Jubilee',
      mode: 'tube',
      color: '#A0A5A9',
      statusSeverityDescription: 'Good Service',
      hasDisruption: false,
      disruptions: [],
    },
  ],
};

const server = setupServer(
  http.get('/api/lines/weekend-status', () => {
    return HttpResponse.json(mockResponse);
  }),
);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useWeekendStatus hook', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_return_weekend_status_data_when_query_succeeds', async () => {
    const { result } = renderHook(() => useWeekendStatus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.weekendDate).toBe('2026-10-17');
    expect(result.current.data?.lines[0]?.lineName).toBe('Jubilee');
  });

  it('Should_handle_query_error_states', async () => {
    server.use(
      http.get('/api/lines/weekend-status', () => {
        return new HttpResponse('Network failed', { status: 500 });
      }),
    );

    const { result } = renderHook(() => useWeekendStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('Request failed with status 500');
  });
});
