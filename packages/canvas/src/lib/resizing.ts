import type { Point, Size } from '@saerskriven/model';
import { boundsOfPoints } from './bounds.js';
import { boxOfPoints, sameCoordinate } from './geometry.js';
import { sameNodeBox, type NodeBox } from './handles.js';
import type { CanvasNode } from './layout.js';
import { boundaryStrokeWidth } from './stylesheet.js';

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

export type ResizeControlPosition = (typeof resizeControlPositions)[number];

/** The extent at which resize controls stop shrinking a larger node. */
export const minimumNodeExtent = 10;

export const keyboardResizeStep = 5;

export const shiftedKeyboardResizeStep = 20;

/** The resize floor, preserving an extent already below {@link minimumNodeExtent}. */
export const minimumResizeExtent = (current: number): number =>
  Math.min(current, minimumNodeExtent);

/** Pointer input includes mouse, pen and touch. */
export type GestureInput = 'pointer' | 'keyboard';

export const resizeKeys = [
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'ArrowLeft',
] as const;

type ResizeKey = (typeof resizeKeys)[number];

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

/** Applies measured resize deltas to the model box, preserving its fractional extents. */
export function resizeBoxFromMeasurement(
  box: NodeBox,
  control: ResizeControlPosition,
  measured: Size,
  resized: Size,
): NodeBox {
  const horizontal = horizontalEdge(control);
  const vertical = verticalEdge(control);
  const widthChange = resized.width - measured.width;
  const heightChange = resized.height - measured.height;
  const across =
    horizontal === undefined
      ? box
      : resizeHorizontal(
          box,
          horizontal,
          horizontal === 'left' ? -widthChange : widthChange,
        );
  return vertical === undefined
    ? across
    : resizeVertical(
        across,
        vertical,
        vertical === 'top' ? -heightChange : heightChange,
      );
}

/** Boundary curves stretch only axes their points span. */
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

/** Omits controls that stretch an axis {@link resizableAxes} leaves out. */
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

/** Scales a boundary curve's local points with its size. */
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
 * Scales points into `box`, allowing for the boundary stroke and
 * {@link minimumResizeExtent}. Keeps coordinates exact on a fixed side.
 * An axis the points do not span only moves.
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
  const extent = Math.max(boxExtent, minimumResizeExtent(current)) - margin * 2;
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
    const moved = Math.min(
      requested,
      box.size.width - minimumResizeExtent(box.size.width),
    );
    return {
      position: { ...box.position, x: box.position.x + moved },
      size: { ...box.size, width: box.size.width - moved },
    };
  }
  const moved = Math.max(
    requested,
    minimumResizeExtent(box.size.width) - box.size.width,
  );
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
    const moved = Math.min(
      requested,
      box.size.height - minimumResizeExtent(box.size.height),
    );
    return {
      position: { ...box.position, y: box.position.y + moved },
      size: { ...box.size, height: box.size.height - moved },
    };
  }
  const moved = Math.max(
    requested,
    minimumResizeExtent(box.size.height) - box.size.height,
  );
  return {
    position: box.position,
    size: { ...box.size, height: box.size.height + moved },
  };
}
