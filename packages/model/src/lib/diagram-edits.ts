import { Either } from 'effect';
import type { Element } from './elements.js';
import type { DiagramId, ElementId } from './ids.js';
import type { Diagram } from './model.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { elementIdsIn, endpointViolationsOf } from './references.js';
import { relationshipIssues } from './relationships.js';

/** The failure for an element id the model does not hold. */
export type UnknownElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' }
>;

/** An element and the index of the diagram holding it. */
export type Located<Held extends Element> = {
  readonly diagramIndex: number;
  readonly element: Held;
};

/** The element `elementId` names, in whichever diagram holds it. */
export function locatedElement(
  model: Model,
  elementId: ElementId,
): Either.Either<Located<Element>, UnknownElementFailure> {
  for (const [diagramIndex, diagram] of model.diagrams.entries()) {
    const element = diagram.elements.find(
      (candidate) => candidate.id === elementId,
    );
    if (element) {
      return Either.right({ diagramIndex, element });
    }
  }
  return Either.left(OperationFailure.UnknownElement({ elementId }));
}

/** The index of the diagram `diagramId` names. */
export function diagramIndexOf(
  model: Model,
  diagramId: DiagramId,
): Either.Either<
  number,
  Extract<OperationFailure, { _tag: 'UnknownDiagram' }>
> {
  const diagramIndex = model.diagrams.findIndex(
    (diagram) => diagram.id === diagramId,
  );
  return diagramIndex === -1
    ? Either.left(OperationFailure.UnknownDiagram({ diagramId }))
    : Either.right(diagramIndex);
}

/** `model` with the diagram at `diagramIndex` replaced by `update`'s result. */
export function withDiagram(
  model: Model,
  diagramIndex: number,
  update: (diagram: Diagram) => Diagram,
): Model {
  return {
    ...model,
    diagrams: model.diagrams.map((diagram, index) =>
      index === diagramIndex ? update(diagram) : diagram,
    ),
  };
}

/** `model` with the element carrying `next.id` in that diagram replaced by `next`. */
export function withElement(
  model: Model,
  diagramIndex: number,
  next: Element,
): Model {
  return withDiagram(model, diagramIndex, (diagram) => ({
    ...diagram,
    elements: diagram.elements.map((element) =>
      element.id === next.id ? next : element,
    ),
  }));
}

/** The first endpoint of a flow `diagram` cannot anchor, or undefined. */
export function flowEndpointFailure(
  element: Element,
  diagram: Diagram,
): Extract<OperationFailure, { _tag: 'InvalidFlowEndpoint' }> | undefined {
  if (element.kind !== 'flow') {
    return undefined;
  }
  const violation = endpointViolationsOf(element, elementIdsIn(diagram)).at(0);
  return violation
    ? OperationFailure.InvalidFlowEndpoint({
        side: violation.side,
        reference: violation.reference,
      })
    : undefined;
}

/** The relationship issues of `element` against the elements of its diagram, or undefined. */
export function invalidRelationships(
  element: Element,
  known: ReadonlyMap<ElementId, Element>,
):
  | Extract<OperationFailure, { _tag: 'InvalidElementRelationship' }>
  | undefined {
  const issues = relationshipIssues(element, known);
  return issues.length === 0
    ? undefined
    : OperationFailure.InvalidElementRelationship({
        elementId: element.id,
        issues,
      });
}
