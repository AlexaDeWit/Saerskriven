import {
  gridSpacing,
  type CanvasFlowEdge,
  type CanvasLayout,
  type CanvasNode,
} from '@saerskriven/canvas';
import type { ElementId, Point } from '@saerskriven/model';
import type { NodeChange, ReactFlowInstance } from '@xyflow/react';
import {
  useEffect,
  useEffectEvent,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { sameSelection } from '../store/selection.js';
import { selectedElements } from '../store/selectors.js';
import { modelStore } from '../store/store.js';
import { positionChanges } from './changes.js';
import { currentConnecting } from './connecting.js';
import { drawnElement } from './edits.js';
import { placementClickDistance, pointerDistance } from './elements.js';
import { insideBounds, selectionBounds } from './layout.js';
import type { DiagramNode } from './nodes.js';
import { currentSnap } from './snap.js';
import { currentTool } from './tools.js';

/** How far, in screen pixels, a press may land outside the selection's drawn bounds and still drag it. */
export const selectionBoundsPadding = 4;

const controlSelector = 'button, input, textarea, .react-flow__handle';

const unmoved: Point = { x: 0, y: 0 };

type GroupDragView = Pick<
  ReactFlowInstance<DiagramNode, CanvasFlowEdge>,
  'getZoom' | 'screenToFlowPosition'
>;

type GroupDragPointer = Pick<
  PointerEvent<HTMLDivElement>,
  | 'button'
  | 'clientX'
  | 'clientY'
  | 'currentTarget'
  | 'isPrimary'
  | 'pointerId'
  | 'pointerType'
  | 'shiftKey'
  | 'stopPropagation'
  | 'target'
>;

type Press = {
  readonly pointerId: number;
  readonly start: Point;
  readonly from: Point;
  readonly selection: readonly ElementId[];
  readonly nodes: readonly CanvasNode[];
  readonly dragging: boolean;
};

/**
 * Whether a press on `target` can drag the selection: one on empty canvas, a
 * selected trust boundary's interior included, or on an element `selection`
 * leaves out, away from its controls.
 */
export function passesToSelection(
  target: EventTarget | null,
  elements: ReadonlyMap<string, ElementId>,
  selection: readonly ElementId[],
): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.matches('.react-flow__pane')) {
    return true;
  }
  const element = drawnElement(target, elements);
  return (
    element !== undefined &&
    !selection.includes(element) &&
    target.closest(controlSelector) === null
  );
}

/**
 * Drags the selection from a primary press inside the bounds its elements
 * draw, on a target {@link passesToSelection} accepts, where the selection
 * holds a node to carry it. `down` answers whether the press is the
 * selection's and stops it, so React Flow neither starts a selection box nor
 * drags the element under the pointer, and `mouseDown` stops the mouse event
 * that follows it. Past the click distance each move hands `moveNodes` the
 * position changes React Flow's own drag reports, with the first selected
 * node on the grid while snapping is on, and the release settles them and
 * focuses the canvas. A shorter press leaves its click to the canvas.
 * `cancel` puts a drag back, as a blurred window and a selection that changes
 * during the press do.
 */
export function useGroupDrag(
  view: RefObject<GroupDragView | null>,
  layout: CanvasLayout,
  selection: readonly ElementId[],
  elements: ReadonlyMap<string, ElementId>,
  moveNodes: (changes: NodeChange<DiagramNode>[]) => void,
) {
  const press = useRef<Press | undefined>(undefined);

  const settle = (current: Press, offset: Point): void => {
    press.current = undefined;
    if (current.dragging) {
      moveNodes(positionChanges(current.nodes, offset, false));
    }
  };

  const offsetAt = (current: Press, event: GroupDragPointer): Point => {
    const at = view.current?.screenToFlowPosition(
      { x: event.clientX, y: event.clientY },
      { snapToGrid: false },
    );
    if (at === undefined) {
      return unmoved;
    }
    const offset = { x: at.x - current.from.x, y: at.y - current.from.y };
    const reference = current.nodes[0];
    return currentSnap() && reference !== undefined
      ? {
          x: onGrid(reference.position.x + offset.x) - reference.position.x,
          y: onGrid(reference.position.y + offset.y) - reference.position.y,
        }
      : offset;
  };

  const cancel = (): void => {
    const current = press.current;
    if (current !== undefined) {
      settle(current, unmoved);
    }
  };

  const ongoing = (event: GroupDragPointer): Press | undefined => {
    const current = press.current;
    if (current === undefined || current.pointerId !== event.pointerId) {
      return undefined;
    }
    if (
      !sameSelection(current.selection, selectedElements(modelStore.getState()))
    ) {
      cancel();
      return undefined;
    }
    return current;
  };

  const blurred = useEffectEvent((): void => {
    cancel();
  });
  useEffect(() => {
    window.addEventListener('blur', blurred);
    return () => {
      window.removeEventListener('blur', blurred);
    };
  }, []);

  return {
    cancel,
    down(event: GroupDragPointer): boolean {
      cancel();
      const instance = view.current;
      const selected = new Set(selection);
      const nodes = layout.nodes.filter((node) => selected.has(node.id));
      if (
        instance === null ||
        nodes.length === 0 ||
        currentTool().active !== 'select' ||
        currentConnecting().open ||
        !event.isPrimary ||
        event.button !== 0 ||
        event.shiftKey ||
        event.pointerType === 'touch' ||
        !passesToSelection(event.target, elements, selection)
      ) {
        return false;
      }
      const start = { x: event.clientX, y: event.clientY };
      const from = instance.screenToFlowPosition(start, { snapToGrid: false });
      if (
        !insideBounds(
          from,
          selectionBounds(layout, selection),
          selectionBoundsPadding / instance.getZoom(),
        )
      ) {
        return false;
      }
      event.stopPropagation();
      press.current = {
        pointerId: event.pointerId,
        start,
        from,
        selection,
        nodes,
        dragging: false,
      };
      return true;
    },
    mouseDown(event: Pick<MouseEvent, 'stopPropagation'>): void {
      if (press.current !== undefined) {
        event.stopPropagation();
      }
    },
    move(event: GroupDragPointer): void {
      const current = ongoing(event);
      if (
        current === undefined ||
        (!current.dragging &&
          pointerDistance(event, current.start) < placementClickDistance)
      ) {
        return;
      }
      if (!current.dragging) {
        event.currentTarget.setPointerCapture(event.pointerId);
        press.current = { ...current, dragging: true };
      }
      moveNodes(positionChanges(current.nodes, offsetAt(current, event), true));
    },
    up(event: GroupDragPointer): void {
      const current = ongoing(event);
      if (current === undefined) {
        return;
      }
      settle(current, offsetAt(current, event));
      if (current.dragging) {
        event.currentTarget
          .querySelector<HTMLElement>('.react-flow')
          ?.focus({ preventScroll: true });
      }
    },
  };
}

function onGrid(value: number): number {
  return Math.round(value / gridSpacing) * gridSpacing;
}
