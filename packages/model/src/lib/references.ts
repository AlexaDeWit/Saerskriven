import { Data, Either } from 'effect';
import type { Element, ElementKind, Flow, FlowEndpoint } from './elements.js';
import type { ElementId, ThreatId } from './ids.js';
import type { Diagram } from './model.js';
import { isEmptyName } from './text.js';
import type { Threat } from './threats.js';

/**
 * One end of a flow as a reader names it: the element it attaches to, the id
 * of an attached element the lookup does not hold, or a free point.
 */
export type FlowEnd =
  | { readonly kind: 'element'; readonly element: Element }
  | { readonly kind: 'missing'; readonly element: ElementId }
  | { readonly kind: 'free' };

/** A flow's two ends and whether it runs both ways, which is what names a flow left unlabelled. */
export type FlowEnds = {
  readonly source: FlowEnd;
  readonly target: FlowEnd;
  readonly bidirectional: boolean;
};

/**
 * `element`, an element or one as a diagram draws it, where it is a flow left
 * unlabelled, which a reader names by its ends, and undefined otherwise. A
 * name of white space alone counts, since a file or a paste can still hold
 * one.
 */
export function unlabelledFlow<
  Held extends { readonly kind: ElementKind; readonly name: string },
>(element: Held): Extract<Held, { readonly kind: 'flow' }> | undefined {
  return isFlow(element) && isEmptyName(element.name) ? element : undefined;
}

function isFlow<Held extends { readonly kind: ElementKind }>(
  element: Held,
): element is Extract<Held, { readonly kind: 'flow' }> {
  return element.kind === 'flow';
}

/** The ends of `flow`, each attached one looked up in `elements`. */
export function flowEnds(
  flow: Flow,
  elements: ReadonlyMap<ElementId, Element>,
): FlowEnds {
  const end = (endpoint: FlowEndpoint): FlowEnd => {
    if (endpoint.kind === 'free') {
      return { kind: 'free' };
    }
    const element = elements.get(endpoint.element);
    return element === undefined
      ? { kind: 'missing', element: endpoint.element }
      : { kind: 'element', element };
  };
  return {
    source: end(flow.source),
    target: end(flow.target),
    bidirectional: flow.bidirectional,
  };
}

/**
 * What a reader calls one end of a flow: the name of the element it attaches
 * to, the element's id where {@link isEmptyName} finds no name or the lookup
 * lacked it, or `free`, the caller's word for a free point.
 */
export function flowEndName(end: FlowEnd, free: string): string {
  if (end.kind === 'free') {
    return free;
  }
  if (end.kind === 'missing') {
    return end.element;
  }
  return isEmptyName(end.element.name) ? end.element.id : end.element.name;
}

/**
 * The diagrams a name selects: the one whose id it is first, then every other
 * one whose title it is exactly, in document order. A caller taking the first
 * therefore never draws a diagram titled with another one's id.
 */
export function diagramsNamed(
  diagrams: readonly Diagram[],
  name: string,
): Diagram[] {
  return [
    ...diagrams.filter((diagram) => diagram.id === name),
    ...diagrams.filter(
      (diagram) => diagram.id !== name && diagram.title === name,
    ),
  ];
}

/**
 * Why {@link chosenDiagram} chose no diagram, as data for the caller to word:
 * no name and no diagram, no name and several, or a name that selects none.
 */
export type DiagramChoiceFailure = Data.TaggedEnum<{
  NoDiagram: {};
  SeveralDiagrams: { readonly diagrams: readonly Diagram[] };
  NoDiagramNamed: {
    readonly name: string;
    readonly diagrams: readonly Diagram[];
  };
}>;

/** Constructors for {@link DiagramChoiceFailure}, with Effect's `$is` and `$match`. */
export const DiagramChoiceFailure = Data.taggedEnum<DiagramChoiceFailure>();

/**
 * The diagram a caller means: without a name, the only one there is, and
 * with one, the first {@link diagramsNamed} selects.
 */
export function chosenDiagram(
  diagrams: readonly Diagram[],
  name: string | undefined,
): Either.Either<Diagram, DiagramChoiceFailure> {
  if (name !== undefined) {
    const [found] = diagramsNamed(diagrams, name);
    return found === undefined
      ? Either.left(DiagramChoiceFailure.NoDiagramNamed({ name, diagrams }))
      : Either.right(found);
  }
  const [only] = diagrams;
  if (only === undefined) {
    return Either.left(DiagramChoiceFailure.NoDiagram());
  }
  return diagrams.length === 1
    ? Either.right(only)
    : Either.left(DiagramChoiceFailure.SeveralDiagrams({ diagrams }));
}

/** Ids of the elements one diagram places. */
export function elementIdsIn(diagram: Diagram): Set<string> {
  return new Set(diagram.placements.map(({ element }) => element));
}

/** The given elements, or elements as a diagram draws them, keyed by id. */
export function elementsById<Held extends { readonly id: ElementId }>(
  elements: readonly Held[],
): Map<ElementId, Held> {
  return new Map(elements.map((element) => [element.id, element]));
}

/** Ids of every element the given diagrams place. */
export function elementIdsAcross(diagrams: readonly Diagram[]): Set<string> {
  return new Set(diagrams.flatMap((diagram) => [...elementIdsIn(diagram)]));
}

/**
 * The first of `elementIds` that names none of `elements`, and undefined
 * where every one of them resolves.
 */
export function unknownElementIn(
  elements: readonly Element[],
  elementIds: readonly ElementId[],
): ElementId | undefined {
  const known = new Set<string>(elements.map(({ id }) => id));
  return elementIds.find((elementId) => !known.has(elementId));
}

/**
 * The first of `threatIds` that names no threat of the given register, and
 * undefined where every one of them resolves.
 */
export function unknownThreatIn(
  threats: readonly Threat[],
  threatIds: readonly ThreatId[],
): ThreatId | undefined {
  const known = new Set<string>(threats.map((threat) => threat.id));
  return threatIds.find((threatId) => !known.has(threatId));
}
