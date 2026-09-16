import { focusCanvas } from '../canvas/edits.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';

let take: (() => boolean) | undefined;

let titleRequested = false;

let historyStep: (() => () => void) | undefined;

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
 * Opens the model's properties with focus in their Title, clearing the canvas
 * selection, or closes them with focus on the canvas where they already show.
 */
export function toggleModelProperties(): void {
  if (modelStore.getState().modelProperties) {
    hideModelProperties();
    return;
  }
  titleRequested = true;
  dispatch(Action.ShowModelProperties());
}

/** Closes the model's properties and hands focus to the canvas. */
export function hideModelProperties(): void {
  dispatch(Action.HideModelProperties());
  focusCanvas();
}

/** Focuses the Title through `focusTitle` where {@link toggleModelProperties} opened the panel now mounting. */
export function takeModelPropertiesFocus(focusTitle: () => void): void {
  if (titleRequested) {
    titleRequested = false;
    focusTitle();
  }
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
