import {
  generateDiagramId,
  type Diagram,
  type DiagramId,
  type ElementId,
} from '@saerskriven/model';
import { Action } from '../store/actions.js';
import { activeDiagram, activeDiagramId } from '../store/selectors.js';
import { activeTranslator } from '../messages/locale.js';
import { changedModel, dispatch, modelStore } from '../store/store.js';
import { externalStore } from '../ui/external-store.js';
import {
  announce,
  endAnnouncement,
  excerpt,
  nameQuoteLength,
  type Announcer,
} from './announcements.js';
import { focusElement } from './edits.js';

/**
 * Puts the diagram `diagramId` on screen without saying so, and ends any
 * status line still showing. It returns the diagram now on screen, or
 * `undefined` where nothing changed.
 */
export function switchDiagram(diagramId: DiagramId): Diagram | undefined {
  const before = activeDiagramId(modelStore.getState());
  dispatch(Action.SelectDiagram({ diagramId }));
  const shown = activeDiagram(modelStore.getState());
  if (shown === undefined || shown.id === before) {
    return undefined;
  }
  endAnnouncement();
  return shown;
}

/**
 * Puts the diagram `diagramId` names on screen and says so, where it was not
 * already. `announcer` says it: the status line draws it unless a caller
 * hands in `announceUndrawn`.
 */
export function showDiagram(
  diagramId: DiagramId,
  announcer: Announcer = announce,
): boolean {
  const shown = switchDiagram(diagramId);
  if (shown === undefined) {
    return false;
  }
  say('canvas.diagram-shown', shown, announcer);
  return true;
}

/**
 * Shows the diagram drawing `elementId`, selects the element and focuses it,
 * and says the diagram's title where another was on screen. It answers
 * whether the model holds the element.
 */
export function revealElement(elementId: ElementId): boolean {
  const diagram = modelStore
    .getState()
    .present.diagrams.find((held) =>
      held.elements.some(({ id }) => id === elementId),
    );
  if (diagram === undefined) {
    return false;
  }
  const shown = switchDiagram(diagram.id);
  dispatch(Action.Select({ elementIds: [elementId] }));
  focusElement(elementId);
  if (shown !== undefined) {
    say('canvas.diagram-shown', shown);
  }
  return true;
}

/**
 * Shows the next or previous diagram in the model's order, wrapping at either
 * end, and says which as {@link showDiagram} does.
 */
export function stepDiagram(
  direction: 'next' | 'previous',
  announcer: Announcer = announce,
): boolean {
  const state = modelStore.getState();
  const diagrams = state.present.diagrams;
  const current = activeDiagramId(state);
  const at = diagrams.findIndex((diagram) => diagram.id === current);
  if (diagrams.length < 2 || at < 0) {
    return false;
  }
  const step = direction === 'next' ? 1 : diagrams.length - 1;
  const target = diagrams[(at + step) % diagrams.length];
  return target === undefined ? false : showDiagram(target.id, announcer);
}

/**
 * Adds an empty diagram after the others, shows it, and opens its title for
 * editing. Its title is written in the active locale at creation and is model
 * content from then on.
 */
export function createDiagram(): boolean {
  const diagram = {
    id: generateDiagramId(),
    title: activeTranslator().t('defaults.untitled-diagram'),
    elements: [],
  };
  if (!changedModel(Action.AddDiagram({ diagram }))) {
    return false;
  }
  say('canvas.diagram-added', diagram);
  beginRenamingDiagram();
  return true;
}

/**
 * Retitles the diagram on screen as one undo step without saying so, skipping
 * an unchanged title. It returns the diagram as retitled, or `undefined`
 * where nothing changed.
 */
export function retitleActiveDiagram(title: string): Diagram | undefined {
  const diagram = activeDiagram(modelStore.getState());
  if (diagram === undefined || diagram.title === title) {
    return undefined;
  }
  dispatch(Action.RenameDiagram({ diagramId: diagram.id, title }));
  const retitled = activeDiagram(modelStore.getState());
  return retitled?.title === title ? retitled : undefined;
}

/** Retitles the diagram on screen and says so in the status line, where the title changed. */
export function renameActiveDiagram(title: string): boolean {
  const renamed = retitleActiveDiagram(title);
  if (renamed === undefined) {
    return false;
  }
  say('canvas.diagram-renamed', renamed);
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

function say(
  message:
    | 'canvas.diagram-shown'
    | 'canvas.diagram-added'
    | 'canvas.diagram-renamed',
  diagram: Pick<Diagram, 'title'>,
  announcer: Announcer = announce,
): void {
  const title = excerpt(diagram.title, nameQuoteLength);
  announcer((t) => t(message, { title }));
}

function setRenaming(next: DiagramId | undefined): void {
  if (renaming === next) {
    return;
  }
  renaming = next;
  renamingStore.notify();
}
