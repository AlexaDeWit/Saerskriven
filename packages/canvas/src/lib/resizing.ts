import type { Point, Size } from '@saerskriven/model';
import { boundsOfPoints } from './bounds.js';
import { boxOfPoints, sameCoordinate } from './geometry.js';
import { sameNodeBox, type NodeBox } from './handles.js';
import type { CanvasNode } from './layout.js';
import { boundaryStrokeWidth } from './stylesheet.js';

/** Positions of the four side controls and four corner controls. */
export const resizeControlPositions = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
] as const;

/** One position from which a node can be resized. */
export type ResizeControlPosition = (typeof resizeControlPositions)[number];

/** The minimum model-space width and height of a resized node. */
export const minimumNodeExtent = 10;

/** The model-space distance of one keyboard resize. */
export const keyboardResizeStep = 5;

/** The model-space distance of one shifted keyboard resize. */
export const shiftedKeyboardResizeStep = 20;

/** What a gesture on the canvas is made with: a pointer, which is a mouse, a pen or a touch, or the keyboard. */
export type GestureInput = 'pointer' | 'keyboard';

/** The keys that move an active resize control. */
export const resizeKeys = [
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'ArrowLeft',
] as const;

type ResizeKey = (typeof resizeKeys)[number];

/** Whether `key` is one of the arrow keys in `resizeKeys`. */
export const isResizeKey = (key: string): key is ResizeKey =>
  resizeKeys.some((candidate) => candidate === key);

/**
 * Resizes one edge of `box` by an arrow key while the opposite edge stays
 * fixed. Returns nothing when the key does not apply or the box cannot shrink.
 */
export function resizeBoxByKey(
  box: NodeBox,
  control: ResizeControlPosition,
  key: string,
  step = keyboardResizeStep,
): NodeBox | undefined {
  if (!isResizeKey(key)) {
    return undefined;
  }
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
  const requested = key === 'ArrowLeft' || key === 'ArrowUp' ? -step : step;
  const changed = horizontal
    ? resizeOnHorizontalAxis(box, control, requested)
    : resizeOnVerticalAxis(box, control, requested);
  return changed === undefined || sameNodeBox(changed, box)
    ? undefined
    : changed;
}

/** Keeps the untouched axis of a side resize at its model value. */
export function resizeBoxOnControlAxes(
  box: NodeBox,
  control: ResizeControlPosition,
  resized: NodeBox,
): NodeBox {
  if (control === 'left' || control === 'right') {
    return {
      position: { x: resized.position.x, y: box.position.y },
      size: { width: resized.size.width, height: box.size.height },
    };
  }
  if (control === 'top' || control === 'bottom') {
    return {
      position: { x: box.position.x, y: resized.position.y },
      size: { width: box.size.width, height: resized.size.height },
    };
  }
  return resized;
}

/** Which axes a resize of `node` can stretch: both, but on a boundary curve only those its points span. */
export function resizableAxes(node: CanvasNode): {
  readonly width: boolean;
  readonly height: boolean;
} {
  if (node.kind !== 'boundary-curve') {
    return { width: true, height: true };
  }
  const span = boundsOfPoints(node.waypoints);
  return { width: span.width > 0, height: span.height > 0 };
}

/** The controls that resize `node`: every position, less those that would stretch an axis {@link resizableAxes} leaves out. */
export function resizeControlsOf(
  node: CanvasNode,
): readonly ResizeControlPosition[] {
  const axes = resizableAxes(node);
  return resizeControlPositions.filter(
    (control) =>
      (axes.width || horizontalEdge(control) === undefined) &&
      (axes.height || verticalEdge(control) === undefined),
  );
}

/** `node` drawn at `size`, a boundary curve's points scaled with it in the node's own coordinates. */
export function nodeAtSize(node: CanvasNode, size: Size): CanvasNode {
  return node.kind === 'boundary-curve'
    ? {
        ...node,
        size,
        waypoints: scaledCurvePoints(node.waypoints, {
          position: { x: 0, y: 0 },
          size,
        }),
      }
    : { ...node, size };
}

