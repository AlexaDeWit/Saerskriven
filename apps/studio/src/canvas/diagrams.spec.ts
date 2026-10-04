import { act, renderHook } from '@testing-library/react';
import { diagramId } from '@saerskriven/model/fixtures';
import { locales } from '@saerskriven/i18n';
import { chooseLanguage } from '../messages/locale.js';
import { inLocale } from '../messages/messages.fixtures.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { commandById, runCommand } from '../commands/registry.js';
import { activeDiagramId } from '../store/selectors.js';
import { initialState, untitledDiagram } from '../store/state.js';
import {
  mainDiagram,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import {
  announceUndrawn,
  currentAnnouncement,
  resetAnnouncements,
} from './announcements.js';
import {
  createDiagram,
  endRenamingDiagram,
  renameActiveDiagram,
  resetDiagramRenaming,
  retitleActiveDiagram,
  showDiagram,
  stepDiagram,
  switchDiagram,
  useDiagramRenaming,
} from './diagrams.js';

const shown = (): string | undefined => activeDiagramId(modelStore.getState());

beforeEach(() => {
  modelStore.setState(initialState(twoDiagramModel), true);
  resetAnnouncements();
  resetDiagramRenaming();
});

afterEach(() => {
  chooseLanguage('en-CA');
});

describe.each(locales)('diagram announcements in %s', (locale) => {
  it.each(['', '   '])(
    'speaks the fallback for title %j on switching',
    (title) => {
      chooseLanguage(locale);
      const model = {
        ...twoDiagramModel,
        diagrams: twoDiagramModel.diagrams.map((diagram, index) =>
          index === 1 ? { ...diagram, title } : diagram,
        ),
      };
      modelStore.setState(initialState(model), true);

      expect(showDiagram(secondDiagram)).toBe(true);

      expect(currentAnnouncement().message).toContain(
        inLocale(locale)('defaults.untitled-diagram'),
      );
      expect(modelStore.getState().present).toBe(model);
      expect(modelStore.getState().present.diagrams[1].title).toBe(title);
    },
  );

  it('speaks the generated title on adding a diagram', () => {
    chooseLanguage(locale);
    expect(createDiagram()).toBe(true);
    expect(currentAnnouncement().message).toContain(
      inLocale(locale)('defaults.untitled-diagram'),
    );
  });
});

describe('showDiagram', () => {
  it('puts the diagram on screen and says which', () => {
    expect(showDiagram(secondDiagram)).toBe(true);
    expect(shown()).toBe(secondDiagram);
    expect(currentAnnouncement().message).toContain('Second');
    expect(modelStore.getState().past).toEqual([]);
  });

  it('says nothing for the diagram already on screen, or for one the model lacks', () => {
    expect(showDiagram(mainDiagram)).toBe(false);
    expect(showDiagram(diagramId('diagram-missing'))).toBe(false);
    expect(shown()).toBe(mainDiagram);
    expect(currentAnnouncement().message).toBe('');
  });
});

describe('switchDiagram', () => {
  it('puts the diagram on screen and leaves the status line empty', () => {
    expect(switchDiagram(secondDiagram)?.id).toBe(secondDiagram);
    expect(shown()).toBe(secondDiagram);
    expect(currentAnnouncement().message).toBe('');
  });

  it('reports no change for the diagram already on screen', () => {
    expect(switchDiagram(mainDiagram)).toBeUndefined();
  });

  it('ends the line a step drew', () => {
    stepDiagram('next');
    expect(currentAnnouncement().message).not.toBe('');
    switchDiagram(mainDiagram);
    expect(currentAnnouncement().message).toBe('');
  });
});

describe('stepDiagram', () => {
  it('steps along the list and wraps at either end', () => {
    expect(stepDiagram('next')).toBe(true);
    expect(shown()).toBe(secondDiagram);
    expect(stepDiagram('next')).toBe(true);
    expect(shown()).toBe(mainDiagram);
    expect(stepDiagram('previous')).toBe(true);
    expect(shown()).toBe(secondDiagram);
  });

  it('has nowhere to step in a model of one diagram', () => {
    modelStore.setState(initialState(sampleModel), true);
    expect(stepDiagram('next')).toBe(false);
    expect(shown()).toBe(mainDiagram);
  });

  it('says which diagram it showed in the status line', () => {
    stepDiagram('next');
    expect(currentAnnouncement().message).toContain('Second');
    expect(currentAnnouncement().drawn).toBe(true);
  });

  it('says it without drawing it through announceUndrawn, in place of a drawn line', () => {
    stepDiagram('next');
    stepDiagram('next', announceUndrawn);

    expect(shown()).toBe(mainDiagram);
    expect(currentAnnouncement().message).toContain('Main');
    expect(currentAnnouncement().drawn).toBe(false);
  });

  it('says a step between two diagrams of one title as a new announcement in the same words', () => {
    stepDiagram('next');
    retitleActiveDiagram('Main');
    stepDiagram('next', announceUndrawn);
    const first = currentAnnouncement();

    stepDiagram('next', announceUndrawn);

    expect(shown()).toBe(secondDiagram);
    expect(currentAnnouncement().message).toBe(first.message);
    expect(currentAnnouncement().sequence).toBe(first.sequence + 1);
  });

  it('is what the two registered commands run', () => {
    const { surface } = recordingSurface();
    runCommand(commandById('next-diagram'), surface);
    expect(shown()).toBe(secondDiagram);
    runCommand(commandById('previous-diagram'), surface);
    expect(shown()).toBe(mainDiagram);
  });
});

describe('createDiagram', () => {
  it('adds an untitled diagram after the others, shows it, and opens its title', () => {
    const { result } = renderHook(useDiagramRenaming);
    expect(result.current).toBeUndefined();

    act(() => {
      expect(createDiagram()).toBe(true);
    });

    const state = modelStore.getState();
    expect(state.present.diagrams).toHaveLength(3);
    expect(state.present.diagrams[2].title).toBe(untitledDiagram);
    expect(state.present.diagrams[2].elements).toEqual([]);
    expect(shown()).toBe(state.present.diagrams[2].id);
    expect(state.past).toHaveLength(1);
    expect(result.current).toBe(state.present.diagrams[2].id);
    expect(currentAnnouncement().message).toContain(untitledDiagram);

    act(() => {
      endRenamingDiagram();
    });
    expect(result.current).toBeUndefined();
  });
});

describe('retitleActiveDiagram', () => {
  it('retitles the diagram on screen as one undo step and leaves the status line empty', () => {
    expect(retitleActiveDiagram('Renamed')?.id).toBe(mainDiagram);
    const state = modelStore.getState();
    expect(state.present.diagrams[0].title).toBe('Renamed');
    expect(state.past).toHaveLength(1);
    expect(currentAnnouncement().message).toBe('');
  });

  it('reports no change for an unchanged or refused title', () => {
    expect(retitleActiveDiagram('Main')).toBeUndefined();
    expect(retitleActiveDiagram('')).toBeUndefined();
    expect(modelStore.getState().past).toEqual([]);
  });

  it('ends the line a step drew', () => {
    stepDiagram('next');
    expect(currentAnnouncement().message).not.toBe('');
    retitleActiveDiagram('Renamed');
    expect(currentAnnouncement().message).toBe('');
  });
});

describe('renameActiveDiagram', () => {
  it('retitles the diagram on screen as one undo step and says so', () => {
    expect(renameActiveDiagram('Renamed')).toBe(true);
    const state = modelStore.getState();
    expect(state.present.diagrams[0].title).toBe('Renamed');
    expect(state.past).toHaveLength(1);
    expect(currentAnnouncement().message).toContain('Renamed');
  });

  it('does nothing for an unchanged or refused title', () => {
    expect(renameActiveDiagram('Main')).toBe(false);
    expect(renameActiveDiagram('')).toBe(false);
    expect(modelStore.getState().past).toEqual([]);
    expect(currentAnnouncement().message).toBe('');
  });

  it('is what the registered rename command opens and the new-diagram command runs', () => {
    const { surface } = recordingSurface();
    const { result } = renderHook(useDiagramRenaming);
    act(() => {
      runCommand(commandById('rename-diagram'), surface);
    });
    expect(result.current).toBe(mainDiagram);
    act(() => {
      endRenamingDiagram();
      runCommand(commandById('new-diagram'), surface);
    });
    const added = modelStore.getState().present.diagrams;
    expect(added).toHaveLength(3);
    expect(result.current).toBe(added[2].id);
  });
});
