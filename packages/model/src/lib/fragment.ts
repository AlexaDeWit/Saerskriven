import { Either } from 'effect';
import { linkAssumption } from './assumption-operations.js';
import type { Assumption } from './assumptions.js';
import {
  diagramIndexOf,
  locatedDiagram,
  type UnknownElementFailure,
} from './diagram-edits.js';
import type { ThreatCategory } from './categories.js';
import type { Decimals } from './decimals.js';
import { translatedElement } from './element-geometry.js';
import type { Element } from './elements.js';
import type { Point } from './geometry.js';
import type { DiagramId, ElementId, ThreatId } from './ids.js';
import { linkMitigation } from './mitigation-operations.js';
import type { Mitigation } from './mitigations.js';
import { OperationFailure } from './operation-failures.js';
import { parseModel, type Model } from './parse.js';
import { withId } from './records.js';
import { elementsAcross, elementsById } from './references.js';
import { restrictRelationships } from './relationships.js';
import type { Threat } from './threats.js';

/** The failures {@link selectionFragment} can produce. */
export type SelectionFragmentFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownDiagram' | 'UnknownElement' | 'InvalidFragment' }
>;

/** The failure {@link remapFragment} can produce. */
export type RemapFragmentFailure = Extract<
  OperationFailure,
  { _tag: 'InvalidFragment' }
>;

/** The failures {@link insertFragment} can produce. */
export type InsertFragmentFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'UnknownDiagram'
      | 'InvalidFragment'
      | 'UnknownMitigation'
      | 'UnknownAssumption'
      | 'UnknownThreat';
  }
>;

/**
 * Copies a selection and its flow endpoints, with related records restricted
 * to the copied graph. A copied threat or assumption leaves its model link
 * behind, since that link belongs to the source model.
 */
export function selectionFragment(
  model: Model,
  diagramId: DiagramId,
  selection: readonly ElementId[],
): Either.Either<Model, SelectionFragmentFailure> {
  return Either.flatMap(locatedDiagram(model, diagramId), (diagram) =>
    Either.flatMap(closedSelection(diagram.elements, selection), (included) => {
      const elements = diagram.elements
        .filter((element) => included.has(element.id))
        .map((element) => restrictRelationships(element, included));
      const threats = model.threats
        .filter((threat) => threat.elements.some((id) => included.has(id)))
        .map((threat) => ({
          ...threat,
          elements: threat.elements.filter((id) => included.has(id)),
          appliesToModel: false,
        }));
      const threatIds = new Set(threats.map((threat) => threat.id));
      return checkedFragment({
        ...model,
        diagrams: [{ ...diagram, elements }],
        threats,
        mitigations: restrictedLinks(model.mitigations, threatIds),
        assumptions: restrictedLinks(model.assumptions, threatIds).map(
          (item) => ({ ...item, appliesToModel: false }),
        ),
      });
    }),
  );
}

/**
 * Remaps every ID under a fresh prefix and translates copied geometry, each
 * point it moves stored at `decimals`. A mitigation or assumption of which
 * `target` holds an identical record keeps its id, so {@link insertFragment}
 * links to that record instead of cloning it. So does a threat identical to
 * one `target` holds that applies to the model, which {@link insertFragment}
 * attaches the pasted elements to. Threat numbers stay as copied for
 * {@link insertFragment} to settle.
 */
