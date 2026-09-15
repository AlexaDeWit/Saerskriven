import { focusCanvas } from '../canvas/edits.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';

let take: (() => boolean) | undefined;

let titleRequested = false;

/**
 * Registers what moves focus into the threat panel, and hands back the
 * removal. The overlay registers itself while it is mounted, so the canvas
 * can offer a key press to the panel without holding a reference to it.
 */
export function panelFocusHandler(handler: () => boolean): () => void {
  take = handler;
  return () => {
    if (take === handler) {
      take = undefined;
    }
  };
}

/**
 * Moves focus into the threat panel, opening it again where Escape closed it,
 * and reports whether there was a panel to take it. The registered command
 * calls this channel because focus does not belong in the model store.
 */
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