/**
 * Boundary curve points scaled so the curve laid out from them fills `box`,
 * whose sides the layout places one boundary stroke outside the points. Each
 * point keeps its place across the points' span, and a side that `box` leaves
 * in place keeps its points' exact coordinates. An axis shrinks to
 * `minimumNodeExtent` and no further, or not at all where it already spans
 * less, and an axis the points do not span only moves.
 */
export function scaledCurvePoints(
  points: readonly Point[],
  box: NodeBox,
): Point[] {
  const bounds = boxOfPoints(points);
  if (bounds === undefined) {
    return [];
  }
  const across = scaledAxis(
    { low: bounds.minX, high: bounds.maxX },
    box.position.x,
    box.size.width,
  );
  const down = scaledAxis(
    { low: bounds.minY, high: bounds.maxY },
    box.position.y,
    box.size.height,
  );
  return points.map((point) => ({ x: across(point.x), y: down(point.y) }));
}

function scaledAxis(
  { low, high }: { readonly low: number; readonly high: number },
  boxStart: number,
  boxExtent: number,
): (value: number) => number {
  const margin = boundaryStrokeWidth;
  const span = high - low;
  const current = span + margin * 2;
  const keepsStart = sameCoordinate(boxStart, low - margin);
  const keepsEnd = sameCoordinate(boxStart + boxExtent, low - margin + current);
  if (keepsStart && keepsEnd) {
    return (value) => value;
  }
  const extent =
    Math.max(boxExtent, Math.min(current, minimumNodeExtent)) - margin * 2;
  const factor = span === 0 ? 1 : extent / span;
  if (keepsStart) {
    return (value) => low + (value - low) * factor;
  }
  if (keepsEnd) {
    return (value) => high - (high - value) * factor;
  }
  return (value) => boxStart + margin + (value - low) * factor;
}

function resizeOnHorizontalAxis(
  box: NodeBox,
  control: ResizeControlPosition,
  requested: number,
): NodeBox | undefined {
  const edge = horizontalEdge(control);
  return edge === undefined
    ? undefined
    : resizeHorizontal(box, edge, requested);
}

function resizeOnVerticalAxis(
  box: NodeBox,
  control: ResizeControlPosition,
  requested: number,
): NodeBox | undefined {
  const edge = verticalEdge(control);
  return edge === undefined ? undefined : resizeVertical(box, edge, requested);
}

function horizontalEdge(
  control: ResizeControlPosition,
): 'left' | 'right' | undefined {
  if (control.includes('left')) {
    return 'left';
  }
  return control.includes('right') ? 'right' : undefined;
}

function verticalEdge(
  control: ResizeControlPosition,
): 'top' | 'bottom' | undefined {
  if (control.includes('top')) {
    return 'top';
  }
  return control.includes('bottom') ? 'bottom' : undefined;
}

function resizeHorizontal(
  box: NodeBox,
  edge: 'left' | 'right',
  requested: number,
): NodeBox {
  if (edge === 'left') {
    const moved = Math.min(requested, box.size.width - minimumNodeExtent);
    return {
      position: { ...box.position, x: box.position.x + moved },
      size: { ...box.size, width: box.size.width - moved },
    };
  }
  const moved = Math.max(requested, minimumNodeExtent - box.size.width);
  return {
    position: box.position,
    size: { ...box.size, width: box.size.width + moved },
  };
}

function resizeVertical(
  box: NodeBox,
  edge: 'top' | 'bottom',
  requested: number,
): NodeBox {
  if (edge === 'top') {
    const moved = Math.min(requested, box.size.height - minimumNodeExtent);
    return {
      position: { ...box.position, y: box.position.y + moved },
      size: { ...box.size, height: box.size.height - moved },
    };
  }
  const moved = Math.max(requested, minimumNodeExtent - box.size.height);
  return {
    position: box.position,
    size: { ...box.size, height: box.size.height + moved },
  };
}
