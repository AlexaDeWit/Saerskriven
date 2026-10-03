import type { ElementId } from '@saerskriven/model';
import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { drawnElement } from './edits.js';
import { placementClickDistance, pointerDistance } from './elements.js';
import { currentTool } from './tools.js';

/** How soon, in milliseconds, a second press must follow the first to make a double-click: the common platform default. */
export const doublePressInterval = 500;

/** Every pane floating over the canvas: the threat or model panel, and the cards and editors of the selection. */
export const paneSelector = '[data-pane]';

type Press = {
  readonly timeStamp: number;
  readonly x: number;
  readonly y: number;
};

type Pointer = Pick<PointerEvent, 'timeStamp' | 'clientX' | 'clientY'>;

/**
 * Whether `second` follows the press `first` recorded soon enough, and moves
 * less than a click may, to be the second press of a double-click.
 */
export function secondPressOf(first: Press, second: Pointer): boolean {
  return (
    second.timeStamp - first.timeStamp < doublePressInterval &&
    pointerDistance(second, first) < placementClickDistance
  );
}

/**
 * Keeps the second press of a double-click on an element out of a pane that
 * the first press opened over the element. Only a primary button press in the
 * select tool counts. That press and the pointer click it makes stop at the
 * canvas, so no control of the pane acts on them, and the click hands back
 * the element whose text the double-click edits. A cancelled press, a blurred
 * window or a click with no pointer behind it, such as a keyboard activation,
 * lets the shield go.
 */
export function usePaneShield(elements: ReadonlyMap<string, ElementId>) {
  const pressed = useRef<
    { readonly press: Press; readonly element: ElementId } | undefined
  >(undefined);
  const shielded = useRef<ElementId | undefined>(undefined);

  const cancel = useCallback(() => {
    pressed.current = undefined;
    shielded.current = undefined;
  }, []);

  useEffect(() => {
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('blur', cancel);
    };
  }, [cancel]);

  return {
    cancel,
    pointerDown(event: PointerEvent<HTMLElement>): boolean {
      const first = pressed.current;
      cancel();
      if (
        !event.isPrimary ||
        event.button !== 0 ||
        currentTool().active !== 'select' ||
        !(event.target instanceof Element)
      ) {
        return false;
      }
      const inPane = event.target.closest(paneSelector) !== null;
      if (inPane && first !== undefined && secondPressOf(first.press, event)) {
        event.preventDefault();
        event.stopPropagation();
        shielded.current = first.element;
        return true;
      }
      const element = inPane ? undefined : drawnElement(event.target, elements);
      if (element !== undefined) {
        const press = {
          timeStamp: event.timeStamp,
          x: event.clientX,
          y: event.clientY,
        };
        pressed.current = { press, element };
      }
      return false;
    },
    click(event: MouseEvent<HTMLElement>): ElementId | undefined {
      const element = shielded.current;
      shielded.current = undefined;
      if (element === undefined || event.detail === 0) {
        return undefined;
      }
      event.preventDefault();
      event.stopPropagation();
      return element;
    },
  };
}
