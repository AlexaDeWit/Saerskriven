import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { emptyModel } from '@saerskriven/model';
import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { locales } from '@saerskriven/i18n';
import { Either } from 'effect';
import { chooseLanguage } from '../messages/locale.js';
import { inLocale } from '../messages/messages.fixtures.js';
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
  mainDiagram,
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
      <button type="button">Elsewhere</button>
    </CommandSurfaceProvider>,
  );
};

const elsewhere = (): HTMLElement =>
  screen.getByRole('button', { name: 'Elsewhere' });

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
  act(() => {
    chooseLanguage('en-CA');
  });
});

describe.each(locales)('blank diagram titles in %s', (locale) => {
  it.each(['', '   '])(
    'names the button and radio item for title %j without changing the saved title',
    async (title) => {
      const user = userEvent.setup();
      const t = inLocale(locale);
      chooseLanguage(locale);
      const model = {
        ...twoDiagramModel,
        diagrams: twoDiagramModel.diagrams.map((diagram, index) =>
          index === 0 ? { ...diagram, title } : diagram,
        ),
      };
      const original = saerskrivenYamlCodec.write(model).output;
      const opened = Either.getOrThrow(saerskrivenYamlCodec.read(original));
      modelStore.setState(initialState(opened.model), true);
      mounted();

      const fallback = t('defaults.untitled-diagram');
      const name = t('menu.diagram-named', { title: fallback });
      expect(switcher(name).textContent).toBe(fallback);
      await user.click(switcher(name));
      await screen.findByRole('menu');
      expect(choice(fallback).getAttribute('aria-checked')).toBe('true');
      await user.click(choice('Second'));
      await user.click(switcher(t('menu.diagram-named', { title: 'Second' })));
      await user.click(choice(fallback));

      expect(switcher(name).textContent).toBe(fallback);
      const state = modelStore.getState();
      expect(state.present).toBe(opened.model);
      expect(state.present.diagrams[0].title).toBe(title);
      expect(state.past).toEqual([]);
      expect(
        saerskrivenYamlCodec.write(state.present, opened.source).output,
      ).toBe(original);
    },
  );
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

  it('says a step made with focus on its button without drawing it, in place of a drawn line', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(twoDiagramModel), true);
    mounted();
    act(() => {
      stepDiagram('next');
      stepDiagram('previous');
      switcher('Diagram: Main').focus();
    });
    expect(currentAnnouncement().drawn).toBe(true);

    await user.keyboard('{PageDown}');

    expect(activeDiagramId(modelStore.getState())).toBe(secondDiagram);
    expect(currentAnnouncement().message).toContain('Second');
    expect(currentAnnouncement().drawn).toBe(false);
    expect(document.activeElement).toBe(switcher('Diagram: Second'));

    await user.keyboard('{PageUp}');

    expect(activeDiagramId(modelStore.getState())).toBe(mainDiagram);
    expect(currentAnnouncement().message).toContain('Main');
    expect(currentAnnouncement().drawn).toBe(false);
  });

  it('leaves a step made with focus elsewhere to the drawn line', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(twoDiagramModel), true);
    mounted();
    act(() => {
      elsewhere().focus();
    });

    await user.keyboard('{PageDown}');

    expect(activeDiagramId(modelStore.getState())).toBe(secondDiagram);
    expect(currentAnnouncement().message).toContain('Second');
    expect(currentAnnouncement().drawn).toBe(true);
  });

  it('leaves the step keys on its button to the browser in a model of one diagram', () => {
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    expect(
      fireEvent.keyDown(switcher('Diagram: Main'), { key: 'PageDown' }),
    ).toBe(true);
    expect(currentAnnouncement().message).toBe('');
  });

  it.each(['shiftKey', 'ctrlKey', 'altKey'] as const)(
    'takes no step for a step key pressed on its button with %s',
    (modifier) => {
      modelStore.setState(initialState(twoDiagramModel), true);
      mounted();

      expect(
        fireEvent.keyDown(switcher('Diagram: Main'), {
          key: 'PageDown',
          [modifier]: true,
        }),
      ).toBe(true);
      expect(activeDiagramId(modelStore.getState())).toBe(mainDiagram);
      expect(currentAnnouncement().message).toBe('');
    },
  );

  it('says a title committed by leaving the field in the status line', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();

    await openTitle(user);
    await user.keyboard('Core');
    await user.tab();

    expect(currentAnnouncement().message).toContain('Core');
    expect(currentAnnouncement().drawn).toBe(true);
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
    mounted();

    await openTitle(user);
    await user.keyboard('Clicked away');
    await user.click(elsewhere());

    expect(modelStore.getState().present.diagrams[0].title).toBe(
      'Clicked away',
    );
    expect(document.activeElement).toBe(elsewhere());
  });

  it('leaves focus on a control that took it before the closed switcher returned focus to its button', async () => {
    const user = userEvent.setup();
    modelStore.setState(initialState(sampleModel), true);
    mounted();
    await user.click(switcher('Diagram: Main'));
    const menu = await screen.findByRole('menu');

    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    act(() => {
      elsewhere().focus();
    });
    await act(async () => {
      await new Promise((settled) => {
        setTimeout(settled, 10);
      });
    });

    expect(document.activeElement).toBe(elsewhere());
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
