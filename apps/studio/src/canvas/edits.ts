import type { CanvasNode, NodeBox } from '@saerskriven/canvas';
import {
  elementsAcross,
  type Element,
  type ElementId,
  type Model,
  type Point,
} from '@saerskriven/model';
import { Action } from '../store/actions.js';
import {
  activeDiagramId,
  elementById,
  renameable,
  selectedElement,
  selectedElementRecord,
} from '../store/selectors.js';
import type { State } from '../store/state.js';
import { changedModel, dispatch, modelStore } from '../store/store.js';
import { announce, quotedName } from './announcements.js';
import { flowEnds, freshBoundaryCurve, freshFlow } from './elements.js';
import { articleKindMessages } from '../messages/enum-labels.js';
import { sentences, type Speaker } from '../messages/said.js';
import { currentLayout } from './layout.js';
import { elementIds } from './nodes.js';

type RemovalCascade = {
  readonly flows: number;
  readonly threatLinks: number;
  readonly threats: number;
};

/** Places and selects one element, then opens its inline editor when asked. */
export function placeElement(element: Element, openNameField = true): boolean {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined) {
    return false;
  }
  return placed(
    Action.AddElement({ diagramId, element }),
    element.id,
    element.kind === 'text' ? 'note' : openNameField ? 'name' : undefined,
  );
}

/** Places a trust-boundary curve through its committed waypoints. */
export function placeBoundaryCurve(waypoints: readonly Point[]): boolean {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  if (diagramId === undefined || waypoints.length < 2) {
    return false;
  }
  const element = freshBoundaryCurve(waypoints);
  return placed(Action.AddElement({ diagramId, element }), element.id, 'name');
}

/** Draws a flow between two connectable elements. */
export function connectElements(source: ElementId, target: ElementId): void {
  const state = modelStore.getState();
  const diagramId = activeDiagramId(state);
  const ends = new Set(flowEnds(currentLayout(state)).map((node) => node.id));
  if (diagramId === undefined || !ends.has(source) || !ends.has(target)) {
    return;
  }
  const flow = freshFlow(source, target);
  added(Action.AddElement({ diagramId, element: flow }), flow.id);
}

/** Makes the selected flow bidirectional, or one-way again, as one undo step. */
export function toggleFlowDirection(): void {
  const flow = selectedElementRecord(modelStore.getState());
  if (flow?.kind !== 'flow') {
    return;
  }
  const bidirectional = !flow.bidirectional;
  if (
    changedModel(Action.SetFlowDirection({ elementId: flow.id, bidirectional }))
  ) {
    const { name } = flow;
    announce((t) =>
      t(bidirectional ? 'canvas.flow-both-ways' : 'canvas.flow-one-way', {
        flow: quotedName(t, name, t(articleKindMessages.flow)),
      }),
    );
  }
}

/** Removes the selection and announces its combined cascade once. */
export function removeSelected(): boolean {
  const state = modelStore.getState();
  const selection = state.selection;
  if (selection.length === 0) {
    return false;
  }
  const one = selection.at(0);
  const removed = removedSubject(state, selection);
  const cascade = removalCascade(state.present, selection);
  const action =
    selection.length === 1 && one !== undefined
      ? Action.RemoveElement({ elementId: one })
      : Action.RemoveElements({ elementIds: selection });
  if (!changedModel(action)) {
    return false;
  }
  announce((t) => describeRemoval(t, removed, cascade));
  return true;
}

/**
 * What a removal takes beyond the elements themselves, counted before it:
 * the flows it detaches, the threat links it drops, and the threats it
 * removes for want of a last attachment.
 */
export function removalCascade(
  model: Model,
  removedIds: ElementId | readonly ElementId[],
): RemovalCascade {
  const removed = new Set(
    Array.isArray(removedIds) ? removedIds : [removedIds],
  );
  return {
    flows: detachedFlows(model, removed),
    threatLinks: droppedThreatLinks(model, removed),
    threats: culledThreats(model, removed),
  };
}

/** What a removal took: one element by its own name and kind, or a count of them. */
export type RemovedSubject =
  | { readonly name: string; readonly kind: Element['kind'] }
  | { readonly count: number };

/** Describes removal with explicit counts, including zero. */
export function describeRemoval(
  t: Speaker,
  removed: RemovedSubject,
  cascade: RemovalCascade,
): string {
  return sentences(
    'count' in removed
      ? t('canvas.removed-elements', removed)
      : t('canvas.removed-named', {
          name: quotedName(
            t,
            removed.name,
            t(articleKindMessages[removed.kind]),
          ),
        }),
    t('canvas.flows-detached', { count: cascade.flows }),
    t('canvas.threat-links-dropped', { count: cascade.threatLinks }),
    t('canvas.threats-removed', { count: cascade.threats }),
  );
}

/** Opens the selected element's inline editor when its text is editable. */
export function renameSelected(): void {
  const state = modelStore.getState();
  const elementId = selectedElement(state);
  if (elementId !== undefined && renameable(state)) {
    beginEditingText(elementId);
  }
}

/** Selects every element in the diagram on screen. */
export function selectAll(): void {
  const layout = currentLayout(modelStore.getState());
  const selected = [...new Set(elementIds(layout).values())];
  dispatch(Action.Select({ elementIds: selected }));
}

