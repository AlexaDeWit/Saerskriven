import { useMemo, useRef } from 'react';

type CloseFocusHandlers = {
  readonly onCloseAutoFocus: (event: Event) => void;
  readonly onInteractOutside: () => void;
};

const nowhereElse = (): boolean => false;

const focusMovedOn = (): boolean =>
  document.activeElement !== null && document.activeElement !== document.body;

/**
 * The handlers that keep a closed Radix dropdown from taking focus back to
 * its trigger once focus has moved on, since Radix returns it in a zero-delay
 * timer a shortcut can land in. Where focus has not moved, `elsewhere` may
 * place it and return true to cancel the return. Pass a stable function.
 */
export function useCloseFocus(
  elsewhere: () => boolean = nowhereElse,
): CloseFocusHandlers {
  const interactedOutside = useRef(false);

  return useMemo(
    () => ({
      onCloseAutoFocus: (event: Event) => {
        const outside = interactedOutside.current;
        interactedOutside.current = false;
        if ((!outside && focusMovedOn()) || elsewhere()) {
          event.preventDefault();
        }
      },
      onInteractOutside: () => {
        interactedOutside.current = true;
      },
    }),
    [elsewhere],
  );
}
