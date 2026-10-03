import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  drawnAs,
  iconOnly,
  tooltipOnFocus,
} from '../commands/commands.fixtures.js';
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
      expect(drawnAs(screen.getByRole('button', { name }))).toEqual(iconOnly);
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

    const { tooltip, label, chord } = await tooltipOnFocus('actor-tool');
    expect(tooltip.textContent).toContain(label);
    expect(within(tooltip).getByText(chord)).toBeDefined();
  });
});
