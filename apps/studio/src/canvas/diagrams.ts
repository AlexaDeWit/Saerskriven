import { generateDiagramId, type DiagramId } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import { activeDiagram, activeDiagramId } from '../store/selectors.js';
import { untitledDiagram } from '../store/state.js';
import { changedModel, dispatch, modelStore } from '../store/store.js';
import { externalStore } from '../ui/external-store.js';
import { announce, nameQuoteLength, quoted } from './announcements.js';

/** Puts the diagram `diagramId` names on screen and says so, where it was not already. */
export function showDiagram(diagramId: DiagramId): boolean {
  const before = activeDiagramId(modelStore.getState());
  dispatch(Action.SelectDiagram({ diagramId }));
  const shown = activeDiagram(modelStore.getState());
  if (shown === undefined || shown.id === before) {
    return false;
  }
  announce(`Showing ${quoted(shown.title, nameQuoteLength)}.`);
  return true;
}

/** Shows the next or previous diagram in the model's order, wrapping at either end. */
export function stepDiagram(direction: 'next' | 'previous'): boolean {
  const state = modelStore.getState();
  const diagrams = state.present.diagrams;
  const current = activeDiagramId(state);
  const at = diagrams.findIndex((diagram) => diagram.id === current);
  if (diagrams.length < 2 || at < 0) {
    return false;
  }
  const step = direction === 'next' ? 1 : diagrams.length - 1;
  const target = diagrams[(at + step) % diagrams.length];
  return target === undefined ? false : showDiagram(target.id);
}

/** Adds an empty diagram after the others, shows it, and opens its title for editing. */
export function createDiagram(): boolean {
  const diagram = {
    id: generateDiagramId(),
    title: untitledDiagram,
    elements: [],
  };
  if (!changedModel(Action.AddDiagram({ diagram }))) {
    return false;
  }
  announce(`Added ${quoted(diagram.title, nameQuoteLength)}.`);
  beginRenamingDiagram();
  return true;
}

/** Retitles the diagram on screen as one undo step, skipping an unchanged title. */
export function renameActiveDiagram(title: string): boolean {
  const state = modelStore.getState();
  const diagram = activeDiagram(state);
  if (diagram === undefined || diagram.title === title) {
    return false;
  }
  dispatch(Action.RenameDiagram({ diagramId: diagram.id, title }));
  const renamed = activeDiagram(modelStore.getState());
  if (renamed === undefined || renamed.title !== title) {
    return false;
  }
  announce(`Renamed the diagram to ${quoted(title, nameQuoteLength)}.`);
  return true;
}

let renaming: DiagramId | undefined;

const renamingStore = externalStore(() => renaming);

/** Opens the title of the diagram on screen in the switcher's field. */
export function beginRenamingDiagram(): void {
  setRenaming(activeDiagramId(modelStore.getState()));
}

/** Closes the switcher's title field, committed or not. */
export function endRenamingDiagram(): void {
  setRenaming(undefined);
}

/**
 * The diagram whose title the switcher's field is open on. It names the
 * diagram, so a field is not left open over another diagram put on screen.
 */
export function useDiagramRenaming(): DiagramId | undefined {
  return renamingStore.use();
}

/** Puts the switcher back to its button, for specs. */
export function resetDiagramRenaming(): void {
  setRenaming(undefined);
}

function setRenaming(next: DiagramId | undefined): void {
  if (renaming === next) {
    return;
  }
  renaming = next;
  renamingStore.notify();
}
