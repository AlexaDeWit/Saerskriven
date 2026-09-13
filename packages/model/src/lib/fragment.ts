import { restrictRelationships } from './relationships.js';
import { Either } from 'effect';
import { linkAssumption } from './assumption-operations.js';
import type { Assumption } from './assumptions.js';
import type { Element } from './elements.js';
import type { DiagramId, ElementId, ThreatId } from './ids.js';
import { linkMitigation } from './mitigation-operations.js';
import type { Mitigation } from './mitigations.js';
import { OperationFailure } from './operation-failures.js';
import { parseModel, type Model } from './parse.js';
import { translatedElement } from './operations.js';
import type { Point } from './geometry.js';

/**
 * Copies a selection and its flow endpoints, with related records restricted
 * to the copied graph. A copied assumption leaves its model link behind,
 * since that link belongs to the source model.
 */
export function selectionFragment(
  model: Model,
  diagramId: DiagramId,
  selection: readonly ElementId[],
): Either.Either<Model, OperationFailure> {
  const diagram = model.diagrams.find(
    (candidate) => candidate.id === diagramId,
  );
  if (diagram === undefined) {
    return Either.left(OperationFailure.UnknownDiagram({ diagramId }));
  }
  return Either.flatMap(
    closedSelection(diagram.elements, selection),
    (included) => {
      const elements = diagram.elements
        .filter((element) => included.has(element.id))
        .map((element) => restrictRelationships(element, included));
      const threats = model.threats
        .filter((threat) => threat.elements.some((id) => included.has(id)))
        .map((threat) => ({
          ...threat,
          elements: threat.elements.filter((id) => included.has(id)),
        }));
      const threatIds = new Set(threats.map((threat) => threat.id));
      return checkedFragment({
        ...model,
        diagrams: [{ ...diagram, elements }],
        threats,
        mitigations: model.mitigations
          .filter((item) => item.threats.some((id) => threatIds.has(id)))
          .map((item) => ({
            ...item,
            threats: item.threats.filter((id) => threatIds.has(id)),
          })),
        assumptions: model.assumptions
          .filter((item) => item.threats.some((id) => threatIds.has(id)))
          .map((item) => ({
            ...item,
            threats: item.threats.filter((id) => threatIds.has(id)),
            appliesToModel: false,
          })),
      });
    },
  );
}

function closedSelection(
  elements: readonly Element[],
  selection: readonly ElementId[],
): Either.Either<Set<ElementId>, OperationFailure> {
  const known = new Map(elements.map((element) => [element.id, element]));
  const included = new Set(selection);
  for (const id of included) {
    const element = known.get(id);
    if (element === undefined) {
      return Either.left(OperationFailure.UnknownElement({ elementId: id }));
    }
    if (element.kind === 'flow') {
      for (const end of [element.source, element.target]) {
        if (end.kind === 'attached') {
          included.add(end.element);
        }
      }
    }
  }
  for (const element of elements) {
    if (
      element.kind === 'flow' &&
      element.source.kind === 'attached' &&
      element.target.kind === 'attached' &&
      included.has(element.source.element) &&
      included.has(element.target.element)
    ) {
      included.add(element.id);
    }
  }
  return Either.right(included);
}

/**
 * Remaps every ID under a fresh prefix and translates copied geometry. A
 * mitigation or assumption `target` holds an identical record of keeps its
 * id, so {@link insertFragment} links to that record instead of cloning it.
 */
export function remapFragment(
  fragment: Model,
  prefix: string,
  offset: Point,
  target: Model,
): Either.Either<Model, OperationFailure> {
  const renamed = (id: string) => prefix + ':' + id;
  const heldMitigation = identicalIn(target.mitigations, sameMitigation);
  const heldAssumption = identicalIn(target.assumptions, sameAssumption);
  return checkedFragment({
    ...fragment,
    diagrams: fragment.diagrams.map((diagram) => ({
      ...diagram,
      id: renamed(diagram.id),
      elements: diagram.elements.map((element) =>
        renamedElement(translatedElement(element, offset), renamed),
      ),
    })),
    threats: fragment.threats.map((item) => ({
      ...item,
      id: renamed(item.id),
      elements: item.elements.map(renamed),
    })),
    mitigations: fragment.mitigations.map((item) => ({
      ...item,
      id: heldMitigation(item) ? item.id : renamed(item.id),
      threats: item.threats.map(renamed),
    })),
    assumptions: fragment.assumptions.map((item) => ({
      ...item,
      id: heldAssumption(item) ? item.id : renamed(item.id),
      threats: item.threats.map(renamed),
    })),
  });
}

function renamedElement(element: Element, renamed: (id: string) => string) {
  if (element.kind === 'flow') {
    return {
      ...element,
      id: renamed(element.id),
      ...(element.trustBoundaryIds === undefined
        ? {}
        : { trustBoundaryIds: element.trustBoundaryIds.map(renamed) }),
      source:
        element.source.kind === 'attached'
          ? { ...element.source, element: renamed(element.source.element) }
          : element.source,
      target:
        element.target.kind === 'attached'
          ? { ...element.target, element: renamed(element.target.element) }
          : element.target,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      ...element,
      id: renamed(element.id),
      ...(element.containedElements === undefined
        ? {}
        : { containedElements: element.containedElements.map(renamed) }),
      ...(element.crossingFlows === undefined
        ? {}
        : { crossingFlows: element.crossingFlows.map(renamed) }),
    };
  }
  return { ...element, id: renamed(element.id) };
}

