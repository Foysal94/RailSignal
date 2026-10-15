import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SubscriptionModal } from './SubscriptionModal';

const server = setupServer();

function renderWithClient(component: ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={testClient}>{component}</QueryClientProvider>);
}

describe('SubscriptionModal Component', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_render_all_19_london_lines_and_select_all_toggle', () => {
    renderWithClient(<SubscriptionModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /friday alerts subscription/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select all lines/i)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(20);
  });

  it('Should_toggle_all_lines_when_select_all_is_clicked', async () => {
    const user = userEvent.setup();
    renderWithClient(<SubscriptionModal open={true} onOpenChange={vi.fn()} />);

    const selectAllCheckbox = screen.getByLabelText(/select all lines/i) as HTMLInputElement;
    expect(selectAllCheckbox.checked).toBe(true);

    await user.click(selectAllCheckbox);
    expect(selectAllCheckbox.checked).toBe(false);

    const bakerlooCheckbox = screen.getByLabelText(/bakerloo/i) as HTMLInputElement;
    expect(bakerlooCheckbox.checked).toBe(false);

    await user.click(selectAllCheckbox);
    expect(selectAllCheckbox.checked).toBe(true);
    expect(bakerlooCheckbox.checked).toBe(true);
  });

  it('Should_display_real_time_email_validation_feedback_on_blur', async () => {
    const user = userEvent.setup();
    renderWithClient(<SubscriptionModal open={true} onOpenChange={vi.fn()} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('Should_submit_subscription_and_display_success_feedback', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('/api/subscriptions', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            id: 'sub-789',
            email: 'sub@example.com',
            subscribedLineIds: ['victoria', 'central'],
            createdAt: '2026-10-15T12:00:00Z',
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithClient(<SubscriptionModal open={true} onOpenChange={vi.fn()} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'sub@example.com');

    const submitBtn = screen.getByRole('button', { name: /subscribe to friday alerts/i });
    expect(submitBtn.className).toContain('min-h-[44px]');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/subscription confirmed/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/friday morning email delivery and one-click unsubscribe links/i),
    ).toBeInTheDocument();
    expect(capturedBody).toBeDefined();
  });

  it('Should_require_at_least_one_line_to_be_selected', async () => {
    const user = userEvent.setup();
    renderWithClient(<SubscriptionModal open={true} onOpenChange={vi.fn()} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'sub@example.com');

    const selectAllCheckbox = screen.getByLabelText(/select all lines/i);
    await user.click(selectAllCheckbox);

    const submitBtn = screen.getByRole('button', { name: /subscribe to friday alerts/i });
    await user.click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/at least one line must be selected/i);
  });

  it('Should_display_server_error_when_subscription_mutation_fails', async () => {
    server.use(
      http.post('/api/subscriptions', () => {
        return HttpResponse.json(
          {
            type: 'https://datatracker.ietf.org/doc/html/rfc9457',
            title: 'Bad Request',
            status: 400,
            detail: 'Database unreachable',
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithClient(<SubscriptionModal open={true} onOpenChange={vi.fn()} />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'sub@example.com');

    const submitBtn = screen.getByRole('button', { name: /subscribe to friday alerts/i });
    await user.click(submitBtn);

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((el) => el.textContent?.includes('Database unreachable'))).toBe(true);
    });
  });

  it('Should_render_accessible_sticky_action_bar_and_adaptive_lines_list_to_prevent_scroll_trap', () => {
    renderWithClient(<SubscriptionModal open={true} onOpenChange={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /subscribe to friday alerts/i });
    const actionBar = submitBtn.closest('div');
    expect(actionBar?.className).toContain('sticky');
    expect(actionBar?.className).toContain('bottom-0');
    expect(actionBar?.className).toContain('bg-radar-card');

    const linesList = screen.getByLabelText(/bakerloo/i).closest('.grid');
    expect(linesList?.className).toContain('overscroll-contain');
    expect(linesList?.className).toContain('max-h-36');
  });
});
