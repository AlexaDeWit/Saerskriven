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
import { selectionRectangleSelector } from './selection-frame.js';

/** How long the pan takes, in milliseconds, so the eye can follow the view moving. */
export const focusPanDuration = 500;

/** How far inside the viewport's border the pan leaves a ring, in screen pixels, so the whole ring is drawn clear of the edge. */
export const ringMargin = 4;

export type PannedView = Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>;

const handleSelector = '[data-bend-index], [data-flow-end], [data-curve-point]';

const ringedSelector = `${drawnSelector}, .react-flow__resize-control > button, ${handleSelector}`;

const movedSelector = `${ringedSelector}, ${selectionRectangleSelector}`;

/** Tab, including Shift or Alt, arms focus panning until the next pointer press. */
export function armsFocusPan(event: KeyboardEvent): boolean {
  return event.key === 'Tab' && !event.ctrlKey && !event.metaKey;
}

/** Finds the least pan that clears a ring past the viewport border. Oversized rings fill the viewport. */
export function offsetIntoView(ring: Box, viewport: Box): Point | undefined {
  const offset = {
    x: shiftInto(ring.minX, ring.maxX, viewport.minX, viewport.maxX),
    y: shiftInto(ring.minY, ring.maxY, viewport.minY, viewport.maxY),
  };
  return offset.x === 0 && offset.y === 0 ? undefined : offset;
}

/** Preserves zoom and replaces an active pan. Reduced motion and held keys move at once. */
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
 * Follows visible keyboard focus after one frame, excluding window restoration.
 * Pointer-first script focus preserves `:focus-visible` in Chromium but clears it in Playwright WebKit.
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

/** Measures keyboard moves on the next frame, using the focused item or a placed bend. Returns a stop function. */
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

/** Follows keyboard focus, moves, and resizes inside a React Flow provider. Overlays do not reduce the viewport. */
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
