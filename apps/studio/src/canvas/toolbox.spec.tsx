import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openCanvas } from './canvas.fixtures.js';
import { currentTool } from './tools.js';
import { Toolbox } from './toolbox.js';
import { heldElements } from '../store/store.fixtures.js';

describe('Toolbox', () => {
  beforeEach(() => {
    openCanvas();
  });

  it('offers Select, every element kind and Hand as icon buttons', () => {
    render(<Toolbox />);

    for (const name of [
      'Select',
      'Actor',
      'Process',
      'Store',
      'Trust boundary',
      'Trust boundary curve',
      'Note',
      'Hand',
    ]) {
      const control = screen.getByRole('button', { name });
      expect(control.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
    }
  });

  it('selects a mode without editing the model', async () => {
    const user = userEvent.setup();
    render(<Toolbox />);

    await user.click(screen.getByRole('button', { name: 'Actor' }));

    expect(currentTool()).toMatchObject({ active: 'actor', locked: false });
    expect(heldElements()).toBe(6);
    expect(
      screen
        .getByRole('button', { name: 'Actor' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('locks an element mode on a double click', async () => {
    const user = userEvent.setup();
    render(<Toolbox />);

    await user.dblClick(screen.getByRole('button', { name: 'Store' }));

    expect(currentTool()).toMatchObject({ active: 'store', locked: true });
  });

  it('shows every shortcut in the icon tooltip', async () => {
    render(<Toolbox />);
    act(() => {
      screen.getByRole('button', { name: 'Actor' }).focus();
    });

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Actor');
    expect(within(tooltip).getByText('A or 2')).toBeDefined();
  });
});
