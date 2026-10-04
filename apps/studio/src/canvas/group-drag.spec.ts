import {
  drawnBounds,
  selectedBadgeAnchor,
  type GestureInput,
} from '@saerskriven/canvas';
import { badgeRadius } from '@saerskriven/canvas/tokens';
import type { ElementId, Point } from '@saerskriven/model';
import type { NodeChange } from '@xyflow/react';
import { act, renderHook } from '@testing-library/react';
import { actorElement, processElement } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import {
  boundaryElement,
  laidOutNode,
  noteElement,
  openCanvas,
  primaryPointer,
  requestFlow,
} from './canvas.fixtures.js';
import {
  passesToSelection,
  selectionBoundsPadding,
  useGroupDrag,
} from './group-drag.js';
import { currentLayout, insideBounds, selectionBounds } from './layout.js';
import { elementIds, type DiagramNode } from './nodes.js';
import { toggleSnap } from './snap.js';
import { selectTool } from './tools.js';

const canvas = document.createElement('div');
canvas.className = 'react-flow';
canvas.tabIndex = -1;

const container = document.createElement('div');
container.append(canvas);
document.body.append(container);

const pane = document.createElement('div');
pane.className = 'react-flow__pane';

const drawn = (id: ElementId): HTMLElement => {
  const node = document.createElement('div');
  node.className = 'react-flow__node';
  node.dataset['id'] = id;
  return node;
};

type Modifiers = {
  readonly pointerType: 'mouse' | 'touch';
  readonly shiftKey: boolean;
};

const plainMouse: Modifiers = { pointerType: 'mouse', shiftKey: false };

const pressAt = (
  at: Point,
  target: EventTarget = pane,
  modifiers: Partial<Modifiers> = {},
) =>
  primaryPointer(at, {
    target,
    currentTarget: container,
    ...plainMouse,
    ...modifiers,
  });

