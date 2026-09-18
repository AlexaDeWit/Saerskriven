import {
  keyboardResizeStep,
  resizeKeys,
  shiftedKeyboardResizeStep,
} from '@saerskriven/canvas';
import type { StudioTranslator } from '../messages/catalogues.js';
import {
  bare,
  describeShortcutEntries,
  enterChord,
  escapeChord,
  firedBy,
  mod,
  shift,
  type ChordEvent,
  type CommandMessageId,
  type Platform,
  type ShortcutEntry,
} from './shortcuts.js';

/** The headings used to group contextual keys in the shortcut reference. */
export const contextualGroups = [
  'commands.group-canvas-navigation',
  'commands.group-canvas-editing',
  'commands.group-flow-route',
  'commands.group-placement',
  'commands.group-connecting',
  'commands.group-text-editing',
  'commands.group-panels',
] as const satisfies readonly CommandMessageId[];

type ContextualShortcutEntry = ShortcutEntry & {
  readonly group: (typeof contextualGroups)[number];
};

const arrowKeys = resizeKeys.map(bare);
const shiftedArrowKeys = resizeKeys.map(shift);
const enterKey = [enterChord];
const escapeKey = [escapeChord];

const table = {
  'choose-bend-segment': {
    id: 'choose-bend-segment',
    label: 'commands.key-choose-bend-segment',
    group: 'commands.group-flow-route',
    shortcuts: [bare('ArrowLeft'), bare('ArrowRight')],
    when: 'commands.key-when-choosing-segment',
  },
  'commit-bend': {
    id: 'commit-bend',
    label: 'commands.key-commit-bend',
    group: 'commands.group-flow-route',
    shortcuts: enterKey,
    when: 'commands.key-when-segment-or-position',
  },
  'cancel-bend': {
    id: 'cancel-bend',
    label: 'commands.key-cancel-bend',
    group: 'commands.group-flow-route',
    shortcuts: escapeKey,
    when: 'commands.key-when-bend-gesture',
  },
  'move-bend': {
    id: 'move-bend',
    label: { id: 'commands.key-move-bend', units: keyboardResizeStep },
    group: 'commands.group-flow-route',
    shortcuts: arrowKeys,
    when: 'commands.key-when-bend-handle-or-position',
  },
  'move-bend-far': {
    id: 'move-bend-far',
    label: { id: 'commands.key-move-bend', units: shiftedKeyboardResizeStep },
    group: 'commands.group-flow-route',
    shortcuts: shiftedArrowKeys,
    when: 'commands.key-when-bend-handle-or-position',
  },
  'remove-bend': {
    id: 'remove-bend',
    label: 'commands.key-remove-bend',
    group: 'commands.group-flow-route',
    shortcuts: [bare('Delete'), bare('Backspace')],
    when: 'commands.key-when-existing-bend-handle',
  },
  'pin-flow-end': {
    id: 'pin-flow-end',
    label: 'commands.key-pin-flow-end',
    group: 'commands.group-flow-route',
    shortcuts: arrowKeys,
    when: 'commands.key-when-flow-end-handle',
  },
  'release-flow-end': {
    id: 'release-flow-end',
    label: 'commands.key-release-flow-end',
    group: 'commands.group-flow-route',
    shortcuts: [bare('Delete'), bare('Backspace')],
    when: 'commands.key-when-flow-end-handle',
  },
  'focus-canvas-item': {
    id: 'focus-canvas-item',
    label: 'commands.key-focus-canvas-item',
    group: 'commands.group-canvas-navigation',
    shortcuts: [bare('Tab'), shift('Tab')],
    when: 'commands.key-when-canvas-focus',
  },
  'select-canvas-item': {
    id: 'select-canvas-item',
    label: 'commands.key-select-canvas-item',
    group: 'commands.group-canvas-navigation',
    shortcuts: [enterChord, bare(' ')],
    when: 'commands.key-when-not-only-selected',
  },
  'edit-canvas-text': {
    id: 'edit-canvas-text',
    label: 'commands.key-edit-canvas-text',
    group: 'commands.group-canvas-navigation',
    shortcuts: enterKey,
    when: 'commands.key-when-only-selected',
  },
  'toggle-canvas-item': {
    id: 'toggle-canvas-item',
    label: 'commands.key-toggle-canvas-item',
    group: 'commands.group-canvas-navigation',
    shortcuts: [shift('Enter')],
    when: 'commands.key-when-canvas-item-focus',
  },
  'move-selection': {
    id: 'move-selection',
    label: { id: 'commands.key-move-selection', units: keyboardResizeStep },
    group: 'commands.group-canvas-editing',
    shortcuts: arrowKeys,
    when: 'commands.key-when-selected-item-focus',
  },
  'move-selection-far': {
    id: 'move-selection-far',
    label: {
      id: 'commands.key-move-selection',
      units: shiftedKeyboardResizeStep,
    },
    group: 'commands.group-canvas-editing',
    shortcuts: shiftedArrowKeys,
    when: 'commands.key-when-selected-item-focus',
  },
  'resize-selection': {
    id: 'resize-selection',
    label: { id: 'commands.key-resize-selection', units: keyboardResizeStep },
    group: 'commands.group-canvas-editing',
    shortcuts: arrowKeys,
    when: 'commands.key-when-resize-control-focus',
  },
  'resize-selection-far': {
    id: 'resize-selection-far',
    label: {
      id: 'commands.key-resize-selection',
      units: shiftedKeyboardResizeStep,
    },
    group: 'commands.group-canvas-editing',
    shortcuts: shiftedArrowKeys,
    when: 'commands.key-when-resize-control-focus',
  },
  'place-at-centre': {
    id: 'place-at-centre',
    label: 'commands.key-place-at-centre',
    group: 'commands.group-placement',
    shortcuts: enterKey,
    when: 'commands.key-when-item-tool-active',
  },
  'finish-boundary-curve': {
    id: 'finish-boundary-curve',
    label: 'commands.key-finish-boundary-curve',
    group: 'commands.group-placement',
    shortcuts: enterKey,
    when: 'commands.key-when-two-waypoints',
  },
  'move-through-flow-targets': {
    id: 'move-through-flow-targets',
    label: 'commands.key-move-through-flow-targets',
    group: 'commands.group-connecting',
    shortcuts: [bare('ArrowUp'), bare('ArrowDown')],
    when: 'commands.key-when-destination-list-open',
  },
  'choose-flow-target': {
    id: 'choose-flow-target',
    label: 'commands.key-choose-flow-target',
    group: 'commands.group-connecting',
    shortcuts: enterKey,
    when: 'commands.key-when-destination-focus',
  },
  'cancel-flow-target': {
    id: 'cancel-flow-target',
    label: 'commands.key-cancel-flow-target',
    group: 'commands.group-connecting',
    shortcuts: escapeKey,
    when: 'commands.key-when-destination-list-open',
  },
  'commit-name': {
    id: 'commit-name',
    label: 'commands.key-commit-name',
    group: 'commands.group-text-editing',
    shortcuts: enterKey,
    when: 'commands.key-when-single-line-editor',
  },
  'commit-note': {
    id: 'commit-note',
    label: 'commands.key-commit-note',
    group: 'commands.group-text-editing',
    shortcuts: [mod('Enter')],
    when: 'commands.key-when-note-editor',
  },
  'cancel-canvas-text': {
    id: 'cancel-canvas-text',
    label: 'commands.key-cancel-canvas-text',
    group: 'commands.group-text-editing',
    shortcuts: escapeKey,
    when: 'commands.key-when-canvas-text-editor',
  },
  'close-threat-panel': {
    id: 'close-threat-panel',
    label: 'commands.key-close-threat-panel',
    group: 'commands.group-panels',
    shortcuts: escapeKey,
    when: 'commands.key-when-inside-threat-panel',
  },
  'close-model-properties': {
    id: 'close-model-properties',
    label: 'commands.key-close-model-properties',
    group: 'commands.group-panels',
    shortcuts: escapeKey,
    when: 'commands.key-when-inside-model-properties',
  },
  'close-shortcut-reference': {
    id: 'close-shortcut-reference',
    label: 'commands.key-close-shortcut-reference',
    group: 'commands.group-panels',
    shortcuts: escapeKey,
    when: 'commands.key-when-inside-reference',
  },
} as const satisfies Record<string, ContextualShortcutEntry>;

/** The known identifier of one contextual shortcut. */
export type ContextualShortcutId = keyof typeof table;

/** Every contextual shortcut, in declaration order. */
export const contextualShortcuts: readonly (ContextualShortcutEntry & {
  readonly id: ContextualShortcutId;
})[] = Object.values(table);

/** Whether `event` presses the contextual shortcut named by `id`. */
export function pressesContextualShortcut(
  id: ContextualShortcutId,
  event: ChordEvent,
  platform: Platform,
): boolean {
  return table[id].shortcuts.some((chord) => firedBy(event, chord, platform));
}

/** The spoken description of the selected contextual shortcuts. */
export function describeContextualShortcuts(
  ids: readonly ContextualShortcutId[],
  platform: Platform,
  t: StudioTranslator['t'],
): string {
  return describeShortcutEntries(
    ids.map((id) => table[id]),
    platform,
    t,
  );
}