export function remapFragment(
  fragment: Model,
  prefix: string,
  offset: Point,
  target: Model,
  decimals?: Decimals,
): Either.Either<Model, RemapFragmentFailure> {
  const renamed = (id: string) => prefix + ':' + id;
  const heldMitigation = identicalIn(target.mitigations, sameMitigation);
  const heldAssumption = identicalIn(target.assumptions, sameAssumption);
  const held = new Set<string>(
    fragmentHeldThreats(target, fragment).map(({ id }) => id),
  );
  const renamedThreat = (id: string) => (held.has(id) ? id : renamed(id));
  return checkedFragment({
    ...fragment,
    diagrams: fragment.diagrams.map((diagram) => ({
      ...diagram,
      id: renamed(diagram.id),
      elements: diagram.elements.map((element) =>
        renamedElement(translatedElement(element, offset, decimals), renamed),
      ),
    })),
    threats: fragment.threats.map((item) => ({
      ...item,
      id: renamedThreat(item.id),
      elements: item.elements.map(renamed),
    })),
    mitigations: fragment.mitigations.map((item) => ({
      ...item,
      id: heldMitigation(item) ? item.id : renamed(item.id),
      threats: item.threats.map(renamedThreat),
    })),
    assumptions: fragment.assumptions.map((item) => ({
      ...item,
      id: heldAssumption(item) ? item.id : renamed(item.id),
      threats: item.threats.map(renamedThreat),
    })),
  });
}

/**
 * Inserts one copied graph atomically. A copied threat identical to one the
 * model holds that applies to the model is not pasted: the held threat takes
 * the pasted elements and changes in nothing else, so a link a copied record
 * holds to it is left behind. Every other copied threat is pasted, with no
 * model link. It keeps its number when no threat in the model holds it, so a
 * cut then paste restores a threat's number, and otherwise takes a new number
 * above the last issued and every kept one, so the last issued number never
 * ends below a pasted number. A copied record identical to one the model
 * holds adds its pasted threat links to that record, which keeps its own
 * `appliesToModel`. Every other copied record linked to a pasted threat is
 * added as a clone, an assumption with no model link. An element, threat or
 * record ID the model holds, other than an identical one's, refuses the
 * insertion.
 */
