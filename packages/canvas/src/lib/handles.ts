import {
  sides,
  type ElementId,
  type Point,
  type Side,
  type Size,
} from '@saerskriven/model';
import type { Box } from './geometry.js';
import { squaredDistance } from './vectors.js';

/** The sides of a node, in the model's order, which breaks a tie. */
export const handleSides: readonly Side[] = sides;

/** One side of a node, where a flow endpoint attaches. */
export type HandleSide = Side;

/** Where a node sits and how large it is, the pair every handle comes from. */
export type NodeBox = {
  readonly position: Point;
  readonly size: Size;
};

/** Centre of a node's box. */
export function centreOf(box: NodeBox): Point {
  return {
    x: box.position.x + box.size.width / 2,
    y: box.position.y + box.size.height / 2,
  };
}

/**
 * A node's four handle positions, at the midpoints of its sides. Nothing is
 * measured: the positions are the model's own position and size.
 */
export function handlePositions(box: NodeBox): Record<HandleSide, Point> {
  const centre = centreOf(box);
  return {
    top: { x: centre.x, y: box.position.y },
    right: { x: box.position.x + box.size.width, y: centre.y },
    bottom: { x: centre.x, y: box.position.y + box.size.height },
    left: { x: box.position.x, y: centre.y },
  };
}

/**
 * The side whose midpoint lies nearest the given point. Ties break in the
 * order of {@link handleSides}: top, then right, then bottom, then left.
 */
export function nearestHandleSide(box: NodeBox, toward: Point): HandleSide {
  const positions = handlePositions(box);
  let nearest: HandleSide = handleSides[0];
  for (const side of handleSides) {
    if (
      squaredDistance(positions[side], toward) <
      squaredDistance(positions[nearest], toward)
    ) {
      nearest = side;
    }
  }
  return nearest;
}

/** The box a node covers, as its low and high bound on each axis. */
export function nodeBox(box: NodeBox): Box {
  return {
    minX: box.position.x,
    minY: box.position.y,
    maxX: box.position.x + box.size.width,
    maxY: box.position.y + box.size.height,
  };
}

/** Whether two node boxes share a position and a size. */
export function sameNodeBox(one: NodeBox, other: NodeBox): boolean {
  return (
    one.position.x === other.position.x &&
    one.position.y === other.position.y &&
    one.size.width === other.size.width &&
    one.size.height === other.size.height
  );
}

/** The box of each given node, keyed by the node's id. */
export function nodeBoxesOf(
  nodes: readonly (NodeBox & { readonly id: ElementId })[],
): Map<ElementId, NodeBox> {
  return new Map(
    nodes.map((node) => [
      node.id,
      { position: node.position, size: node.size },
    ]),
  );
}
