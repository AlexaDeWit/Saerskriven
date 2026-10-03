import type { GestureInput } from '@saerskriven/canvas';
import type { ElementId, Point } from '@saerskriven/model';
import type { NodeChange } from '@xyflow/react';
import { act, renderHook } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { actorElement, processElement } from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { laidOutNode, openCanvas } from './canvas.fixtures.js';
import { currentLayout } from './layout.js';
import { useNodeDrag } from './node-drag.js';
import { nodesById, type DiagramNode } from './nodes.js';
import { selectTool } from './tools.js';

const pair = [actorElement, processElement];

class ViewKeepingMouseEvent extends MouseEvent {
  constructor(type: string, { view, ...init }: MouseEventInit = {}) {
    super(type, init);
    Object.defineProperty(this, 'view', { value: view });
  }
}

const renderNodeDrag = () => {
  const moveNodes =
    vi.fn<(changes: NodeChange<DiagramNode>[], input: GestureInput) => void>();
  const { result, rerender } = renderHook(() =>
    useNodeDrag(nodesById(currentLayout(modelStore.getState())), moveNodes),
  );
  return {
    start: (ids: readonly ElementId[]) => {
      act(() => {
        result.current.onNodeDragStart(
          undefined,
          undefined,
          ids.map((id) => ({ id })),
        );
      });
    },
    stop: () => {
      act(() => {
        result.current.onNodeDragStop();
      });
    },
    report: (changes: NodeChange<DiagramNode>[]) => {
      act(() => {
        result.current.onNodesChange(changes);
      });
    },
    autoPan: () => result.current.autoPan,
    rerender,
    moveNodes,
  };
};

const movedTo = (
  ids: readonly ElementId[],
  offset: Point,
  dragging: boolean,
): NodeChange<DiagramNode>[] =>
  ids.map((id) => {
    const { position } = laidOutNode(id);
    return {
      id,
      type: 'position',
      position: { x: position.x + offset.x, y: position.y + offset.y },
      dragging,
    };
  });

const measured: NodeChange<DiagramNode> = {
  id: actorElement,
  type: 'dimensions',
  dimensions: { width: 100, height: 50 },
};

const blur = (): void => {
  act(() => {
    window.dispatchEvent(new Event('blur'));
  });
};

beforeAll(() => {
  vi.stubGlobal('MouseEvent', ViewKeepingMouseEvent);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  openCanvas(pair);
});

describe('useNodeDrag', () => {
  it("hands a drag and its release on as a pointer's and a move outside a drag as the keyboard's, as React Flow reports them", () => {
    const { start, report, moveNodes } = renderNodeDrag();
    const changes = [
      movedTo(pair, { x: 20, y: 10 }, true),
      movedTo(pair, { x: 30, y: 10 }, false),
      movedTo(pair, { x: 5, y: 0 }, false),
    ];

    start(pair);
    for (const change of changes) {
      report(change);
    }

    expect(moveNodes.mock.calls).toEqual([
      [changes[0], 'pointer'],
      [changes[1], 'pointer'],
      [changes[2], 'keyboard'],
    ]);
  });

  it('puts a drag back once the selection changes under it, as Escape to Select does, and drops the rest of it with autopan off', () => {
    const { start, report, autoPan, moveNodes } = renderNodeDrag();

    start(pair);
    report(movedTo(pair, { x: 20, y: 10 }, true));
    expect(autoPan()).toBe(true);
    act(() => {
      selectTool('select');
    });
    expect(autoPan()).toBe(false);
    report(movedTo(pair, { x: 40, y: 30 }, true));
    report([...movedTo(pair, { x: 40, y: 30 }, false), measured]);

    expect(moveNodes.mock.calls).toEqual([
      [movedTo(pair, { x: 20, y: 10 }, true), 'pointer'],
      [movedTo(pair, { x: 0, y: 0 }, false), 'pointer'],
      [[measured], 'pointer'],
    ]);
    expect(autoPan()).toBe(true);
  });

  it('puts a drag back when the window loses focus, and releases the mouse gesture React Flow holds', () => {
    const { start, report, moveNodes } = renderNodeDrag();
    const released = vi.fn<(event: MouseEvent) => void>();
    window.addEventListener('mouseup', released);

    blur();
    start(pair);
    report(movedTo(pair, { x: 20, y: 10 }, true));
    blur();
    report(movedTo(pair, { x: 20, y: 10 }, false));
    window.removeEventListener('mouseup', released);

    expect(moveNodes).toHaveBeenCalledTimes(2);
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(pair, { x: 0, y: 0 }, false),
      'pointer',
    );
    expect(released).toHaveBeenCalledOnce();
    expect(released.mock.calls[0]?.[0].view).toBe(window);
  });

  it('puts a drag back where the model has its nodes now, when the model moved under it', () => {
    const { start, report, rerender, moveNodes } = renderNodeDrag();

    start(pair);
    report(movedTo(pair, { x: 20, y: 10 }, true));
    act(() => {
      dispatch(
        Action.MoveElement({
          elementId: actorElement,
          offset: { x: 15, y: 0 },
        }),
      );
    });
    rerender();
    act(() => {
      selectTool('select');
    });

    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(pair, { x: 0, y: 0 }, false),
      'pointer',
    );
  });

  it('keeps a drag whose pressed node React Flow selected as it started', () => {
    openCanvas();
    const { start, report, moveNodes } = renderNodeDrag();

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });
    start([actorElement]);
    report(movedTo([actorElement], { x: 20, y: 10 }, true));
    report(movedTo([actorElement], { x: 20, y: 10 }, false));

    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo([actorElement], { x: 20, y: 10 }, false),
      'pointer',
    );
  });

  it('replaces a drag React Flow never ended at the next drag start', () => {
    const { start, report, autoPan, moveNodes } = renderNodeDrag();

    start([actorElement]);
    report(movedTo([actorElement], { x: 20, y: 10 }, true));
    start(pair);
    report(movedTo(pair, { x: 5, y: 5 }, true));
    act(() => {
      selectTool('select');
    });
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(pair, { x: 0, y: 0 }, false),
      'pointer',
    );

    start(pair);
    expect(autoPan()).toBe(true);
    report(movedTo(pair, { x: 10, y: 0 }, true));
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(pair, { x: 10, y: 0 }, true),
      'pointer',
    );
  });

  it('filters the late release of a drag the window put back, whatever is pressed before it, and lets the next keyboard move by', () => {
    const { start, report, autoPan, moveNodes } = renderNodeDrag();

    start(pair);
    report(movedTo(pair, { x: 20, y: 10 }, true));
    blur();
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointerdown', { isPrimary: true }),
      );
    });
    report(movedTo(pair, { x: 20, y: 10 }, false));
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(pair, { x: 0, y: 0 }, false),
      'pointer',
    );
    report(movedTo(pair, { x: 5, y: 0 }, false));

    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(pair, { x: 5, y: 0 }, false),
      'keyboard',
    );
    expect(autoPan()).toBe(true);
  });

  it('forgets at its stop a drag that moved nothing, so the next keyboard move goes by', () => {
    const { start, report, stop, autoPan, moveNodes } = renderNodeDrag();

    start(pair);
    act(() => {
      selectTool('select');
    });
    stop();
    report(movedTo(pair, { x: 5, y: 0 }, false));

    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(pair, { x: 5, y: 0 }, false),
      'keyboard',
    );
    expect(autoPan()).toBe(true);
  });
});
