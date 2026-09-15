import { useMemo, useRef } from 'react';

/** The two handlers {@link useCloseFocus} hands a Radix dropdown's content. */
export type CloseFocusHandlers = {
  readonly onCloseAutoFocus: (event: Event) => void;
  readonly onInteractOutside: () => void;
};

const nowhereElse = (): boolean => false;

const focusMovedOn = (): boolean =>
  document.activeElement !== null && document.activeElement !== document.body;

/**
 * Keeps a closed dropdown from taking focus back to its trigger once focus
 * has moved on. Radix returns focus in a zero-delay timer after the content
 * unmounts, so a shortcut pressed in that gap can move focus into a control
 * that the return then takes it from. A close that follows a pointer press or
 * focus outside the content is left to Radix, which skips the return itself.
 * Where focus has not moved on, `elsewhere` may place it and return true to
 * cancel the return. Pass a stable function.
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
