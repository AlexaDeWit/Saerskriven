import {
  diagramsOf,
  elementIdsIn,
  type DiagramId,
  type ElementId,
  type Model,
} from '@saerskriven/model';

/** One element a Delete acts on, and whether it leaves the model or one diagram. */
export type Deletion = {
  readonly elementId: ElementId;
  readonly fromModel: boolean;
};

/**
 * What a Delete on the diagram `diagramId` names does to each of
 * `elementIds`, in their order: an element also on another diagram comes off
 * this one, and an element on this diagram alone leaves the model. An id the
 * diagram does not place is left out, so a selection gone stale never
 * reaches past the diagram on screen.
 */
export function deletionsOn(
  model: Model,
  diagramId: DiagramId,
  elementIds: readonly ElementId[],
): readonly Deletion[] {
  const diagram = model.diagrams.find(({ id }) => id === diagramId);
  const placed =
    diagram === undefined ? new Set<string>() : elementIdsIn(diagram);
  return [...new Set(elementIds)]
    .filter((elementId) => placed.has(elementId))
    .map((elementId) => ({
      elementId,
      fromModel: diagramsOf(model, elementId).length === 1,
    }));
}
