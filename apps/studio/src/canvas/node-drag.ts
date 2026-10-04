import type { CanvasNode, GestureInput } from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import type { NodeChange } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { sameSelection } from '../store/selection.js';
import { selectedElements } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { positionChanges, unmoved } from './changes.js';
import { useHeldMouse } from './held-mouse.js';
import type { DiagramNode } from './nodes.js';

const draggedSelector = '.react-flow__node.draggable';

type Drag = {
  readonly selection: readonly ElementId[];
  readonly ids: readonly string[];
  readonly cancelled: boolean;
};

/**
 * Selection changes and window blur restore a drag to the model's positions
 * and suppress its remaining position changes. Auto-pan stops until release.
 * Blur also releases a mouse press before React Flow starts dragging.
 * Changes outside a drag are keyboard moves. After a drag React Flow never
 * ended, the first keyboard move settles it and uses pointer precision.
 */
export function useNodeDrag(
  positions: ReadonlyMap<string, CanvasNode>,
  moveNodes: (changes: NodeChange<DiagramNode>[], input: GestureInput) => void,
) {
  const drag = useRef<Drag | undefined>(undefined);
  const [heldBack, setHeldBack] = useState(false);

  const forget = (): void => {
    drag.current = undefined;
    setHeldBack(false);
  };

  const cancel = (): void => {
    const current = drag.current;
    if (current === undefined || current.cancelled) {
      return;
    }
    drag.current = { ...current, cancelled: true };
    setHeldBack(true);
    const nodes = current.ids.flatMap((id) => {
      const node = positions.get(id);
      return node === undefined ? [] : [node];
    });
    moveNodes(positionChanges(nodes, unmoved, false), 'pointer');
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
  useHeldMouse(startsGesture, cancel, () => drag.current !== undefined);
  useEffect(() => {
    return modelStore.subscribe(reselected);
  }, []);

  return {
    autoPan: !heldBack,
    onNodeDragStart: (
      _event: unknown,
      _node: unknown,
      nodes: readonly Pick<DiagramNode, 'id'>[],
    ): void => {
      drag.current = {
        selection: selectedElements(modelStore.getState()),
        ids: nodes.map((node) => node.id),
        cancelled: false,
      };
      setHeldBack(false);
    },
    onNodeDragStop: (): void => {
      forget();
    },
    onNodesChange: (changes: NodeChange<DiagramNode>[]): void => {
      const current = drag.current;
      if (current !== undefined && settles(changes)) {
        forget();
      }
      const passed =
        current?.cancelled === true
          ? changes.filter((change) => change.type !== 'position')
          : changes;
      if (passed.length > 0) {
        moveNodes(passed, current === undefined ? 'keyboard' : 'pointer');
      }
    },
  };
}

function startsGesture({ button, target }: MouseEvent): boolean {
  return (
    button === 0 &&
    target instanceof Element &&
    target.closest(draggedSelector) !== null &&
    target.closest('.nodrag') === null
  );
}

function settles(changes: readonly NodeChange<DiagramNode>[]): boolean {
  return changes.some(
    (change) => change.type === 'position' && change.dragging === false,
  );
}
