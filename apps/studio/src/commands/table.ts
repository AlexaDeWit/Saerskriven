import { announce } from '../canvas/announcements.js';
import { arrangeSelected } from '../canvas/arrangement.js';
import { startBendInsertion } from '../canvas/bend-insertion.js';
import {
  copySelected,
  duplicateSelected,
  pasteSelected,
} from '../canvas/clipboard.js';
import { startFlow } from '../canvas/connecting.js';
import {
  beginRenamingDiagram,
  createDiagram,
  stepDiagram,
} from '../canvas/diagrams.js';
import {
  removeSelected,
  renameSelected,
  selectAll,
  toggleFlowDirection,
} from '../canvas/edits.js';
import { openSelectionControl } from '../canvas/selection-control.js';
import { toggleSnap } from '../canvas/snap.js';
import { selectTool, type Tool } from '../canvas/tools.js';
import {
  focusThreatPanel,
  stepHistory,
  toggleModelProperties,
} from '../panel/panel-focus.js';
import { Action } from '../store/actions.js';
import { severalDiagrams } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  bare,
  character,
  escapeChord,
  mod,
  modShift,
  type CommandMessageId,
  type ShortcutEntry,
} from './shortcuts.js';
import type { CommandSurface, FileCommands, ViewCommands } from './surface.js';

/** The headings used to group commands in the shortcut reference. */
export const commandGroups = [
  'commands.group-file',
  'commands.group-edit',
  'commands.group-view',
  'commands.group-diagram',
  'commands.group-tools',
  'commands.group-help',
] as const satisfies readonly CommandMessageId[];

type CommandGroup = (typeof commandGroups)[number];

/** One registered command, before its id narrows to a known one. */
export type CommandEntry = ShortcutEntry & {
  readonly group: CommandGroup;
  readonly inTextFields: boolean;
  readonly available?: (state: State) => boolean;
  readonly run: (surface: CommandSurface) => void;
};

type Built<Id extends string> = CommandEntry & { readonly id: Id };

const command = <const Id extends string>({
  inTextFields = false,
  ...entry
}: Omit<Built<Id>, 'inTextFields'> & {
  readonly inTextFields?: boolean;
}): Built<Id> => ({ ...entry, inTextFields });

const editCommand = <const Id extends string>(
  entry: Pick<Built<Id>, 'id' | 'label' | 'shortcuts'> & {
    readonly run: () => void;
  },
): Built<Id> =>
  command({
    ...entry,
    group: 'commands.group-edit',
    when: 'commands.when-selection-outside-fields-and-overlays',
  });

const fileCommand = <const Id extends string>({
  operation,
  ...entry
}: Pick<Built<Id>, 'id' | 'label' | 'shortcuts' | 'when'> & {
  readonly inTextFields?: boolean;
  readonly operation: keyof FileCommands;
}): Built<Id> =>
  command({
    ...entry,
    group: 'commands.group-file',
    run: (surface) => {
      surface.files[operation]();
    },
  });

const viewCommand = <const Id extends string>({
  operation,
  ...entry
}: Pick<Built<Id>, 'id' | 'label' | 'shortcuts' | 'when'> & {
  readonly operation: keyof ViewCommands;
}): Built<Id> =>
  command({
    ...entry,
    group: 'commands.group-view',
    run: (surface) => {
      surface.view[operation]();
    },
  });

const toolCommand = <const Id extends string>({
  tool,
  ...entry
}: Pick<Built<Id>, 'id' | 'label' | 'shortcuts' | 'when'> & {
  readonly tool: Tool;
}): Built<Id> =>
  command({
    ...entry,
    group: 'commands.group-tools',
    run: () => {
      selectTool(tool);
    },
  });

const history =
  (action: Action, message: 'canvas.undo-done' | 'canvas.redo-done') =>
  (): void => {
    const before = modelStore.getState().present;
    stepHistory(() => {
      dispatch(action);
    });
    if (modelStore.getState().present !== before) {
      announce((t) => t(message));
    }
  };

