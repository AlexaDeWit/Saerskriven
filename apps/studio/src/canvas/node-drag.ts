import type { CanvasNode } from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import type { NodeChange } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { sameSelection } from '../store/selection.js';
import { selectedElements } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { positionChanges, unmoved } from './changes.js';
import type { DiagramNode } from './nodes.js';

type Drag = {
  readonly selection: readonly ElementId[];
  readonly ids: readonly string[];
  readonly cancelled: boolean;
};

/**
 * React Flow's own drag of nodes, from its `onNodeDragStart` to the settled
 * position change that ends it. Its changes pass to `moveNodes` until the
 * selection changes under it, as Escape does, or the window loses focus. The
 * drag is then put back where the model has its nodes now, and nothing more
 * of it reaches `moveNodes`, its release included, so it records no move.
 * `autoPan` stays off until that release. A drag React Flow ends without a
 * settled change is forgotten at the next drag start or primary press.
 */
export function useNodeDrag(
  positions: ReadonlyMap<string, CanvasNode>,
  moveNodes: (changes: NodeChange<DiagramNode>[]) => void,
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
    moveNodes(positionChanges(nodes, unmoved, false));
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
  const pressed = useEffectEvent((event: PointerEvent): void => {
    if (event.isPrimary) {
      forget();
    }
  });
  useEffect(() => {
    const unsubscribe = modelStore.subscribe(reselected);
    window.addEventListener('blur', blurred);
    window.addEventListener('pointerdown', pressed, true);
    return () => {
      unsubscribe();
      window.removeEventListener('blur', blurred);
      window.removeEventListener('pointerdown', pressed, true);
    };
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
        moveNodes(passed);
      }
    },
  };
}

function settles(changes: readonly NodeChange<DiagramNode>[]): boolean {
  return changes.some(
    (change) => change.type === 'position' && change.dragging === false,
  );
}
