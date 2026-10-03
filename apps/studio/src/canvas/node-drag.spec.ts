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

const renderNodeDrag = () => {
  const moveNodes = vi.fn<(changes: NodeChange<DiagramNode>[]) => void>();
  const { result } = renderHook(() =>
    useNodeDrag(nodesById(currentLayout(modelStore.getState())), moveNodes),
  );
  return { report: result, moveNodes };
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

beforeEach(() => {
  openCanvas(pair);
});

describe('useNodeDrag', () => {
  it('hands a drag, its release and a keyboard move on as React Flow reports them', () => {
    const { report, moveNodes } = renderNodeDrag();
    const changes = [
      movedTo(pair, { x: 20, y: 10 }, true),
      movedTo(pair, { x: 30, y: 10 }, false),
      movedTo(pair, { x: 5, y: 0 }, false),
    ];

    for (const change of changes) {
      report.current(change);
    }

    expect(moveNodes.mock.calls).toEqual(changes.map((change) => [change]));
  });

  it('puts a drag back once the selection changes under it, as Escape to Select does, and drops the rest of it', () => {
    const { report, moveNodes } = renderNodeDrag();

    report.current(movedTo(pair, { x: 20, y: 10 }, true));
    act(() => {
      selectTool('select');
    });
    report.current(movedTo(pair, { x: 40, y: 30 }, true));
    report.current([...movedTo(pair, { x: 40, y: 30 }, false), measured]);

    expect(moveNodes.mock.calls).toEqual([
      [movedTo(pair, { x: 20, y: 10 }, true)],
      [movedTo(pair, { x: 0, y: 0 }, false)],
      [[measured]],
    ]);
  });

  it('puts a drag back when the window loses focus', () => {
    const { report, moveNodes } = renderNodeDrag();

    report.current(movedTo(pair, { x: 20, y: 10 }, true));
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    report.current(movedTo(pair, { x: 20, y: 10 }, false));

    expect(moveNodes).toHaveBeenCalledTimes(2);
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(pair, { x: 0, y: 0 }, false),
    );
  });

  it('keeps a drag whose pressed node React Flow selected as it started, and hands on the next drag once one is put back', () => {
    openCanvas();
    const { report, moveNodes } = renderNodeDrag();

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });
    report.current(movedTo([actorElement], { x: 20, y: 10 }, true));
    report.current(movedTo([actorElement], { x: 20, y: 10 }, false));
    report.current(movedTo([actorElement], { x: 10, y: 0 }, true));
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    report.current(movedTo([actorElement], { x: 10, y: 0 }, false));
    report.current(movedTo([actorElement], { x: 5, y: 5 }, true));

    expect(moveNodes).toHaveBeenNthCalledWith(
      2,
      movedTo([actorElement], { x: 20, y: 10 }, false),
    );
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo([actorElement], { x: 5, y: 5 }, true),
    );
  });
});
