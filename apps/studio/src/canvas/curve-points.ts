import { curveMidpoints, type CurveMidpoint } from '@saerskriven/canvas';
import {
  setBoundaryShape,
  type CurveBoundaryShape,
  type Element,
  type Point,
  type TrustBoundary,
} from '@saerskriven/model';
import { Action } from '../store/actions.js';
import { dispatch } from '../store/store.js';
import { announce, spokenElement } from './announcements.js';
import { useElementDraft, type ElementEdit } from './element-draft.js';
import { editedWaypoints, type WaypointTarget } from './waypoints.js';

/** A trust boundary drawn as a curve. */
export type CurveBoundary = TrustBoundary & {
  readonly shape: CurveBoundaryShape;
};

/**
 * How long a curve segment must be drawn, in screen pixels, to show a
 * midpoint handle: twice the 1.75rem point handle at the default 16px root,
 * so on a straight segment the midpoint handle clears the point handles at
 * both of its ends.
 */
export const shortestMidpointSegment = 56;

const fewestCurvePoints = 2;

const pointEdit: ElementEdit<CurveBoundary, WaypointTarget> = {
  subject: (element) => (isCurveBoundary(element) ? element : undefined),
  edited: (model, boundary, target) =>
    setBoundaryShape(model, boundary.id, editedCurve(boundary, target)),
  action: (boundary, target) =>
    Action.SetBoundaryShape({
      elementId: boundary.id,
      shape: editedCurve(boundary, target),
    }),
  said: (boundary, target) => (t) =>
    t(target.kind === 'insert' ? 'canvas.point-added' : 'canvas.point-moved', {
      number: target.index + 1,
      boundary: spokenElement(t, boundary),
    }),
};

/**
 * Where Add point on the point at `index` puts a new one: halfway along the
 * drawn curve to the next point by length, or from the last point, halfway
 * back to the one before it. Nothing for an index the curve has no point at.
 */
export function addedPoint(
  waypoints: readonly Point[],
  index: number,
): WaypointTarget | undefined {
  if (index < 0 || index >= waypoints.length) {
    return undefined;
  }
  const segment = Math.min(index, waypoints.length - 2);
  const point = curveMidpoints(waypoints).at(segment)?.point;
  return point === undefined
    ? undefined
    : { kind: 'insert', index: segment + 1, point };
}

/**
 * The midpoint handles a curve drawn through `points` at `zoom` shows, each
 * with the index of its segment: one on every segment drawn at least
 * {@link shortestMidpointSegment} long. While `draft` holds a drag, only the
 * midpoint that a midpoint drag pulls a point out of stays, marked `pulled`.
 */
export function shownMidpoints(
  points: readonly Point[],
  zoom: number,
  draft: WaypointTarget | undefined,
): (CurveMidpoint & { readonly index: number; readonly pulled: boolean })[] {
  const held = draft?.kind === 'insert' ? draft.index - 1 : undefined;
  return curveMidpoints(points)
    .map((middle, index) => ({ ...middle, index, pulled: index === held }))
    .filter(({ segmentLength, pulled }) =>
      draft === undefined
        ? segmentLength * zoom >= shortestMidpointSegment
        : pulled,
    );
}

/**
 * The selected trust boundary curve's points: a preview of one inserted or
 * moved, and the edits that insert, move or remove one while the curve keeps
 * two. `add` inserts the {@link addedPoint} of a point and answers the index
 * the new one takes. `remove` says whether a point went.
 */
export function useCurvePoints() {
  const points = useElementDraft(pointEdit);
  const boundary = points.subject;
  return {
    ...points,
    boundary,
    add: (index: number): number | undefined => {
      const target =
        boundary === undefined
          ? undefined
          : addedPoint(boundary.shape.waypoints, index);
      if (target === undefined) {
        return undefined;
      }
      points.commit(target);
      return target.index;
    },
    remove: (index: number): boolean => {
      if (boundary?.shape.waypoints[index] === undefined) {
        return false;
      }
      if (boundary.shape.waypoints.length <= fewestCurvePoints) {
        announce((t) => t('canvas.point-kept'));
        return false;
      }
      dispatch(
        Action.SetBoundaryShape({
          elementId: boundary.id,
          shape: {
            kind: 'curve',
            waypoints: boundary.shape.waypoints.filter(
              (_point, at) => at !== index,
            ),
          },
        }),
      );
      points.cancel();
      announce((t) =>
        t('canvas.point-removed', {
          number: index + 1,
          boundary: spokenElement(t, boundary),
        }),
      );
      return true;
    },
  };
}

/** The state and operations exposed to the curve point controls. */
export type CurvePoints = ReturnType<typeof useCurvePoints>;

function isCurveBoundary(element: Element): element is CurveBoundary {
  return element.kind === 'trust-boundary' && element.shape.kind === 'curve';
}

function editedCurve(
  boundary: CurveBoundary,
  target: WaypointTarget,
): CurveBoundaryShape {
  return {
    kind: 'curve',
    waypoints: editedWaypoints(boundary.shape.waypoints, target),
  };
}
