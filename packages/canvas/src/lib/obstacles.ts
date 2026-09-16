import type { Size } from '@saerskriven/model';
import { badgeBox, placedBadgeAnchor } from './badges.js';
import {
  boxesOverlap,
  boxMeetsCircle,
  segmentMeetsBox,
  segmentsOfBox,
  segmentsOfPolyline,
  shiftedBy,
  type Box,
  type Circle,
  type Segment,
} from './geometry.js';
import { nodeBox } from './handles.js';
import type { CanvasNode } from './layout.js';
import { memoizedByIdentity } from './memoized.js';
import { controlPolygon } from './paths.js';
import { flowLabelClearance } from './typography.js';

/** What a label is held clear of: boxes, circles and straight runs of line. */
export type Solids = {
  readonly boxes: Box[];
  readonly circles: readonly Circle[];
  readonly lines: readonly Segment[];
};

/**
 * The circle a process's glyph draws, in the node's own coordinates, which is
 * also the shape label placement charges a label for.
 */
export function processCircle(size: Size): Circle {
  return {
    centre: { x: size.width / 2, y: size.height / 2 },
    radius: Math.min(size.width, size.height) / 2,
  };
}

/**
 * The shape a node's glyph draws, in diagram coordinates: a trust boundary's
 * outline as lines, since a label inside one is where it belongs, a process's
 * circle, and every other kind's box.
 */
export const nodeOutline = memoizedByIdentity((node: CanvasNode): Solids => {
  if (node.kind === 'boundary-box') {
    return { boxes: [], circles: [], lines: segmentsOfBox(nodeBox(node)) };
  }
  if (node.kind === 'boundary-curve') {
    return {
      boxes: [],
      circles: [],
      lines: segmentsOfPolyline(
        controlPolygon(node.waypoints).map((point) =>
          shiftedBy(point, node.position),
        ),
      ),
    };
  }
  if (node.kind === 'process') {
    return { boxes: [], circles: [placedCircle(node)], lines: [] };
  }
  return { boxes: [nodeBox(node)], circles: [], lines: [] };
});

/** The box of a node's badge in diagram coordinates, or none. */
export const ownBadgeBox = memoizedByIdentity((node: CanvasNode): Box[] =>
  node.badge === undefined
    ? []
    : [badgeBox(placedBadgeAnchor(node), node.badge)],
);

/** Every node's outline and badge, with no lines of their own beyond those. */
export function elementSolids(nodes: readonly CanvasNode[]): Solids {
  const outlines = nodes.map(nodeOutline);
  return {
    boxes: [
      ...outlines.flatMap((outline) => outline.boxes),
      ...nodes.flatMap(ownBadgeBox),
    ],
    circles: outlines.flatMap((outline) => outline.circles),
    lines: [],
  };
}

/**
 * How many of the solids a box meets, counting up to `stopAt` and no
 * further. No box meets nothing.
 */
export function boxCollisions(
  box: Box | undefined,
  solids: Solids,
  stopAt = Number.POSITIVE_INFINITY,
): number {
  if (box === undefined) {
    return 0;
  }
  let collisions = 0;
  for (const other of solids.boxes) {
    collisions += boxesOverlap(box, other) ? 1 : 0;
    if (collisions >= stopAt) {
      return collisions;
    }
  }
  for (const circle of solids.circles) {
    collisions += boxMeetsCircle(box, circle) ? 1 : 0;
    if (collisions >= stopAt) {
      return collisions;
    }
  }
  for (const line of solids.lines) {
    collisions += segmentMeetsBox(line, box) ? 1 : 0;
    if (collisions >= stopAt) {
      return collisions;
    }
  }
  return collisions;
}

/** A box grown by one label clearance on every side. */
export function grownByClearance(box: Box): Box {
  return {
    minX: box.minX - flowLabelClearance,
    minY: box.minY - flowLabelClearance,
    maxX: box.maxX + flowLabelClearance,
    maxY: box.maxY + flowLabelClearance,
  };
}

function placedCircle(node: CanvasNode): Circle {
  const circle = processCircle(node.size);
  return {
    centre: shiftedBy(circle.centre, node.position),
    radius: circle.radius,
  };
}
