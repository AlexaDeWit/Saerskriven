import type { BoundaryShape, Element, Flow, FlowEndpoint } from './elements.js';
import type { Point, Size } from './geometry.js';

const origin: Point = { x: 0, y: 0 };

/** Translates element geometry while attached endpoints retain their references. */
export function translatedElement(element: Element, offset: Point): Element {
  if (element.kind === 'flow') {
    return {
      ...element,
      source: shiftedEndpoint(element.source, offset),
      target: shiftedEndpoint(element.target, offset),
      waypoints: element.waypoints.map((waypoint) => shifted(waypoint, offset)),
    };
  }
  if (element.kind === 'trust-boundary') {
    return { ...element, shape: shiftedShape(element.shape, offset) };
  }
  return { ...element, position: shifted(element.position, offset) };
}

/**
 * The point a flow freed from `element` keeps: a node's or a box's centre, a
 * curve's first waypoint, or a flow's first bend or free end.
 */
export function anchorPoint(element: Element): Point {
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
export function resized(element: Element, size: Size): Element | undefined {
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

function centreOf(position: Point, size: Size): Point {
  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  };
}

function freeEndpointPosition(flow: Flow): Point | undefined {
  return [flow.source, flow.target]
    .flatMap((endpoint) =>
      endpoint.kind === 'free' ? [endpoint.position] : [],
    )
    .at(0);
}

function shifted(point: Point, offset: Point): Point {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function shiftedEndpoint(endpoint: FlowEndpoint, offset: Point): FlowEndpoint {
  return endpoint.kind === 'free'
    ? { ...endpoint, position: shifted(endpoint.position, offset) }
    : endpoint;
}

function shiftedShape(shape: BoundaryShape, offset: Point): BoundaryShape {
  return shape.kind === 'box'
    ? { ...shape, position: shifted(shape.position, offset) }
    : {
        ...shape,
        waypoints: shape.waypoints.map((waypoint) => shifted(waypoint, offset)),
      };
}
