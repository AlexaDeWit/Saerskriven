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

/** A trust boundary drawn as a curve. */
export type CurveBoundary = TrustBoundary & {
  readonly shape: CurveBoundaryShape;
};

/** One point of a curve, by its place in the curve, at a new position. */
export type PointTarget = { readonly index: number; readonly point: Point };

const fewestCurvePoints = 2;

const pointEdit: ElementEdit<CurveBoundary, PointTarget> = {
  subject: (element) => (isCurveBoundary(element) ? element : undefined),
  edited: (model, boundary, target) =>
    setBoundaryShape(model, boundary.id, movedPoint(boundary, target)),
  action: (boundary, target) =>
    Action.SetBoundaryShape({
      elementId: boundary.id,
      shape: movedPoint(boundary, target),
    }),
  said: (boundary, target) => (t) =>
    t('canvas.point-moved', {
      number: target.index + 1,
      boundary: spokenElement(t, boundary),
    }),
};

/**
 * The selected trust boundary curve's points: a preview of one moved, and
 * the edits that move one or remove one while the curve keeps two.
 */
export function useCurvePoints() {
  const points = useElementDraft(pointEdit);
  const boundary = points.subject;
  return {
    ...points,
    boundary,
    remove: (index: number): void => {
      if (boundary?.shape.waypoints[index] === undefined) {
        return;
      }
      if (boundary.shape.waypoints.length <= fewestCurvePoints) {
        announce((t) => t('canvas.point-kept'));
        return;
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
    },
  };
}

/** The state and operations exposed to the curve point controls. */
export type CurvePoints = ReturnType<typeof useCurvePoints>;

function isCurveBoundary(element: Element): element is CurveBoundary {
  return element.kind === 'trust-boundary' && element.shape.kind === 'curve';
}

function movedPoint(
  boundary: CurveBoundary,
  target: PointTarget,
): CurveBoundaryShape {
  return {
    kind: 'curve',
    waypoints: boundary.shape.waypoints.map((point, at) =>
      at === target.index ? target.point : point,
    ),
  };
}
