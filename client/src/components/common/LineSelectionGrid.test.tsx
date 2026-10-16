import { TFL_LINE_IDS } from '@railsignal/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LineSelectionGrid } from './LineSelectionGrid';

describe('LineSelectionGrid Component', () => {
  it('Should_render_default_title_live_counter_and_all_london_transit_lines', () => {
    render(<LineSelectionGrid selectedLines={[...TFL_LINE_IDS]} onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Monitored London Lines' })).toBeInTheDocument();
    expect(screen.getByText('19/19 lines selected')).toBeInTheDocument();
    expect(screen.getByLabelText(/select all lines/i)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(20);
  });

  it('Should_render_custom_title_and_helper_text_when_provided', () => {
    render(
      <LineSelectionGrid
        selectedLines={['central']}
        onChange={vi.fn()}
        title="Included Transit Lines"
        helperText="Pre-selected active closures or priority lines for immediate demo:"
      />,
    );

    expect(screen.getByRole('group', { name: 'Included Transit Lines' })).toBeInTheDocument();
    expect(
      screen.getByText('Pre-selected active closures or priority lines for immediate demo:'),
    ).toBeInTheDocument();
    expect(screen.getByText('1/19 lines selected')).toBeInTheDocument();
  });

  it('Should_toggle_all_lines_to_empty_when_all_are_selected_and_select_all_is_clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<LineSelectionGrid selectedLines={[...TFL_LINE_IDS]} onChange={onChange} />);

    const selectAllCheckbox = screen.getByLabelText(/select all lines/i);
    await user.click(selectAllCheckbox);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('Should_select_all_lines_when_some_are_unselected_and_select_all_is_clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<LineSelectionGrid selectedLines={['central', 'victoria']} onChange={onChange} />);

    const selectAllCheckbox = screen.getByLabelText(/select all lines/i);
    await user.click(selectAllCheckbox);

    expect(onChange).toHaveBeenCalledWith([...TFL_LINE_IDS]);
  });

  it('Should_toggle_individual_line_selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<LineSelectionGrid selectedLines={['central', 'victoria']} onChange={onChange} />);

    const victoriaCheckbox = screen.getByLabelText('Victoria');
    await user.click(victoriaCheckbox);

    expect(onChange).toHaveBeenCalledWith(['central']);
  });

  it('Should_add_line_to_selection_when_unselected_line_is_clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<LineSelectionGrid selectedLines={['central']} onChange={onChange} />);

    const bakerlooCheckbox = screen.getByLabelText('Bakerloo');
    await user.click(bakerlooCheckbox);

    expect(onChange).toHaveBeenCalledWith(['central', 'bakerloo']);
  });
});
