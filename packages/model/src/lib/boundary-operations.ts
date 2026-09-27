import { Either } from 'effect';
import { locatedElement, withElement } from './diagram-edits.js';
import { samePoint } from './element-geometry.js';
import type { BoundaryShape } from './elements.js';
import type { ElementId } from './ids.js';
import { sameItems } from './lists.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';

/** The failures {@link setBoundaryShape} can produce. */
export type SetBoundaryShapeFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotTrustBoundaryElement' }
>;

/**
 * Replaces a trust boundary's shape with a box or a curve, whichever of the
 * two it held, preserving the model for the shape it already has. The caller
 * supplies a schema-valid shape. The declared relationships stay as they are,
 * as through every geometry edit, so no element moves in or out.
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
      return Either.right(
        sameShape(element.shape, shape)
          ? model
          : withElement(model, diagramIndex, {
              ...element,
              shape: copiedShape(shape),
            }),
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

function copiedShape(shape: BoundaryShape): BoundaryShape {
  return shape.kind === 'box'
    ? {
        kind: 'box',
        position: { ...shape.position },
        size: { ...shape.size },
      }
    : {
        kind: 'curve',
        waypoints: shape.waypoints.map((point) => ({ ...point })),
      };
}
