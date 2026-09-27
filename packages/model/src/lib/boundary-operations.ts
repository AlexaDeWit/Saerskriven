import { Either } from 'effect';
import { locatedElement, withElement } from './diagram-edits.js';
import { samePoint } from './element-geometry.js';
import { trustBoundarySchema, type BoundaryShape } from './elements.js';
import type { ElementId } from './ids.js';
import { sameItems } from './lists.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { toParseIssues } from './parse-issue.js';

/** The failures {@link setBoundaryShape} can produce. */
export type SetBoundaryShapeFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'UnknownElement'
      | 'NotTrustBoundaryElement'
      | 'InvalidElementProperties';
  }
>;

/**
 * Replaces a trust boundary's shape with a box or a curve, whichever of the
 * two it held, preserving the model for the shape it already has. A shape the schema
 * refuses, such as a curve through one point, is refused with the issues
 * under `shape`. The declared relationships stay as they are, as through
 * every geometry edit, so no element moves in or out.
 */
export function setBoundaryShape(
  model: Model,
  elementId: ElementId,
  shape: BoundaryShape,
): Either.Either<Model, SetBoundaryShapeFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    ({
      diagramIndex,
      element,
    }): Either.Either<Model, SetBoundaryShapeFailure> => {
      if (element.kind !== 'trust-boundary') {
        return Either.left(
          OperationFailure.NotTrustBoundaryElement({ elementId }),
        );
      }
      const reshaped = { ...element, shape };
      const next = trustBoundarySchema.safeParse(reshaped);
      if (!next.success) {
        return Either.left(
          OperationFailure.InvalidElementProperties({
            elementId,
            issues: toParseIssues(next.error.issues, reshaped),
          }),
        );
      }
      return Either.right(
        sameShape(element.shape, next.data.shape)
          ? model
          : withElement(model, diagramIndex, next.data),
      );
    },
  );
}

function sameShape(left: BoundaryShape, right: BoundaryShape): boolean {
  if (left.kind === 'box' || right.kind === 'box') {
    return (
      left.kind === 'box' &&
      right.kind === 'box' &&
      samePoint(left.position, right.position) &&
      left.size.width === right.size.width &&
      left.size.height === right.size.height
    );
  }
  return sameItems(left.waypoints, right.waypoints, samePoint);
}
