import { Result } from 'effect';
import { drawnElement, elementOf, placementOf } from './drawing.js';
import type { DrawnElement, DrawnFlowEndpoint } from './drawn-elements.js';
import type { Element, FlowEndpoint } from './elements.js';
import type { DiagramId, ElementId } from './ids.js';
import type { Diagram } from './model.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import type { Placement } from './placements.js';
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

/** The failures for an element a diagram does not draw. */
export type UndrawnElementFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownDiagram' | 'UnknownElement' | 'ElementNotOnDiagram' }
>;

/** An element the model holds. */
export type Located<Held extends Element> = { readonly element: Held };

/** An element as one diagram draws it, and the index of that diagram. */
export type LocatedDrawn<Held extends DrawnElement> = {
  readonly diagramIndex: number;
  readonly drawn: Held;
};

/** The element `elementId` names. */
export function locatedElement(
  model: Model,
  elementId: ElementId,
): Result.Result<Located<Element>, UnknownElementFailure> {
  const element = model.elements.find(({ id }) => id === elementId);
  return element === undefined
    ? Result.fail(OperationFailure.UnknownElement({ elementId }))
    : Result.succeed({ element });
}

/** The element `elementId` names, as the diagram `diagramId` names draws it. */
export function locatedDrawn(
  model: Model,
  diagramId: DiagramId,
  elementId: ElementId,
): Result.Result<LocatedDrawn<DrawnElement>, UndrawnElementFailure> {
  return Result.flatMap(diagramIndexOf(model, diagramId), (diagramIndex) =>
    Result.flatMap(
      locatedElement(model, elementId),
      ({
        element,
      }): Result.Result<LocatedDrawn<DrawnElement>, UndrawnElementFailure> => {
        const placement = model.diagrams[diagramIndex].placements.find(
          (candidate) => candidate.element === elementId,
        );
        const drawn =
          placement === undefined
            ? undefined
            : drawnElement(element, placement);
        return drawn === undefined
          ? Result.fail(
              OperationFailure.ElementNotOnDiagram({ elementId, diagramId }),
            )
          : Result.succeed({ diagramIndex, drawn });
      },
    ),
  );
}

/** The diagram `diagramId` names. */
export function locatedDiagram(
  model: Model,
  diagramId: DiagramId,
): Result.Result<Diagram, UnknownDiagramFailure> {
  const diagram = model.diagrams.find(
    (candidate) => candidate.id === diagramId,
  );
  return diagram === undefined
    ? Result.fail(OperationFailure.UnknownDiagram({ diagramId }))
    : Result.succeed(diagram);
}

/** The index of the diagram `diagramId` names. */
export function diagramIndexOf(
  model: Model,
  diagramId: DiagramId,
): Result.Result<number, UnknownDiagramFailure> {
  const diagramIndex = model.diagrams.findIndex(
    (diagram) => diagram.id === diagramId,
  );
  return diagramIndex === -1
    ? Result.fail(OperationFailure.UnknownDiagram({ diagramId }))
    : Result.succeed(diagramIndex);
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

/** `model` with the element carrying `next.id` replaced by `next`. */
export function withElement(model: Model, next: Element): Model {
  return {
    ...model,
    elements: model.elements.map((element) =>
      element.id === next.id ? next : element,
    ),
  };
}

/** `model` with the placement of `next.element` on the diagram at `diagramIndex` replaced by `next`. */
export function withPlacement(
  model: Model,
  diagramIndex: number,
  next: Placement,
): Model {
  return withDiagram(model, diagramIndex, (diagram) => ({
    ...diagram,
    placements: diagram.placements.map((placement) =>
      placement.element === next.element ? next : placement,
    ),
  }));
}

/**
 * `model` with the element `next` draws replaced by its facts, and its
 * placement on the diagram at `diagramIndex` by its geometry there.
 */
export function withDrawn(
  model: Model,
  diagramIndex: number,
  next: DrawnElement,
): Model {
  return withPlacement(
    withElement(model, elementOf(next)),
    diagramIndex,
    placementOf(next),
  );
}

type InvalidFlowEndpointFailure = Extract<
  OperationFailure,
  { _tag: 'InvalidFlowEndpoint' }
>;

const flowAnchorKinds = new Set<Element['kind']>(['actor', 'process', 'store']);

/**
 * The refusal of a flow's `side` end, or undefined where the edit operations
 * accept it: free, or attached to an actor, process or store `diagram`
 * places that `other`, the flow's other end, is not attached to. Parse does
 * not apply this rule, so a flow read from a file can already break it.
 */
export function flowEndFailure(
  model: Model,
  diagram: Diagram,
  side: 'source' | 'target',
  end: FlowEndpoint,
  other: FlowEndpoint | DrawnFlowEndpoint,
): InvalidFlowEndpointFailure | undefined {
  if (end.kind === 'free') {
    return undefined;
  }
  const placed = diagram.placements.some(
    ({ element }) => element === end.element,
  );
  const anchor = model.elements.find(({ id }) => id === end.element);
  return placed &&
    anchor !== undefined &&
    flowAnchorKinds.has(anchor.kind) &&
    !(other.kind !== 'free' && other.element === end.element)
    ? undefined
    : OperationFailure.InvalidFlowEndpoint({ side, reference: end.element });
}

/** The refusal of a flow's first end, source first, that {@link flowEndFailure} refuses in `diagram`. */
export function flowEndpointFailure(
  model: Model,
  element: Element,
  diagram: Diagram,
): InvalidFlowEndpointFailure | undefined {
  return element.kind === 'flow'
    ? (flowEndFailure(
        model,
        diagram,
        'source',
        element.source,
        element.target,
      ) ??
        flowEndFailure(
          model,
          diagram,
          'target',
          element.target,
          element.source,
        ))
    : undefined;
}

/**
 * The refusal of an element whose name is empty or white space alone, or
 * undefined. A flow may be left unlabelled, so it is never refused. Parse
 * accepts such a name on every kind, so a file can already hold one.
 */
export function emptyNameFailure(
  element: Element,
): Extract<OperationFailure, { _tag: 'EmptyName' }> | undefined {
  return element.kind !== 'flow' && isEmptyName(element.name)
    ? OperationFailure.EmptyName({ elementId: element.id })
    : undefined;
}

/** `element` as the edit operations store it: a name of white space alone held as `''`. */
export function withStoredName<Held extends Element | DrawnElement>(
  element: Held,
): Held {
  return element.name !== '' && isEmptyName(element.name)
    ? { ...element, name: '' }
    : element;
}

/** The relationship issues of `element` against the elements `known` holds, or undefined. */
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
