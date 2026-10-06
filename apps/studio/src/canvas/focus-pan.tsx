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
import { paintFlowFocusRing } from './flow-focus-paint.js';
import { followKeyboardMoves, type KeyboardMove } from './keyboard-moves.js';
import { selectionRectangleSelector } from './selection-frame.js';

/** Duration in milliseconds. */
export const focusPanDuration = 500;

/** Inset from a crossed viewport edge, in screen pixels. */
export const ringMargin = 4;

export type PannedView = Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>;

const handleSelector = '[data-bend-index], [data-flow-end], [data-curve-point]';

const ringedSelector = `${drawnSelector}, .react-flow__resize-control > button, ${handleSelector}`;

const movedSelector = `${ringedSelector}, ${selectionRectangleSelector}`;

/** Safari's Alt+Tab arms the pan too. */
export function armsFocusPan(event: KeyboardEvent): boolean {
  return event.key === 'Tab' && !event.ctrlKey && !event.metaKey;
}

/** Crossed edges retain `ringMargin`. An oversized ring fills the viewport with the least move. */
export function offsetIntoView(ring: Box, viewport: Box): Point | undefined {
  const offset = {
    x: shiftInto(ring.minX, ring.maxX, viewport.minX, viewport.maxX),
    y: shiftInto(ring.minY, ring.maxY, viewport.minY, viewport.maxY),
  };
  return offset.x === 0 && offset.y === 0 ? undefined : offset;
}

/** A new target cancels an unfinished pan, including when the target already fits. Repeated arrow keys move at once. */
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
 * Tab controls modality because Chromium retains `:focus-visible` after pointer-first script focus.
 * Pointer presses disarm the pan. Focus returning from another window does not pan.
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

/** The caller distinguishes keyboard moves from pointer moves. Callbacks run on the next frame and carry key-repeat state. */
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

/** Mounted inside `ReactFlow`. Pans keyboard focus and movement using the current viewport and ring extent. */
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
  if (
    target instanceof SVGGraphicsElement &&
    target.matches('.react-flow__edge')
  ) {
    const painted = paintFlowFocusRing(target);
    if (painted !== undefined) {
      return painted;
    }
  }
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
