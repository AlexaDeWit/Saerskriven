import type { CanvasFlowEdge, CanvasLayout } from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
import type { ReactFlowInstance } from '@xyflow/react';
import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { canvasModel, primaryPointer } from './canvas.fixtures.js';
import { currentLayout } from './layout.js';
import type { DiagramNode } from './nodes.js';
import { usePlacement, type PlacementControls } from './placement.js';
import { resetTools, selectTool } from './tools.js';
import { heldElements, sampleModel } from '../store/store.fixtures.js';

type ViewTransform = {
  readonly pan: Point;
  readonly zoom: number;
};

const surface = document.createElement('div');
const pane = document.createElement('div');
pane.className = 'react-flow';
surface.append(pane);

const surfaceRef: RefObject<HTMLDivElement | null> = { current: surface };

const viewAt = (
  transform: ViewTransform,
): Pick<
  ReactFlowInstance<DiagramNode, CanvasFlowEdge>,
  'screenToFlowPosition'
> => ({
  screenToFlowPosition: ({ x, y }: Point): Point => ({
    x: (x - transform.pan.x) / transform.zoom,
    y: (y - transform.pan.y) / transform.zoom,
  }),
});

const onPane = { currentTarget: surface, target: pane };

const renderPlacement = (
  transform: ViewTransform = { pan: { x: 0, y: 0 }, zoom: 1 },
  layout: CanvasLayout = currentLayout(modelStore.getState()),
) => {
  const viewRef: RefObject<Pick<
    ReactFlowInstance<DiagramNode, CanvasFlowEdge>,
    'screenToFlowPosition'
  > | null> = { current: viewAt(transform) };
  return renderHook(
    ({ current }) => usePlacement(surfaceRef, viewRef, current),
    { initialProps: { current: layout } },
  );
};

const boxPreview = (controls: PlacementControls) => {
  expect(controls.preview?.kind).toBe('box');
  return controls.preview?.kind === 'box' ? controls.preview : undefined;
};

describe('box placement gestures', () => {
  beforeEach(() => {
    modelStore.setState(initialState(canvasModel), true);
    resetTools();
    selectTool('actor');
  });

  it('shows the default on press, updates it on movement, and commits the last preview', () => {
    const { result } = renderPlacement();

    act(() => {
      result.current.pointerDown(primaryPointer({ x: 100, y: 80 }, onPane));
    });
    expect(boxPreview(result.current)).toMatchObject({
      position: { x: 40, y: 50 },
      size: { width: 120, height: 60 },
    });

    act(() => {
      result.current.pointerMove(primaryPointer({ x: 180, y: 140 }, onPane));
    });
    const shown = boxPreview(result.current);
    expect(shown).toMatchObject({
      position: { x: 101, y: 81 },
      size: { width: 78, height: 58 },
    });

    act(() => {
      result.current.pointerUp(primaryPointer({ x: 999, y: 999 }, onPane));
    });

    expect(result.current.preview).toBeUndefined();
    expect(
      modelStore.getState().present.diagrams[0].elements.at(-1),
    ).toMatchObject({
      kind: 'actor',
      position: shown?.position,
      size: shown?.size,
    });
    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('drops a cancelled gesture without an element or undo step', () => {
    const { result } = renderPlacement();
    const before = heldElements();

    act(() => {
      result.current.pointerDown(primaryPointer({ x: 100, y: 80 }, onPane));
      result.current.pointerMove(primaryPointer({ x: 180, y: 140 }, onPane));
      result.current.pointerCancel(primaryPointer({ x: 180, y: 140 }, onPane));
      result.current.pointerUp(primaryPointer({ x: 180, y: 140 }, onPane));
    });

    expect(result.current.preview).toBeUndefined();
    expect(heldElements()).toBe(before);
    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('drops a gesture when Escape changes the tool', () => {
    const { result } = renderPlacement();
    const before = heldElements();

    act(() => {
      result.current.pointerDown(primaryPointer({ x: 100, y: 80 }, onPane));
      result.current.pointerMove(primaryPointer({ x: 180, y: 140 }, onPane));
    });
    act(() => {
      selectTool('select');
    });
    expect(result.current.preview).toBeUndefined();

    act(() => {
      result.current.pointerUp(primaryPointer({ x: 180, y: 140 }, onPane));
    });
    expect(heldElements()).toBe(before);
    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('drops a gesture when another model replaces its layout', () => {
    const firstLayout = currentLayout(modelStore.getState());
    const { result, rerender } = renderPlacement(undefined, firstLayout);
    const before = heldElements();

    act(() => {
      result.current.pointerDown(primaryPointer({ x: 100, y: 80 }, onPane));
      result.current.pointerMove(primaryPointer({ x: 180, y: 140 }, onPane));
    });
    modelStore.setState(initialState(sampleModel), true);
    rerender({ current: currentLayout(modelStore.getState()) });
    rerender({ current: firstLayout });

    expect(result.current.preview).toBeUndefined();
    act(() => {
      result.current.pointerUp(primaryPointer({ x: 180, y: 140 }, onPane));
    });
    expect(heldElements()).toBe(3);
    expect(modelStore.getState().past).toHaveLength(0);
    expect(before).toBe(6);
  });

  it('keeps one pointer in control until that pointer cancels', () => {
    const { result } = renderPlacement();

    act(() => {
      result.current.pointerDown(
        primaryPointer({ x: 100, y: 80 }, { ...onPane, pointerId: 1 }),
      );
      result.current.pointerDown(
        primaryPointer({ x: 300, y: 280 }, { ...onPane, pointerId: 2 }),
      );
      result.current.pointerMove(
        primaryPointer({ x: 180, y: 140 }, { ...onPane, pointerId: 1 }),
      );
    });
    expect(boxPreview(result.current)).toMatchObject({
      position: { x: 101, y: 81 },
      size: { width: 78, height: 58 },
    });

    act(() => {
      result.current.pointerCancel(
        primaryPointer({ x: 300, y: 280 }, { ...onPane, pointerId: 2 }),
      );
    });
    expect(result.current.preview).toBeDefined();

    act(() => {
      result.current.pointerCancel(
        primaryPointer({ x: 180, y: 140 }, { ...onPane, pointerId: 1 }),
      );
    });
    expect(result.current.preview).toBeUndefined();
    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('gives the same model geometry through pan and zoom', () => {
    const from = { x: 40, y: 60 };
    const to = { x: 140, y: 110 };
    const previewAt = (transform: ViewTransform) => {
      const screen = (point: Point): Point => ({
        x: point.x * transform.zoom + transform.pan.x,
        y: point.y * transform.zoom + transform.pan.y,
      });
      const rendered = renderPlacement(transform);
      act(() => {
        rendered.result.current.pointerDown(
          primaryPointer(screen(from), onPane),
        );
        rendered.result.current.pointerMove(primaryPointer(screen(to), onPane));
      });
      const preview = boxPreview(rendered.result.current);
      act(() => {
        rendered.result.current.pointerCancel(
          primaryPointer(screen(to), onPane),
        );
      });
      rendered.unmount();
      return preview === undefined
        ? undefined
        : {
            kind: preview.node.kind,
            position: preview.position,
            size: preview.size,
          };
    };

    expect(previewAt({ pan: { x: 0, y: 0 }, zoom: 1 })).toEqual(
      previewAt({ pan: { x: 300, y: -80 }, zoom: 2 }),
    );
  });
});
