import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Action } from '../store/actions.js';
import { dispatch } from '../store/store.js';
import { announce } from './announcements.js';
import { startFlow } from './connecting.js';
import { openCanvas } from './canvas.fixtures.js';
import { currentTool } from './tools.js';
import { CanvasAnnouncement } from './canvas-announcement.js';
import { FlowTargetChooser } from './flow-target-chooser.js';
import { Toolbox } from './toolbox.js';
import { actorElement, heldElements } from '../store/store.fixtures.js';

const chrome = (): void => {
  render(
    <>
      <Toolbox />
      <CanvasAnnouncement />
      <FlowTargetChooser />
    </>,
  );
};

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

describe('the canvas messages', () => {
  beforeEach(() => {
    openCanvas();
  });

  it('keeps the canvas message region mounted while it has nothing to say', () => {
    chrome();

    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(status.getAttribute('aria-label')).toBeNull();
    expect(status.getAttribute('aria-atomic')).toBe('true');
  });

  it('clears a message when the next canvas action changes state', () => {
    chrome();
    act(() => {
      announce('An edit completed.');
    });
    expect(screen.getByRole('status').textContent).toContain('completed');

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });

    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('opens the connector command chooser without adding a flow tool', () => {
    openCanvas([actorElement]);
    startFlow();

    chrome();

    expect(screen.getByRole('listbox')).toBeDefined();
    expect(screen.queryByRole('button', { name: /flow tool/iu })).toBeNull();
  });

  it('commits the connector command target directly', async () => {
    const user = userEvent.setup();
    openCanvas([actorElement]);
    startFlow();
    chrome();

    await user.click(screen.getByRole('option', { name: 'Studio' }));

    expect(heldElements()).toBe(7);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
