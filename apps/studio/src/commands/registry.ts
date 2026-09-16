import type { Diagram, DiagramId } from '@saerskriven/model';
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
  describeShortcutEntries,
  escapeChord,
  firedBy,
  mod,
  modShift,
  type ChordEvent,
  type Platform,
  type ShortcutEntry,
} from './shortcuts.js';

/** File operations whose session guards unsaved changes before replacing the model. */
export type FileCommands = {
  open(): void;
  import(): void;
  save(): void;
  saveAs(): void;
  exportDiagram(diagramId?: DiagramId): void;
  exportRegister(): void;
  exportTypst(): void;
  exportPdf(): void;
  exportPng(): void;
  close(): void;
};

/** Moving the canvas, which is React Flow's viewport rather than the model. */
export type ViewCommands = {
  zoomIn(): void;
  zoomOut(): void;
  fitToView(): void;
  fitSelection(): void;
  resetZoom(): void;
};

/** The shortcut reference controlled by a registered command. */
export type ReferenceCommands = {
  toggle(): void;
};

/** Commands that use the file session, shortcut reference, or canvas viewport. */
export type CommandSurface = {
  readonly files: FileCommands;
  readonly reference: ReferenceCommands;
  readonly view: ViewCommands;
};

/** The headings used to group commands in the shortcut reference. */
export const commandGroups = [
  'File',
  'Edit',
  'View',
  'Diagram',
  'Tools',
  'Help',
] as const;

type CommandGroup = (typeof commandGroups)[number];

type CommandEntry = ShortcutEntry & {
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
    group: 'Edit',
    when: 'With a canvas selection, outside text fields and open overlays',
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
    group: 'File',
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
    group: 'View',
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
    group: 'Tools',
    run: () => {
      selectTool(tool);
    },
  });

const history = (action: Action, message: string) => (): void => {
  const before = modelStore.getState().present;
  stepHistory(() => {
    dispatch(action);
  });
  if (modelStore.getState().present !== before) {
    announce(message);
  }
};

const outsideMenus = 'Focus is outside a text field or open menu';

const severalDiagramsWhen =
  'The model holds more than one diagram and focus is outside a text field';

