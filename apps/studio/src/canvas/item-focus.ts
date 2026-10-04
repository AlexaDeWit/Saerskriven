import type { ElementId } from '@saerskriven/model';
import type { KeyboardEvent } from 'react';
import { commandForKey, keyboardOwner } from '../commands/binding.js';
import { runCommand } from '../commands/registry.js';
import { hostPlatform } from '../commands/shortcuts.js';
import type { CommandSurface } from '../commands/surface.js';
import { selectedElement } from '../store/selectors.js';
import { modelStore } from '../store/store.js';
import { drawnElement, focusCanvas, focusElement } from './edits.js';

const selectionFrameSelector = '.react-flow__nodesselection';

const besideSelectionSelector =
  '[data-bend-index], [data-flow-end], [data-bend-toolbar], [data-curve-point], [data-selection-commands]';

/** Runs item commands before their controls handle keys. Select restores focus before clearing the selection. */
export function commandOnItem(
  event: Pick<
    KeyboardEvent,
    'nativeEvent' | 'preventDefault' | 'stopPropagation' | 'target'
  >,
  elements: ReadonlyMap<string, ElementId>,
  surface: CommandSurface,
): boolean {
  const command = commandForKey(event.nativeEvent, hostPlatform);
  const keepFocus = focusKeeper(event.target, elements);
  if (
    command === undefined ||
    keepFocus === undefined ||
    (command.id !== 'select-tool' &&
      ((!event.nativeEvent.ctrlKey && !event.nativeEvent.metaKey) ||
        keyboardOwner(event.target) !== 'page'))
  ) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  if (command.id === 'select-tool') {
    keepFocus();
  }
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
  if (!(target instanceof Element)) {
    return undefined;
  }
  if (target.closest(selectionFrameSelector) !== null) {
    return focusCanvas;
  }
  const selected = selectedElement(modelStore.getState());
  return selected === undefined ||
    target.closest(besideSelectionSelector) === null
    ? undefined
    : () => {
        focusElement(selected);
      };
}
