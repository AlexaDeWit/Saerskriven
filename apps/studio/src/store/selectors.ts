import {
  elementsAcross,
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
