import {
  diagramsOf,
  mergeOutcome,
  type ElementId,
  type Model,
} from '@saerskriven/model';
import { diagramTitle } from '../messages/diagram-title.js';
import { sentences } from '../messages/said.js';
import { Action } from '../store/actions.js';
import { elementById, selectedElement } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { changedModel, dispatch, modelStore } from '../store/store.js';
import { openPicker, type ExistingEntry } from './add-existing.js';
import { announce, spokenElement } from './announcements.js';
import { focusElement } from './edits.js';

/**
 * The one element selected, where the model holds another element of its
 * kind to merge into it, and undefined otherwise.
 */
export function mergeTarget(state: State): ElementId | undefined {
  const selected = selectedElement(state);
  const kept =
    selected === undefined ? undefined : elementById(state, selected);
  return kept !== undefined &&
    state.present.elements.some(
      ({ id, kind }) => id !== kept.id && kind === kept.kind,
    )
    ? kept.id
    : undefined;
}

/** Whether Merge an element into this one has an element to keep and another of its kind to merge. */
export function mergeable(state: State): boolean {
  return mergeTarget(state) !== undefined;
}

/** Every element of the kind of the one `intoId` names but that one, in the model's order, each with the diagrams that place it. */
export function mergeEntries(
  model: Model,
  intoId: ElementId,
): readonly ExistingEntry[] {
  const into = model.elements.find(({ id }) => id === intoId);
  return into === undefined
    ? []
    : model.elements
        .filter(({ id, kind }) => id !== intoId && kind === into.kind)
        .map((element) => ({
          element,
          diagrams: diagramsOf(model, element.id),
        }));
}

/** Opens the picker on the element to merge into the one selected, where {@link mergeTarget} finds one. */
export function openMergeInto(): void {
  const into = mergeTarget(modelStore.getState());
  if (into !== undefined) {
    openPicker({ kind: 'merge', into });
  }
}

/**
 * Merges `elementId` into `intoId` as one undo step, then selects and
 * focuses the element kept and says what was merged and the diagrams where
 * its placement was dropped. A refusal is the failure notice's to say.
 */
export function mergeInto(elementId: ElementId, intoId: ElementId): boolean {
  const state = modelStore.getState();
  const merged = elementById(state, elementId);
  const kept = elementById(state, intoId);
  const dropped = mergeOutcome(state.present, elementId, intoId).dropped.map(
    ({ title }) => title,
  );
  if (
    !changedModel(Action.MergeElements({ elementId, intoId })) ||
    merged === undefined ||
    kept === undefined
  ) {
    return false;
  }
  dispatch(Action.Select({ elementIds: [intoId] }));
  focusElement(intoId);
  announce((t) =>
    sentences(
      t('canvas.merged', {
        element: spokenElement(t, merged),
        into: spokenElement(t, kept),
      }),
      dropped.length === 0
        ? ''
        : t('canvas.merge-dropped', {
            diagrams: dropped.map((title) => diagramTitle(title, t)),
          }),
    ),
  );
  return true;
}
