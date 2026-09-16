import type { ElementId, Point } from '@saerskriven/model';
import type { FlowGeometry } from './flow-labels.js';
import {
  centreOf,
  handlePositions,
  nearestHandleSide,
  type HandleSide,
  type NodeBox,
} from './handles.js';
import type { CanvasEdgeGeometry } from './layout.js';
import { memoizedByIdentity } from './memoized.js';

/** A flow end that has somewhere to be drawn: a free position or a box. */
export type PlacedEndpoint =
  | { readonly kind: 'free'; readonly point: Point }
  | {
      readonly kind: 'node';
      readonly element: ElementId;
      readonly box: NodeBox;
    };

/** Where a flow end is drawn, the side it takes, and the element it is on. */
export type Anchor = {
  readonly point: Point;
  readonly side: HandleSide | undefined;
  readonly element: ElementId | undefined;
};

/**
 * Both ends of a flow anchored. An end on a box takes its pinned side, or
 * the side nearest the waypoint beside it, or the other end where there is
 * no waypoint. A free end stays at its own position.
 */
export function anchorsOf(
  source: PlacedEndpoint,
  target: PlacedEndpoint,
  waypoints: readonly Point[],
  sourcePin: HandleSide | undefined,
  targetPin: HandleSide | undefined,
): { readonly source: Anchor; readonly target: Anchor } {
  return {
    source: anchorOf(source, waypoints[0] ?? referenceOf(target), sourcePin),
    target: anchorOf(
      target,
      waypoints.at(-1) ?? referenceOf(source),
      targetPin,
    ),
  };
}

/** The points a flow's line runs through, from its source to its target. */
export function edgePoints(
  edge: CanvasEdgeGeometry,
): readonly [Point, ...Point[]] {
  return [edge.source, ...edge.waypoints, edge.target];
}

/** What label placement reads of a laid-out flow. */
export const flowGeometry = memoizedByIdentity(
  (edge: CanvasEdgeGeometry): FlowGeometry => ({
    id: edge.id,
    name: edge.name,
    badge: edge.badge,
    points: edgePoints(edge),
  }),
);

function anchorOf(
  endpoint: PlacedEndpoint,
  toward: Point,
  pin: HandleSide | undefined,
): Anchor {
  if (endpoint.kind === 'free') {
    return { point: endpoint.point, side: undefined, element: undefined };
  }
  const side = pin ?? nearestHandleSide(endpoint.box, toward);
  return {
    point: handlePositions(endpoint.box)[side],
    side,
    element: endpoint.element,
  };
}

function referenceOf(endpoint: PlacedEndpoint): Point {
  return endpoint.kind === 'free' ? endpoint.point : centreOf(endpoint.box);
}
