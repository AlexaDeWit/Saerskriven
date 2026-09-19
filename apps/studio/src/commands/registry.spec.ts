import { initialState, placeholderModel } from '../store/state.js';
import {
  actorElement,
  mainDiagram,
  newProcess,
  sampleModel,
} from '../store/store.fixtures.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { currentTool, resetTools } from '../canvas/tools.js';
import { panelFocusHandler } from '../panel/panel-focus.js';
import { recordingSurface } from './commands.fixtures.js';
import {
  commandById,
  commandFor,
  commands,
  diagramExportCommand,
  runCommand,
  toolCommands,
  type CommandId,
} from './registry.js';
import { activeTranslator } from '../messages/locale.js';
import { platforms, shortcutsOn, spellChord } from './shortcuts.js';

const { t } = activeTranslator();

const chordsOn = (platform: (typeof platforms)[number]): string[] =>
  commands.flatMap((command) =>
    shortcutsOn(command.shortcuts, platform).map((chord) =>
      spellChord(chord, platform, t),
    ),
  );

const press = (
  key: string,
  modifiers: { readonly ctrlKey?: boolean; readonly shiftKey?: boolean } = {},
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe('the command registry', () => {
  it('leaves the import, export and diagram-switcher commands without shortcuts', () => {
    expect(
      commands
        .filter((command) => command.shortcuts.length === 0)
        .map((command) => command.id),
    ).toEqual([
      'import',
      'export-diagram',
      'export-register',
      'export-typst',
      'export-pdf',
      'export-png',
      'new-diagram',
      'rename-diagram',
    ]);
  });

  it('gives no two commands the same chord, on either platform', () => {
    for (const platform of platforms) {
      const chords = chordsOn(platform);
      expect(new Set(chords).size).toBe(chords.length);
    }
  });

  it('matches every registered chord with the platform modifier', () => {
    for (const platform of platforms) {
      for (const command of commands) {
        for (const chord of shortcutsOn(command.shortcuts, platform)) {
          const modified = chord.modifiers.includes('Mod');
          const event = {
            key: chord.key,
            ctrlKey: modified && platform === 'other',
            metaKey: modified && platform === 'apple',
            shiftKey: chord.modifiers.includes('Shift'),
            altKey: false,
          };
          expect(commandFor(event, platform)?.id).toBe(command.id);
          expect(
            commandFor(
              { ...event, ctrlKey: event.metaKey, metaKey: event.ctrlKey },
              platform,
            )?.id,
          ).toBe(modified ? undefined : command.id);
        }
      }
    }
  });

  it('files every command under its own id', () => {
    for (const command of commands) {
      expect(commandById(command.id)).toBe(command);
    }
  });

  it('exempts only saving and the history moves from a control being typed in', () => {
    expect(
      commands
        .filter((command) => command.inTextFields)
        .map((command) => command.id),
    ).toEqual(['save', 'save-as', 'undo', 'redo']);
  });

  it('leaves Escape to the field a refused draft is being corrected in', () => {
    expect(commandById('select-tool').inTextFields).toBe(false);
  });

  it('binds every toolbox mode to a command of its own', () => {
    const bound = Object.values(toolCommands);
    expect(new Set(bound).size).toBe(bound.length);
  });
});

describe('commandFor', () => {
  it.each([
    { key: 'z', modifiers: { ctrlKey: true }, command: 'undo' },
    { key: 'z', modifiers: { ctrlKey: true, shiftKey: true }, command: 'redo' },
    { key: 'q', modifiers: { ctrlKey: true }, command: 'no command' },
    { key: '1', modifiers: {}, command: 'select-tool' },
    { key: '2', modifiers: {}, command: 'actor-tool' },
    { key: '3', modifiers: {}, command: 'process-tool' },
    { key: '4', modifiers: {}, command: 'store-tool' },
    { key: '5', modifiers: {}, command: 'boundary-box-tool' },
    { key: '6', modifiers: {}, command: 'boundary-curve-tool' },
    { key: '7', modifiers: {}, command: 'note-tool' },
    { key: 't', modifiers: {}, command: 'focus-threats' },
  ] as const)(
    'maps $key with modifiers $modifiers to $command',
    ({ key, modifiers, command }) => {
      expect(
        commandFor(press(key, modifiers), 'other')?.id ?? 'no command',
      ).toBe(command);
    },
  );

  it('gives M to Model properties alone, unshifted and unmodified, on either platform', () => {
    const unmodified = press('m');
    for (const platform of platforms) {
      expect(
        commands
          .filter((command) =>
            shortcutsOn(command.shortcuts, platform).some(
              (chord) => chord.key === 'm',
            ),
          )
          .map((command) => command.id),
      ).toEqual(['model-properties']);
      expect(commandFor(unmodified, platform)?.id).toBe('model-properties');
      expect(commandFor({ ...unmodified, key: 'M' }, platform)?.id).toBe(
        'model-properties',
      );
      expect(
        commandFor({ ...unmodified, key: 'M', shiftKey: true }, platform),
      ).toBeUndefined();
      expect(
        commandFor(
          {
            ...unmodified,
            ctrlKey: platform === 'other',
            metaKey: platform === 'apple',
          },
          platform,
        ),
      ).toBeUndefined();
    }
  });
});

describe('runCommand', () => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
    resetAnnouncements();
    resetTools();
  });

  it('asks the surface for the commands it answers for', () => {
    const recording = recordingSurface();
    const asked: CommandId[] = [
      'open',
      'save',
      'save-as',
      'export-diagram',
      'export-register',
      'export-typst',
      'export-pdf',
      'export-png',
      'zoom-in',
      'fit-to-view',
      'shortcut-reference',
    ];

    for (const id of asked) {
      runCommand(commandById(id), recording.surface);
    }

    expect(recording.asked).toEqual([
      'open',
      'save',
      'saveAs',
      'exportDiagram',
      'exportRegister',
      'exportTypst',
      'exportPdf',
      'exportPng',
      'zoomIn',
      'fitToView',
      'toggleReference',
    ]);
  });

  it('binds a diagram export to the diagram named by the menu item', () => {
    const recording = recordingSurface();
    const command = diagramExportCommand(placeholderModel.diagrams[0], true);

    runCommand(command, recording.surface);

    expect(recording.asked).toEqual(['exportDiagram']);
  });

  it('selects an element mode without editing the store', () => {
    const recording = recordingSurface();
    const before = modelStore.getState();

    runCommand(commandById('actor-tool'), recording.surface);

    expect(currentTool()).toMatchObject({ active: 'actor', locked: false });
    expect(modelStore.getState()).toBe(before);
    expect(recording.asked).toEqual([]);
  });

  it('selects the diagram through the select-all command', () => {
    const recording = recordingSurface();

    runCommand(commandById('select-all'), recording.surface);

    expect(modelStore.getState().selection).toEqual(
      placeholderModel.diagrams[0].elements.map((element) => element.id),
    );
    expect(modelStore.getState().past).toEqual([]);
    expect(recording.asked).toEqual([]);
  });

  it('asks the mounted threat panel to take focus', () => {
    let asked = false;
    const release = panelFocusHandler(() => {
      asked = true;
      return true;
    });

    runCommand(commandById('focus-threats'), recordingSurface().surface);

    expect(asked).toBe(true);
    release();
  });

  it('opens the model properties with a selection cleared, and closes them when they show', () => {
    const recording = recordingSurface();
    modelStore.setState(initialState(sampleModel), true);
    dispatch(Action.Select({ elementIds: [actorElement] }));

    runCommand(commandById('model-properties'), recording.surface);
    expect(modelStore.getState()).toMatchObject({
      selection: [],
      modelProperties: true,
    });

    runCommand(commandById('model-properties'), recording.surface);
    expect(modelStore.getState().modelProperties).toBe(false);
    expect(modelStore.getState().past).toEqual([]);
    expect(recording.asked).toEqual([]);
  });

  it('announces only completed history moves', () => {
    const recording = recordingSurface();
    modelStore.setState(initialState(sampleModel), true);
    dispatch(
      Action.AddElement({
        diagramId: mainDiagram,
        element: newProcess('history-process', 'History process'),
      }),
    );
    resetAnnouncements();

    runCommand(commandById('undo'), recording.surface);
    expect(currentAnnouncement().message).toContain('Undo');

    runCommand(commandById('redo'), recording.surface);
    expect(currentAnnouncement().message).toContain('Redo');

    resetAnnouncements();
    runCommand(commandById('redo'), recording.surface);
    expect(currentAnnouncement().message).toBe('');
  });
});
