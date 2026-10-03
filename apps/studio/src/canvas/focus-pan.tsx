import type { Box } from '@saerskriven/canvas';
import type { Point, Size } from '@saerskriven/model';
import {
  useReactFlow,
  useStore,
  type ReactFlowInstance,
  type Viewport,
} from '@xyflow/react';
import { useEffect } from 'react';
import { drawnSelector } from './edits.js';
import { paneSelector } from './pane-shield.js';

/** How long the pan takes, in milliseconds, so the eye can follow the view moving. */
export const focusPanDuration = 500;

/** How far clear of every pane the pan leaves a ring, in screen pixels, so the ring and the pane's border read as two lines. */
export const ringClearance = 4;

/** A focused item's ring, the panes over the canvas and the canvas itself, as boxes on screen. */
export type FocusScene = {
  readonly ring: Box;
  readonly panes: readonly Box[];
  readonly canvas: Box;
};

/** What the pan reads the view from and moves it through. */
export type PannedView = Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>;

const ringedSelector = `${drawnSelector}, .react-flow__resize-control > button`;

/**
 * The shortest move that puts a ring some pane covers inside the canvas and
 * `ringClearance` clear of every pane. Nothing while no pane covers the ring,
 * a shared edge not counting, and nothing where the ring fits nowhere clear.
 */
export function clearingOffset({
  ring,
  panes,
  canvas,
}: FocusScene): Point | undefined {
  const size = { width: ring.maxX - ring.minX, height: ring.maxY - ring.minY };
  const from = { x: ring.minX, y: ring.minY };
  if (!blocked(cornersUnder(panes, size, 0), from)) {
    return undefined;
  }
  const zones = cornersUnder(panes, size, ringClearance);
  const room = {
    minX: canvas.minX,
    minY: canvas.minY,
    maxX: canvas.maxX - size.width,
    maxY: canvas.maxY - size.height,
  };
  const columns = [from.x, room.minX, room.maxX].concat(
    zones.flatMap((zone) => [zone.minX, zone.maxX]),
  );
  const rows = [from.y, room.minY, room.maxY].concat(
    zones.flatMap((zone) => [zone.minY, zone.maxY]),
  );
  return columns
    .flatMap((x) => rows.map((y) => ({ x, y })))
    .filter((corner) => holds(room, corner) && !blocked(zones, corner))
    .map((corner) => ({ x: corner.x - from.x, y: corner.y - from.y }))
    .reduce<Point | undefined>(
      (nearest, offset) =>
        nearest === undefined || lengthOf(offset) < lengthOf(nearest)
          ? offset
          : nearest,
      undefined,
    );
}

/**
 * Answers the pan for one canvas: handed the scene keyboard focus landed in,
 * it moves `view` by the scene's clearing offset from where the view is at
 * that moment, at the same zoom, over `focusPanDuration`, or at once where
 * `instant` says so. A scene with no offset stops a pan still on its way, so
 * the view rests where the newest focus was measured.
 */
export function focusPanner(
  view: PannedView,
  instant: () => boolean,
): (scene: FocusScene) => void {
  let heading: Viewport | undefined;
  return (scene) => {
    const offset = clearingOffset(scene);
    const live = view.getViewport();
    const underWay =
      heading !== undefined && (heading.x !== live.x || heading.y !== live.y);
    heading = undefined;
    if (offset !== undefined) {
      heading = { x: live.x + offset.x, y: live.y + offset.y, zoom: live.zoom };
      void view.setViewport(heading, {
        duration: instant() ? 0 : focusPanDuration,
        interpolate: 'linear',
      });
    } else if (underWay) {
      void view.setViewport(live);
    }
  };
}

/**
 * Calls `landed` with each drawn element, flow or resize control inside
 * `surface` that focus moves to showing its ring, which is the browser's
 * `:focus-visible` judgement, so a click, a press or a tap never calls it.
 * The call waits for the next frame, when a pane the same key press opened
 * or closed is in place, and is dropped if focus has moved on by then. Focus
 * the browser hands back to the item that held it when the window lost focus
 * is no move. Answers the function that stops listening.
 */
export function onKeyboardFocus(
  surface: HTMLElement,
  landed: (target: Element) => void,
): () => void {
  let heldByWindow: Element | null = null;
  let settling = 0;
  const windowBlurred = (): void => {
    heldByWindow = document.activeElement;
  };
  const focused = ({ target }: FocusEvent): void => {
    const handedBack = target === heldByWindow;
    heldByWindow = null;
    cancelAnimationFrame(settling);
    if (handedBack || !(target instanceof Element) || !showsRing(target)) {
      return;
    }
    settling = requestAnimationFrame(() => {
      if (showsRing(target)) {
        landed(target);
      }
    });
  };
  window.addEventListener('blur', windowBlurred);
  surface.addEventListener('focusin', focused);
  return () => {
    cancelAnimationFrame(settling);
    window.removeEventListener('blur', windowBlurred);
    surface.removeEventListener('focusin', focused);
  };
}

/**
 * Pans the canvas the least that shows the whole focus ring of the item
 * keyboard focus lands on, where a pane covers any of it. Mounted inside
 * `ReactFlow`, where its store is in reach.
 */
export function FocusPan(): null {
  const flow = useReactFlow();
  const surface = useStore((state) => state.domNode);

  useEffect(() => {
    if (surface === null) {
      return undefined;
    }
    const pan = focusPanner(flow, prefersReducedMotion);
    return onKeyboardFocus(surface, (target) => {
      pan({
        ring: ringOf(target, flow.getZoom()),
        panes: [...document.querySelectorAll(paneSelector)].map(boxOf),
        canvas: boxOf(surface),
      });
    });
  }, [flow, surface]);

  return null;
}

function showsRing(target: Element): boolean {
  return target.matches(ringedSelector) && target.matches(':focus-visible');
}

function cornersUnder(
  panes: readonly Box[],
  ring: Size,
  clearance: number,
): Box[] {
  return panes.map((pane) => ({
    minX: pane.minX - ring.width - clearance,
    minY: pane.minY - ring.height - clearance,
    maxX: pane.maxX + clearance,
    maxY: pane.maxY + clearance,
  }));
}

function blocked(zones: readonly Box[], corner: Point): boolean {
  return zones.some(
    (zone) =>
      zone.minX < corner.x &&
      corner.x < zone.maxX &&
      zone.minY < corner.y &&
      corner.y < zone.maxY,
  );
}

function holds(room: Box, corner: Point): boolean {
  return (
    room.minX <= corner.x &&
    corner.x <= room.maxX &&
    room.minY <= corner.y &&
    corner.y <= room.maxY
  );
}

function lengthOf(offset: Point): number {
  return Math.hypot(offset.x, offset.y);
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
    Math.max(
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
