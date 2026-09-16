import type { Point } from '@saerskriven/model';
import { badgeBox, placedBadgeAnchor, type ThreatBadge } from './badges.js';
import { edgePoints } from './flow-anchors.js';
import { boxOfPoints, cornersOfBox, shiftedBy } from './geometry.js';
import { nodeBox } from './handles.js';
import type { CanvasEdge, CanvasNode } from './layout.js';
import { arrowheadPoints, controlPolygon } from './paths.js';
import { placedTextCorners, textPlacementCorners } from './text-placement.js';

/**
 * The extent of what a layout paints: node outlines, a boundary curve's
 * control polygon, element and flow text, badges, flow lines and arrowheads.
 * Stroke widths straddle the lines they paint and are left for the caller to
 * pad.
 */
export type CanvasBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** The drawn extent of nodes and flows, as {@link CanvasBounds} defines it. */
export function drawnBounds(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): CanvasBounds {
  return boundsOfPoints([
    ...nodes.flatMap((node) => drawnNodePoints(node)),
    ...edges.flatMap((edge) => drawnEdgePoints(edge)),
  ]);
}

/**
 * The smallest bounds holding the given points, or a zero box at the origin
 * for none.
 */
export function boundsOfPoints(points: readonly Point[]): CanvasBounds {
  const box = boxOfPoints(points);
  return box === undefined
    ? { x: 0, y: 0, width: 0, height: 0 }
    : {
        x: box.minX,
        y: box.minY,
        width: box.maxX - box.minX,
        height: box.maxY - box.minY,
      };
}

function drawnNodePoints(node: CanvasNode): Point[] {
  return [
    ...cornersOfBox(nodeBox(node)),
    ...placedTextCorners(node),
    ...outlinePoints(node).map((point) => shiftedBy(point, node.position)),
    ...badgePoints(placedBadgeAnchor(node), node.badge),
  ];
}

function outlinePoints(node: CanvasNode): readonly Point[] {
  return node.kind === 'boundary-curve' ? controlPolygon(node.waypoints) : [];
}

function drawnEdgePoints(edge: CanvasEdge): Point[] {
  const points = edgePoints(edge);
  return [
    ...points,
    ...arrowheadPoints(edge.target, points[points.length - 2]),
    ...(edge.bidirectional ? arrowheadPoints(edge.source, points[1]) : []),
    ...textPlacementCorners(edge.label.name),
    ...(edge.label.badge === undefined
      ? []
      : badgePoints(edge.label.badge, edge.badge)),
  ];
}

function badgePoints(at: Point, badge: ThreatBadge | undefined): Point[] {
  return badge === undefined ? [] : cornersOfBox(badgeBox(at, badge));
}
