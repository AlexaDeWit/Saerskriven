import type { Point } from '@saerskriven/model';
import type { Segment } from './geometry.js';

/** The squared distance between two points. */
export function squaredDistance(from: Point, to: Point): number {
  return (from.x - to.x) ** 2 + (from.y - to.y) ** 2;
}

/**
 * The unit vector pointing from `from` to `to`. Two equal points point to
 * the right, so a run of no length still has a direction.
 */
export function unitDirection(from: Point, to: Point): Point {
  const run = { x: to.x - from.x, y: to.y - from.y };
  const length = Math.hypot(run.x, run.y);
  return length === 0
    ? { x: 1, y: 0 }
    : { x: run.x / length, y: run.y / length };
}

/** The point a given fraction of the way along a segment. */
export function alongSegment(segment: Segment, fraction: number): Point {
  return {
    x: segment.from.x + (segment.to.x - segment.from.x) * fraction,
    y: segment.from.y + (segment.to.y - segment.from.y) * fraction,
  };
}

/**
 * The unit normal a label hangs off a segment by: of the two, the one with a
 * non-negative y, and where that y is zero the one with a positive x, so the
 * side follows the segment's direction and not the end it is drawn from.
 */
export function labelNormal(segment: Segment): Point {
  const along = unitDirection(segment.from, segment.to);
  const normal = { x: -along.y, y: along.x };
  return normal.y < 0 || (normal.y === 0 && normal.x < 0)
    ? negated(normal)
    : normal;
}

/**
 * Where a point projects onto a segment: the fraction along it, clamped to
 * the segment, the distance to that foot, and the distance signed by the side
 * {@link labelNormal} names.
 */
export function projectedOn(
  segment: Segment,
  point: Point,
): {
  readonly distance: number;
  readonly fraction: number;
  readonly signedDistance: number;
} {
  const run = {
    x: segment.to.x - segment.from.x,
    y: segment.to.y - segment.from.y,
  };
  const lengthSquared = run.x * run.x + run.y * run.y;
  const fraction =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - segment.from.x) * run.x +
              (point.y - segment.from.y) * run.y) /
              lengthSquared,
          ),
        );
  const at = alongSegment(segment, fraction);
  const normal = labelNormal(segment);
  return {
    distance: Math.hypot(point.x - at.x, point.y - at.y),
    fraction,
    signedDistance: (point.x - at.x) * normal.x + (point.y - at.y) * normal.y,
  };
}

/** The vector pointing the other way. */
export function negated(point: Point): Point {
  return scaledBy(point, -1);
}

/** The vector multiplied by a factor. */
export function scaledBy(point: Point, factor: number): Point {
  return { x: point.x * factor, y: point.y * factor };
}

/** The point a distance along a direction from `at`. */
export function offsetBy(at: Point, direction: Point, distance: number): Point {
  return {
    x: at.x + direction.x * distance,
    y: at.y + direction.y * distance,
  };
}
