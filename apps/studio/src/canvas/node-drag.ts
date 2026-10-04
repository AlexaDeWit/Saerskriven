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

const draggedSelector =
  '.react-flow__node.draggable, .react-flow__nodesselection-rect';

type Drag = {
  readonly selection: readonly ElementId[];
  readonly ids: readonly string[];
  readonly cancelled: boolean;
};

/**
 * React Flow's own drag of nodes, from its `onNodeDragStart` to its
 * `onNodeDragStop`, which follows every drag it started and did not abort,
 * or, for an aborted one, to the settled position change React Flow sends
 * instead. The next drag start replaces a drag React Flow never ended.
 *
 * Its changes pass to `moveNodes` as a pointer's until the selection changes
 * under it, as Escape does, or the window loses focus. The drag is then put
 * back where the model has its nodes now, and nothing more of it reaches
 * `moveNodes`, its release included, so it records no move. `autoPan` stays
 * off until that release.
 *
 * A blurred window also ends React Flow's mouse gesture with the window
 * mouse release it waits for, since the real one may land outside the
 * window. That gesture starts at the press, before React Flow starts the
 * drag, so a blur also lets go of a press still held on a node React Flow may
 * drag or on the frame it draws around a box selection. A press on a control
 * inside a node drags no node, and a blur leaves it alone.
 *
 * A change React Flow reports outside a drag passes as the keyboard's: only
 * an arrow key moves a node then. React Flow reports an arrow-key move and a
 * drag's release as the same change, so that is an inference: after a drag
 * React Flow never ended, the first arrow-key move passes as a pointer's and
 * is stored at three decimals where one was due. That change settles the
 * drag, so the moves after it pass as the keyboard's.
 */
export function useNodeDrag(
  positions: ReadonlyMap<string, CanvasNode>,
  moveNodes: (changes: NodeChange<DiagramNode>[], input: GestureInput) => void,
) {
  const drag = useRef<Drag | undefined>(undefined);
  const pressed = useRef(false);
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
  const blurred = useEffectEvent((): void => {
    if (drag.current === undefined && !pressed.current) {
      return;
    }
    cancel();
    window.dispatchEvent(new MouseEvent('mouseup', { view: window }));
  });
  useEffect(() => {
    const press = (event: MouseEvent): void => {
      if (startsGesture(event)) {
        pressed.current = true;
      }
    };
    const release = (): void => {
      pressed.current = false;
    };
    const unsubscribe = modelStore.subscribe(reselected);
    window.addEventListener('mousedown', press, true);
    window.addEventListener('mouseup', release, true);
    window.addEventListener('blur', blurred);
    return () => {
      unsubscribe();
      window.removeEventListener('mousedown', press, true);
      window.removeEventListener('mouseup', release, true);
      window.removeEventListener('blur', blurred);
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
