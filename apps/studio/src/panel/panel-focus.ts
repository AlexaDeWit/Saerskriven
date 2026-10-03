import type { ThreatId } from '@saerskriven/model';
import { focusCanvas } from '../canvas/edits.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';

/** A threat asked for on the model panel, and what to call once the list has opened it. */
export type ThreatRequest = {
  readonly threatId: ThreatId;
  readonly opened: () => void;
};

/** What the mounted model panel's threat list answers to from outside it. */
export type ModelList = {
  readonly open: (request: ThreatRequest) => void;
  readonly focus: () => void;
};

let take: (() => boolean) | undefined;

let focusRequested = false;

let historyStep: (() => () => void) | undefined;

let modelList: ModelList | undefined;

let arriving: ThreatRequest | undefined;

/** Registers what moves focus into the mounted threat panel, and returns the removal. */
export function panelFocusHandler(handler: () => boolean): () => void {
  take = handler;
  return () => {
    if (take === handler) {
      take = undefined;
    }
  };
}

/** Moves focus into the threat panel, reopening it where Escape closed it, and answers whether a panel took it. */
export function focusThreatPanel(): boolean {
  return take?.() ?? false;
}

/**
 * Opens the model panel on its Threats tab with focus on that tab, clearing
 * the canvas selection, or closes it with focus on the canvas where it
 * already shows.
 */
export function toggleModelPanel(): void {
  if (modelStore.getState().modelPanel) {
    hideModelPanel();
    return;
  }
  focusRequested = true;
  dispatch(Action.ShowModelPanel());
}

/** Closes the model panel and hands focus to the canvas. */
export function hideModelPanel(): void {
  dispatch(Action.HideModelPanel());
  focusCanvas();
}

/** Focuses the Threats tab through `focusTab` where {@link toggleModelPanel} opened the panel now mounting. */
export function takeModelPanelFocus(focusTab: () => void): void {
  if (focusRequested) {
    focusRequested = false;
    focusTab();
  }
}

/** Registers the mounted model panel's threat list, and returns the removal. */
export function modelListHandler(handler: ModelList): () => void {
  modelList = handler;
  return () => {
    if (modelList === handler) {
      modelList = undefined;
    }
  };
}

/**
 * Opens a threat on the model panel's Threats tab, showing the panel where it
 * is hidden, which clears the selection. The list calls `opened` once it has
 * opened the threat, and never where a refused draft holds another open.
 */
export function openInModelPanel(request: ThreatRequest): void {
  if (modelStore.getState().modelPanel && modelList !== undefined) {
    modelList.open(request);
    return;
  }
  arriving = request;
  dispatch(Action.ShowModelPanel());
}

/** The request {@link openInModelPanel} left for the model panel's list to take as it mounts. */
export function arrivingThreat(): ThreatRequest | undefined {
  return arriving;
}

/** Forgets the request the mounting list has taken. */
export function settleArrivingThreat(): void {
  arriving = undefined;
}

/** Moves focus into the model panel where it shows, and answers whether it did. */
export function focusModelPanel(): boolean {
  if (!modelStore.getState().modelPanel || modelList === undefined) {
    return false;
  }
  modelList.focus();
  return true;
}

/** Registers the threat panel's look at focus before an undo or redo, which returns how to settle it after. Returns the removal. */
export function historyFocusHandler(handler: () => () => void): () => void {
  historyStep = handler;
  return () => {
    if (historyStep === handler) {
      historyStep = undefined;
    }
  };
}

/** Runs an undo or redo step between the mounted threat panel's two looks at focus. */
export function stepHistory(step: () => void): void {
  const settle = historyStep?.();
  step();
  settle?.();
}
