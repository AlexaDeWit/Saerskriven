let take: (() => boolean) | undefined;

let modelPropertiesRequested = false;

let focusTitle: (() => void) | undefined;

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
 * Notes that the model's properties were just opened on request, so the menu
 * that ran the command hands focus to their Title as it closes rather than
 * back to its own button.
 */
export function requestModelPropertiesFocus(): void {
  modelPropertiesRequested = true;
}

/** Registers what focuses the model properties' Title while the panel is mounted, and hands back the removal. */
export function modelPropertiesFocusHandler(handler: () => void): () => void {
  focusTitle = handler;
  return () => {
    if (focusTitle === handler) {
      focusTitle = undefined;
    }
  };
}

/**
 * Focuses the model properties' Title where a request is pending and the
 * panel is mounted, and reports whether it did. The request is spent either
 * way, so a later menu close leaves focus to the menu.
 */
export function focusRequestedModelProperties(): boolean {
  const requested = modelPropertiesRequested;
  modelPropertiesRequested = false;
  if (!requested || focusTitle === undefined) {
    return false;
  }
  focusTitle();
  return true;
}