/** Every command the studio offers, named once. */
export const commandTable = {
  open: fileCommand({
    id: 'open',
    label: 'commands.label-open',
    shortcuts: [mod('o')],
    when: 'commands.when-outside-text-fields',
    operation: 'open',
  }),
  import: fileCommand({
    id: 'import',
    label: 'commands.label-import',
    shortcuts: [],
    when: 'commands.when-import',
    operation: 'import',
  }),
  save: fileCommand({
    id: 'save',
    label: 'commands.label-save',
    shortcuts: [mod('s')],
    when: 'commands.when-anywhere',
    inTextFields: true,
    operation: 'save',
  }),
  'save-as': fileCommand({
    id: 'save-as',
    label: 'commands.label-save-as',
    shortcuts: [modShift('s')],
    when: 'commands.when-anywhere',
    inTextFields: true,
    operation: 'saveAs',
  }),
  'export-diagram': fileCommand({
    id: 'export-diagram',
    label: 'commands.label-export-diagram',
    shortcuts: [],
    when: 'commands.when-file-menu',
    operation: 'exportDiagram',
  }),
  'export-register': fileCommand({
    id: 'export-register',
    label: 'commands.label-export-register',
    shortcuts: [],
    when: 'commands.when-file-menu',
    operation: 'exportRegister',
  }),
  'export-typst': fileCommand({
    id: 'export-typst',
    label: 'commands.label-export-typst',
    shortcuts: [],
    when: 'commands.when-file-menu',
    operation: 'exportTypst',
  }),
  'export-pdf': fileCommand({
    id: 'export-pdf',
    label: 'commands.label-export-pdf',
    shortcuts: [],
    when: 'commands.when-file-menu',
    operation: 'exportPdf',
  }),
  'export-png': fileCommand({
    id: 'export-png',
    label: 'commands.label-export-png',
    shortcuts: [],
    when: 'commands.when-file-menu',
    operation: 'exportPng',
  }),
  'close-file': fileCommand({
    id: 'close-file',
    label: 'commands.label-close-file',
    shortcuts: [modShift('x')],
    when: 'commands.when-outside-text-fields',
    operation: 'close',
  }),
  copy: editCommand({
    id: 'copy',
    label: 'commands.label-copy',
    shortcuts: [mod('c')],
    run: () => {
      void copySelected();
    },
  }),
  cut: editCommand({
    id: 'cut',
    label: 'commands.label-cut',
    shortcuts: [mod('x')],
    run: () => {
      void copySelected(true);
    },
  }),
  paste: editCommand({
    id: 'paste',
    label: 'commands.label-paste',
    shortcuts: [mod('v')],
    run: () => {
      void pasteSelected();
    },
  }),
  duplicate: editCommand({
    id: 'duplicate',
    label: 'commands.label-duplicate',
    shortcuts: [mod('d')],
    run: duplicateSelected,
  }),
  'edit-geometry': editCommand({
    id: 'edit-geometry',
    label: 'commands.label-edit-geometry',
    shortcuts: [modShift('p')],
    run: () => {
      openSelectionControl('geometry');
    },
  }),
  'reconnect-source': editCommand({
    id: 'reconnect-source',
    label: 'commands.label-reconnect-source',
    shortcuts: [modShift('1')],
    run: () => {
      openSelectionControl('source');
    },
  }),
  'reconnect-target': editCommand({
    id: 'reconnect-target',
    label: 'commands.label-reconnect-target',
    shortcuts: [modShift('2')],
    run: () => {
      openSelectionControl('target');
    },
  }),
  'toggle-flow-direction': editCommand({
    id: 'toggle-flow-direction',
    label: 'commands.label-toggle-flow-direction',
    shortcuts: [modShift('3')],
    run: toggleFlowDirection,
  }),
  'align-left': editCommand({
    id: 'align-left',
    label: 'commands.label-align-left',
    shortcuts: [modShift('ArrowLeft')],
    run: () => {
      arrangeSelected('left');
    },
  }),
  'align-centre': editCommand({
    id: 'align-centre',
    label: 'commands.label-align-centre',
    shortcuts: [modShift('h')],
    run: () => {
      arrangeSelected('centre');
    },
  }),
  'align-right': editCommand({
    id: 'align-right',
    label: 'commands.label-align-right',
    shortcuts: [modShift('ArrowRight')],
    run: () => {
      arrangeSelected('right');
    },
  }),
  'align-top': editCommand({
    id: 'align-top',
    label: 'commands.label-align-top',
    shortcuts: [modShift('ArrowUp')],
    run: () => {
      arrangeSelected('top');
    },
  }),
  'align-middle': editCommand({
    id: 'align-middle',
    label: 'commands.label-align-middle',
    shortcuts: [modShift('v')],
    run: () => {
      arrangeSelected('middle');
    },
  }),
  'align-bottom': editCommand({
    id: 'align-bottom',
    label: 'commands.label-align-bottom',
    shortcuts: [modShift('ArrowDown')],
    run: () => {
      arrangeSelected('bottom');
    },
  }),
  'distribute-horizontal': editCommand({
    id: 'distribute-horizontal',
    label: 'commands.label-distribute-horizontal',
    shortcuts: [modShift('d')],
    run: () => {
      arrangeSelected('horizontal');
    },
  }),
  'distribute-vertical': editCommand({
    id: 'distribute-vertical',
    label: 'commands.label-distribute-vertical',
    shortcuts: [modShift('b')],
    run: () => {
      arrangeSelected('vertical');
    },
  }),
  undo: command({
    id: 'undo',
    label: 'commands.label-undo',
    group: 'commands.group-edit',
    shortcuts: [mod('z')],
    when: 'commands.when-anywhere',
    inTextFields: true,
    run: history(Action.Undo(), 'canvas.undo-done'),
  }),
  redo: command({
    id: 'redo',
    label: 'commands.label-redo',
    group: 'commands.group-edit',
    shortcuts: [modShift('z'), mod('y', 'other')],
    when: 'commands.when-anywhere',
    inTextFields: true,
    run: history(Action.Redo(), 'canvas.redo-done'),
  }),
  delete: command({
    id: 'delete',
    label: 'commands.label-delete',
    group: 'commands.group-edit',
    shortcuts: [bare('Delete'), bare('Backspace')],
    when: 'commands.when-selection-exists-outside-fields',
    run: removeSelected,
  }),
  rename: command({
    id: 'rename',
    label: 'commands.label-rename',
    group: 'commands.group-edit',
    shortcuts: [bare('F2')],
    when: 'commands.when-one-renameable-item',
    run: renameSelected,
  }),
  'model-properties': command({
    id: 'model-properties',
    label: 'commands.label-model-properties',
    group: 'commands.group-edit',
    shortcuts: [bare('m')],
    when: 'commands.when-model-properties',
    run: toggleModelProperties,
  }),
  'focus-threats': command({
    id: 'focus-threats',
    label: 'commands.label-focus-threats',
    group: 'commands.group-edit',
    shortcuts: [bare('t')],
    when: 'commands.when-one-item-outside-fields',
    run: focusThreatPanel,
  }),
  'select-all': command({
    id: 'select-all',
    label: 'commands.label-select-all',
    group: 'commands.group-edit',
    shortcuts: [mod('a')],
    when: 'commands.when-outside-fields',
    run: selectAll,
  }),
  'add-bend': command({
    id: 'add-bend',
    label: 'commands.label-add-bend',
    group: 'commands.group-edit',
    shortcuts: [character('+')],
    when: 'commands.when-one-flow-selected',
    run: startBendInsertion,
  }),
  'start-flow': command({
    id: 'start-flow',
    label: 'commands.label-start-flow',
    group: 'commands.group-edit',
    shortcuts: [bare('f')],
    when: 'commands.when-one-item-selected',
    run: startFlow,
  }),
  'snap-to-grid': command({
    id: 'snap-to-grid',
    label: 'commands.label-snap-to-grid',
    group: 'commands.group-view',
    shortcuts: [modShift('g')],
    when: 'commands.when-view-menu',
    run: toggleSnap,
  }),
  'reset-zoom': viewCommand({
    id: 'reset-zoom',
    label: 'commands.label-reset-zoom',
    shortcuts: [mod('1')],
    when: 'commands.when-outside-text-fields',
    operation: 'resetZoom',
  }),
  'fit-selection': viewCommand({
    id: 'fit-selection',
    label: 'commands.label-fit-selection',
    shortcuts: [modShift('0')],
    when: 'commands.when-selection-outside-fields',
    operation: 'fitSelection',
  }),
  'fit-to-view': viewCommand({
    id: 'fit-to-view',
    label: 'commands.label-fit-to-view',
    shortcuts: [mod('0')],
    when: 'commands.when-outside-fields',
    operation: 'fitToView',
  }),
  'zoom-in': viewCommand({
    id: 'zoom-in',
    label: 'commands.label-zoom-in',
    shortcuts: [mod('='), character('+', ['Mod'])],
    when: 'commands.when-outside-fields',
    operation: 'zoomIn',
  }),
  'zoom-out': viewCommand({
    id: 'zoom-out',
    label: 'commands.label-zoom-out',
    shortcuts: [mod('-')],
    when: 'commands.when-outside-fields',
    operation: 'zoomOut',
  }),
  'next-diagram': command({
    id: 'next-diagram',
    label: 'commands.label-next-diagram',
    group: 'commands.group-diagram',
    shortcuts: [bare('PageDown')],
    when: 'commands.when-several-diagrams',
    available: severalDiagrams,
    run: () => {
      stepDiagram('next');
    },
  }),
  'previous-diagram': command({
    id: 'previous-diagram',
    label: 'commands.label-previous-diagram',
    group: 'commands.group-diagram',
    shortcuts: [bare('PageUp')],
    when: 'commands.when-several-diagrams',
    available: severalDiagrams,
    run: () => {
      stepDiagram('previous');
    },
  }),
  'new-diagram': command({
    id: 'new-diagram',
    label: 'commands.label-new-diagram',
    group: 'commands.group-diagram',
    shortcuts: [],
    when: 'commands.when-diagram-switcher',
    run: createDiagram,
  }),
  'rename-diagram': command({
    id: 'rename-diagram',
    label: 'commands.label-rename-diagram',
    group: 'commands.group-diagram',
    shortcuts: [],
    when: 'commands.when-diagram-switcher-with-diagram',
    run: beginRenamingDiagram,
  }),
  'select-tool': toolCommand({
    id: 'select-tool',
    label: 'commands.label-select-tool',
    shortcuts: [bare('v'), escapeChord, bare('1')],
    when: 'commands.when-select-tool',
    tool: 'select',
  }),
  'hand-tool': toolCommand({
    id: 'hand-tool',
    label: 'commands.label-hand-tool',
    shortcuts: [bare('h'), bare(' ')],
    when: 'commands.when-hand-tool',
    tool: 'hand',
  }),
  'actor-tool': toolCommand({
    id: 'actor-tool',
    label: 'commands.label-actor-tool',
    shortcuts: [bare('a'), bare('2')],
    when: 'commands.when-outside-fields-and-menus',
    tool: 'actor',
  }),
  'process-tool': toolCommand({
    id: 'process-tool',
    label: 'commands.label-process-tool',
    shortcuts: [bare('p'), bare('3')],
    when: 'commands.when-outside-fields-and-menus',
    tool: 'process',
  }),
  'store-tool': toolCommand({
    id: 'store-tool',
    label: 'commands.label-store-tool',
    shortcuts: [bare('s'), bare('4')],
    when: 'commands.when-outside-fields-and-menus',
    tool: 'store',
  }),
  'note-tool': toolCommand({
    id: 'note-tool',
    label: 'commands.label-note-tool',
    shortcuts: [bare('n'), bare('7')],
    when: 'commands.when-outside-fields-and-menus',
    tool: 'note',
  }),
  'boundary-box-tool': toolCommand({
    id: 'boundary-box-tool',
    label: 'commands.label-boundary-box-tool',
    shortcuts: [bare('b'), bare('5')],
    when: 'commands.when-outside-fields-and-menus',
    tool: 'boundary-box',
  }),
  'boundary-curve-tool': toolCommand({
    id: 'boundary-curve-tool',
    label: 'commands.label-boundary-curve-tool',
    shortcuts: [bare('c'), bare('6')],
    when: 'commands.when-outside-fields-and-menus',
    tool: 'boundary-curve',
  }),
  'shortcut-reference': command({
    id: 'shortcut-reference',
    label: 'commands.label-shortcut-reference',
    group: 'commands.group-help',
    shortcuts: [character('?'), bare('F1')],
    when: 'commands.when-outside-fields-and-menus',
    run: (surface) => {
      surface.reference.toggle();
    },
  }),
} as const satisfies Record<string, CommandEntry>;
