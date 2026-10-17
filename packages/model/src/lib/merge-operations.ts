import { Either } from 'effect';
import { locatedElement, type UnknownElementFailure } from './diagram-edits.js';
import { diagramsOf, placementOn } from './drawing.js';
import type { Element, Flow, FlowEndpoint } from './elements.js';
import type { ElementId, ThreatId } from './ids.js';
import type { Diagram } from './model.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { withPlacedEnds } from './placed-ends.js';
import { relistedRelationships } from './relationships.js';

/** The failures {@link mergeElements} can produce. */
export type MergeElementsFailure =
  | UnknownElementFailure
  | Extract<
      OperationFailure,
      {
        _tag:
          | 'MergeIntoItself'
          | 'MergeKindsDiffer'
          | 'MergeJoinedByFlow'
          | 'MergeFlowEndsDiffer';
      }
    >;

/**
 * What {@link mergeElements} takes from the merged element onto the kept one:
 * the diagrams whose placement of it becomes the kept element's, the diagrams
 * that already place the kept element, where its placement is dropped, the
 * threats attached to it, and the flows with an end attached to it.
 */
export type MergeOutcome = {
  readonly moved: readonly Diagram[];
  readonly dropped: readonly Diagram[];
  readonly threats: readonly ThreatId[];
  readonly flows: readonly ElementId[];
};

/**
 * Merges the element `elementId` names into the one `intoId` names, which
 * keeps its id, name, details and properties, and drops the merged
 * element's own. Every reference to the merged element names the kept one
 * instead, once each: threat attachments, flow ends and relationship lists,
 * a list of the kept element's own losing it. Each placement of the merged
 * element becomes the kept element's, with its geometry and accent, except on
 * a diagram already placing the kept element, where it is dropped and the
 * flow ends there attached to it attach to the kept one. A flow end keeps its
 * pinned side, and one drawn away from either element attaches where its
 * diagram now places the kept one. Nothing is culled. Refuses one id named
 * twice, two kinds, a flow joining the two, and two flows whose ends differ:
 * flows merge only where each end attaches to the same element, or is free
 * on both.
 */
export function mergeElements(
  model: Model,
  elementId: ElementId,
  intoId: ElementId,
): Either.Either<Model, MergeElementsFailure> {
  if (elementId === intoId) {
    return Either.left(OperationFailure.MergeIntoItself({ elementId }));
  }
  return Either.flatMap(locatedElement(model, elementId), ({ element }) =>
    Either.flatMap(
      locatedElement(model, intoId),
      ({ element: into }): Either.Either<Model, MergeElementsFailure> => {
        const refusal = mergeRefusal(model, element, into);
        return refusal === undefined
          ? Either.right(merged(model, elementId, intoId))
          : Either.left(refusal);
      },
    ),
  );
}

/** What {@link mergeElements} would take from `elementId` onto `intoId` in `model`, read before the merge. */
export function mergeOutcome(
  model: Model,
  elementId: ElementId,
  intoId: ElementId,
): MergeOutcome {
  const placed = diagramsOf(model, elementId);
  const dropped = placed.filter(
    (diagram) => placementOn(diagram, intoId) !== undefined,
  );
  return {
    moved: placed.filter((diagram) => !dropped.includes(diagram)),
    dropped,
    threats: model.threats
      .filter((threat) => threat.elements.includes(elementId))
      .map(({ id }) => id),
    flows: model.elements
      .filter(
        (candidate) =>
          candidate.kind === 'flow' && endIds(candidate).includes(elementId),
      )
      .map(({ id }) => id),
  };
}

function mergeRefusal(
  model: Model,
  element: Element,
  into: Element,
): Exclude<MergeElementsFailure, UnknownElementFailure> | undefined {
  const pair = { elementId: element.id, intoId: into.id };
  if (element.kind !== into.kind) {
    return OperationFailure.MergeKindsDiffer({
      ...pair,
      elementKind: element.kind,
      intoKind: into.kind,
    });
  }
  if (
    element.kind === 'flow' &&
    into.kind === 'flow' &&
    !endIds(element).every((id, index) => id === endIds(into)[index])
  ) {
    return OperationFailure.MergeFlowEndsDiffer(pair);
  }
  const joining = model.elements.find(
    (candidate) =>
      candidate.kind === 'flow' &&
      endIds(candidate).includes(element.id) &&
      endIds(candidate).includes(into.id),
  );
  return joining === undefined
    ? undefined
    : OperationFailure.MergeJoinedByFlow({ ...pair, flowId: joining.id });
}

function merged(model: Model, elementId: ElementId, intoId: ElementId): Model {
  const renamed = (ids: readonly ElementId[]): ElementId[] =>
    ids.includes(elementId)
      ? [...new Set(ids.map((id) => (id === elementId ? intoId : id)))]
      : [...ids];
  const elements = model.elements.flatMap((element) =>
    element.id === elementId
      ? []
      : [withMergedReferences(element, elementId, intoId, renamed)],
  );
  const ended = { ...model, elements };
  return withPlacedEnds(ended, {
    ...ended,
    diagrams: model.diagrams.map((diagram) =>
      withMergedPlacement(diagram, elementId, intoId),
    ),
    threats: model.threats.map((threat) =>
      threat.elements.includes(elementId)
        ? { ...threat, elements: renamed(threat.elements) }
        : threat,
    ),
  });
}

function withMergedReferences(
  element: Element,
  elementId: ElementId,
  intoId: ElementId,
  renamed: (ids: readonly ElementId[]) => ElementId[],
): Element {
  const relisted = relistedRelationships(element, (ids) =>
    renamed(ids).filter((id) => id !== element.id),
  );
  if (relisted.kind !== 'flow') {
    return relisted;
  }
  const end = (held: FlowEndpoint): FlowEndpoint =>
    held.kind === 'attached' && held.element === elementId
      ? { kind: 'attached', element: intoId }
      : held;
  const source = end(relisted.source);
  const target = end(relisted.target);
  return source === relisted.source && target === relisted.target
    ? relisted
    : { ...relisted, source, target };
}

function withMergedPlacement(
  diagram: Diagram,
  elementId: ElementId,
  intoId: ElementId,
): Diagram {
  const placement = placementOn(diagram, elementId);
  if (placement === undefined) {
    return diagram;
  }
  return {
    ...diagram,
    placements:
      placementOn(diagram, intoId) === undefined
        ? diagram.placements.map((held) =>
            held === placement ? { ...held, element: intoId } : held,
          )
        : diagram.placements.filter((held) => held !== placement),
  };
}

function endIds(flow: Flow): (ElementId | undefined)[] {
  return [flow.source, flow.target].map((end) =>
    end.kind === 'attached' ? end.element : undefined,
  );
}