/** Opens the text drawn on one canvas element for editing. */
export function beginEditingText(elementId: ElementId): boolean {
  const element = elementById(modelStore.getState(), elementId);
  if (element === undefined) {
    return false;
  }
  dispatch(
    Action.InlineEditing({
      editor: { kind: element.kind === 'text' ? 'note' : 'name', elementId },
    }),
  );
  return true;
}

/** Closes the inline editor and returns focus to its element. */
export function endInlineEditing(elementId: ElementId): void {
  dispatch(Action.InlineEditing({ editor: undefined }));
  focusElement(elementId);
}

/** Closes the inline editor without changing focus after blur. */
export function stopInlineEditing(): void {
  dispatch(Action.InlineEditing({ editor: undefined }));
}

/** Renames an element as one undo step, skipping unchanged names. */
export function commitRename(elementId: ElementId, name: string): void {
  const element = elementById(modelStore.getState(), elementId);
  if (element === undefined || element.name === name) {
    return;
  }
  dispatch(Action.RenameElement({ elementId, name }));
}

/** Changes the prose drawn by one canvas note. */
export function commitNote(elementId: ElementId, text: string): void {
  const element = elementById(modelStore.getState(), elementId);
  if (element?.kind !== 'text' || element.text === text) {
    return;
  }
  dispatch(Action.EditNote({ elementId, text }));
}

/** Applies a node's new position and size as one undoable resize. */
export function resizeNode(node: CanvasNode, box: NodeBox): void {
  if (
    node.position.x === box.position.x &&
    node.position.y === box.position.y &&
    node.size.width === box.size.width &&
    node.size.height === box.size.height
  ) {
    return;
  }
  dispatch(
    Action.ResizeElement({
      elementId: node.id,
      offset: {
        x: box.position.x - node.position.x,
        y: box.position.y - node.position.y,
      },
      size: box.size,
    }),
  );
}

const drawnSelector = '.react-flow__node, .react-flow__edge';

const focusAttempts = 3;

/** Resolves a drawn node or flow through the current layout's ID map. */
export function drawnElement(
  target: EventTarget | null,
  elements: ReadonlyMap<string, ElementId>,
): ElementId | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const drawn = target.closest(drawnSelector)?.getAttribute('data-id');
  return drawn === undefined || drawn === null
    ? undefined
    : elements.get(drawn);
}

/** Focuses the canvas itself, where focus goes when a control over it closes. */
export function focusCanvas(): void {
  document.querySelector<HTMLElement>('.react-flow')?.focus();
}

/** Focuses a drawn element, retrying across renders until state or focus changes. */
export function focusElement(
  elementId: ElementId,
  attempts = focusAttempts,
): void {
  const state = modelStore.getState();
  const drawn = [...document.querySelectorAll(drawnSelector)].find(
    (candidate) => candidate.getAttribute('data-id') === elementId,
  );
  if (drawn instanceof HTMLElement || drawn instanceof SVGElement) {
    drawn.focus();
  }
  if (attempts <= 1) {
    return;
  }
  const focused = document.activeElement;
  const retry = (): void => {
    if (
      modelStore.getState() === state &&
      (document.activeElement === focused ||
        document.activeElement === document.body)
    ) {
      focusElement(elementId, attempts - 1);
    }
  };
  if (drawn instanceof HTMLElement || drawn instanceof SVGElement) {
    setTimeout(retry, 0);
  } else {
    requestAnimationFrame(retry);
  }
}

function detachedFlows(model: Model, removed: ReadonlySet<ElementId>): number {
  return elementsAcross(model.diagrams).filter(
    (element) =>
      element.kind === 'flow' &&
      !removed.has(element.id) &&
      [element.source, element.target].some(
        (endpoint) =>
          endpoint.kind === 'attached' && removed.has(endpoint.element),
      ),
  ).length;
}

function droppedThreatLinks(
  model: Model,
  removed: ReadonlySet<ElementId>,
): number {
  return model.threats.reduce(
    (count, threat) =>
      count + threat.elements.filter((held) => removed.has(held)).length,
    0,
  );
}

function culledThreats(model: Model, removed: ReadonlySet<ElementId>): number {
  return model.threats.filter(
    (threat) =>
      threat.elements.length > 0 &&
      threat.elements.every((held) => removed.has(held)),
  ).length;
}

function added(action: Action, elementId: ElementId): void {
  if (!changedModel(action)) {
    return;
  }
  dispatch(Action.Select({ elementIds: [elementId] }));
  focusElement(elementId);
}

function placed(
  action: Action,
  elementId: ElementId,
  editor: 'name' | 'note' | undefined,
): boolean {
  if (!changedModel(action)) {
    return false;
  }
  dispatch(Action.Select({ elementIds: [elementId] }));
  if (editor !== undefined) {
    dispatch(Action.InlineEditing({ editor: { kind: editor, elementId } }));
  } else {
    focusElement(elementId);
  }
  return true;
}

function removedSubject(
  state: State,
  selection: readonly ElementId[],
): RemovedSubject {
  const one = selection.length === 1 ? selection[0] : undefined;
  const element = one === undefined ? undefined : elementById(state, one);
  return element === undefined
    ? { count: selection.length }
    : { name: element.name, kind: element.kind };
}
