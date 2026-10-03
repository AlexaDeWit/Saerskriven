import type { ThreatId } from '@saerskriven/model';
import { flushSync } from 'react-dom';
import { focusCanvas } from '../canvas/edits.js';
import { externalStore } from '../ui/external-store.js';
import { handlerSlot } from '../ui/handler-slot.js';
import {
  focusModelPanel,
  hiddenInModelPanel,
  openInModelPanel,
} from './panel-focus.js';

let open = false;

let opener: HTMLElement | undefined;

let focusRequested = false;

let carried: ThreatId | undefined;

const registerFocus = handlerSlot<() => void>();

const registerStore = externalStore(() => open);

/**
 * Opens the threat register with focus in it, or moves focus back into it
 * where it is already open.
 */
export function openThreatRegister(): void {
  if (open) {
    registerFocus.current()?.();
    return;
  }
  const active = document.activeElement;
  opener =
    active instanceof HTMLElement &&
    active !== document.body &&
    active.closest('[role="menu"]') === null
      ? active
      : undefined;
  focusRequested = true;
  moveTo(true);
}

/**
 * Opens the threat of a row chosen in the register on the model panel, whose
 * list calls `opened` once it has. Where the register hides that panel under
 * it, the register then closes as {@link closeThreatRegister} closes it, and
 * carries the choice to its next opening. The panel is committed before it
 * is read, so this is called from an event handler alone.
 */
export function chooseInThreatRegister(
  threatId: ThreatId,
  opened: () => void,
): void {
  flushSync(() => {
    openInModelPanel({ threatId, opened });
  });
  if (hiddenInModelPanel(threatId)) {
    closeThreatRegister();
    carried = threatId;
  }
}

/**
 * The threat whose row the register marks as it opens: the one a choice
 * closed it on, until it has opened and closed another way.
 */
export function carriedChoice(): ThreatId | undefined {
  return carried;
}

/**
 * Closes the register and moves focus into the model panel where it shows,
 * and otherwise back to where it was when the register opened, or to the
 * canvas where that is gone. The close is committed before focus moves,
 * since what the register covered is inert or hidden until it has gone, and
 * so it is called from an event handler alone.
 */
export function closeThreatRegister(): void {
  const returning = opener;
  flushSync(leaveThreatRegister);
  if (focusModelPanel()) {
    return;
  }
  if (returning?.isConnected === true) {
    returning.focus();
  } else {
    focusCanvas();
  }
}

/** Closes the register where it is open, and leaves focus to the caller. */
export function leaveThreatRegister(): void {
  if (!open) {
    return;
  }
  opener = undefined;
  focusRequested = false;
  carried = undefined;
  moveTo(false);
}

/**
 * Registers what moves focus into the mounted register, and returns the
 * removal. Where {@link openThreatRegister} opened the register now
 * mounting, focus moves there at once.
 */
export function registerFocusHandler(handler: () => void): () => void {
  const release = registerFocus.register(handler);
  if (focusRequested) {
    focusRequested = false;
    handler();
  }
  return release;
}

/** Subscribes a component to whether the register is open. */
export function useThreatRegisterOpen(): boolean {
  return registerStore.use();
}

/**
 * Closes the register and forgets its opener and the choice it carries, which
 * is how a spec starts from rest.
 */
export function resetThreatRegister(): void {
  leaveThreatRegister();
  carried = undefined;
}

function moveTo(next: boolean): void {
  open = next;
  registerStore.notify();
}
