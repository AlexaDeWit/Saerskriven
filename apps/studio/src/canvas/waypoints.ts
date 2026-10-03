import type { Point } from '@saerskriven/model';

/**
 * A point of a run of waypoints, a flow's bends or a trust boundary curve's
 * points, by its place in the run: a new one inserted at `index`, or the one
 * at `index` moved.
 */
export type WaypointTarget = {
  readonly kind: 'insert' | 'move';
  readonly index: number;
  readonly point: Point;
};

/** `points` with `target` inserted into them or moved within them. */
export function editedWaypoints(
  points: readonly Point[],
  target: WaypointTarget,
): Point[] {
  return [
    ...points.slice(0, target.index),
    target.point,
    ...points.slice(target.index + (target.kind === 'move' ? 1 : 0)),
  ];
}
