import type { ElementId } from '@saerskriven/model';
import type { KeyboardEvent } from 'react';
import { commandForKey } from '../commands/binding.js';
import { runCommand } from '../commands/registry.js';
import { hostPlatform } from '../commands/shortcuts.js';
import type { CommandSurface } from '../commands/surface.js';
import { drawnElement, focusCanvas, focusElement } from './edits.js';

const selectionFrameSelector = '.react-flow__nodesselection';

/**
 * Runs the Select tool's command for a key pressed on a drawn element or
 * flow, on a control inside one, or on the frame React Flow draws around the
 * nodes a box selected, and answers whether it did. Focus moves first to that
 * element, or from the frame to the canvas, so a control or frame the cleared
 * selection unmounts does not drop it. The press stops at the canvas, short of
 * React Flow, which blurs a node or flow that Escape unselects.
 */
export function selectToolOnItem(
  event: Pick<
    KeyboardEvent,
    'nativeEvent' | 'preventDefault' | 'stopPropagation' | 'target'
  >,
  elements: ReadonlyMap<string, ElementId>,
  surface: CommandSurface,
): boolean {
  const command = commandForKey(event.nativeEvent, hostPlatform);
  const keepFocus = focusKeeper(event.target, elements);
  if (command?.id !== 'select-tool' || keepFocus === undefined) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  keepFocus();
  runCommand(command, surface);
  return true;
}

function focusKeeper(
  target: EventTarget | null,
  elements: ReadonlyMap<string, ElementId>,
): (() => void) | undefined {
  const element = drawnElement(target, elements);
  if (element !== undefined) {
    return () => {
      focusElement(element);
    };
  }
  return target instanceof Element &&
    target.closest(selectionFrameSelector) !== null
    ? focusCanvas
    : undefined;
}
