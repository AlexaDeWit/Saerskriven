import type { ElementId } from '@saerskriven/model';
import { selectedElement } from '../store/selectors.js';
import { modelStore } from '../store/store.js';
import { externalStore } from '../ui/external-store.js';
import { resetAnnouncements } from './announcements.js';
import { connectElements } from './edits.js';
import { flowEnds } from './elements.js';
import { currentLayout } from './layout.js';

/** Whether the target chooser is open, and the element the flow in progress runs from. */
export type Connecting = {
  readonly open: boolean;
  readonly from: ElementId | undefined;
};

const atRest: Connecting = { open: false, from: undefined };

let current = atRest;

const connectingStore = externalStore(currentConnecting);

/** Opens the target chooser on the one selected element, where a flow can run from it. */
export function startFlow(): void {
  const state = modelStore.getState();
  const selection = selectedElement(state);
  const ends = flowEnds(currentLayout(state));
  if (selection === undefined || !ends.some((node) => node.id === selection)) {
    return;
  }
  moveTo({ open: true, from: selection });
}

/** Opens or closes the chooser at the control's asking. Closing ends the flow in progress. */
export function chooserOpened(open: boolean): void {
  moveTo(open ? { open: true, from: current.from } : atRest);
}

/** Draws the flow to a chosen target, and answers whether there was a flow in progress. */
export function commitFlowTarget(
  target: ElementId,
  from: ElementId | undefined = current.from,
): boolean {
  if (from === undefined) {
    return false;
  }
  moveTo(atRest);
  connectElements(from, target);
  return true;
}

/** Forgets a flow in progress, which is how a spec starts from rest. */
export function resetConnecting(): void {
  moveTo(atRest);
}

/** What the chooser is showing. */
export function currentConnecting(): Connecting {
  return current;
}

/** Subscribes a component to {@link startFlow} and its two endings. */
export function useConnecting(): Connecting {
  return connectingStore.use();
}

function moveTo(next: Connecting): void {
  if (next.open === current.open && next.from === current.from) {
    return;
  }
  current = next;
  resetAnnouncements();
  connectingStore.notify();
}
