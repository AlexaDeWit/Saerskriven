import {
  diagramsOf,
  type Diagram,
  type DiagramId,
  type ElementId,
  type Model,
} from '@saerskriven/model';

const sharedByDiagrams = new WeakMap<
  readonly Diagram[],
  ReadonlySet<ElementId>
>();

/**
 * The elements placed on more than one of `diagrams`. The set is worked out
 * once per array, so a selector reading it on every node costs one lookup.
 */
export function sharedElementIds(
  diagrams: readonly Diagram[],
): ReadonlySet<ElementId> {
  const held = sharedByDiagrams.get(diagrams);
  if (held !== undefined) {
    return held;
  }
  const seen = new Set<ElementId>();
  const shared = new Set<ElementId>();
  for (const { placements } of diagrams) {
    for (const { element } of placements) {
      if (seen.has(element)) {
        shared.add(element);
      }
      seen.add(element);
    }
  }
  sharedByDiagrams.set(diagrams, shared);
  return shared;
}

/** The diagrams other than `shownOn` that place `elementId`, in the model's order. */
export function otherDiagrams(
  model: Pick<Model, 'diagrams'>,
  elementId: ElementId,
  shownOn: DiagramId,
): readonly Diagram[] {
  return sharedElementIds(model.diagrams).has(elementId)
    ? diagramsOf(model, elementId).filter(({ id }) => id !== shownOn)
    : [];
}
