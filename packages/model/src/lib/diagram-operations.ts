import { Either } from 'effect';
import {
  diagramIndexOf,
  flowEndpointFailure,
  invalidRelationships,
  locatedDiagram,
  withDiagram,
} from './diagram-edits.js';
import type { DiagramId } from './ids.js';
import type { Diagram } from './model.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { elementIdsAcross, elementsById } from './references.js';
import { firstRefusedCharacter, isEmptyName } from './text.js';

/** The failures {@link addDiagram} can produce. */
export type AddDiagramFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'DuplicateDiagramId'
      | 'DuplicateElementId'
      | 'InvalidFlowEndpoint'
      | 'InvalidElementRelationship'
      | 'EmptyTitle'
      | 'RefusedTitleCharacter';
  }
>;

/** The failures {@link renameDiagram} can produce. */
export type RenameDiagramFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownDiagram' | 'EmptyTitle' | 'RefusedTitleCharacter' }
>;

/** The failures {@link removeDiagram} can produce. */
export type RemoveDiagramFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownDiagram' | 'DiagramNotEmpty' }
>;

/** Appends a diagram with a valid title, new element IDs and valid local endpoint and boundary references. */
export function addDiagram(
  model: Model,
  diagram: Diagram,
): Either.Either<Model, AddDiagramFailure> {
  if (model.diagrams.some((existing) => existing.id === diagram.id)) {
    return Either.left(
      OperationFailure.DuplicateDiagramId({ diagramId: diagram.id }),
    );
  }
  const titleRefusal = refusedTitle(diagram.id, diagram.title);
  if (titleRefusal !== undefined) {
    return Either.left(titleRefusal);
  }
  const taken = elementIdsAcross(model.diagrams);
  const own = new Set<string>();
  for (const element of diagram.elements) {
    if (taken.has(element.id) || own.has(element.id)) {
      return Either.left(
        OperationFailure.DuplicateElementId({ elementId: element.id }),
      );
    }
    own.add(element.id);
  }
  const known = elementsById(diagram.elements);
  for (const element of diagram.elements) {
    const failure =
      flowEndpointFailure(element, diagram) ??
      invalidRelationships(element, known);
    if (failure !== undefined) {
      return Either.left(failure);
    }
  }
  return Either.right({ ...model, diagrams: [...model.diagrams, diagram] });
}

/** Retitles a diagram, rejecting empty titles and characters refused by the model. */
export function renameDiagram(
  model: Model,
  diagramId: DiagramId,
  title: string,
): Either.Either<Model, RenameDiagramFailure> {
  return Either.flatMap(
    diagramIndexOf(model, diagramId),
    (diagramIndex): Either.Either<Model, RenameDiagramFailure> => {
      const refusal = refusedTitle(diagramId, title);
      return refusal === undefined
        ? Either.right(
            withDiagram(model, diagramIndex, (diagram) => ({
              ...diagram,
              title,
            })),
          )
        : Either.left(refusal);
    },
  );
}

/** Removes only an empty diagram. Explicit element deletion must precede diagram deletion. */
export function removeDiagram(
  model: Model,
  diagramId: DiagramId,
): Either.Either<Model, RemoveDiagramFailure> {
  return Either.flatMap(
    locatedDiagram(model, diagramId),
    (diagram): Either.Either<Model, RemoveDiagramFailure> =>
      diagram.elements.length > 0
        ? Either.left(
            OperationFailure.DiagramNotEmpty({
              diagramId,
              elements: diagram.elements.length,
            }),
          )
        : Either.right({
            ...model,
            diagrams: model.diagrams.filter(
              (candidate) => candidate.id !== diagramId,
            ),
          }),
  );
}

function refusedTitle(
  diagramId: DiagramId,
  title: string,
):
  | Extract<OperationFailure, { _tag: 'EmptyTitle' | 'RefusedTitleCharacter' }>
  | undefined {
  if (isEmptyName(title)) {
    return OperationFailure.EmptyTitle({ diagramId });
  }
  const at = firstRefusedCharacter(title);
  return at === undefined
    ? undefined
    : OperationFailure.RefusedTitleCharacter({ diagramId, at });
}
