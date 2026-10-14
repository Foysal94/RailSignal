import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

describe('Header Component', () => {
  it('Should_render_logo_and_subtitle', () => {
    render(<Header />);
    expect(screen.getByText('RailSignal')).toBeInTheDocument();
    expect(screen.getByText('Weekend Closure Radar')).toBeInTheDocument();
  });

  it('Should_render_temporal_window_badge', () => {
    render(<Header />);
    expect(
      screen.getByText('This Weekend: Friday 19:00 - Monday 04:30 London Time'),
    ).toBeInTheDocument();
  });

  it('Should_render_dual_action_cta_buttons_with_min_44px_height', () => {
    render(<Header />);
    const testAlertBtn = screen.getByRole('button', { name: /send test alert/i });
    const fridayAlertsBtn = screen.getByRole('button', { name: /friday alerts/i });

    expect(testAlertBtn).toBeInTheDocument();
    expect(fridayAlertsBtn).toBeInTheDocument();

    expect(testAlertBtn.className).toContain('min-h-[44px]');
    expect(fridayAlertsBtn.className).toContain('min-h-[44px]');
  });

  it('Should_trigger_callbacks_when_action_buttons_are_clicked', async () => {
    const user = userEvent.setup();
    const onSendTestAlert = vi.fn();
    const onFridayAlerts = vi.fn();

    render(<Header onSendTestAlert={onSendTestAlert} onFridayAlerts={onFridayAlerts} />);

    await user.click(screen.getByRole('button', { name: /send test alert/i }));
    expect(onSendTestAlert).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /friday alerts/i }));
    expect(onFridayAlerts).toHaveBeenCalledTimes(1);
  });
});
