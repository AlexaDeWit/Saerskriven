import type {
  CanvasFlowEdge,
  CanvasNode,
  GestureInput,
} from '@saerskriven/canvas';
import {
  sideSchema,
  type Decimals,
  type ElementId,
  type Point,
  type Side,
} from '@saerskriven/model';
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react';
import { Action } from '../store/actions.js';
import { sameSelection } from '../store/selection.js';
import { selectedElements } from '../store/selectors.js';
import { dispatch, modelStore } from '../store/store.js';
import { connectElements } from './edits.js';
import type { DiagramNode } from './nodes.js';
import { gestureDecimals } from './stored-decimals.js';

/** One thing React Flow reports about a node or a flow it draws. */
export type DiagramChange =
  | NodeChange<DiagramNode>
  | EdgeChange<CanvasFlowEdge>;

/**
 * Turns what React Flow reports about a gesture on its nodes into store
 * actions and dispatches them, a move storing the decimals a gesture made
 * with `input` keeps.
 */
export function applyChanges(
  changes: readonly DiagramChange[],
  elements: ReadonlyMap<string, ElementId>,
  nodes: ReadonlyMap<string, CanvasNode>,
  input: GestureInput,
): void {
  const selection = selectedElements(modelStore.getState());
  for (const action of [
    ...selectionActions(changes, elements, selection),
    ...moveActions(changes, nodes, selection, gestureDecimals[input]),
  ]) {
    dispatch(action);
  }
}

/** Dispatches the selection React Flow reports about its flows, which it never moves. */
export function applySelection(
  changes: readonly DiagramChange[],
  elements: ReadonlyMap<string, ElementId>,
): void {
  const selection = selectedElements(modelStore.getState());
  for (const action of selectionActions(changes, elements, selection)) {
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

/**
 * The moves the reported changes ask for, as offsets from where the model has
 * each element, each to be stored at `decimals`.
 */
export function moveActions(
  changes: readonly DiagramChange[],
  nodes: ReadonlyMap<string, CanvasNode>,
  selection: readonly ElementId[],
  decimals?: Decimals,
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
    ? [Action.MoveElement({ ...first, decimals })]
    : [Action.MoveElements({ elementIds, offset: first.offset, decimals })];
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

/** No offset at all, which settles a node where the model has it. */
export const unmoved: Point = { x: 0, y: 0 };

/** The position changes that carry `nodes` by `offset` from where the model has them. */
export function positionChanges(
  nodes: readonly CanvasNode[],
  offset: Point,
  dragging: boolean,
): NodeChange<DiagramNode>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: 'position',
    position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
    dragging,
  }));
}

/** React Flow's connection test: a flow runs between two different elements. */
export function betweenTwoElements(connection: Connection | Edge): boolean {
  return connection.source !== connection.target;
}

/** The side a handle id names, or none for a drop that named no handle. */
export function sideOfHandle(
  handle: string | null | undefined,
): Side | undefined {
  const parsed = sideSchema.safeParse(handle);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Draws the flow a settled connection asks for, where both ends name elements
 * of the diagram, pinning each end to the side of the handle it met.
 */
export function applyConnection(
  connection: Connection,
  elements: ReadonlyMap<string, ElementId>,
): void {
  const source = elements.get(connection.source);
  const target = elements.get(connection.target);
  if (source !== undefined && target !== undefined) {
    connectElements(source, target, {
      source: sideOfHandle(connection.sourceHandle),
      target: sideOfHandle(connection.targetHandle),
    });
  }
}
