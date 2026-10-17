import { Either } from 'effect';
import {
  diagramIndexOf,
  locatedDrawn,
  locatedElement,
  withDiagram,
  type UndrawnElementFailure,
  type UnknownDiagramFailure,
  type UnknownElementFailure,
} from './diagram-edits.js';
import type { Decimals } from './decimals.js';
import { diagramsOf, drawnElement, placementOf } from './drawing.js';
import type { DrawnElement } from './drawn-elements.js';
import { storedElement } from './element-geometry.js';
import type { DiagramId, ElementId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { withPlacedEnds } from './placed-ends.js';
import type { Placement } from './placements.js';
import { elementIdsIn } from './references.js';

/** The failures {@link placeElement} can produce. */
export type PlaceElementFailure =
  | UnknownDiagramFailure
  | UnknownElementFailure
  | Extract<
      OperationFailure,
      { _tag: 'ElementAlreadyOnDiagram' | 'InvalidPlacement' }
    >;

/** The failures {@link unplaceElement} can produce. */
export type UnplaceElementFailure =
  | UndrawnElementFailure
  | Extract<OperationFailure, { _tag: 'LastPlacement' }>;

/**
 * Places the element `placement` names, which the model already holds, last
 * on the diagram `diagramId` names, with the geometry and accent the
 * placement holds, stored at `decimals`. The element keeps its facts and its
 * threats, so it is the same element on every diagram it is on, and a flow on
 * that diagram whose end was drawn away from it attaches to it there. Refuses
 * an element the diagram already places, geometry its kind does not take,
 * and a flow end the diagram cannot draw: one attached to an element the
 * diagram places holds no position, and every other end holds one.
 */
export function placeElement(
  model: Model,
  diagramId: DiagramId,
  placement: Placement,
  decimals?: Decimals,
): Either.Either<Model, PlaceElementFailure> {
  const elementId = placement.element;
  return Either.flatMap(diagramIndexOf(model, diagramId), (diagramIndex) =>
    Either.flatMap(
      locatedElement(model, elementId),
      ({ element }): Either.Either<Model, PlaceElementFailure> => {
        const placed = elementIdsIn(model.diagrams[diagramIndex]);
        if (placed.has(elementId)) {
          return Either.left(
            OperationFailure.ElementAlreadyOnDiagram({ elementId, diagramId }),
          );
        }
        const drawn = drawnElement(element, placement);
        if (drawn === undefined || !drawableEnds(drawn, placed)) {
          return Either.left(
            OperationFailure.InvalidPlacement({ elementId, diagramId }),
          );
        }
        const stored = placementOf(storedElement(drawn, decimals));
        return Either.right(
          withPlacedEnds(
            model,
            withDiagram(model, diagramIndex, (diagram) => ({
              ...diagram,
              placements: [...diagram.placements, stored],
            })),
          ),
        );
      },
    ),
  );
}

/**
 * Takes the element `elementId` names off the diagram `diagramId` names. The
 * element stays in the model with its threats and its other placements, so
 * nothing is culled. A flow on that diagram attached to it stays attached,
 * its end drawn away at the element's anchor there, stored at `decimals`.
 * Refuses the element's last placement, which only removing the element
 * takes away.
 */
export function unplaceElement(
  model: Model,
  diagramId: DiagramId,
  elementId: ElementId,
  decimals?: Decimals,
): Either.Either<Model, UnplaceElementFailure> {
  return Either.flatMap(
    locatedDrawn(model, diagramId, elementId),
    ({ diagramIndex }): Either.Either<Model, UnplaceElementFailure> =>
      diagramsOf(model, elementId).length === 1
        ? Either.left(OperationFailure.LastPlacement({ elementId, diagramId }))
        : Either.right(
            withPlacedEnds(
              model,
              withDiagram(model, diagramIndex, (diagram) => ({
                ...diagram,
                placements: diagram.placements.filter(
                  (held) => held.element !== elementId,
                ),
              })),
              decimals,
            ),
          ),
  );
}

function drawableEnds(
  drawn: DrawnElement,
  placed: ReadonlySet<string>,
): boolean {
  return (
    drawn.kind !== 'flow' ||
    [drawn.source, drawn.target].every((end) =>
      end.kind === 'free'
        ? true
        : placed.has(end.element) === (end.kind === 'attached'),
    )
  );
}
