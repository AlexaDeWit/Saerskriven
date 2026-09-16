import type { CanvasFlowEdge, CanvasNode } from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react';
import { Action } from '../store/actions.js';
import { sameSelection } from '../store/selection.js';
import { selectedElements } from '../store/selectors.js';
import { dispatch, modelStore } from '../store/store.js';
import { connectElements } from './edits.js';
import type { DiagramNode } from './nodes.js';

/** One thing React Flow reports about a node or a flow it draws. */
export type DiagramChange =
  | NodeChange<DiagramNode>
  | EdgeChange<CanvasFlowEdge>;

/** Turns what React Flow reports about a gesture into store actions and dispatches them. */
export function applyChanges(
  changes: readonly DiagramChange[],
  elements: ReadonlyMap<string, ElementId>,
  nodes: ReadonlyMap<string, CanvasNode>,
): void {
  const selection = selectedElements(modelStore.getState());
  for (const action of [
    ...selectionActions(changes, elements, selection),
    ...moveActions(changes, nodes, selection),
  ]) {
    dispatch(action);
  }
}

/**
 * The selection React Flow reports, folded onto `selection`. Node and edge
 * changes arrive through separate callbacks, so a caller passes the store's
 * current selection rather than the one a render saw.
 */
export function selectionActions(
  changes: readonly DiagramChange[],
  elements: ReadonlyMap<string, ElementId>,
  selection: readonly ElementId[],
): Action[] {
  const next = [...selection];
  for (const change of changes) {
    if (change.type !== 'select') {
      continue;
    }
    const element = elements.get(change.id);
    if (element === undefined) {
      continue;
    }
    const index = next.indexOf(element);
    if (change.selected && index === -1) {
      next.push(element);
    } else if (!change.selected && index !== -1) {
      next.splice(index, 1);
    }
  }
  return sameSelection(selection, next)
    ? []
    : [Action.Select({ elementIds: next })];
}

/** The moves the reported changes ask for, as offsets from where the model has each element. */
export function moveActions(
  changes: readonly DiagramChange[],
  nodes: ReadonlyMap<string, CanvasNode>,
  selection: readonly ElementId[],
): Action[] {
  const resizing = new Set(
    changes.flatMap((change) =>
      change.type === 'dimensions' && change.resizing === true
        ? [change.id]
        : [],
    ),
  );
  const settled = changes.flatMap((change) => {
    if (
      change.type !== 'position' ||
      change.dragging === true ||
      change.position === undefined ||
      resizing.has(change.id)
    ) {
      return [];
    }
    const node = nodes.get(change.id);
    if (node === undefined) {
      return [];
    }
    const offset = {
      x: change.position.x - node.position.x,
      y: change.position.y - node.position.y,
    };
    return offset.x === 0 && offset.y === 0
      ? []
      : [{ elementId: node.id, offset }];
  });
  const first = settled.at(0);
  if (first === undefined) {
    return [];
  }
  const elementIds = selection.includes(first.elementId)
    ? selection
    : [first.elementId];
  return elementIds.length === 1
    ? [Action.MoveElement(first)]
    : [Action.MoveElements({ elementIds, offset: first.offset })];
}

/**
 * The elements whose geometry moves during the reported gesture. A resize
 * changes one node even when the store holds a multi-selection.
 */
export function gestureSelection(
  changes: readonly DiagramChange[],
  nodes: ReadonlyMap<string, CanvasNode>,
  selection: readonly ElementId[],
): readonly ElementId[] {
  const resized = new Set(
    changes.flatMap((change) => {
      if (change.type !== 'dimensions' || change.resizing === undefined) {
        return [];
      }
      const node = nodes.get(change.id);
      return node === undefined ? [] : [node.id];
    }),
  );
  return resized.size === 0 ? selection : [...resized];
}

/** React Flow's connection test: a flow runs between two different elements. */
export function betweenTwoElements(connection: Connection | Edge): boolean {
  return connection.source !== connection.target;
}

/** Draws the flow a settled connection asks for, where both ends name elements of the diagram. */
export function applyConnection(
  connection: Connection,
  elements: ReadonlyMap<string, ElementId>,
): void {
  const source = elements.get(connection.source);
  const target = elements.get(connection.target);
  if (source !== undefined && target !== undefined) {
    connectElements(source, target);
  }
}
