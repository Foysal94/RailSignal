import type { WeekendStatusResponse } from '@railsignal/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import App from './App';

function renderWithClient(component: ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={testClient}>{component}</QueryClientProvider>);
}

const mockWeekendResponse: WeekendStatusResponse = {
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
  ],
};

const server = setupServer(
  http.get('/api/lines/weekend-status', () => {
    return HttpResponse.json(mockWeekendResponse);
  }),
);

describe('App Shell Integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_render_header_and_network_status_grid', async () => {
    renderWithClient(<App />);

    // Header assertions
    expect(screen.getByText('RailSignal')).toBeInTheDocument();
    expect(screen.getByText('Weekend Closure Radar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send test alert/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /friday alerts/i })).toBeInTheDocument();

    // Data grid assertions
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Central' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Victoria' })).toBeInTheDocument();
    });
  });

  it('Should_open_test_alert_modal_when_send_test_alert_button_clicked', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    renderWithClient(<App />);

    const sendTestAlertBtn = screen.getByRole('button', { name: /send test alert/i });
    await user.click(sendTestAlertBtn);

    expect(screen.getByRole('heading', { name: /send sample alert/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/recipient email/i)).toBeInTheDocument();
  });

  it('Should_open_subscription_modal_when_friday_alerts_button_clicked', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    renderWithClient(<App />);

    const fridayAlertsBtn = screen.getByRole('button', { name: /friday alerts/i });
    await user.click(fridayAlertsBtn);

    expect(
      screen.getByRole('heading', { name: /friday alerts subscription/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('Should_render_footer_with_wcag_compliant_text_slate_400_color', () => {
    renderWithClient(<App />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer.className).toContain('text-slate-400');
    expect(footer.className).not.toContain('text-slate-500');
  });
});