/**
 * Inserts one copied graph atomically and issues new threat numbers. A
 * copied record identical to one the model holds adds its pasted threat
 * links to that record, which keeps its own `appliesToModel`. Every other
 * copied record linked to a pasted threat is added as a clone, an
 * assumption with no model link. An element, threat or record ID the model
 * holds, other than an identical record's, refuses the insertion.
 */
export function insertFragment(
  model: Model,
  diagramId: DiagramId,
  fragment: Model,
): Either.Either<Model, OperationFailure> {
  if (!model.diagrams.some((diagram) => diagram.id === diagramId)) {
    return Either.left(OperationFailure.UnknownDiagram({ diagramId }));
  }
  const elements = fragment.diagrams.flatMap((diagram) => diagram.elements);
  if (elements.length === 0) {
    return Either.right(model);
  }
  const { mitigations, assumptions } = pastedRecords(model, fragment);
  const graph: Model = {
    ...model,
    diagrams: model.diagrams.map((diagram) =>
      diagram.id === diagramId
        ? { ...diagram, elements: [...diagram.elements, ...elements] }
        : diagram,
    ),
    threats: [
      ...model.threats,
      ...fragment.threats.map((threat, index) => ({
        ...threat,
        number: model.lastIssuedThreatNumber + index + 1,
      })),
    ],
    lastIssuedThreatNumber:
      model.lastIssuedThreatNumber + fragment.threats.length,
  };
  const links: ((current: Model) => Either.Either<Model, OperationFailure>)[] =
    [
      ...mitigations.linked.flatMap(({ id, threats }) =>
        threats.map(
          (threatId) => (current: Model) =>
            linkMitigation(current, id, threatId),
        ),
      ),
      ...assumptions.linked.flatMap(({ id, threats }) =>
        threats.map(
          (threatId) => (current: Model) =>
            linkAssumption(current, id, threatId),
        ),
      ),
    ];
  const linked = links.reduce<Either.Either<Model, OperationFailure>>(
    (result, link) => Either.flatMap(result, link),
    Either.right(graph),
  );
  return Either.flatMap(linked, (withLinks) =>
    checkedFragment({
      ...withLinks,
      mitigations: [...withLinks.mitigations, ...mitigations.cloned],
      assumptions: [
        ...withLinks.assumptions,
        ...assumptions.cloned.map((item) => ({
          ...item,
          appliesToModel: false,
        })),
      ],
    }),
  );
}

/**
 * How many of a remapped fragment's records {@link insertFragment} links to
 * an identical record `model` holds, and how many it adds as clones.
 */
export function fragmentRecordCounts(
  model: Model,
  fragment: Model,
): { readonly linked: number; readonly cloned: number } {
  const { mitigations, assumptions } = pastedRecords(model, fragment);
  return {
    linked: mitigations.linked.length + assumptions.linked.length,
    cloned: mitigations.cloned.length + assumptions.cloned.length,
  };
}

type Split<Held> = { readonly linked: Held[]; readonly cloned: Held[] };

function pastedRecords(
  model: Model,
  fragment: Model,
): {
  readonly mitigations: Split<Mitigation>;
  readonly assumptions: Split<Assumption>;
} {
  return {
    mitigations: splitRecords(
      fragment.mitigations,
      identicalIn(model.mitigations, sameMitigation),
    ),
    assumptions: splitRecords(
      fragment.assumptions,
      identicalIn(model.assumptions, sameAssumption),
    ),
  };
}

function splitRecords<Held extends { readonly threats: readonly ThreatId[] }>(
  copies: readonly Held[],
  identical: (copy: Held) => boolean,
): Split<Held> {
  const pasted = copies.filter((copy) => copy.threats.length > 0);
  return {
    linked: pasted.filter(identical),
    cloned: pasted.filter((copy) => !identical(copy)),
  };
}

function identicalIn<Held extends { readonly id: string }>(
  held: readonly Held[],
  same: (held: Held, copy: Held) => boolean,
): (copy: Held) => boolean {
  const byId = new Map(held.map((record) => [record.id, record]));
  return (copy) => {
    const record = byId.get(copy.id);
    return record !== undefined && same(record, copy);
  };
}

function sameMitigation(held: Mitigation, copy: Mitigation): boolean {
  return (
    held.title === copy.title &&
    held.prose === copy.prose &&
    held.status === copy.status
  );
}

function sameAssumption(held: Assumption, copy: Assumption): boolean {
  return held.prose === copy.prose && held.status === copy.status;
}

function checkedFragment(
  input: unknown,
): Either.Either<Model, OperationFailure> {
  return Either.mapLeft(parseModel(input), ({ issues }) =>
    OperationFailure.InvalidFragment({ issues }),
  );
}
