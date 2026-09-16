import { Data, Either } from 'effect';
import type { Element, Flow } from './elements.js';
import type { ElementId, ThreatId } from './ids.js';
import type { Diagram } from './model.js';
import type { Threat } from './threats.js';

/**
 * One attached flow endpoint that cannot anchor where it points: at the
 * flow itself, or at an id absent from the diagram meant to hold the flow.
 */
export type EndpointViolation = {
  readonly side: 'source' | 'target';
  readonly reference: ElementId;
  readonly reason: 'self-anchored' | 'outside-diagram';
};

/**
 * The violations among one flow's attached endpoints, checked against the
 * element ids of the diagram meant to hold it. The self check runs first,
 * so a candidate flow not yet in the diagram reports a self anchor as such
 * rather than as absent.
 */
export function endpointViolationsOf(
  flow: Flow,
  diagramElementIds: ReadonlySet<string>,
): EndpointViolation[] {
  return (['source', 'target'] as const).flatMap(
    (side): EndpointViolation[] => {
      const endpoint = flow[side];
      if (endpoint.kind !== 'attached') {
        return [];
      }
      if (endpoint.element === flow.id) {
        return [{ side, reference: endpoint.element, reason: 'self-anchored' }];
      }
      return diagramElementIds.has(endpoint.element)
        ? []
        : [{ side, reference: endpoint.element, reason: 'outside-diagram' }];
    },
  );
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

/** Ids of the elements one diagram owns. */
export function elementIdsIn(diagram: Diagram): Set<string> {
  return new Set(diagram.elements.map((element) => element.id));
}

/** Every element the given diagrams own, in diagram order. */
export function elementsAcross(diagrams: readonly Diagram[]): Element[] {
  return diagrams.flatMap((diagram) => diagram.elements);
}

/** Ids of every element across the given diagrams. */
export function elementIdsAcross(diagrams: readonly Diagram[]): Set<string> {
  return new Set(elementsAcross(diagrams).map((element) => element.id));
}

/**
 * The first of `elementIds` that names no element of the given diagrams,
 * and undefined where every one of them resolves.
 */
export function unknownElementIn(
  diagrams: readonly Diagram[],
  elementIds: readonly ElementId[],
): ElementId | undefined {
  const known = elementIdsAcross(diagrams);
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
