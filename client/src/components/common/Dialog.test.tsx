import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog component', () => {
  it('Should_render_modal_content_when_open_is_true', () => {
    render(
      <Dialog open={true} title="Test Title" description="Test Description">
        <p>Modal Body Content</p>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Modal Body Content')).toBeInTheDocument();
  });

  it('Should_not_render_content_when_open_is_false', () => {
    render(
      <Dialog open={false} title="Hidden Title">
        <p>Hidden Content</p>
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Should_call_onOpenChange_when_close_button_clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <Dialog open={true} onOpenChange={onOpenChange} title="Closeable Title">
        <p>Body</p>
      </Dialog>,
    );

    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    expect(closeBtn.className).toContain('min-h-[44px]');
    await user.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Should_support_escape_key_to_close', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <Dialog open={true} onOpenChange={onOpenChange} title="Escape Test">
        <input type="text" aria-label="Input field" />
      </Dialog>,
    );

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Should_focus_initialFocusRef_element_upon_opening', () => {
    function TestComponent() {
      const inputRef = { current: null as HTMLInputElement | null };
      return (
        <Dialog open={true} title="Focus Test" initialFocusRef={inputRef}>
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            aria-label="Target input"
          />
        </Dialog>
      );
    }
    render(<TestComponent />);
    expect(screen.getByLabelText('Target input')).toHaveFocus();
  });
});
