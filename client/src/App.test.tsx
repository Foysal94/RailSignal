import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App Shell Foundation', () => {
  it('Should_render_app_shell_container', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'RailSignal' })).toBeInTheDocument();
    expect(screen.getByText(/weekend closure radar client shell/i)).toBeInTheDocument();
  });
});
