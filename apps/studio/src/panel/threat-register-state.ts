import { focusCanvas } from '../canvas/edits.js';
import { externalStore } from '../ui/external-store.js';
import { focusModelPanel } from './panel-focus.js';

let open = false;

let opener: HTMLElement | undefined;

let focusRequested = false;

let take: (() => void) | undefined;

const registerStore = externalStore(() => open);

/**
 * Opens the threat register with focus in it, or moves focus back into it
 * where it is already open.
 */
export function openThreatRegister(): void {
  if (open) {
    take?.();
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
 * Closes the register and moves focus into the model panel where it shows,
 * and otherwise back to where it was when the register opened, or to the
 * canvas where that is gone.
 */
export function closeThreatRegister(): void {
  const returning = opener;
  leaveThreatRegister();
  if (focusModelPanel()) {
    return;
  }
  if (returning?.isConnected === true) {
    returning.focus();
  } else {
    focusCanvas();
  }
}

/** Closes the register and leaves focus to the caller. */
export function leaveThreatRegister(): void {
  opener = undefined;
  focusRequested = false;
  moveTo(false);
}

/**
 * Registers what moves focus into the mounted register, and returns the
 * removal. Where {@link openThreatRegister} opened the register now
 * mounting, focus moves there at once.
 */
export function registerFocusHandler(handler: () => void): () => void {
  take = handler;
  if (focusRequested) {
    focusRequested = false;
    handler();
  }
  return () => {
    if (take === handler) {
      take = undefined;
    }
  };
}

/** Subscribes a component to whether the register is open. */
export function useThreatRegisterOpen(): boolean {
  return registerStore.use();
}

/** Closes the register and forgets its opener, which is how a spec starts from rest. */
export function resetThreatRegister(): void {
  take = undefined;
  leaveThreatRegister();
}

function moveTo(next: boolean): void {
  if (next === open) {
    return;
  }
  open = next;
  registerStore.notify();
}
