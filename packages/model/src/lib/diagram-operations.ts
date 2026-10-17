import { Either } from 'effect';
import {
  diagramIndexOf,
  locatedDiagram,
  withDiagram,
} from './diagram-edits.js';
import type { DiagramId } from './ids.js';
import type { Diagram } from './model.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { firstRefusedCharacter, isEmptyName } from './text.js';

/** The failures {@link addDiagram} can produce. */
export type AddDiagramFailure = Extract<
  OperationFailure,
  { _tag: 'DuplicateDiagramId' | 'EmptyTitle' | 'RefusedTitleCharacter' }
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

/**
 * Appends an empty diagram under a new id with a valid title. An element
 * joins it through `addElement` or a paste.
 */
export function addDiagram(
  model: Model,
  diagram: Pick<Diagram, 'id' | 'title'>,
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
  return Either.right({
    ...model,
    diagrams: [
      ...model.diagrams,
      { id: diagram.id, title: diagram.title, placements: [] },
    ],
  });
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

/** Removes only a diagram that places no element. Explicit element deletion must precede diagram deletion. */
export function removeDiagram(
  model: Model,
  diagramId: DiagramId,
): Either.Either<Model, RemoveDiagramFailure> {
  return Either.flatMap(
    locatedDiagram(model, diagramId),
    (diagram): Either.Either<Model, RemoveDiagramFailure> =>
      diagram.placements.length > 0
        ? Either.left(
            OperationFailure.DiagramNotEmpty({
              diagramId,
              elements: diagram.placements.length,
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
