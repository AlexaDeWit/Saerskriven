import {
  canvasNodeOf,
  type CanvasFlowEdge,
  type CanvasLayout,
  type NodeBox,
} from '@saerskriven/canvas';
import type { Element, Point } from '@saerskriven/model';
import type { ReactFlowInstance } from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { keyboardOwner, nativeActivationTarget } from '../commands/binding.js';
import { pressesContextualShortcut } from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { placeBoundaryCurve, placeElement } from './edits.js';
import {
  centredPlacement,
  defaultCurveWaypoints,
  freshElement,
  pointerPlacement,
  withPlacement,
  type ElementTool,
} from './elements.js';
import type { DiagramNode } from './nodes.js';
import type { PlacementDraft } from './placement-preview.js';
import { nameFieldExtent } from './inline-editing.js';
import {
  currentTool,
  finishPlacement,
  isElementTool,
  useTool,
  type Tool,
  type ToolState,
} from './tools.js';

const noPoints: readonly Point[] = [];

type BoxTool = Exclude<ElementTool, 'boundary-curve'>;

type PlacementView = Pick<
  ReactFlowInstance<DiagramNode, CanvasFlowEdge>,
  'screenToFlowPosition'
>;

type PlacementPointerEvent = Pick<
  PointerEvent<HTMLDivElement>,
  | 'button'
  | 'clientX'
  | 'clientY'
  | 'currentTarget'
  | 'isPrimary'
  | 'pointerId'
  | 'preventDefault'
  | 'stopPropagation'
  | 'target'
>;

type PlacementCancellationEvent = Pick<
  PointerEvent<HTMLDivElement>,
  'pointerId'
>;

type PlacementGesture = {
  readonly pointerId: number;
  readonly tool: BoxTool;
  readonly revision: number;
  readonly transition: number;
  readonly contextRevision: number;
  readonly layout: CanvasLayout;
  readonly screen: Point;
  readonly flow: Point;
  readonly geometry: NodeBox;
  readonly element: Element;
};

type CurveDraft = {
  readonly revision: number;
  readonly layout: CanvasLayout;
  readonly waypoints: readonly Point[];
  readonly pointer: Point | undefined;
};

type BoxDraft = {
  readonly contextRevision: number;
  readonly transition: number;
  readonly layout: CanvasLayout;
  readonly gesture: PlacementGesture | undefined;
};

/** The active mode and event handlers for placement gestures. */
export type PlacementControls = {
  readonly mode: ToolState;
  readonly preview: PlacementDraft | undefined;
  readonly click: (event: MouseEvent<HTMLDivElement>) => boolean;
  readonly pointerDown: (event: PlacementPointerEvent) => void;
  readonly pointerMove: (event: PlacementPointerEvent) => void;
  readonly pointerUp: (event: PlacementPointerEvent) => void;
  readonly pointerCancel: (event: PlacementCancellationEvent) => void;
};