export function insertFragment(
  model: Model,
  diagramId: DiagramId,
  fragment: Model,
): Either.Either<Model, InsertFragmentFailure> {
  const target = diagramIndexOf(model, diagramId);
  if (Either.isLeft(target)) {
    return Either.left(target.left);
  }
  const elements = elementsAcross(fragment.diagrams);
  if (elements.length === 0) {
    return Either.right(model);
  }
  const { threats, mitigations, assumptions } = pastedRegister(model, fragment);
  const graph: Model = {
    ...model,
    ...numberedThreats(model, threats),
    diagrams: model.diagrams.map((diagram) =>
      diagram.id === diagramId
        ? { ...diagram, elements: [...diagram.elements, ...elements] }
        : diagram,
    ),
  };
  return Either.flatMap(
    linkedRecords(graph, mitigations.linked, assumptions.linked),
    (withLinks) =>
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
  const { mitigations, assumptions } = pastedRegister(model, fragment);
  return {
    linked: mitigations.linked.length + assumptions.linked.length,
    cloned: mitigations.cloned.length + assumptions.cloned.length,
  };
}

/**
 * The threats of a fragment that `model` holds: each is identical to a
 * threat of `model` that applies to the model, so {@link insertFragment}
 * attaches the pasted elements to that threat in place of pasting this one.
 */
export function fragmentHeldThreats(model: Model, fragment: Model): Threat[] {
  return fragment.threats.filter(heldModelThreat(model));
}

function numberedThreats(
  model: Model,
  { linked, cloned: pasted }: Split<Threat>,
): Pick<Model, 'threats' | 'lastIssuedThreatNumber'> {
  const attachments = new Map(linked.map(({ id, elements }) => [id, elements]));
  const claimed = new Set(model.threats.map(({ number }) => number));
  const renumbered: number[] = [];
  for (const [index, { number }] of pasted.entries()) {
    if (claimed.has(number)) {
      renumbered.push(index);
    } else {
      claimed.add(number);
    }
  }
  const floor = [...claimed].reduce(
    (highest, number) => Math.max(highest, number),
    model.lastIssuedThreatNumber,
  );
  const issued = new Map(
    renumbered.map((index, offset) => [index, floor + offset + 1]),
  );
  return {
    threats: [
      ...model.threats.map((threat) => {
        const elements = attachments.get(threat.id);
        return elements === undefined
          ? threat
          : {
              ...threat,
              elements: elements.reduce<ElementId[]>(
                (attached, id) => withId(attached, id),
                threat.elements,
              ),
            };
      }),
      ...pasted.map((threat, index) => ({
        ...threat,
        number: issued.get(index) ?? threat.number,
        appliesToModel: false,
      })),
    ],
    lastIssuedThreatNumber: floor + renumbered.length,
  };
}

function linkedRecords(
  graph: Model,
  mitigations: readonly Mitigation[],
  assumptions: readonly Assumption[],
): Either.Either<Model, InsertFragmentFailure> {
  const links: ((
    current: Model,
  ) => Either.Either<Model, InsertFragmentFailure>)[] = [
    ...mitigations.flatMap(({ id, threats }) =>
      threats.map(
        (threatId) => (current: Model) => linkMitigation(current, id, threatId),
      ),
    ),
    ...assumptions.flatMap(({ id, threats }) =>
      threats.map(
        (threatId) => (current: Model) => linkAssumption(current, id, threatId),
      ),
    ),
  ];
  return links.reduce<Either.Either<Model, InsertFragmentFailure>>(
    (result, link) => Either.flatMap(result, link),
    Either.right(graph),
  );
}

function closedSelection(
  elements: readonly Element[],
  selection: readonly ElementId[],
): Either.Either<Set<ElementId>, UnknownElementFailure> {
  const known = elementsById(elements);
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

function restrictedLinks<Linked extends { readonly threats: ThreatId[] }>(
  records: readonly Linked[],
  threatIds: ReadonlySet<string>,
): Linked[] {
  return records
    .filter((item) => item.threats.some((id) => threatIds.has(id)))
    .map((item) => ({
      ...item,
      threats: item.threats.filter((id) => threatIds.has(id)),
    }));
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

type Split<Held> = { readonly linked: Held[]; readonly cloned: Held[] };

function pastedRegister(
  model: Model,
  fragment: Model,
): {
  readonly threats: Split<Threat>;
  readonly mitigations: Split<Mitigation>;
  readonly assumptions: Split<Assumption>;
} {
  const threats = split(fragment.threats, heldModelThreat(model));
  const pasted = new Set(threats.cloned.map(({ id }) => id));
  return {
    threats,
    mitigations: split(
      restrictedLinks(fragment.mitigations, pasted),
      identicalIn(model.mitigations, sameMitigation),
    ),
    assumptions: split(
      restrictedLinks(fragment.assumptions, pasted),
      identicalIn(model.assumptions, sameAssumption),
    ),
  };
}

function split<Held>(
  copies: readonly Held[],
  identical: (copy: Held) => boolean,
): Split<Held> {
  return {
    linked: copies.filter(identical),
    cloned: copies.filter((copy) => !identical(copy)),
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

function heldModelThreat(model: Model): (copy: Threat) => boolean {
  return identicalIn(model.threats, sameModelThreat);
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

function sameModelThreat(held: Threat, copy: Threat): boolean {
  return (
    held.appliesToModel &&
    held.number === copy.number &&
    held.title === copy.title &&
    held.description === copy.description &&
    held.severity === copy.severity &&
    held.status === copy.status &&
    sameCategory(held.category, copy.category)
  );
}

function sameCategory(held: ThreatCategory, copy: ThreatCategory): boolean {
  return (
    held.methodology === copy.methodology &&
    held.category === copy.category &&
    (held.methodology !== 'custom' ||
      copy.methodology !== 'custom' ||
      held.methodologyName === copy.methodologyName)
  );
}

function checkedFragment(
  input: unknown,
): Either.Either<Model, RemapFragmentFailure> {
  return Either.mapLeft(parseModel(input), ({ issues }) =>
    OperationFailure.InvalidFragment({ issues }),
  );
}
