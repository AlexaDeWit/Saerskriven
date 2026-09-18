import type { Diagram } from '@saerskriven/model';
import type { StudioTranslator } from '../messages/catalogues.js';
import type { Tool } from '../canvas/tools.js';
import { commandTable, type CommandEntry } from './table.js';
import {
  describeShortcutEntries,
  firedBy,
  type ChordEvent,
  type Platform,
} from './shortcuts.js';
import type { CommandSurface } from './surface.js';

/** Every command the studio offers, named once. */
export type CommandId = keyof typeof commandTable;

/**
 * One command: what it is called, what presses it, and what it then does.
 * `available` gates only the key binding: while it is false the chord is left
 * to the browser.
 */
export type Command = CommandEntry & { readonly id: CommandId };

/** Every command, grouped in `commandGroups` order. */
export const commands: readonly Command[] = Object.values(commandTable);

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
  return commandTable[id];
}

/** The first command whose shortcut matches the event, in table order. */
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
  t: StudioTranslator['t'],
): string {
  return describeShortcutEntries(
    ids.map((id) => commandTable[id]),
    platform,
    t,
  );
}

/**
 * The SVG command bound to one diagram. In a model of several the label names
 * the diagram, whose title is model content and passes through as it is.
 */
export function diagramExportCommand(
  diagram: Diagram,
  several: boolean,
): Command {
  const exported = commandById('export-diagram');
  return {
    ...exported,
    label: several
      ? { id: 'commands.export-diagram-named', title: diagram.title }
      : exported.label,
    run: (surface) => {
      surface.files.exportDiagram(diagram.id);
    },
  };
}
