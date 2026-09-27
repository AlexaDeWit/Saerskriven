import { Either } from 'effect';
import type { Element, FlowEndpoint } from './elements.js';
import type { DiagramId, ElementId } from './ids.js';
import type { Diagram } from './model.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { relationshipIssues } from './relationships.js';
import { isEmptyName } from './text.js';

/** The failure for an element id the model does not hold. */
export type UnknownElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' }
>;

/** The failure for a diagram id the model does not hold. */
export type UnknownDiagramFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownDiagram' }
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

/** The diagram `diagramId` names. */
export function locatedDiagram(
  model: Model,
  diagramId: DiagramId,
): Either.Either<Diagram, UnknownDiagramFailure> {
  const diagram = model.diagrams.find(
    (candidate) => candidate.id === diagramId,
  );
  return diagram === undefined
    ? Either.left(OperationFailure.UnknownDiagram({ diagramId }))
    : Either.right(diagram);
}

/** The index of the diagram `diagramId` names. */
export function diagramIndexOf(
  model: Model,
  diagramId: DiagramId,
): Either.Either<number, UnknownDiagramFailure> {
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

type InvalidFlowEndpointFailure = Extract<
  OperationFailure,
  { _tag: 'InvalidFlowEndpoint' }
>;

const flowAnchorKinds = new Set<Element['kind']>(['actor', 'process', 'store']);

/**
 * The refusal of a flow's `side` end, or undefined where the edit operations
 * accept it: free, or attached to an actor, process or store of `diagram`
 * that `other`, the flow's other end, is not attached to. Parse does not
 * apply this rule, so a flow read from a file can already break it.
 */
export function flowEndFailure(
  diagram: Diagram,
  side: 'source' | 'target',
  end: FlowEndpoint,
  other: FlowEndpoint,
): InvalidFlowEndpointFailure | undefined {
  if (end.kind === 'free') {
    return undefined;
  }
  const anchor = diagram.elements.find((element) => element.id === end.element);
  return anchor !== undefined &&
    flowAnchorKinds.has(anchor.kind) &&
    !(other.kind === 'attached' && other.element === end.element)
    ? undefined
    : OperationFailure.InvalidFlowEndpoint({ side, reference: end.element });
}

/** The refusal of a flow's first end, source first, that {@link flowEndFailure} refuses in `diagram`. */
export function flowEndpointFailure(
  element: Element,
  diagram: Diagram,
): InvalidFlowEndpointFailure | undefined {
  return element.kind === 'flow'
    ? (flowEndFailure(diagram, 'source', element.source, element.target) ??
        flowEndFailure(diagram, 'target', element.target, element.source))
    : undefined;
}

/**
 * The refusal of an element whose name is empty or white space alone, or
 * undefined. Parse accepts such a name, so a file can already hold one.
 */
export function emptyNameFailure(
  element: Element,
): Extract<OperationFailure, { _tag: 'EmptyName' }> | undefined {
  return isEmptyName(element.name)
    ? OperationFailure.EmptyName({ elementId: element.id })
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
