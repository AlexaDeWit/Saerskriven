import type { CanvasNode } from '@saerskriven/canvas';
import { storedNumber } from '@saerskriven/model';
import { z } from 'zod';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { currentLayout } from './layout.js';
import { commandDecimals } from './stored-decimals.js';

const arrangementSchema = z.enum([
  'left',
  'centre',
  'right',
  'top',
  'middle',
  'bottom',
  'horizontal',
  'vertical',
]);
type Arrangement = z.infer<typeof arrangementSchema>;

type Moves = Extract<Action, { _tag: 'ArrangeElements' }>['moves'];

const extents = { x: 'width', y: 'height' } as const;

type Axis = keyof typeof extents;

const arrangements = {
  left: { axis: 'x', share: 0 },
  centre: { axis: 'x', share: 0.5 },
  right: { axis: 'x', share: 1 },
  top: { axis: 'y', share: 0 },
  middle: { axis: 'y', share: 0.5 },
  bottom: { axis: 'y', share: 1 },
  horizontal: { axis: 'x', share: undefined },
  vertical: { axis: 'y', share: undefined },
} as const satisfies Record<
  Arrangement,
  { readonly axis: Axis; readonly share: number | undefined }
>;

function aligned(
  nodes: readonly CanvasNode[],
  axis: Axis,
  share: number,
): Moves {
  if (nodes.length < 2) {
    return [];
  }
  const extent = extents[axis];
  const low = nodes.reduce(
    (least, node) => Math.min(least, node.position[axis]),
    Infinity,
  );
  const high = nodes.reduce(
    (most, node) => Math.max(most, node.position[axis] + node.size[extent]),
    -Infinity,
  );
  const longest = nodes.reduce(
    (most, node) => Math.max(most, node.size[extent]),
    0,
  );
  const anchor = storedNumber(
    low + (high - low - longest) * share,
    commandDecimals,
  );
  return nodes.map((node) => {
    const target = storedNumber(
      anchor + (longest - node.size[extent]) * share,
      commandDecimals,
    );
    return {
      elementId: node.id,
      offset: { x: 0, y: 0, [axis]: target - node.position[axis] },
    };
  });
}

function distributed(nodes: readonly CanvasNode[], axis: Axis): Moves {
  if (nodes.length < 3) {
    return [];
  }
  const extent = extents[axis];
  const ordered = [...nodes];
  ordered.sort(
    (a, b) => a.position[axis] - b.position[axis] || a.id.localeCompare(b.id),
  );
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const occupied = ordered.reduce(
    (total, node) => total + node.size[extent],
    0,
  );
  const gap =
    (last.position[axis] +
      last.size[extent] -
      first.position[axis] -
      occupied) /
    (ordered.length - 1);
  let at = first.position[axis] + first.size[extent] + gap;
  return ordered.slice(1, -1).map((node) => {
    const offset = { x: 0, y: 0, [axis]: at - node.position[axis] };
    at += node.size[extent] + gap;
    return { elementId: node.id, offset };
  });
}

/**
 * Arranges selected nodes in one undo step. Flows retain their bends and
 * attachments. An alignment places the widest selected node, or the tallest,
 * at a number `commandDecimals` stores, and the others against where that
 * puts it, each at a stored number too, so a second press moves nothing
 * while the sizes have that many decimals or fewer. A distribution keeps the
 * first and last nodes and evens the gaps between.
 */
export function arrangeSelected(operation: Arrangement): void {
  const state = modelStore.getState();
  const nodes = currentLayout(state).nodes.filter((node) =>
    state.selection.includes(node.id),
  );
  const { axis, share } = arrangements[operation];
  const moves =
    share === undefined
      ? distributed(nodes, axis)
      : aligned(nodes, axis, share);
  dispatch(Action.ArrangeElements({ moves, decimals: commandDecimals }));
  if (modelStore.getState().present !== state.present) {
    announce((t) => t('canvas.arranged', { count: nodes.length }));
  }
}
