import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function TestConsumer({ durationMs }: { durationMs?: number }) {
  const { showToast } = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          showToast({
            type: 'success',
            message: 'Alert queued successfully!',
            durationMs,
          })
        }
      >
        Trigger Success Toast
      </button>
      <button
        type="button"
        onClick={() =>
          showToast({
            type: 'error',
            message: 'Failed to process request.',
          })
        }
      >
        Trigger Error Toast
      </button>
    </div>
  );
}

describe('Toast notification system', () => {
  it('Should_display_success_toast_when_triggered', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    const triggerBtn = screen.getByRole('button', { name: /trigger success toast/i });
    await user.click(triggerBtn);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Alert queued successfully!')).toBeInTheDocument();
  });

  it('Should_dismiss_toast_automatically_after_timeout', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer durationMs={80} />
      </ToastProvider>,
    );

    const triggerBtn = screen.getByRole('button', { name: /trigger success toast/i });
    await user.click(triggerBtn);

    expect(screen.getByText('Alert queued successfully!')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByText('Alert queued successfully!')).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('Should_allow_manual_dismissal_via_close_button', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    const triggerBtn = screen.getByRole('button', { name: /trigger error toast/i });
    await user.click(triggerBtn);

    expect(screen.getByText('Failed to process request.')).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /dismiss notification/i });
    expect(dismissBtn.className).toContain('min-h-[44px]');
    await user.click(dismissBtn);

    expect(screen.queryByText('Failed to process request.')).not.toBeInTheDocument();
  });
});
