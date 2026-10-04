import type { Box } from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
import {
  useReactFlow,
  useStore,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import { useEffect } from 'react';
import { drawnSelector } from './edits.js';
import { followKeyboardMoves, type KeyboardMove } from './keyboard-moves.js';
import { selectionFrameSelector } from './move-message.js';

/** How long the pan takes, in milliseconds, so the eye can follow the view moving. */
export const focusPanDuration = 500;

/** How far inside the viewport's border the pan leaves a ring, in screen pixels, so the whole ring is drawn clear of the edge. */
export const ringMargin = 4;

/** What the pan reads the view from and moves it through. */
export type PannedView = Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>;

const handleSelector = '[data-bend-index], [data-flow-end], [data-curve-point]';

const ringedSelector = `${drawnSelector}, .react-flow__resize-control > button, ${handleSelector}`;

const movedSelector = `${ringedSelector}, ${selectionFrameSelector}`;

/**
 * Whether a key press puts the keyboard in charge of where focus goes, which
 * it stays until the next pointer press: Tab, with Shift or without, and with
 * Alt, the chord that reaches every item in Safari.
 */
export function armsFocusPan(event: KeyboardEvent): boolean {
  return event.key === 'Tab' && !event.ctrlKey && !event.metaKey;
}

/**
 * The shortest move that brings a ring into the viewport, the canvas's own
 * box on screen, where any of it lies outside: on each axis the ring ends
 * `ringMargin` inside the border it had crossed. Nothing for a ring wholly
 * inside, whatever is drawn over it there. A ring too long for the viewport
 * on an axis moves the least that fills the viewport with it, its nearer end
 * at the border, and not at all once it spans the viewport.
 */
export function offsetIntoView(ring: Box, viewport: Box): Point | undefined {
  const offset = {
    x: shiftInto(ring.minX, ring.maxX, viewport.minX, viewport.maxX),
    y: shiftInto(ring.minY, ring.maxY, viewport.minY, viewport.maxY),
  };
  return offset.x === 0 && offset.y === 0 ? undefined : offset;
}

/**
 * Answers the pan for one canvas: handed an offset, it moves `view` by it
 * from where the view is at that moment, at the same zoom, over
 * `focusPanDuration`, or at once where `instant` says so or the call asks
 * for it, as the follow of a held arrow key does to keep up. No offset stops
 * a pan still on its way, so the view rests where the newest item was
 * measured. A pan is on its way until `view` answers that it arrived.
 */
export function viewPanner(
  view: PannedView,
  instant: () => boolean,
): (offset: Point | undefined, atOnce?: boolean) => void {
  let heading: Viewport | undefined;
  const headFor = async (arriving: Viewport, duration: number) => {
    heading = arriving;
    await view.setViewport(arriving, { duration, interpolate: 'linear' });
    if (heading === arriving) {
      heading = undefined;
    }
  };
  return (offset, atOnce = false) => {
    const live = view.getViewport();
    const underWay =
      heading !== undefined && (heading.x !== live.x || heading.y !== live.y);
    heading = undefined;
    if (offset !== undefined) {
      void headFor(
        { x: live.x + offset.x, y: live.y + offset.y, zoom: live.zoom },
        atOnce || instant() ? 0 : focusPanDuration,
      );
    } else if (underWay) {
      void view.setViewport(live);
    }
  };
}

/**
 * Calls `landed` with each drawn element, flow, resize control, or bend,
 * flow end or curve point handle inside `surface` that focus moves to
 * showing its ring while the keyboard is in charge: from a key press
 * `armsFocusPan` answers until the next pointer press. `:focus-visible` alone
 * is no keyboard test, since Chromium and Safari keep it for a script focus
 * that follows any earlier key press, as a flow drawn by pointer is focused.
 * The call waits for the next frame, when what the key press changed is
 * drawn, and is dropped if focus has moved on by then. Focus the browser
 * hands back to the item that held it when the window lost focus is no move,
 * until a key arms again. Answers the function that stops listening.
 */
export function onKeyboardFocus(
  surface: HTMLElement,
  landed: (target: Element) => void,
): () => void {
  let keyboardInCharge = false;
  let heldByWindow: Element | null = null;
  let settling = 0;
  const keyed = (event: KeyboardEvent): void => {
    if (armsFocusPan(event)) {
      keyboardInCharge = true;
      heldByWindow = null;
    }
  };
  const pressed = (): void => {
    keyboardInCharge = false;
  };
  const windowBlurred = (): void => {
    heldByWindow = document.activeElement;
  };
  const moves = (target: EventTarget | null): target is Element =>
    keyboardInCharge &&
    target instanceof Element &&
    target.matches(ringedSelector) &&
    target.matches(':focus-visible');
  const focused = ({ target }: FocusEvent): void => {
    const handedBack = target === heldByWindow;
    heldByWindow = null;
    cancelAnimationFrame(settling);
    if (handedBack || !moves(target)) {
      return;
    }
    settling = requestAnimationFrame(() => {
      if (moves(target)) {
        landed(target);
      }
    });
  };
  window.addEventListener('keydown', keyed, true);
  window.addEventListener('pointerdown', pressed, true);
  window.addEventListener('blur', windowBlurred);
  surface.addEventListener('focusin', focused);
  return () => {
    cancelAnimationFrame(settling);
    window.removeEventListener('keydown', keyed, true);
    window.removeEventListener('pointerdown', pressed, true);
    window.removeEventListener('blur', windowBlurred);
    surface.removeEventListener('focusin', focused);
  };
}

/**
 * Calls `moved` with what a key press moved or resized inside `surface`, each
 * time `keyboardMoved` says one did, with no Tab press needed first: whatever
 * holds focus (the drawn element, the resize control, a bend, flow end or
 * curve point handle, or the frame around a box selection, whose box is the
 * whole group's), or the bend being placed, which is measured itself while
 * the route toolbar holds focus. It tells no key press from a pointer: the
 * caller does. The call comes on the next frame, when the move is drawn, and
 * says whether the last key press was a repeat. Answers the function that
 * stops listening.
 */
export function onKeyboardMove(
  surface: HTMLElement,
  moved: (target: Element, held: boolean) => void,
): () => void {
  let keyHeld = false;
  let settling = 0;
  const keyed = (event: KeyboardEvent): void => {
    keyHeld = event.repeat;
  };
  const release = followKeyboardMoves((item) => {
    const held = keyHeld;
    cancelAnimationFrame(settling);
    settling = requestAnimationFrame(() => {
      const target = movedItem(surface, item);
      if (target !== null) {
        moved(target, held);
      }
    });
  });
  window.addEventListener('keydown', keyed, true);
  return () => {
    cancelAnimationFrame(settling);
    window.removeEventListener('keydown', keyed, true);
    release();
  };
}

/**
 * Pans the canvas the least that brings the focused item's ring into the
 * viewport, where Tab puts focus on an item outside it or an arrow key moves
 * or resizes the focused item, or the box selection, out of it, and the
 * least that brings in a bend an arrow key moves out of it while it is being
 * placed. What lies over the canvas plays no part. Mounted inside
 * `ReactFlow`, where its store is in reach.
 */
export function FocusPan(): null {
  const flow = useReactFlow();
  const surface = useStore((state) => state.domNode);

  useEffect(() => {
    if (surface === null) {
      return undefined;
    }
    const pan = viewPanner(flow, prefersReducedMotion);
    const bringIn = (target: Element, atOnce = false): void => {
      pan(
        offsetIntoView(ringOf(target, flow.getZoom()), boxOf(surface)),
        atOnce,
      );
    };
    const stopFocus = onKeyboardFocus(surface, bringIn);
    const stopMoves = onKeyboardMove(surface, bringIn);
    return () => {
      stopFocus();
      stopMoves();
    };
  }, [flow, surface]);

  return null;
}

function shiftInto(
  from: number,
  to: number,
  low: number,
  high: number,
): number {
  if (from >= low && to <= high) {
    return 0;
  }
  const near = low + ringMargin;
  const far = high - ringMargin;
  if (to - from > far - near) {
    return from > near ? near - from : to < far ? far - to : 0;
  }
  return from < low ? near - from : far - to;
}

function movedItem(surface: HTMLElement, moved: KeyboardMove): Element | null {
  if (moved !== 'focused') {
    return surface.querySelector(
      `[data-bend-index="${String(moved.placedBend)}"]`,
    );
  }
  const focused = document.activeElement;
  return focused !== null &&
    surface.contains(focused) &&
    focused.matches(movedSelector)
    ? focused
    : null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function boxOf(drawn: Element): Box {
  const { left, top, right, bottom } = drawn.getBoundingClientRect();
  return { minX: left, minY: top, maxX: right, maxY: bottom };
}

function ringOf(target: Element, zoom: number): Box {
  const drawn = boxOf(target);
  const style = getComputedStyle(target);
  const scale =
    target instanceof HTMLElement && target.offsetWidth > 0
      ? (drawn.maxX - drawn.minX) / target.offsetWidth
      : zoom;
  const reach =
    style.outlineStyle === 'none'
      ? 0
      : Math.max(
          Number.parseFloat(style.outlineOffset) +
            Number.parseFloat(style.outlineWidth),
          0,
        ) * scale;
  return {
    minX: drawn.minX - reach,
    minY: drawn.minY - reach,
    maxX: drawn.maxX + reach,
    maxY: drawn.maxY + reach,
  };
}