const renderGroupDrag = (zoom = 1) => {
  const moveNodes =
    vi.fn<(changes: NodeChange<DiagramNode>[], input: GestureInput) => void>();
  const view = {
    current: { screenToFlowPosition: (at: Point) => at, getZoom: () => zoom },
  };
  const layout = currentLayout(modelStore.getState());
  const { result } = renderHook(() =>
    useGroupDrag(
      view,
      layout,
      modelStore.getState().selection,
      elementIds(layout),
      moveNodes,
    ),
  );
  return { drag: result, moveNodes };
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

const group = [boundaryElement, actorElement, processElement];

const betweenActorAndProcess = { x: 200, y: 40 };

beforeEach(() => {
  openCanvas(group);
});

describe('passesToSelection', () => {
  it('passes empty canvas and an element the selection leaves out', () => {
    const elements = elementIds(currentLayout(modelStore.getState()));

    expect(passesToSelection(pane, elements, [boundaryElement])).toBe(true);
    expect(
      passesToSelection(drawn(actorElement), elements, [boundaryElement]),
    ).toBe(true);
  });

  it('leaves a selected element and a control to their own gestures', () => {
    const elements = elementIds(currentLayout(modelStore.getState()));
    const handle = document.createElement('div');
    handle.className = 'react-flow__handle';
    drawn(actorElement).append(handle);

    expect(passesToSelection(drawn(actorElement), elements, group)).toBe(false);
    expect(passesToSelection(handle, elements, [boundaryElement])).toBe(false);
    expect(passesToSelection(null, elements, group)).toBe(false);
  });
});

describe('useGroupDrag', () => {
  it('drags every selected node by one offset from empty canvas inside the bounds', () => {
    const { drag, moveNodes } = renderGroupDrag();
    const press = pressAt(betweenActorAndProcess);

    expect(drag.current.down(press)).toBe(true);
    drag.current.move(pressAt({ x: 230, y: 60 }));
    drag.current.up(pressAt({ x: 240, y: 70 }));

    expect(press.stopPropagation).toHaveBeenCalled();
    expect(moveNodes).toHaveBeenCalledTimes(2);
    expect(moveNodes).toHaveBeenNthCalledWith(
      1,
      movedTo(group, { x: 30, y: 20 }, true),
      'pointer',
    );
    expect(moveNodes).toHaveBeenNthCalledWith(
      2,
      movedTo(group, { x: 40, y: 30 }, false),
      'pointer',
    );
  });

  it('drags a trust boundary selected alone from its interior, and from an element inside it', () => {
    openCanvas([boundaryElement]);
    const { drag, moveNodes } = renderGroupDrag();

    expect(drag.current.down(pressAt(betweenActorAndProcess))).toBe(true);
    drag.current.move(pressAt({ x: 210, y: 40 }));
    drag.current.up(pressAt({ x: 210, y: 40 }));
    expect(
      drag.current.down(pressAt({ x: 60, y: 30 }, drawn(actorElement))),
    ).toBe(true);

    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo([boundaryElement], { x: 10, y: 0 }, false),
      'pointer',
    );
  });

  it('leaves a press that never travels the click distance to the click', () => {
    const { drag, moveNodes } = renderGroupDrag();

    expect(drag.current.down(pressAt(betweenActorAndProcess))).toBe(true);
    drag.current.move(pressAt({ x: 202, y: 41 }));
    drag.current.up(pressAt({ x: 202, y: 41 }));

    expect(moveNodes).not.toHaveBeenCalled();
  });

  it('counts the padding around the bounds in screen pixels', () => {
    const bounds = selectionBounds(currentLayout(modelStore.getState()), group);
    const nearby = {
      x: bounds.x - selectionBoundsPadding * 0.75,
      y: bounds.y + bounds.height / 2,
    };

    expect(renderGroupDrag().drag.current.down(pressAt(nearby))).toBe(true);
    expect(renderGroupDrag(2).drag.current.down(pressAt(nearby))).toBe(false);
  });

  it("drags the selection from beside a selected element's badge, stepped out past its corner", () => {
    openCanvas([actorElement]);
    const reader = laidOutNode(actorElement);
    const at = selectedBadgeAnchor(reader);
    const besideBadge = {
      x: reader.position.x + at.x + badgeRadius.primary,
      y: reader.position.y + at.y - badgeRadius.primary,
    };

    expect(
      insideBounds(
        besideBadge,
        drawnBounds([reader], []),
        selectionBoundsPadding,
      ),
    ).toBe(false);
    expect(renderGroupDrag().drag.current.down(pressAt(besideBadge))).toBe(
      true,
    );
  });

  it('leaves a press outside the bounds, on a selected element, with Shift, by touch or in another tool to the canvas', () => {
    const { drag } = renderGroupDrag();
    const outside = pressAt({ x: 600, y: 300 });

    expect(drag.current.down(outside)).toBe(false);
    expect(
      drag.current.down(pressAt({ x: 60, y: 30 }, drawn(actorElement))),
    ).toBe(false);
    expect(
      drag.current.down(
        pressAt(betweenActorAndProcess, pane, { shiftKey: true }),
      ),
    ).toBe(false);
    expect(
      drag.current.down(
        pressAt(betweenActorAndProcess, pane, { pointerType: 'touch' }),
      ),
    ).toBe(false);
    selectTool('hand');
    expect(drag.current.down(pressAt(betweenActorAndProcess))).toBe(false);
    expect(outside.stopPropagation).not.toHaveBeenCalled();
  });

  it('leaves a selection of flows alone, which has no node to carry it', () => {
    openCanvas([requestFlow]);

    expect(
      renderGroupDrag().drag.current.down(pressAt(betweenActorAndProcess)),
    ).toBe(false);
  });

  it('stops the mouse press only while a press is the selection’s', () => {
    const { drag } = renderGroupDrag();
    const before = { stopPropagation: vi.fn<() => void>() };
    const during = { stopPropagation: vi.fn<() => void>() };

    drag.current.mouseDown(before);
    drag.current.down(pressAt(betweenActorAndProcess));
    drag.current.mouseDown(during);

    expect(before.stopPropagation).not.toHaveBeenCalled();
    expect(during.stopPropagation).toHaveBeenCalled();
  });

  it('focuses the canvas once a drag settles, and leaves focus to a click', () => {
    const { drag } = renderGroupDrag();
    const element = drawn(noteElement);
    element.tabIndex = 0;
    document.body.append(element);
    element.focus();

    drag.current.down(pressAt(betweenActorAndProcess, element));
    drag.current.up(pressAt(betweenActorAndProcess, element));
    expect(document.activeElement).toBe(element);
    drag.current.down(pressAt(betweenActorAndProcess, element));
    drag.current.move(pressAt({ x: 230, y: 60 }));
    drag.current.up(pressAt({ x: 230, y: 60 }));

    expect(document.activeElement).toBe(canvas);
    element.remove();
  });

  it('puts a drag back once the selection changes under it, as Escape to Select does', () => {
    const { drag, moveNodes } = renderGroupDrag();

    drag.current.down(pressAt(betweenActorAndProcess));
    drag.current.move(pressAt({ x: 230, y: 50 }));
    act(() => {
      selectTool('select');
    });
    drag.current.move(pressAt({ x: 260, y: 90 }));
    drag.current.up(pressAt({ x: 260, y: 90 }));

    expect(moveNodes).toHaveBeenCalledTimes(2);
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(group, { x: 0, y: 0 }, false),
      'pointer',
    );
  });

  it('puts a drag back when the window loses focus', () => {
    const { drag, moveNodes } = renderGroupDrag();

    drag.current.down(pressAt(betweenActorAndProcess));
    drag.current.move(pressAt({ x: 230, y: 50 }));
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    drag.current.up(pressAt({ x: 230, y: 50 }));

    expect(moveNodes).toHaveBeenCalledTimes(2);
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(group, { x: 0, y: 0 }, false),
      'pointer',
    );
  });

  it('puts a cancelled drag back where it started', () => {
    const { drag, moveNodes } = renderGroupDrag();

    drag.current.down(pressAt(betweenActorAndProcess));
    drag.current.move(pressAt({ x: 260, y: 90 }));
    drag.current.cancel();
    drag.current.up(pressAt({ x: 260, y: 90 }));

    expect(moveNodes).toHaveBeenCalledTimes(2);
    expect(moveNodes).toHaveBeenLastCalledWith(
      movedTo(group, { x: 0, y: 0 }, false),
      'pointer',
    );
  });

  it('snaps the first selected node to the grid and moves the rest with it', () => {
    toggleSnap();
    try {
      const { drag, moveNodes } = renderGroupDrag();

      drag.current.down(pressAt(betweenActorAndProcess));
      drag.current.move(pressAt({ x: 213, y: 47 }));

      expect(moveNodes).toHaveBeenLastCalledWith(
        movedTo(group, { x: 20, y: -5 }, true),
        'pointer',
      );
    } finally {
      toggleSnap();
    }
  });
});
