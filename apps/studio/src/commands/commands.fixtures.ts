import { act, screen } from '@testing-library/react';
import { activeTranslator } from '../messages/locale.js';
import { commandById, runCommand, type CommandId } from './registry.js';
import { hostPlatform, shortcutLabelText, shortcutText } from './shortcuts.js';
import type { CommandSurface } from './surface.js';

type RecordingSurface = {
  readonly surface: CommandSurface;
  readonly asked: string[];
};

/** A {@link CommandSurface} that records what a command asked of it, in the order asked. */
export function recordingSurface(): RecordingSurface {
  const asked: string[] = [];
  const note = (what: string) => (): void => {
    asked.push(what);
  };
  return {
    asked,
    surface: {
      files: {
        open: note('open'),
        save: note('save'),
        saveAs: note('saveAs'),
        exportDiagram: note('exportDiagram'),
        exportRegister: note('exportRegister'),
        exportTypst: note('exportTypst'),
        exportPdf: note('exportPdf'),
        exportPng: note('exportPng'),
        share: note('share'),
        close: note('close'),
      },
      reference: { toggle: note('toggleReference') },
      view: {
        zoomIn: note('zoomIn'),
        zoomOut: note('zoomOut'),
        fitToView: note('fitToView'),
        fitSelection: note('fitSelection'),
        resetZoom: note('resetZoom'),
      },
    },
  };
}

/** Runs `command` from the registry on a {@link recordingSurface}, inside `act`. */
export function runRegistered(command: CommandId): void {
  act(() => {
    runCommand(commandById(command), recordingSurface().surface);
  });
}

type OpenedTooltip = {
  readonly tooltip: HTMLElement;
  readonly label: string;
  readonly chord: string;
};

/**
 * Focuses the button named by `command`'s registry label and returns the
 * tooltip that opens, with the label and the chord the registry spells for
 * this host.
 */
export async function tooltipOnFocus(
  command: CommandId,
): Promise<OpenedTooltip> {
  const { t } = activeTranslator();
  const entry = commandById(command);
  const label = shortcutLabelText(entry.label, t);
  act(() => {
    screen.getByRole('button', { name: label }).focus();
  });
  return {
    tooltip: await screen.findByRole('tooltip'),
    label,
    chord: shortcutText(entry.shortcuts, hostPlatform, t).chord,
  };
}

/** What a control draws: its visible text, and whether its glyph is hidden from assistive technology. */
export const drawnAs = (control: HTMLElement) => ({
  text: control.textContent,
  glyph: control.querySelector('svg')?.getAttribute('aria-hidden'),
});

/** {@link drawnAs} for a control drawn as a glyph alone, its name carried by its label. */
export const iconOnly = { text: '', glyph: 'true' };
