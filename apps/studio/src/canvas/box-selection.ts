import type { CanvasFlowEdge } from '@saerskriven/canvas';
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
import { applySelection } from './changes.js';
import type { Tool } from './tools.js';

type ScreenPoint = { readonly x: number; readonly y: number };

type ScreenBox = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

type BoxPress = Pick<
  PointerEvent<HTMLDivElement>,
  'pointerType' | 'button' | 'target' | 'clientX' | 'clientY'
>;

type BoxRelease = Pick<MouseEvent, 'clientX' | 'clientY'>;

/**
 * React Flow's selection box extended to flows. The edge selections React
 * Flow reports while a box is drawn are dropped, and a finished box adds the
 * flows it wholly contains, as drawn, to the selection. A flow is measured by
 * its geometry and not by its client rect, which in Firefox takes in the
 * stroke of the invisible hit path.
 */
export function useBoxSelection(
  surface: RefObject<HTMLDivElement | null>,
  elements: ReadonlyMap<string, ElementId>,
) {
  const selecting = useRef(false);
  const start = useRef<ScreenPoint | undefined>(undefined);

  return {
    pointerDown: (event: BoxPress, tool: Tool): void => {
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
    onSelectionEnd: (event: BoxRelease): void => {
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
      applySelection(accepted, elements);
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
  const bounds: ScreenBox = {
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    right: Math.max(from.x, to.x),
    bottom: Math.max(from.y, to.y),
  };
  return [...root.querySelectorAll('.react-flow__edge')].flatMap((flow) => {
    const drawn = geometryOf(flow);
    const id = elements.get(flow.getAttribute('data-id') ?? '');
    return id !== undefined &&
      drawn !== undefined &&
      drawn.left >= bounds.left &&
      drawn.top >= bounds.top &&
      drawn.right <= bounds.right &&
      drawn.bottom <= bounds.bottom
      ? [id]
      : [];
  });
}

function geometryOf(flow: Element): ScreenBox | undefined {
  if (!(flow instanceof SVGGraphicsElement)) {
    return undefined;
  }
  const toScreen = flow.getScreenCTM();
  if (toScreen === null) {
    return undefined;
  }
  const box = flow.getBBox();
  const corners = [box.x, box.x + box.width].flatMap((x) =>
    [box.y, box.y + box.height].map((y) => ({
      x: toScreen.a * x + toScreen.c * y + toScreen.e,
      y: toScreen.b * x + toScreen.d * y + toScreen.f,
    })),
  );
  const across = corners.map((corner) => corner.x);
  const down = corners.map((corner) => corner.y);
  return {
    left: Math.min(...across),
    top: Math.min(...down),
    right: Math.max(...across),
    bottom: Math.max(...down),
  };
}
