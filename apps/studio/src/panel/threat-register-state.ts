import type { ThreatId } from '@saerskriven/model';
import { flushSync } from 'react-dom';
import { focusCanvas } from '../canvas/edits.js';
import { Action } from '../store/actions.js';
import { dispatch } from '../store/store.js';
import { externalStore } from '../ui/external-store.js';
import { handlerSlot } from '../ui/handler-slot.js';
import {
  focusModelPanel,
  hiddenInModelPanel,
  openInModelPanel,
  showModelDetails,
  showModelThreats,
  type ListFocus,
} from './panel-focus.js';

let open = false;

let opener: HTMLElement | undefined;

let focusRequested = false;

let carried: ThreatId | undefined;

const registerFocus = handlerSlot<() => void>();

const registerStore = externalStore(() => open);

/** Reopening the register moves focus into it without replacing its opener. */
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

/** Commits a row choice before reading the editor, closing a covering register onto the opened threat or refused field. */
export function chooseInThreatRegister(
  threatId: ThreatId,
  opened: () => void,
): void {
  flushSync(() => {
    openInModelPanel({ threatId, opened });
  });
  const hidden = hiddenInModelPanel(threatId);
  if (hidden === 'opened') {
    closeThreatRegister();
    carried = threatId;
  }
  if (hidden === 'refused') {
    closeOnto('refusal');
  }
}

/** A choice carried across a covering register's automatic close. */
export function carriedChoice(): ThreatId | undefined {
  return carried;
}

/** Commits the close before restoring focus to the editor, opener or canvas. */
export function closeThreatRegister(): void {
  closeOnto('summary');
}

/** Opens model metadata from the register and focuses its title after the register closes. */
export function detailsFromThreatRegister(): void {
  flushSync(() => {
    dispatch(Action.ShowModelPanel());
  });
  flushSync(() => {
    showModelDetails();
  });
  closeOnto('details');
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

/** A newly mounted register takes a pending focus request before this returns its removal. */
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

/** Clears both the open register and any carried row choice. */
export function resetThreatRegister(): void {
  leaveThreatRegister();
  carried = undefined;
}

function closeOnto(on: ListFocus): void {
  const returning = opener;
  flushSync(() => {
    leaveThreatRegister();
    if (on === 'refusal') {
      showModelThreats();
    }
  });
  if (focusModelPanel(on)) {
    return;
  }
  if (returning?.isConnected === true) {
    returning.focus();
  } else {
    focusCanvas();
  }
}

function moveTo(next: boolean): void {
  open = next;
  registerStore.notify();
}
