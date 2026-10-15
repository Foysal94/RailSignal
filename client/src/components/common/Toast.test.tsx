import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function TestConsumer() {
  const { showToast } = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() => showToast({ type: 'success', message: 'Alert queued successfully!' })}
      >
        Trigger Success Toast
      </button>
      <button
        type="button"
        onClick={() => showToast({ type: 'error', message: 'Failed to process request.' })}
      >
        Trigger Error Toast
      </button>
    </div>
  );
}

describe('Toast notification system', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Should_display_success_toast_when_triggered', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    const triggerBtn = screen.getByRole('button', { name: /trigger success toast/i });
    act(() => {
      triggerBtn.click();
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Alert queued successfully!')).toBeInTheDocument();
  });

  it('Should_dismiss_toast_automatically_after_timeout', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    const triggerBtn = screen.getByRole('button', { name: /trigger success toast/i });
    act(() => {
      triggerBtn.click();
    });

    expect(screen.getByText('Alert queued successfully!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Alert queued successfully!')).not.toBeInTheDocument();
  });

  it('Should_allow_manual_dismissal_via_close_button', async () => {
    vi.useRealTimers();
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
