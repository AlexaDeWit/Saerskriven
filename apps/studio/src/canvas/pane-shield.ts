import type { ElementId } from '@saerskriven/model';
import { useRef, type MouseEvent, type PointerEvent } from 'react';
import { drawnElement } from './edits.js';
import { placementClickDistance } from './elements.js';

/** How soon, in milliseconds, a second press must follow the first to make a double-click: the common platform default. */
export const doublePressInterval = 500;

type Press = Pick<PointerEvent, 'timeStamp' | 'clientX' | 'clientY'>;

/**
 * Whether `second` follows `first` soon enough, and moves less than a click
 * may, to be the second press of a double-click.
 */
export function secondPressOf(first: Press, second: Press): boolean {
  return (
    second.timeStamp - first.timeStamp < doublePressInterval &&
    Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY) <
      placementClickDistance
  );
}

/**
 * Keeps the second press of a double-click on an element out of a pane that
 * the first press opened over the element. That press and the click it makes
 * stop at the canvas, so no control of the pane acts on them, and the click
 * hands back the element whose text the double-click edits.
 */
export function usePaneShield(elements: ReadonlyMap<string, ElementId>) {
  const pressed = useRef<
    { readonly press: Press; readonly element: ElementId } | undefined
  >(undefined);
  const shielded = useRef<ElementId | undefined>(undefined);

  return {
    /** Records a press on an element, or stops a second press landing in a pane and says so. */
    pointerDown(event: PointerEvent<HTMLElement>): boolean {
      const first = pressed.current;
      const inPane =
        event.target instanceof Element &&
        event.target.closest('[data-pane]') !== null;
      shielded.current = undefined;
      pressed.current = undefined;
      if (inPane && first !== undefined && secondPressOf(first.press, event)) {
        event.preventDefault();
        event.stopPropagation();
        shielded.current = first.element;
        return true;
      }
      const element = inPane ? undefined : drawnElement(event.target, elements);
      if (element !== undefined) {
        const { timeStamp, clientX, clientY } = event;
        pressed.current = { press: { timeStamp, clientX, clientY }, element };
      }
      return false;
    },
    /** Stops the click a stopped press makes, and returns the element the double-click edits. */
    click(event: MouseEvent<HTMLElement>): ElementId | undefined {
      const element = shielded.current;
      if (element === undefined) {
        return undefined;
      }
      shielded.current = undefined;
      event.preventDefault();
      event.stopPropagation();
      return element;
    },
  };
}
