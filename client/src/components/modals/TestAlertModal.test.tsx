import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../common/Toast';
import { TestAlertModal } from './TestAlertModal';

const server = setupServer();

function renderWithClient(component: ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testClient}>
      <ToastProvider>{component}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe('TestAlertModal Component', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('Should_render_modal_with_preselected_disrupted_lines', () => {
    renderWithClient(
      <TestAlertModal
        open={true}
        onOpenChange={vi.fn()}
        disruptedLineIds={['central', 'district']}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /send demo test alert/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/recipient email/i)).toBeInTheDocument();

    const centralCheckbox = screen.getByLabelText(/central/i) as HTMLInputElement;
    const districtCheckbox = screen.getByLabelText(/district/i) as HTMLInputElement;
    expect(centralCheckbox.checked).toBe(true);
    expect(districtCheckbox.checked).toBe(true);
  });

  it('Should_toggle_line_selection_when_checkbox_is_clicked', async () => {
    const user = userEvent.setup();

    renderWithClient(
      <TestAlertModal open={true} onOpenChange={vi.fn()} disruptedLineIds={['central']} />,
    );

    const centralCheckbox = screen.getByLabelText(/central/i) as HTMLInputElement;
    expect(centralCheckbox.checked).toBe(true);

    await user.click(centralCheckbox);
    expect(centralCheckbox.checked).toBe(false);

    await user.click(centralCheckbox);
    expect(centralCheckbox.checked).toBe(true);
  });

  it('Should_submit_form_via_mutation_and_display_success_confirmation', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('/api/demo/send-test-digest', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ status: 'queued', email: 'test@example.com' }, { status: 202 });
      }),
    );

    const user = userEvent.setup();
    renderWithClient(
      <TestAlertModal open={true} onOpenChange={vi.fn()} disruptedLineIds={['central']} />,
    );

    const emailInput = screen.getByLabelText(/recipient email/i);
    await user.type(emailInput, 'test@example.com');

    const submitBtn = screen.getByRole('button', { name: /dispatch test alert/i });
    expect(submitBtn.className).toContain('min-h-[44px]');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/demo alert enqueued/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/bullmq job was enqueued and dispatched via resend/i),
    ).toBeInTheDocument();
    expect(capturedBody).toEqual({
      email: 'test@example.com',
      lineIds: ['central'],
    });
  });

  it('Should_display_error_message_when_submission_fails', async () => {
    server.use(
      http.post('/api/demo/send-test-digest', () => {
        return HttpResponse.json(
          {
            type: 'https://datatracker.ietf.org/doc/html/rfc9457',
            title: 'Bad Request',
            status: 400,
            detail: 'Redis queue connection failed',
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithClient(
      <TestAlertModal open={true} onOpenChange={vi.fn()} disruptedLineIds={['central']} />,
    );

    const emailInput = screen.getByLabelText(/recipient email/i);
    await user.type(emailInput, 'test@example.com');

    const submitBtn = screen.getByRole('button', { name: /dispatch test alert/i });
    await user.click(submitBtn);

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((el) => el.textContent?.includes('Redis queue connection failed'))).toBe(
        true,
      );
    });
  });
});
