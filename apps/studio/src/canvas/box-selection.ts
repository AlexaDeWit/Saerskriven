import type { CanvasFlowEdge, CanvasNode } from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import type { EdgeChange } from '@xyflow/react';
import {
  useRef,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { Action } from '../store/actions.js';
import { selectedElements } from '../store/selectors.js';
import { dispatch, modelStore } from '../store/store.js';
import { applyChanges } from './changes.js';
import type { Tool } from './tools.js';

type ScreenPoint = { readonly x: number; readonly y: number };

/**
 * React Flow's selection box extended to flows. The edge selections React
 * Flow reports while a box is drawn are dropped, and a finished box adds the
 * flows it wholly contains, as drawn, to the selection.
 */
export function useBoxSelection(
  surface: RefObject<HTMLDivElement | null>,
  elements: ReadonlyMap<string, ElementId>,
  positions: ReadonlyMap<string, CanvasNode>,
) {
  const selecting = useRef(false);
  const start = useRef<ScreenPoint | undefined>(undefined);

  return {
    pointerDown: (event: PointerEvent<HTMLDivElement>, tool: Tool): void => {
      if (
        tool === 'select' &&
        event.pointerType !== 'touch' &&
        event.button === 0 &&
        event.target instanceof Element &&
        event.target.matches('.react-flow__pane')
      ) {
        start.current = { x: event.clientX, y: event.clientY };
      }
    },
    cancel: (): void => {
      selecting.current = false;
      start.current = undefined;
    },
    onSelectionStart: (): void => {
      selecting.current = true;
    },
    onSelectionEnd: (event: MouseEvent): void => {
      selecting.current = false;
      const from = start.current;
      start.current = undefined;
      if (from === undefined) {
        return;
      }
      const flowIds = containedFlows(
        surface.current,
        from,
        { x: event.clientX, y: event.clientY },
        elements,
      );
      if (flowIds.length > 0) {
        const currentSelection = selectedElements(modelStore.getState());
        dispatch(
          Action.Select({ elementIds: [...currentSelection, ...flowIds] }),
        );
      }
    },
    onEdgesChange: (changes: EdgeChange<CanvasFlowEdge>[]): void => {
      const accepted = selecting.current
        ? changes.filter(
            (change) => change.type !== 'select' || !change.selected,
          )
        : changes;
      applyChanges(accepted, elements, positions);
    },
  };
}

function containedFlows(
  root: HTMLDivElement | null,
  from: ScreenPoint,
  to: ScreenPoint,
  elements: ReadonlyMap<string, ElementId>,
): ElementId[] {
  if (root === null) {
    return [];
  }
  const bounds = {
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    right: Math.max(from.x, to.x),
    bottom: Math.max(from.y, to.y),
  };
  return [...root.querySelectorAll('.react-flow__edge')].flatMap((flow) => {
    const drawn = flow.getBoundingClientRect();
    const id = elements.get(flow.getAttribute('data-id') ?? '');
    return id !== undefined &&
      drawn.left >= bounds.left &&
      drawn.top >= bounds.top &&
      drawn.right <= bounds.right &&
      drawn.bottom <= bounds.bottom
      ? [id]
      : [];
  });
}
