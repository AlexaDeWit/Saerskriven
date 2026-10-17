import {
  drawnElement,
  elementIdsIn,
  elementsById,
  type Element,
  type ElementId,
  type Model,
} from '@saerskriven/model';

/** A version of Saerskriven YAML a save writes. */
export type WrittenSaerskrivenYamlVersion = 2 | 3;

/**
 * The version a save of `model` writes: 2 while version 2 holds the model,
 * and 3 once it does not. Version 2 holds a model where every element is on
 * exactly one diagram and drawn there as a version 2 element, no flow end is
 * drawn away from its element, and every relationship list names elements
 * of the one diagram drawing the element that holds it.
 */
export function writtenSaerskrivenYamlVersion(
  model: Model,
): WrittenSaerskrivenYamlVersion {
  return fitsVersion2(model) ? 2 : 3;
}

/**
 * Whether an edit from `before` to `after` moves a Saerskriven YAML file
 * from version 2 to version 3, which a release reading only versions 1 and 2
 * refuses whole. A move back to version 2 is not one.
 */
export function movesToSaerskrivenYamlVersion3(
  before: Model,
  after: Model,
): boolean {
  return (
    writtenSaerskrivenYamlVersion(before) === 2 &&
    writtenSaerskrivenYamlVersion(after) === 3
  );
}

function fitsVersion2(model: Model): boolean {
  const elements = elementsById(model.elements);
  const drawnWith = new Map<ElementId, ReadonlySet<string>>();
  const placedOnce = model.diagrams.every((diagram) => {
    const placed = elementIdsIn(diagram);
    return diagram.placements.every((placement) => {
      const element = elements.get(placement.element);
      const placedBefore = drawnWith.has(placement.element);
      drawnWith.set(placement.element, placed);
      return (
        !placedBefore &&
        element !== undefined &&
        drawnElement(element, placement) !== undefined
      );
    });
  });
  return (
    placedOnce &&
    model.elements.every((element) => {
      const neighbours = drawnWith.get(element.id);
      return (
        neighbours !== undefined &&
        relatedIds(element).every((id) => neighbours.has(id))
      );
    })
  );
}

function relatedIds(element: Element): readonly ElementId[] {
  if (element.kind === 'flow') {
    return [
      ...[element.source, element.target].flatMap((end) =>
        end.kind === 'attached' ? [end.element] : [],
      ),
      ...(element.trustBoundaryIds ?? []),
    ];
  }
  return element.kind === 'trust-boundary'
    ? [...(element.containedElements ?? []), ...(element.crossingFlows ?? [])]
    : [];
}
