import {
  elementsAcross,
  takesAccent,
  type Accent,
  type AccentableElement,
  type Diagram,
  type DiagramId,
  type Element,
  type ElementId,
  type Model,
} from '@saerskriven/model';
import {
  FileLifecycle,
  nameOf,
  placeholderModel,
  type State,
} from './state.js';

const productName = 'Saerskriven';

/** The model on screen is not the saved one, compared by identity. */
export function isDirty(state: State): boolean {
  return state.present !== state.saved;
}

/**
 * Whether replacing the model loses work: unsaved changes, or a recovery
 * snapshot that startup could not read or left unrestored, and that the
 * replacement's recovery write would overwrite or clear. Open, New model and
 * a shared link ask on it before they replace the model.
 */
export function holdsUnsavedWork(state: State): boolean {
  return isDirty(state) || state.recoveryUnread;
}

/** The dirty session lacks a confirmed recovery write. */
export function needsCloseGuard(state: State): boolean {
  return isDirty(state) && !state.recoveryCurrent;
}

/** There is a model to go back to. */
export function canUndo(state: State): boolean {
  return state.past.length > 0;
}

/** There is a model to go forward to. */
export function canRedo(state: State): boolean {
  return state.future.length > 0;
}

/**
 * The diagram on screen: the one `activeDiagram` names while the model holds
 * it, and the model's first diagram otherwise.
 */
export function activeDiagram(
  state: Pick<State, 'present' | 'activeDiagram'>,
): Diagram | undefined {
  return (
    state.present.diagrams.find(
      (diagram) => diagram.id === state.activeDiagram,
    ) ?? state.present.diagrams.at(0)
  );
}

/** Whether `model` holds a diagram of id `diagramId`. */
export function holdsDiagram(
  model: Model,
  diagramId: DiagramId | undefined,
): boolean {
  return (
    diagramId !== undefined &&
    model.diagrams.some((diagram) => diagram.id === diagramId)
  );
}

/** The id of {@link activeDiagram}. */
export function activeDiagramId(
  state: Pick<State, 'present' | 'activeDiagram'>,
): DiagramId | undefined {
  return activeDiagram(state)?.id;
}

/** Whether the model holds a diagram to switch to. */
export function severalDiagrams(state: State): boolean {
  return state.present.diagrams.length > 1;
}

/** The element `elementId` names, in whichever diagram holds it. */
export function elementById(
  state: State,
  elementId: ElementId,
): Element | undefined {
  return elementsAcross(state.present.diagrams).find(
    (element) => element.id === elementId,
  );
}

/** The selected element ID where exactly one is selected. */
export function selectedElement(state: State): ElementId | undefined {
  return state.selection.length === 1 ? state.selection.at(0) : undefined;
}

/** The record of the one selected element. */
export function selectedElementRecord(state: State): Element | undefined {
  const selected = selectedElement(state);
  return selected === undefined ? undefined : elementById(state, selected);
}

/** The selected element IDs, in selection order. */
export function selectedElements(state: State): readonly ElementId[] {
  return state.selection;
}

/** The selected elements of a kind that takes an accent, in selection order. */
export function accentableSelection(
  state: State,
): readonly AccentableElement[] {
  const selected = new Set<string>(state.selection);
  const held = new Map(
    elementsAcross(state.present.diagrams)
      .filter((element) => selected.has(element.id))
      .map((element) => [element.id, element]),
  );
  return state.selection.flatMap((elementId) => {
    const element = held.get(elementId);
    return element !== undefined && takesAccent(element) ? [element] : [];
  });
}

/**
 * What the selection's accent is, over the selected elements that take one:
 * the key they all hold, `none` where none of them holds one, `mixed` where
 * they differ, and `inactive` where no selected element takes an accent.
 */
export function selectionAccent(
  state: State,
): Accent | 'none' | 'mixed' | 'inactive' {
  const accents = new Set(
    accentableSelection(state).map((element) => element.accent ?? 'none'),
  );
  const [only] = accents;
  if (only === undefined) {
    return 'inactive';
  }
  return accents.size === 1 ? only : 'mixed';
}

/** Whether the one selected element has a name a field can open, which a text note has not. */
export function renameable(state: State): boolean {
  const selected = selectedElement(state);
  return selected !== undefined && nameEditable(state, selected);
}

/** The model while both history stacks are empty, and nothing once they are not. */
export function modelAsOpened(state: State): Model | undefined {
  return state.past.length === 0 && state.future.length === 0
    ? state.present
    : undefined;
}

/** Whether the studio is on its untouched placeholder model with no file. */
export function showingPlaceholder(state: State): boolean {
  return (
    modelAsOpened(state) === placeholderModel &&
    FileLifecycle.$is('NoFile')(state.file)
  );
}

/** The browser tab's name: {@link nameOf} the file, then the product name. */
export function windowTitle(state: State, untitled: string): string {
  return `${nameOf(state.file, untitled)} - ${productName}`;
}

function nameEditable(state: State, elementId: ElementId): boolean {
  const element = elementById(state, elementId);
  return element !== undefined && element.kind !== 'text';
}