const table = {
  open: fileCommand({
    id: 'open',
    label: 'Open',
    shortcuts: [mod('o')],
    when: 'Outside text fields',
    operation: 'open',
  }),
  import: fileCommand({
    id: 'import',
    label: 'Import',
    shortcuts: [],
    when: 'Convert an OTM or TM-BOM file into a new native model',
    operation: 'import',
  }),
  save: fileCommand({
    id: 'save',
    label: 'Save',
    shortcuts: [mod('s')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    operation: 'save',
  }),
  'save-as': fileCommand({
    id: 'save-as',
    label: 'Save as',
    shortcuts: [modShift('s')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    operation: 'saveAs',
  }),
  'export-diagram': fileCommand({
    id: 'export-diagram',
    label: 'Diagram as SVG',
    shortcuts: [],
    when: 'From the File menu',
    operation: 'exportDiagram',
  }),
  'export-register': fileCommand({
    id: 'export-register',
    label: 'Register as Markdown',
    shortcuts: [],
    when: 'From the File menu',
    operation: 'exportRegister',
  }),
  'export-typst': fileCommand({
    id: 'export-typst',
    label: 'Model as Typst',
    shortcuts: [],
    when: 'From the File menu',
    operation: 'exportTypst',
  }),
  'export-pdf': fileCommand({
    id: 'export-pdf',
    label: 'Model as PDF',
    shortcuts: [],
    when: 'From the File menu',
    operation: 'exportPdf',
  }),
  'export-png': fileCommand({
    id: 'export-png',
    label: 'Diagram as PNG',
    shortcuts: [],
    when: 'From the File menu',
    operation: 'exportPng',
  }),
  'close-file': fileCommand({
    id: 'close-file',
    label: 'New model',
    shortcuts: [modShift('x')],
    when: 'Outside text fields',
    operation: 'close',
  }),
  copy: editCommand({
    id: 'copy',
    label: 'Copy',
    shortcuts: [mod('c')],
    run: () => {
      void copySelected();
    },
  }),
  cut: editCommand({
    id: 'cut',
    label: 'Cut',
    shortcuts: [mod('x')],
    run: () => {
      void copySelected(true);
    },
  }),
  paste: editCommand({
    id: 'paste',
    label: 'Paste',
    shortcuts: [mod('v')],
    run: () => {
      void pasteSelected();
    },
  }),
  duplicate: editCommand({
    id: 'duplicate',
    label: 'Duplicate',
    shortcuts: [mod('d')],
    run: duplicateSelected,
  }),
  'edit-geometry': editCommand({
    id: 'edit-geometry',
    label: 'Position and size',
    shortcuts: [modShift('p')],
    run: () => {
      openSelectionControl('geometry');
    },
  }),
  'reconnect-source': editCommand({
    id: 'reconnect-source',
    label: 'Change flow source',
    shortcuts: [modShift('1')],
    run: () => {
      openSelectionControl('source');
    },
  }),
  'reconnect-target': editCommand({
    id: 'reconnect-target',
    label: 'Change flow target',
    shortcuts: [modShift('2')],
    run: () => {
      openSelectionControl('target');
    },
  }),
  'toggle-flow-direction': editCommand({
    id: 'toggle-flow-direction',
    label: 'Toggle bidirectional flow',
    shortcuts: [modShift('3')],
    run: toggleFlowDirection,
  }),
  'align-left': editCommand({
    id: 'align-left',
    label: 'Align left',
    shortcuts: [modShift('ArrowLeft')],
    run: () => {
      arrangeSelected('left');
    },
  }),
  'align-centre': editCommand({
    id: 'align-centre',
    label: 'Align centres',
    shortcuts: [modShift('h')],
    run: () => {
      arrangeSelected('centre');
    },
  }),
  'align-right': editCommand({
    id: 'align-right',
    label: 'Align right',
    shortcuts: [modShift('ArrowRight')],
    run: () => {
      arrangeSelected('right');
    },
  }),
  'align-top': editCommand({
    id: 'align-top',
    label: 'Align top',
    shortcuts: [modShift('ArrowUp')],
    run: () => {
      arrangeSelected('top');
    },
  }),
  'align-middle': editCommand({
    id: 'align-middle',
    label: 'Align middles',
    shortcuts: [modShift('v')],
    run: () => {
      arrangeSelected('middle');
    },
  }),
  'align-bottom': editCommand({
    id: 'align-bottom',
    label: 'Align bottom',
    shortcuts: [modShift('ArrowDown')],
    run: () => {
      arrangeSelected('bottom');
    },
  }),
  'distribute-horizontal': editCommand({
    id: 'distribute-horizontal',
    label: 'Distribute horizontally',
    shortcuts: [modShift('d')],
    run: () => {
      arrangeSelected('horizontal');
    },
  }),
  'distribute-vertical': editCommand({
    id: 'distribute-vertical',
    label: 'Distribute vertically',
    shortcuts: [modShift('b')],
    run: () => {
      arrangeSelected('vertical');
    },
  }),
  undo: command({
    id: 'undo',
    label: 'Undo',
    group: 'Edit',
    shortcuts: [mod('z')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    run: history(Action.Undo(), 'Undo completed.'),
  }),
  redo: command({
    id: 'redo',
    label: 'Redo',
    group: 'Edit',
    shortcuts: [modShift('z'), mod('y', 'other')],
    when: 'Anywhere in the studio',
    inTextFields: true,
    run: history(Action.Redo(), 'Redo completed.'),
  }),
  delete: command({
    id: 'delete',
    label: 'Delete selection',
    group: 'Edit',
    shortcuts: [bare('Delete'), bare('Backspace')],
    when: 'A canvas selection exists and focus is outside a text field',
    run: () => {
      removeSelected();
    },
  }),
  rename: command({
    id: 'rename',
    label: 'Rename selection',
    group: 'Edit',
    shortcuts: [bare('F2')],
    when: 'One renameable canvas item is selected',
    run: renameSelected,
  }),
  'model-properties': command({
    id: 'model-properties',
    label: 'Model properties',
    group: 'Edit',
    shortcuts: [bare('m')],
    when: 'Focus is outside a text field or open menu. Opens with focus in Title and clears the canvas selection, or closes where already shown',
    run: toggleModelProperties,
  }),
  'focus-threats': command({
    id: 'focus-threats',
    label: 'Focus threats',
    group: 'Edit',
    shortcuts: [bare('t')],
    when: 'One canvas item is selected and focus is outside a text field',
    run: () => {
      focusThreatPanel();
    },
  }),
  'select-all': command({
    id: 'select-all',
    label: 'Select all',
    group: 'Edit',
    shortcuts: [mod('a')],
    when: 'Focus is outside a text field',
    run: selectAll,
  }),
  'add-bend': command({
    id: 'add-bend',
    label: 'Add bend',
    group: 'Edit',
    shortcuts: [character('+')],
    when: 'One flow is selected',
    run: startBendInsertion,
  }),
  'start-flow': command({
    id: 'start-flow',
    label: 'Start a flow',
    group: 'Edit',
    shortcuts: [bare('f')],
    when: 'One canvas item is selected',
    run: startFlow,
  }),
  'snap-to-grid': command({
    id: 'snap-to-grid',
    label: 'Snap to grid',
    group: 'View',
    shortcuts: [modShift('g')],
    when: 'From the View menu',
    run: toggleSnap,
  }),
  'reset-zoom': viewCommand({
    id: 'reset-zoom',
    label: 'Reset zoom to 100%',
    shortcuts: [mod('1')],
    when: 'Outside text fields',
    operation: 'resetZoom',
  }),
  'fit-selection': viewCommand({
    id: 'fit-selection',
    label: 'Fit selection',
    shortcuts: [modShift('0')],
    when: 'With a canvas selection, outside text fields',
    operation: 'fitSelection',
  }),
  'fit-to-view': viewCommand({
    id: 'fit-to-view',
    label: 'Fit to view',
    shortcuts: [mod('0')],
    when: 'Focus is outside a text field',
    operation: 'fitToView',
  }),
  'zoom-in': viewCommand({
    id: 'zoom-in',
    label: 'Zoom in',
    shortcuts: [mod('='), character('+', ['Mod'])],
    when: 'Focus is outside a text field',
    operation: 'zoomIn',
  }),
  'zoom-out': viewCommand({
    id: 'zoom-out',
    label: 'Zoom out',
    shortcuts: [mod('-')],
    when: 'Focus is outside a text field',
    operation: 'zoomOut',
  }),
  'next-diagram': command({
    id: 'next-diagram',
    label: 'Next diagram',
    group: 'Diagram',
    shortcuts: [bare('PageDown')],
    when: severalDiagramsWhen,
    available: severalDiagrams,
    run: () => {
      stepDiagram('next');
    },
  }),
  'previous-diagram': command({
    id: 'previous-diagram',
    label: 'Previous diagram',
    group: 'Diagram',
    shortcuts: [bare('PageUp')],
    when: severalDiagramsWhen,
    available: severalDiagrams,
    run: () => {
      stepDiagram('previous');
    },
  }),
  'new-diagram': command({
    id: 'new-diagram',
    label: 'New diagram',
    group: 'Diagram',
    shortcuts: [],
    when: 'From the diagram switcher',
    run: () => {
      createDiagram();
    },
  }),
  'rename-diagram': command({
    id: 'rename-diagram',
    label: 'Rename diagram',
    group: 'Diagram',
    shortcuts: [],
    when: 'From the diagram switcher, while the model holds a diagram',
    run: beginRenamingDiagram,
  }),
  'select-tool': toolCommand({
    id: 'select-tool',
    label: 'Select',
    shortcuts: [bare('v'), escapeChord, bare('1')],
    when: 'Outside text fields. Escape cancels placement and clears selection',
    tool: 'select',
  }),
  'hand-tool': toolCommand({
    id: 'hand-tool',
    label: 'Hand',
    shortcuts: [bare('h'), bare(' ')],
    when: 'Hold Space for a temporary Hand tool outside text fields',
    tool: 'hand',
  }),
  'actor-tool': toolCommand({
    id: 'actor-tool',
    label: 'Actor',
    shortcuts: [bare('a'), bare('2')],
    when: outsideMenus,
    tool: 'actor',
  }),
  'process-tool': toolCommand({
    id: 'process-tool',
    label: 'Process',
    shortcuts: [bare('p'), bare('3')],
    when: outsideMenus,
    tool: 'process',
  }),
  'store-tool': toolCommand({
    id: 'store-tool',
    label: 'Store',
    shortcuts: [bare('s'), bare('4')],
    when: outsideMenus,
    tool: 'store',
  }),
  'note-tool': toolCommand({
    id: 'note-tool',
    label: 'Note',
    shortcuts: [bare('n'), bare('7')],
    when: outsideMenus,
    tool: 'note',
  }),
  'boundary-box-tool': toolCommand({
    id: 'boundary-box-tool',
    label: 'Trust boundary',
    shortcuts: [bare('b'), bare('5')],
    when: outsideMenus,
    tool: 'boundary-box',
  }),
  'boundary-curve-tool': toolCommand({
    id: 'boundary-curve-tool',
    label: 'Trust boundary curve',
    shortcuts: [bare('c'), bare('6')],
    when: outsideMenus,
    tool: 'boundary-curve',
  }),
  'shortcut-reference': command({
    id: 'shortcut-reference',
    label: 'Keyboard shortcuts',
    group: 'Help',
    shortcuts: [character('?'), bare('F1')],
    when: outsideMenus,
    run: (surface) => {
      surface.reference.toggle();
    },
  }),
} as const satisfies Record<string, CommandEntry>;

/** Every command the studio offers, named once. */
export type CommandId = keyof typeof table;

/**
 * One command: what it is called, what presses it, and what it then does.
 * `available` gates only the key binding: while it is false the chord is left
 * to the browser.
 */
export type Command = CommandEntry & { readonly id: CommandId };

/** Every command, grouped in {@link commandGroups} order. */
export const commands: readonly Command[] = Object.values(table);

/** The registered command for each toolbox mode. */
export const toolCommands = {
  select: 'select-tool',
  actor: 'actor-tool',
  process: 'process-tool',
  store: 'store-tool',
  note: 'note-tool',
  'boundary-box': 'boundary-box-tool',
  'boundary-curve': 'boundary-curve-tool',
  hand: 'hand-tool',
} as const satisfies Record<Tool, CommandId>;

/** The command `id` names. */
export function commandById(id: CommandId): Command {
  return table[id];
}

/** The command whose shortcut matches the event. No event matches two. */
export function commandFor(
  event: ChordEvent,
  platform: Platform,
): Command | undefined {
  return commands.find((entry) =>
    entry.shortcuts.some((chord) => firedBy(event, chord, platform)),
  );
}

/** Runs a command against the mounted surface. */
export function runCommand(entry: Command, surface: CommandSurface): void {
  entry.run(surface);
}

/** The spoken description of the selected registered commands. */
export function describeCommandShortcuts(
  ids: readonly CommandId[],
  platform: Platform,
): string {
  return describeShortcutEntries(
    ids.map((id) => table[id]),
    platform,
  );
}

/** The SVG command bound to one diagram in a model of one or several. */
export function diagramExportCommand(
  diagram: Diagram,
  several: boolean,
): Command {
  const exported = commandById('export-diagram');
  return {
    ...exported,
    label: several ? `${exported.label}: ${diagram.title}` : exported.label,
    run: (surface) => {
      surface.files.exportDiagram(diagram.id);
    },
  };
}
