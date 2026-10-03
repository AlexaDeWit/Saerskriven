import type { CanvasNode } from '@saerskriven/canvas';
import type { ElementId, Point } from '@saerskriven/model';
import type { NodeChange } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef } from 'react';
import { sameSelection } from '../store/selection.js';
import { selectedElements } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { positionChanges } from './changes.js';
import type { DiagramNode } from './nodes.js';

const unmoved: Point = { x: 0, y: 0 };

type Drag = {
  readonly selection: readonly ElementId[];
  readonly nodes: readonly CanvasNode[];
  readonly cancelled: boolean;
};

/**
 * Hands React Flow's node changes to `moveNodes`, and puts React Flow's own
 * drag of nodes back where the model has them once the selection changes
 * under it, as Escape does, or the window loses focus. Nothing more of a drag
 * put back reaches `moveNodes`, its release included, so it records no move.
 */
export function useNodeDrag(
  positions: ReadonlyMap<string, CanvasNode>,
  moveNodes: (changes: NodeChange<DiagramNode>[]) => void,
): (changes: NodeChange<DiagramNode>[]) => void {
  const drag = useRef<Drag | undefined>(undefined);

  const cancel = (): void => {
    const current = drag.current;
    if (current === undefined || current.cancelled) {
      return;
    }
    drag.current = { ...current, cancelled: true };
    moveNodes(positionChanges(current.nodes, unmoved, false));
  };

  const reselected = useEffectEvent((state: State): void => {
    const current = drag.current;
    if (
      current !== undefined &&
      !sameSelection(current.selection, selectedElements(state))
    ) {
      cancel();
    }
  });
  const blurred = useEffectEvent((): void => {
    cancel();
  });
  useEffect(() => {
    const unsubscribe = modelStore.subscribe(reselected);
    window.addEventListener('blur', blurred);
    return () => {
      unsubscribe();
      window.removeEventListener('blur', blurred);
    };
  }, []);

  return (changes) => {
    const current = drag.current;
    if (current === undefined) {
      drag.current = started(changes, positions);
    } else if (reportsPosition(changes, false)) {
      drag.current = undefined;
    }
    const passed =
      current?.cancelled === true
        ? changes.filter((change) => change.type !== 'position')
        : changes;
    if (passed.length > 0) {
      moveNodes(passed);
    }
  };
}

function reportsPosition(
  changes: readonly NodeChange<DiagramNode>[],
  dragging: boolean,
): boolean {
  return changes.some(
    (change) => change.type === 'position' && change.dragging === dragging,
  );
}

function started(
  changes: readonly NodeChange<DiagramNode>[],
  positions: ReadonlyMap<string, CanvasNode>,
): Drag | undefined {
  if (!reportsPosition(changes, true)) {
    return undefined;
  }
  return {
    selection: selectedElements(modelStore.getState()),
    nodes: changes.flatMap((change) => {
      const node =
        change.type === 'position' ? positions.get(change.id) : undefined;
      return node === undefined ? [] : [node];
    }),
    cancelled: false,
  };
}
