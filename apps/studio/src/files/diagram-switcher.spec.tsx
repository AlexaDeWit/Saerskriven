import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { emptyModel } from '@saerskriven/model';
import {
  CommandSurfaceProvider,
  unmountedSurface,
} from '../commands/binding.js';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { resetDiagramRenaming, stepDiagram } from '../canvas/diagrams.js';
import { activeDiagramId } from '../store/selectors.js';
import { initialState, untitledDiagram } from '../store/state.js';
import {
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { DiagramSwitcher } from './diagram-switcher.js';

const mounted = (): void => {
  render(
    <CommandSurfaceProvider surface={unmountedSurface}>
      <DiagramSwitcher />
    </CommandSurfaceProvider>,
  );
};

const switcher = (name: string | RegExp): HTMLElement =>
  screen.getByRole('button', { name });

const choice = (name: string): HTMLElement =>
  screen.getByRole('menuitemradio', { name });

const item = (name: string): HTMLElement =>
  screen.getByRole('menuitem', { name });

const titleField = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'Diagram title' });

const openTitle = async (user: UserEvent): Promise<HTMLElement> => {
  await user.click(switcher('Diagram: Main'));
  await user.click(
    await screen.findByRole('menuitem', { name: 'Rename diagram' }),
  );
  return titleField();
};

afterEach(() => {
  resetDiagramRenaming();
  resetAnnouncements();
});

describe('the diagram switcher', () => {
  it('names the diagram on screen for a model of one, and offers to add and rename', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await screen.findByRole('menu');

    expect(choice('Main').getAttribute('aria-checked')).toBe('true');
    expect(item('New diagram')).toBeDefined();
    expect(item('Rename diagram').getAttribute('data-disabled')).toBeNull();
  });

  it('lists every diagram by title and switches on a choice', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(twoDiagramModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await screen.findByRole('menu');
    await user.click(choice('Second'));

    expect(activeDiagramId(modelStore.getState())).toBe(secondDiagram);
    expect(switcher('Diagram: Second')).toBeDefined();
    expect(modelStore.getState().past).toEqual([]);
  });

  it('draws no status line for a choice and returns focus to the button naming it', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(twoDiagramModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await screen.findByRole('menu');
    await user.click(choice('Second'));

    expect(currentAnnouncement().message).toBe('');
    await waitFor(() => {
      expect(document.activeElement).toBe(switcher('Diagram: Second'));
    });
  });

  it('draws no status line for a title committed with Enter and returns focus to the button naming it', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(twoDiagramModel), true);
    mounted();
    act(() => {
      stepDiagram('next');
      stepDiagram('previous');
    });
    expect(currentAnnouncement().message).not.toBe('');

    await openTitle(user);
    await user.keyboard('Core{Enter}');

    expect(modelStore.getState().present.diagrams[0].title).toBe('Core');
    expect(currentAnnouncement().message).toBe('');
    expect(document.activeElement).toBe(switcher('Diagram: Core'));
  });

  it('says a title committed by leaving the field in the status line', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    await openTitle(user);
    await user.keyboard('Core');
    await user.tab();

    expect(currentAnnouncement().message).toContain('Core');
    expect(document.activeElement).not.toBe(switcher('Diagram: Core'));
  });

  it('offers only a new diagram while the model holds none', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(emptyModel), true);
    mounted();

    await user.click(switcher('Diagram: No diagram'));
    await screen.findByRole('menu');

    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(
      screen.queryByRole('menuitem', { name: 'Rename diagram' }),
    ).toBeNull();

    await user.click(item('New diagram'));

    expect(modelStore.getState().present.diagrams).toHaveLength(1);
    expect(titleField()).toBeDefined();
  });

  it('adds a diagram, opens its title selected, and commits the title on Enter', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await user.click(
      await screen.findByRole('menuitem', { name: 'New diagram' }),
    );

    const field = titleField();
    expect(document.activeElement).toBe(field);
    expect(field).toHaveProperty('value', untitledDiagram);
    await user.keyboard('Request forgery{Enter}');

    const state = modelStore.getState();
    expect(state.present.diagrams.map((diagram) => diagram.title)).toEqual([
      'Main',
      'Request forgery',
    ]);
    expect(activeDiagramId(state)).toBe(state.present.diagrams[1].id);
    expect(state.past).toHaveLength(2);
    expect(switcher('Diagram: Request forgery')).toBeDefined();
  });

  it('renames in place, refuses an empty title, and cancels on Escape', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    const field = await openTitle(user);
    await user.clear(field);
    await user.keyboard('{Enter}');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const described = document.getElementById(
      field.getAttribute('aria-describedby') ?? '',
    );
    expect(described).not.toBeNull();
    expect(described?.textContent ?? '').not.toBe('');
    expect(modelStore.getState().present.diagrams[0].title).toBe('Main');

    await user.keyboard('Core');
    await user.keyboard('{Escape}');
    expect(modelStore.getState().present.diagrams[0].title).toBe('Main');
    expect(document.activeElement).toBe(switcher('Diagram: Main'));

    const reopened = await openTitle(user);
    await user.keyboard('Core');
    act(() => {
      reopened.blur();
    });
    expect(modelStore.getState().present.diagrams[0].title).toBe('Core');
    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('closes the field, keeping the title, when a refused draft loses focus', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    const field = await openTitle(user);
    await user.clear(field);
    act(() => {
      field.blur();
    });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(modelStore.getState().present.diagrams[0].title).toBe('Main');
    expect(switcher('Diagram: Main')).toBeDefined();
  });

  it('leaves focus where a click put it when the field closes by blur', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    render(
      <CommandSurfaceProvider surface={unmountedSurface}>
        <DiagramSwitcher />
        <button type="button">Elsewhere</button>
      </CommandSurfaceProvider>,
    );

    await openTitle(user);
    await user.keyboard('Clicked away');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    expect(modelStore.getState().present.diagrams[0].title).toBe(
      'Clicked away',
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Elsewhere' }),
    );
  });

  it('leaves focus on a control that took it before the closed switcher returned focus to its button', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    render(
      <CommandSurfaceProvider surface={unmountedSurface}>
        <DiagramSwitcher />
        <button type="button">Elsewhere</button>
      </CommandSurfaceProvider>,
    );
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    await user.click(switcher('Diagram: Main'));
    const menu = await screen.findByRole('menu');

    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    act(() => {
      elsewhere.focus();
    });
    await act(async () => {
      await new Promise((settled) => {
        setTimeout(settled, 10);
      });
    });

    expect(document.activeElement).toBe(elsewhere);
  });

  it('hands focus back to its button when Escape closes it', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();
    await user.click(switcher('Diagram: Main'));
    await screen.findByRole('menu');

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(switcher('Diagram: Main'));
    });
  });

  it('closes the field when an undo takes the diagram it was open on away', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    await user.click(switcher('Diagram: Main'));
    await user.click(
      await screen.findByRole('menuitem', { name: 'New diagram' }),
    );
    expect(titleField()).toBeDefined();

    act(() => {
      dispatch(Action.Undo());
    });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(switcher('Diagram: Main')).toBeDefined();
    expect(modelStore.getState().present.diagrams).toHaveLength(1);
  });
});
