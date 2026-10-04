import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  drawnAs,
  iconOnly,
  tooltipOnFocus,
} from '../commands/commands.fixtures.js';
import {
  boundaryElement,
  canvasModel,
  curvedCanvasModel,
  noteElement,
  openCanvas,
  requestFlow,
} from './canvas.fixtures.js';
import { currentTool } from './tools.js';
import { Toolbox } from './toolbox.js';
import {
  actorElement,
  firstThreat,
  heldElements,
  processElement,
  sampleModel,
  storeElement,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { Action } from '../store/actions.js';
import { currentAnnouncement } from './announcements.js';
import { withLanguage } from '../messages/locale.fixtures.js';

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

  it('disables deletion without a selection and separates it from tool modes', () => {
    render(<Toolbox />);

    const edit = screen.getByRole('group', { name: 'Edit' });
    const remove = within(edit).getByRole('button', {
      name: 'Delete selection',
    });
    expect(remove.hasAttribute('disabled')).toBe(true);
    expect(remove.hasAttribute('aria-pressed')).toBe(false);
    expect(drawnAs(remove)).toEqual(iconOnly);
    expect(within(edit).queryByRole('button', { name: 'Actor' })).toBeNull();
  });

  it.each([
    ['actor', [actorElement], canvasModel],
    ['process', [processElement], canvasModel],
    ['store', [storeElement], sampleModel],
    ['note', [noteElement], canvasModel],
    ['box boundary', [boundaryElement], canvasModel],
    ['curve boundary', [boundaryElement], curvedCanvasModel],
    ['flow', [requestFlow], canvasModel],
    ['several elements', [actorElement, processElement], canvasModel],
  ] as const)(
    'deletes %s with its cascade as one undoable edit',
    async (_, selection, model) => {
      openCanvas(selection, model);
      const user = userEvent.setup();
      render(<Toolbox />);
      const remove = screen.getByRole('button', {
        name: 'Delete selection',
      });

      await user.click(remove);

      const state = modelStore.getState();
      const remaining = state.present.diagrams[0].elements.map(
        (element) => element.id,
      );
      for (const id of selection) {
        expect(remaining).not.toContain(id);
      }
      expect(state.selection).toEqual([]);
      expect(state.past).toHaveLength(1);
      expect(currentAnnouncement().message).not.toBe('');
      expect(remove.hasAttribute('disabled')).toBe(true);
      act(() => {
        dispatch(Action.Undo());
      });
      expect(modelStore.getState().present).toEqual(model);
      expect(modelStore.getState().past).toHaveLength(0);
    },
  );

  it("detaches a deleted actor's flow end and removes its attached threat", async () => {
    openCanvas([actorElement]);
    const user = userEvent.setup();
    render(<Toolbox />);

    await user.click(screen.getByRole('button', { name: 'Delete selection' }));

    const model = modelStore.getState().present;
    expect(
      model.diagrams[0].elements.find((element) => element.id === requestFlow),
    ).toMatchObject({
      source: { kind: 'free' },
    });
    expect(model.threats.map((threat) => threat.id)).not.toContain(firstThreat);
  });

  it('activates deletion with Enter on its button', async () => {
    openCanvas([actorElement]);
    const user = userEvent.setup();
    render(<Toolbox />);
    screen.getByRole('button', { name: 'Delete selection' }).focus();

    await user.keyboard('{Enter}');

    expect(modelStore.getState().selection).toEqual([]);
    expect(modelStore.getState().past).toHaveLength(1);
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

describe.each([
  ['fr-CA', 'Supprimer la sélection'],
  ['sv', 'Ta bort markeringen'],
] as const)('delete control in %s', (locale, label) => {
  withLanguage(locale);

  it('uses the localized command name and keyboard bindings', () => {
    openCanvas([actorElement]);
    render(<Toolbox />);

    expect(
      screen
        .getByRole('button', { name: label })
        .getAttribute('aria-keyshortcuts'),
    ).toBe('Delete Backspace');
  });
});
