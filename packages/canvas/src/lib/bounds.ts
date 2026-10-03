import type { Point } from '@saerskriven/model';
import { badgeAnchor, badgeBox, type ThreatBadge } from './badges.js';
import { edgePoints } from './flow-anchors.js';
import { boxOfPoints, cornersOfBox, shiftedBy } from './geometry.js';
import { nodeBox } from './handles.js';
import type { CanvasEdge, CanvasNode } from './layout.js';
import { noteFrame } from './obstacles.js';
import { arrowheadPoints, controlPolygon } from './paths.js';
import { placedTextCorners } from './text-placement.js';

/**
 * The extent of what a layout paints: node outlines, a boundary curve's
 * control polygon, an out-of-scope note's frame, element text and badges,
 * flow lines and arrowheads, and the backing of each flow's block, which
 * holds its name and badge. Stroke widths straddle the lines they paint and
 * are left for the caller to pad.
 */
export type CanvasBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * The drawn extent of nodes and flows, as {@link CanvasBounds} defines it.
 * `badgeAt` says where each node hangs its badge, in its own coordinates, on
 * its top-right corner unless a caller draws it elsewhere.
 */
export function drawnBounds(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  badgeAt: (node: CanvasNode) => Point = (node) => badgeAnchor(node.size),
): CanvasBounds {
  return boundsOfPoints([
    ...nodes.flatMap((node) => drawnNodePoints(node, badgeAt(node))),
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

function drawnNodePoints(node: CanvasNode, badgeAt: Point): Point[] {
  return [
    ...cornersOfBox(nodeBox(node)),
    ...placedTextCorners(node),
    ...outlinePoints(node),
    ...badgePoints(shiftedBy(badgeAt, node.position), node.badge),
  ];
}

function outlinePoints(node: CanvasNode): readonly Point[] {
  if (node.kind === 'boundary-curve') {
    return controlPolygon(node.waypoints).map((point) =>
      shiftedBy(point, node.position),
    );
  }
  const frame = noteFrame(node);
  return frame === undefined ? [] : cornersOfBox(frame);
}

function drawnEdgePoints(edge: CanvasEdge): Point[] {
  const points = edgePoints(edge);
  return [
    ...points,
    ...arrowheadPoints(edge.target, points[points.length - 2]),
    ...(edge.bidirectional ? arrowheadPoints(edge.source, points[1]) : []),
    ...(edge.label.backing === undefined
      ? []
      : cornersOfBox(edge.label.backing)),
  ];
}

function badgePoints(at: Point, badge: ThreatBadge | undefined): Point[] {
  return badge === undefined ? [] : cornersOfBox(badgeBox(at, badge));
}
