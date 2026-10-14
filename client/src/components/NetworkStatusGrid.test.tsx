import type { WeekendStatusResponse } from '@railsignal/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NetworkStatusGrid } from './NetworkStatusGrid';

const mockSuccessData: WeekendStatusResponse = {
  weekendDate: '2026-10-17',
  windowStart: '2026-10-16T19:00:00Z',
  windowEnd: '2026-10-19T04:30:00Z',
  lastUpdated: '2026-10-14T12:00:00Z',
  lines: [
    {
      lineId: 'bakerloo',
      lineName: 'Bakerloo',
      mode: 'tube',
      color: '#B36305',
      statusSeverityDescription: 'Good Service',
      hasDisruption: false,
      disruptions: [],
    },
    {
      lineId: 'central',
      lineName: 'Central',
      mode: 'tube',
      color: '#E32017',
      statusSeverityDescription: 'Planned Closure',
      corridorDescription: 'No service between White City and Ealing Broadway.',
      hasDisruption: true,
      disruptions: [],
    },
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
  http.get('/api/lines/weekend-status', () => {
    return HttpResponse.json(mockSuccessData);
  }),
);

function createTestWrapper() {
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

describe('NetworkStatusGrid Component', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_display_skeleton_loader_while_isFetching_is_true', async () => {
    server.use(
      http.get('/api/lines/weekend-status', async () => {
        await delay(150);
        return HttpResponse.json(mockSuccessData);
      }),
    );

    render(<NetworkStatusGrid />, { wrapper: createTestWrapper() });

    expect(screen.getByTestId('status-grid-skeleton')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('status-grid-skeleton')).not.toBeInTheDocument();
    });
  });

  it('Should_render_and_automatically_sort_disruptions_to_the_top', async () => {
    render(<NetworkStatusGrid />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Central' })).toBeInTheDocument();
    });

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(3);

    // Central is disrupted with Planned Closure -> must sort first
    expect(articles[0]).toHaveTextContent('Central');
    expect(articles[0]).toHaveTextContent('Planned Closure');

    // Bakerloo and Victoria are Good Service -> must sort after Central
    expect(articles[1]).toHaveTextContent('Bakerloo');
    expect(articles[2]).toHaveTextContent('Victoria');
  });

  it('Should_display_error_state_and_retry_when_fetching_fails', async () => {
    let attemptCount = 0;
    server.use(
      http.get('/api/lines/weekend-status', () => {
        attemptCount++;
        if (attemptCount === 1) {
          return HttpResponse.json(
            { detail: 'Internal transport provider unavailable' },
            { status: 503 },
          );
        }
        return HttpResponse.json(mockSuccessData);
      }),
    );

    const user = userEvent.setup();
    render(<NetworkStatusGrid />, { wrapper: createTestWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Internal transport provider unavailable')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Central' })).toBeInTheDocument();
    });
  });
});
