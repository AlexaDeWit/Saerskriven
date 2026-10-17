import {
  storedPoint,
  storedPoints,
  storedSize,
  type Decimals,
} from './decimals.js';
import type {
  DrawnElement,
  DrawnFlow,
  DrawnFlowEndpoint,
} from './drawn-elements.js';
import type { Point, Size } from './geometry.js';
import { sameItems } from './lists.js';
import type { BoundaryShape } from './placements.js';

const origin: Point = { x: 0, y: 0 };

/**
 * Translates element geometry while attached endpoints retain their
 * references, each point it moves stored at `decimals`.
 */
export function translatedElement(
  element: DrawnElement,
  offset: Point,
  decimals?: Decimals,
): DrawnElement {
  return withPoints(element, (point) =>
    storedPoint({ x: point.x + offset.x, y: point.y + offset.y }, decimals),
  );
}

/**
 * `element` with the whole of its geometry stored at `decimals`: every
 * position, free end, waypoint and size. `element` itself where no count is
 * named.
 */
export function storedElement(
  element: DrawnElement,
  decimals: Decimals | undefined,
): DrawnElement {
  if (decimals === undefined) {
    return element;
  }
  if (element.kind === 'flow') {
    return withPoints(element, (point) => storedPoint(point, decimals));
  }
  if (element.kind === 'trust-boundary') {
    return { ...element, shape: storedShape(element.shape, decimals) };
  }
  return {
    ...element,
    position: storedPoint(element.position, decimals),
    size: storedSize(element.size, decimals),
  };
}

/** A copy of `shape` with its position and size, or its waypoints, stored at `decimals`. */
export function storedShape(
  shape: BoundaryShape,
  decimals: Decimals | undefined,
): BoundaryShape {
  return shape.kind === 'box'
    ? {
        kind: 'box',
        position: storedPoint(shape.position, decimals),
        size: storedSize(shape.size, decimals),
      }
    : { kind: 'curve', waypoints: storedPoints(shape.waypoints, decimals) };
}

/**
 * The point a flow freed from `element` keeps: a node's or a box's centre, a
 * curve's first waypoint, or a flow's first bend or free end.
 */
export function anchorPoint(element: DrawnElement): Point {
  if (element.kind === 'flow') {
    return element.waypoints.at(0) ?? freeEndpointPosition(element) ?? origin;
  }
  if (element.kind === 'trust-boundary') {
    return element.shape.kind === 'box'
      ? centreOf(element.shape.position, element.shape.size)
      : element.shape.waypoints[0];
  }
  return centreOf(element.position, element.size);
}

/** `element` at `size`, or undefined for a flow or a boundary curve, which carry no extent. */
export function resized(
  element: DrawnElement,
  size: Size,
): DrawnElement | undefined {
  if (element.kind === 'flow') {
    return undefined;
  }
  if (element.kind === 'trust-boundary') {
    return element.shape.kind === 'box'
      ? { ...element, shape: { ...element.shape, size } }
      : undefined;
  }
  return { ...element, size };
}

/**
 * Whether an element holds the same geometry after a move or a resize as
 * before it, number for number: positions, sizes, free ends, bends and curve
 * points. Sound only for an element and that same element after such an
 * edit, which changes no kind, attachment or shape: the numbers are compared
 * in order with nothing saying which is which, so two elements of different
 * shapes can hold the same list.
 */
export function sameGeometry(left: DrawnElement, right: DrawnElement): boolean {
  return sameItems(numbersOf(left), numbersOf(right));
}

/** Whether two canvas points coincide. */
export function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function numbersOf(element: DrawnElement): number[] {
  if (element.kind === 'flow') {
    return [element.source, element.target]
      .flatMap((end) => (end.kind === 'free' ? [end.position] : []))
      .concat(element.waypoints)
      .flatMap(({ x, y }) => [x, y]);
  }
  if (element.kind === 'trust-boundary') {
    return element.shape.kind === 'box'
      ? numbersOfBox(element.shape.position, element.shape.size)
      : element.shape.waypoints.flatMap(({ x, y }) => [x, y]);
  }
  return numbersOfBox(element.position, element.size);
}

function numbersOfBox(position: Point, size: Size): number[] {
  return [position.x, position.y, size.width, size.height];
}

function withPoints(
  element: DrawnElement,
  at: (point: Point) => Point,
): DrawnElement {
  if (element.kind === 'flow') {
    return {
      ...element,
      source: endpointAt(element.source, at),
      target: endpointAt(element.target, at),
      waypoints: element.waypoints.map((waypoint) => at(waypoint)),
    };
  }
  if (element.kind === 'trust-boundary') {
    const { shape } = element;
    return {
      ...element,
      shape:
        shape.kind === 'box'
          ? { ...shape, position: at(shape.position) }
          : {
              ...shape,
              waypoints: shape.waypoints.map((waypoint) => at(waypoint)),
            },
    };
  }
  return { ...element, position: at(element.position) };
}

function endpointAt(
  endpoint: DrawnFlowEndpoint,
  at: (point: Point) => Point,
): DrawnFlowEndpoint {
  return endpoint.kind === 'free'
    ? { ...endpoint, position: at(endpoint.position) }
    : endpoint;
}

function centreOf(position: Point, size: Size): Point {
  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  };
}

function freeEndpointPosition(flow: DrawnFlow): Point | undefined {
  return [flow.source, flow.target]
    .flatMap((endpoint) =>
      endpoint.kind === 'free' ? [endpoint.position] : [],
    )
    .at(0);
}
