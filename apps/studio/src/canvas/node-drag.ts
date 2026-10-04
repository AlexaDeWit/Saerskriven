import type { CanvasNode, GestureInput } from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import type { NodeChange } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { sameSelection } from '../store/selection.js';
import { selectedElements } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { positionChanges, unmoved } from './changes.js';
import type { DiagramNode } from './nodes.js';

const draggedSelector = '.react-flow__node.draggable';

type Drag = {
  readonly selection: readonly ElementId[];
  readonly ids: readonly string[];
  readonly cancelled: boolean;
};

/** Cancelled drags restore model positions and suppress later position changes until release. */
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
  useEffect(() => {
    return modelStore.subscribe(reselected);
  }, []);

  return {
    startsGesture,
    cancel,
    active: () => drag.current !== undefined,
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