/** Connects toolbox modes to pointer and Enter placement gestures. */
export function usePlacement(
  surface: RefObject<HTMLDivElement | null>,
  view: RefObject<PlacementView | null>,
  layout: CanvasLayout,
): PlacementControls {
  const mode = useTool();
  const [curveDraft, setCurveDraft] = useState<CurveDraft>(
    emptyCurve(mode.revision, layout),
  );

  if (curveDraft.layout !== layout) {
    setCurveDraft(emptyCurve(mode.revision, layout));
  }

  const currentDraft = curveCurrent(curveDraft, mode.revision, layout);
  const curve = currentDraft ? curveDraft.waypoints : noPoints;
  const curvePointer = currentDraft ? curveDraft.pointer : undefined;
  const gesture = useRef<PlacementGesture | undefined>(undefined);
  const [boxDraft, setBoxDraft] = useState<BoxDraft>({
    contextRevision: 0,
    transition: mode.transition,
    layout,
    gesture: undefined,
  });
  if (boxDraft.transition !== mode.transition || boxDraft.layout !== layout) {
    setBoxDraft({
      contextRevision: boxDraft.contextRevision + 1,
      transition: mode.transition,
      layout,
      gesture: undefined,
    });
  }
  const currentBoxDraft =
    boxDraft.transition === mode.transition && boxDraft.layout === layout
      ? boxDraft.gesture
      : undefined;
  const setBoxGesture = (next: PlacementGesture | undefined): void => {
    setBoxDraft((current) => ({ ...current, gesture: next }));
  };

  const clearCurve = useCallback((): void => {
    setCurveDraft(emptyCurve(mode.revision, layout));
  }, [layout, mode.revision]);

  const commitCurve = useCallback(
    (waypoints: readonly Point[]): void => {
      if (placeBoundaryCurve(waypoints)) {
        clearCurve();
        finishPlacement();
      }
    },
    [clearCurve],
  );

  const placeDefault = useCallback(
    (tool: ElementTool, centre: Point): void => {
      const geometry = centredPlacement(tool, centre);
      const placed =
        tool === 'boundary-curve'
          ? placeBoundaryCurve(defaultCurveWaypoints(centre))
          : placeElement(freshElement(tool, geometry.position, geometry.size));
      if (placed) {
        clearCurve();
        finishPlacement();
      }
    },
    [clearCurve],
  );

  const enterPressed = useEffectEvent(
    (event: globalThis.KeyboardEvent): void => {
      const active = currentTool().active;
      if (
        !isElementTool(active) ||
        event.defaultPrevented ||
        !pressesContextualShortcut('place-at-centre', event, hostPlatform) ||
        nativeActivationTarget(event.target) ||
        keyboardOwner(event.target) !== 'page'
      ) {
        return;
      }
      const extent = surface.current?.getBoundingClientRect();
      const instance = view.current;
      if (extent === undefined || instance === null) {
        return;
      }
      event.preventDefault();
      if (active === 'boundary-curve') {
        if (curve.length >= 2) {
          commitCurve(curve);
          return;
        }
        if (curve.length === 1) {
          return;
        }
      }
      placeDefault(
        active,
        instance.screenToFlowPosition({
          x: extent.left + extent.width / 2,
          y: extent.top + extent.height / 2,
        }),
      );
    },
  );

  useEffect(() => {
    document.addEventListener('keydown', enterPressed);
    return () => {
      document.removeEventListener('keydown', enterPressed);
    };
  }, []);

  const screenToFlow = (x: number, y: number): Point | undefined =>
    view.current?.screenToFlowPosition({ x, y });

  const click = (event: MouseEvent<HTMLDivElement>): boolean => {
    if (mode.active !== 'boundary-curve') {
      return mode.active !== 'select';
    }
    if (
      !(event.target instanceof Element) ||
      nativeActivationTarget(event.target) ||
      event.target.closest('.react-flow') === null
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1) {
      commitCurve(curve);
      return true;
    }
    const point = screenToFlow(event.clientX, event.clientY);
    if (point !== undefined) {
      setCurveDraft((current) => ({
        revision: mode.revision,
        layout,
        waypoints: [
          ...(curveCurrent(current, mode.revision, layout)
            ? current.waypoints
            : noPoints),
          point,
        ],
        pointer: undefined,
      }));
    }
    return true;
  };

  const pointerDown = (event: PlacementPointerEvent): void => {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      (gesture.current !== undefined &&
        gesture.current.contextRevision === boxDraft.contextRevision) ||
      !isBoxTool(mode.active) ||
      !(event.target instanceof Element) ||
      event.target.closest('input, textarea, button, a') !== null ||
      event.target.closest('.react-flow') === null
    ) {
      return;
    }
    const flow = screenToFlow(event.clientX, event.clientY);
    if (flow === undefined) {
      return;
    }
    const started = {
      pointerId: event.pointerId,
      tool: mode.active,
      revision: mode.revision,
      transition: mode.transition,
      contextRevision: boxDraft.contextRevision,
      layout,
      screen: { x: event.clientX, y: event.clientY },
      flow,
      geometry: centredPlacement(mode.active, flow),
      element: freshElement(mode.active, flow),
    };
    gesture.current = started;
    setBoxGesture(started);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const pointerMove = (event: PlacementPointerEvent): void => {
    const started = gesture.current;
    if (started !== undefined && started.pointerId === event.pointerId) {
      if (gestureStale(started, boxDraft.contextRevision, layout)) {
        gesture.current = undefined;
        setBoxGesture(undefined);
        return;
      }
      const point = screenToFlow(event.clientX, event.clientY);
      if (point === undefined) {
        return;
      }
      const moved = {
        ...started,
        geometry: pointerPlacement(
          started.tool,
          started.flow,
          point,
          Math.hypot(
            event.clientX - started.screen.x,
            event.clientY - started.screen.y,
          ),
        ),
      };
      gesture.current = moved;
      setBoxGesture(moved);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      mode.active !== 'boundary-curve' ||
      !(event.target instanceof Element) ||
      event.target.closest('.react-flow') === null
    ) {
      return;
    }
    const point = screenToFlow(event.clientX, event.clientY);
    setCurveDraft((current) => ({
      revision: mode.revision,
      layout,
      waypoints: curveCurrent(current, mode.revision, layout)
        ? current.waypoints
        : noPoints,
      pointer: point,
    }));
  };

  const pointerUp = (event: PlacementPointerEvent): void => {
    const started = gesture.current;
    if (started === undefined || started.pointerId !== event.pointerId) {
      return;
    }
    gesture.current = undefined;
    setBoxGesture(undefined);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (gestureStale(started, boxDraft.contextRevision, layout)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const { geometry } = started;
    const fieldFits =
      geometry.size.width >= nameFieldExtent &&
      geometry.size.height >= nameFieldExtent;
    if (
      placeElement(
        withPlacement(started.element, geometry.position, geometry.size),
        fieldFits,
      )
    ) {
      finishPlacement();
    }
  };

  const curvePreview =
    curvePointer === undefined ? curve : [...curve, curvePointer];
  const draftNode =
    currentBoxDraft === undefined
      ? undefined
      : canvasNodeOf(
          withPlacement(
            currentBoxDraft.element,
            currentBoxDraft.geometry.position,
            currentBoxDraft.geometry.size,
          ),
        );
  const preview: PlacementDraft | undefined =
    currentBoxDraft === undefined
      ? curvePreview.length === 0
        ? undefined
        : { kind: 'curve', points: curvePreview }
      : draftNode === undefined
        ? undefined
        : {
            kind: 'box',
            node: draftNode,
            ...currentBoxDraft.geometry,
          };

  return {
    mode,
    preview,
    click,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel: (event) => {
      if (gesture.current?.pointerId !== event.pointerId) {
        return;
      }
      gesture.current = undefined;
      setBoxGesture(undefined);
    },
  };
}

function isBoxTool(tool: Tool): tool is BoxTool {
  return isElementTool(tool) && tool !== 'boundary-curve';
}

function emptyCurve(revision: number, layout: CanvasLayout): CurveDraft {
  return { revision, layout, waypoints: [], pointer: undefined };
}

function curveCurrent(
  draft: CurveDraft,
  revision: number,
  layout: CanvasLayout,
): boolean {
  return draft.revision === revision && draft.layout === layout;
}

function gestureStale(
  started: PlacementGesture,
  contextRevision: number,
  layout: CanvasLayout,
): boolean {
  const tool = currentTool();
  return (
    started.tool !== tool.active ||
    started.revision !== tool.revision ||
    started.transition !== tool.transition ||
    started.contextRevision !== contextRevision ||
    started.layout !== layout
  );
}
