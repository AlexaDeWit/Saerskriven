import type { ElementId } from '@saerskriven/model';
import { elementIn } from '@saerskriven/model/fixtures';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  dragHandle,
  laidOutNode,
  noteElement,
  openCanvas,
  pointerOn,
  probeFlow,
  requestFlow,
  viewportTransform,
} from './canvas.fixtures.js';
import { currentAnnouncement } from './announcements.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { currentLayout } from './layout.js';
import { followKeyboardMoves, type KeyboardMove } from './keyboard-moves.js';
import {
  actorElement,
  mainDiagram,
  newProcess,
  processElement,
} from '../store/store.fixtures.js';

const press = (key: string, shiftKey = false): void => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });
};

const points = () =>
  currentLayout(modelStore.getState()).edges.find(
    (edge) => edge.id === requestFlow,
  )?.waypoints;

const add = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Add bend' }));
};

const bend = () => screen.getByRole('button', { name: 'Bend 1' });

const sourceEnd = () => screen.getByRole('button', { name: 'Flow source end' });

const targetEnd = () => screen.getByRole('button', { name: 'Flow target end' });

const endOf = (id: ElementId, end: 'source' | 'target') => {
  const flow = elementIn(modelStore.getState().present, id);
  return flow.kind === 'flow' ? flow[end] : undefined;
};

const source = () => endOf(requestFlow, 'source');

const target = (id: ElementId) => endOf(id, 'target');

const extra = { x: 300, y: 120 };

const bent = (): void => {
  dispatch(
    Action.SetFlowWaypoints({
      elementId: requestFlow,
      waypoints: [{ x: 210, y: 30 }],
      decimals: undefined,
    }),
  );
};

const hold = (handle: HTMLElement): void => {
  pointerOn(handle, 'pointerdown', 0, 0);
  pointerOn(handle, 'pointermove', 0, 60);
};

const dropByEscape = (handle: HTMLElement): void => {
  handle.focus();
  press('Escape');
};

const dropByPointerCancel = (handle: HTMLElement): void => {
  pointerOn(handle, 'pointercancel', 0, 60);
};

const drops = [
  { by: 'Escape', drop: dropByEscape },
  {
    by: 'a window blur',
    drop: (): void => {
      fireEvent.blur(window);
    },
  },
  { by: 'a pointer cancel', drop: dropByPointerCancel },
];

beforeEach(() => {
  openCanvas([requestFlow]);
});

describe('DiagramCanvas, dragging while adding a bend', () => {
  it('pulls a segment after Add bend without first placing it by click', () => {
    render(<DiagramCanvas />);
    add();
    const segment =
      document.querySelector('[data-bend-segment="0"]') ?? document.body;
    pointerOn(segment, 'pointerdown', 200, 30);
    pointerOn(segment, 'pointermove', 240, 80);
    pointerOn(segment, 'pointerup', 240, 80);
    expect(points()).toHaveLength(1);
    act(() => {
      dispatch(Action.Undo());
    });
    expect(points()).toHaveLength(0);
  });

  it('drags the insertion preview as one bend and one undo step', () => {
    render(<DiagramCanvas />);
    add();
    press('Enter');
    const before = points()?.[0];
    dragHandle(bend(), { x: 30, y: 60 });
    expect(points()).toHaveLength(1);
    expect(points()?.[0]).not.toEqual(before);
    act(() => {
      dispatch(Action.Undo());
    });
    expect(points()).toHaveLength(0);
  });
});

describe('DiagramCanvas, adding a bend to a flow', () => {
  it('keeps insertion keys and clicks separate from typing and unrelated controls', () => {
    render(<DiagramCanvas />);
    add();
    press('x');
    fireEvent.click(
      document.querySelector('.react-flow__pane') ?? document.body,
    );
    fireEvent.click(document.body);
    expect(document.querySelector('[data-chosen="true"]')).not.toBeNull();
    press('Enter');
    press('x');
    const before = modelStore.getState();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'ArrowRight',
      ctrlKey: true,
    });
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    input.remove();
    pointerOn(
      screen.getByRole('button', { name: 'Add bend' }),
      'pointerdown',
      0,
      0,
    );
    expect(modelStore.getState()).toBe(before);
    press('Enter');
    expect(points()).toEqual([{ x: 210, y: 30 }]);
    fireEvent.click(bend());
    fireEvent.click(
      document.querySelector('.react-flow__pane') ?? document.body,
    );
    expect(screen.getByRole('button', { name: 'Remove bend' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    add();
    fireEvent.click(bend());
    expect(document.querySelector('[data-chosen="true"]')).not.toBeNull();
    press('Escape');
    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('confirms a clicked preview without treating its index as a stored bend', () => {
    render(<DiagramCanvas />);
    add();
    press('Enter');
    press('ArrowDown');
    fireEvent.click(bend());
    expect(points()).toEqual([{ x: 210, y: 35 }]);
    expect(modelStore.getState().past).toHaveLength(1);
    add();
    press('Enter');
    press('ArrowDown');
    fireEvent.click(screen.getByRole('button', { name: 'Bend 2' }));
    expect(points()).toHaveLength(2);
    expect(points()?.[1]).toEqual({ x: 210, y: 35 });
    expect(modelStore.getState().past).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Bend actions' })).toBeNull();
  });

  it('inserts at the chosen segment with keyboard preview, cancellation, and one commit', () => {
    render(<DiagramCanvas />);
    add();
    press('ArrowLeft');
    press('Enter');
    press('ArrowUp');
    press('ArrowRight', true);
    press('ArrowLeft');
    expect(points()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Bend 1' })).toBeTruthy();
    press('Enter');
    expect(points()).toEqual([{ x: 225, y: 25 }]);
    expect(modelStore.getState().past).toHaveLength(1);
    add();
    press('ArrowRight');
    press('Enter');
    press('ArrowDown', true);
    press('Escape');
    expect(points()).toEqual([{ x: 225, y: 25 }]);
    expect(modelStore.getState().past).toHaveLength(1);
    add();
    press('Tab');
    expect(document.querySelector('[data-chosen]')).toBeNull();
  });

  it('wires line and handle pointer gestures and preserves Shift-click deselection', () => {
    render(<DiagramCanvas />);
    const segment =
      document.querySelector('[data-bend-segment="0"]') ?? document.body;
    pointerOn(segment, 'pointerdown', 200, 30);
    pointerOn(segment, 'pointermove', 220, 60);
    expect(points()).toEqual([]);
    pointerOn(segment, 'pointercancel', 220, 60);
    expect(screen.queryByRole('button', { name: 'Bend 1' })).toBeNull();
    pointerOn(segment, 'pointerdown', 200, 30);
    pointerOn(segment, 'pointermove', 220, 60);
    pointerOn(segment, 'pointerup', 220, 60);
    const committed = points();
    expect(committed).toHaveLength(1);
    const handle = bend();
    pointerOn(handle, 'pointerdown', 220, 60);
    pointerOn(handle, 'pointermove', 230, 80);
    pointerOn(handle, 'pointercancel', 230, 80);
    expect(points()).toEqual(committed);
    fireEvent.doubleClick(handle);
    expect(modelStore.getState().inlineEditor).toBeUndefined();
    fireEvent.click(segment);
    fireEvent.click(segment, { shiftKey: true });
    expect(modelStore.getState().selection).toEqual([]);
    expect(points()).toEqual(committed);
  });

  it('places and moves a bend with clicks', () => {
    render(<DiagramCanvas />);
    add();
    const segment = document.querySelector('[data-bend-segment="0"]');
    expect(segment).not.toBeNull();
    fireEvent.click(segment ?? document.body);
    const pane = document.querySelector('.react-flow__pane') ?? document.body;
    fireEvent.pointerDown(pane);
    fireEvent.click(pane, { clientX: 250, clientY: 100 });
    const placed = points();
    expect(placed).toHaveLength(1);
    fireEvent.click(bend());
    fireEvent.click(screen.getByRole('button', { name: 'Move bend' }));
    fireEvent.click(pane, { clientX: 270, clientY: 120 });
    expect(points()).toHaveLength(1);
    expect(points()).not.toEqual(placed);
  });

  it('drops a preview when another element is selected, leaving the model as it was', () => {
    render(<DiagramCanvas />);
    const committed = modelStore.getState().present;
    add();
    press('Enter');
    press('ArrowUp');
    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });
    expect(screen.queryByRole('button', { name: 'Add bend' })).toBeNull();
    expect(modelStore.getState().present).toBe(committed);
  });

  it('cancels a preview on a window blur and on its Cancel action', () => {
    render(<DiagramCanvas />);
    add();
    press('Enter');
    press('ArrowDown');
    fireEvent.blur(window);
    expect(points()).toEqual([]);
    add();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(points()).toEqual([]);
  });

  it('keeps the flow rename action on a double-click of its line', () => {
    render(<DiagramCanvas />);
    const segment = document.querySelector('[data-bend-segment="0"]');
    fireEvent.doubleClick(segment ?? document.body);
    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'name',
      elementId: requestFlow,
    });
    expect(screen.queryByRole('button', { name: 'Add bend' })).toBeNull();
  });
});

describe('DiagramCanvas, a bend on a flow', () => {
  it('nudges a focused bend and keeps deletion and actions local to that bend', () => {
    render(<DiagramCanvas />);
    add();
    press('Enter');
    press('ArrowDown');
    press('Enter');
    bend().focus();
    press('ArrowUp', true);
    press('ArrowLeft');
    expect(points()).toEqual([{ x: 205, y: 15 }]);
    fireEvent.click(bend());
    expect(screen.getByRole('button', { name: 'Remove bend' })).toBe(
      document.activeElement,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move bend' }));
    press('ArrowRight');
    press('Enter');
    expect(points()).toEqual([{ x: 210, y: 15 }]);
    fireEvent.click(bend());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('group', { name: 'Bend actions' })).toBeNull();
    bend().focus();
    press('Backspace');
    expect(points()).toEqual([]);
    expect(
      modelStore
        .getState()
        .present.diagrams[0].elements.some(
          (element) => element.id === requestFlow,
        ),
    ).toBe(true);
    add();
    press('Enter');
    press('Enter');
    fireEvent.click(bend());
    fireEvent.click(screen.getByRole('button', { name: 'Remove bend' }));
    expect(points()).toEqual([]);
  });
});

describe.each(drops)(
  'DiagramCanvas, a flow handle after a drag that $by dropped',
  ({ drop }) => {
    it('opens the actions of the bend on Enter', async () => {
      const user = userEvent.setup();
      bent();
      render(<DiagramCanvas />);
      hold(bend());
      drop(bend());

      bend().focus();
      await user.keyboard('{Enter}');

      expect(
        screen.getByRole('group', { name: 'Bend actions' }),
      ).not.toBeNull();
    });

    it('opens the actions of the end on Space', async () => {
      const user = userEvent.setup();
      render(<DiagramCanvas />);
      hold(sourceEnd());
      drop(sourceEnd());

      sourceEnd().focus();
      await user.keyboard(' ');

      expect(
        screen.getByRole('group', { name: 'Flow end actions' }),
      ).not.toBeNull();
    });
  },
);

describe('DiagramCanvas, a pointer click after a drag of a flow handle', () => {
  it('opens no actions where it ends the drag, released or dropped by Escape', () => {
    bent();
    render(<DiagramCanvas />);
    dragHandle(bend(), { x: 240, y: 80 });
    fireEvent.click(bend(), { detail: 1 });
    expect(screen.queryByRole('group', { name: 'Bend actions' })).toBeNull();

    hold(sourceEnd());
    dropByEscape(sourceEnd());
    pointerOn(sourceEnd(), 'pointerup', 0, 60);
    fireEvent.click(sourceEnd(), { detail: 1 });
    expect(
      screen.queryByRole('group', { name: 'Flow end actions' }),
    ).toBeNull();
  });

  it('deselects the flow by a Shift-click on its line that a later press begins, after a dropped drag', () => {
    render(<DiagramCanvas />);
    hold(sourceEnd());
    dropByPointerCancel(sourceEnd());
    const segment =
      document.querySelector('[data-bend-segment="0"]') ?? document.body;

    fireEvent.pointerDown(segment, { shiftKey: true });
    fireEvent.click(segment, { shiftKey: true, detail: 1 });

    expect(modelStore.getState().selection).toEqual([]);
  });
});

describe('DiagramCanvas, what a route gesture stores', () => {
  it('stores a bend at one decimal once an arrow key moves it, and at three once a drag does', () => {
    dispatch(
      Action.SetFlowWaypoints({
        elementId: requestFlow,
        waypoints: [{ x: 210.123456, y: 30.98765 }],
        decimals: undefined,
      }),
    );
    render(<DiagramCanvas />);

    bend().focus();
    press('ArrowDown');
    expect(points()).toEqual([{ x: 210.1, y: 36 }]);

    dragHandle(bend(), { x: 240.12345, y: 80.6789 });
    expect(points()).toEqual([{ x: 240.123, y: 80.679 }]);
  });

  it('stores a free end at one decimal once an arrow key moves it, and at three once a drag does', () => {
    openCanvas([probeFlow]);
    dispatch(
      Action.SetFlowEndPosition({
        elementId: probeFlow,
        side: 'target',
        position: { x: 500.123456, y: 200.98765 },
        decimals: undefined,
      }),
    );
    render(<DiagramCanvas />);

    targetEnd().focus();
    press('ArrowLeft');
    expect(target(probeFlow)).toMatchObject({
      position: { x: 495.1, y: 201 },
    });

    dragHandle(targetEnd(), { x: 520.12345, y: 240.6789 });
    expect(target(probeFlow)).toMatchObject({
      position: { x: 520.123, y: 240.679 },
    });
  });

  it('stores a bend placed by Enter, or by pressing its handle while placing, at one decimal, and one placed by a click at three', () => {
    dispatch(
      Action.MoveElement({
        elementId: actorElement,
        offset: { x: 0.123456, y: 0.98765 },
        decimals: undefined,
      }),
    );
    render(<DiagramCanvas />);

    add();
    press('Enter');
    press('Enter');
    expect(points()).toEqual([{ x: 210.1, y: 30.5 }]);
    act(() => {
      dispatch(Action.Undo());
    });

    add();
    press('Enter');
    fireEvent.click(bend());
    expect(points()).toEqual([{ x: 210.1, y: 30.5 }]);

    add();
    press('Enter');
    const pane = document.querySelector('.react-flow__pane') ?? document.body;
    const view = viewportTransform();
    fireEvent.pointerDown(pane);
    fireEvent.click(pane, { clientX: 251.37, clientY: 101.73 });
    expect(points()).toEqual([
      {
        x: Number(((251.37 - view.x) / view.zoom).toFixed(3)),
        y: Number(((101.73 - view.y) / view.zoom).toFixed(3)),
      },
      { x: 210.1, y: 30.5 },
    ]);
  });
});

describe('DiagramCanvas, what the view is told of', () => {
  it('hears of each arrow nudge of a focused bend as what holds focus, and of no other key on it', () => {
    render(<DiagramCanvas />);
    add();
    press('Enter');
    press('Enter');
    const told = vi.fn<(moved: KeyboardMove) => void>();
    const release = followKeyboardMoves(told);
    bend().focus();

    press('ArrowUp', true);
    press('ArrowLeft');
    expect(told.mock.calls).toEqual([['focused'], ['focused']]);

    press('Backspace');
    expect(told).toHaveBeenCalledTimes(2);
    release();
  });

  it('hears of each arrow nudge of a bend being placed as that bend, from Add bend and from Move bend, and of no other key while placing', () => {
    render(<DiagramCanvas />);
    const told = vi.fn<(moved: KeyboardMove) => void>();
    const release = followKeyboardMoves(told);

    add();
    press('Enter');
    press('ArrowDown');
    press('ArrowRight', true);
    press('Enter');
    expect(told.mock.calls).toEqual([[{ placedBend: 0 }], [{ placedBend: 0 }]]);

    add();
    press('ArrowRight');
    press('Enter');
    press('ArrowDown');
    press('Escape');
    expect(told.mock.calls.slice(2)).toEqual([[{ placedBend: 1 }]]);

    fireEvent.click(bend());
    fireEvent.click(screen.getByRole('button', { name: 'Move bend' }));
    press('ArrowUp');
    expect(told.mock.calls.slice(3)).toEqual([[{ placedBend: 0 }]]);
    release();
  });

  it('hears nothing of a bend placed by a click, nor of one moved by a drag of its handle', () => {
    render(<DiagramCanvas />);
    const told = vi.fn<(moved: KeyboardMove) => void>();
    const release = followKeyboardMoves(told);

    add();
    press('Enter');
    const pane = document.querySelector('.react-flow__pane') ?? document.body;
    fireEvent.pointerDown(pane);
    fireEvent.click(pane, { clientX: 251, clientY: 101 });
    expect(points()).toHaveLength(1);

    dragHandle(bend(), { x: 240, y: 80 });
    expect(points()).toEqual([{ x: 240, y: 80 }]);

    expect(told).not.toHaveBeenCalled();
    release();
  });

  it('hears of an arrow nudge of a focused free end', () => {
    openCanvas([probeFlow]);
    render(<DiagramCanvas />);
    const told = vi.fn<() => void>();
    const release = followKeyboardMoves(told);
    targetEnd().focus();

    press('ArrowLeft');

    expect(told).toHaveBeenCalledOnce();
    release();
  });
});

describe('DiagramCanvas, the ends of a flow', () => {
  it('pins a flow end to a side by arrow key once, and releases it by Delete', () => {
    render(<DiagramCanvas />);
    expect(
      screen.queryByRole('button', { name: 'Flow target end' }),
    ).not.toBeNull();
    sourceEnd().focus();
    press('ArrowDown');
    expect(source()).toEqual({
      kind: 'attached',
      element: actorElement,
      side: 'bottom',
    });
    expect(modelStore.getState().past).toHaveLength(1);
    press('ArrowDown');
    expect(modelStore.getState().past).toHaveLength(1);
    sourceEnd().focus();
    press('Delete');
    expect(source()).toEqual({ kind: 'attached', element: actorElement });
  });

  it('pins a flow end to a side through its actions, which close once chosen', () => {
    render(<DiagramCanvas />);
    fireEvent.click(sourceEnd());
    expect(
      screen.getByRole('group', { name: 'Flow end actions' }),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Follow the route' })).toBe(
      document.activeElement,
    );
    press('Tab');
    expect(
      screen.queryByRole('group', { name: 'Flow end actions' }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    expect(source()).toMatchObject({ side: 'top' });
    expect(
      screen.queryByRole('group', { name: 'Flow end actions' }),
    ).toBeNull();
  });

  it('pins a flow end to the side of its own element it is released within', () => {
    render(<DiagramCanvas />);
    const before = modelStore.getState().present;
    dragHandle(sourceEnd(), { x: 60, y: 55 }, false);
    expect(modelStore.getState().present).toBe(before);
    dragHandle(sourceEnd(), { x: 60, y: 55 });
    expect(source()).toEqual({
      kind: 'attached',
      element: actorElement,
      side: 'bottom',
    });
  });

  it('frees a flow end released on empty canvas, inside a trust boundary too, at the drop point, as one undo step', () => {
    render(<DiagramCanvas />);
    const handle = sourceEnd();
    hold(handle);
    expect(Number.parseFloat(sourceEnd().style.top)).toBeGreaterThan(60);
    expect(modelStore.getState().past).toEqual([]);
    dropByPointerCancel(handle);
    dragHandle(sourceEnd(), { x: 200, y: 70 });
    const freed = source();
    expect(freed?.kind).toBe('free');
    expect(freed?.kind === 'free' && freed.position.x).toBeCloseTo(200);
    expect(freed?.kind === 'free' && freed.position.y).toBeCloseTo(70);
    expect(modelStore.getState().past).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Flow source end' }),
    ).not.toBeNull();
  });

  it('attaches a flow end released on another element, following the route there', () => {
    act(() => {
      dispatch(
        Action.AddElement({
          diagramId: mainDiagram,
          element: newProcess('extra-node', 'Extra', extra),
          decimals: undefined,
        }),
      );
    });
    render(<DiagramCanvas />);
    dragHandle(sourceEnd(), { x: extra.x + 60, y: extra.y + 30 });
    expect(source()).toEqual({ kind: 'attached', element: 'extra-node' });
    expect(modelStore.getState().past).toHaveLength(2);
  });

  it('leaves a flow end released on the element its other end holds, or on a Note, where it was', () => {
    render(<DiagramCanvas />);
    const before = modelStore.getState();
    const studio = laidOutNode(processElement);
    dragHandle(sourceEnd(), {
      x: studio.position.x + studio.size.width / 2,
      y: studio.position.y + studio.size.height / 2,
    });
    const note = laidOutNode(noteElement);
    dragHandle(sourceEnd(), {
      x: note.position.x + note.size.width / 2,
      y: note.position.y + note.size.height / 2,
    });
    expect(modelStore.getState()).toMatchObject({
      present: before.present,
      past: [],
      lastFailure: undefined,
    });
  });

  it('keeps a focused free end, and its flow, on Delete or Backspace, and says so', () => {
    openCanvas([probeFlow]);
    render(<DiagramCanvas />);
    targetEnd().focus();
    press('Delete');
    press('Backspace');
    expect(target(probeFlow)).toEqual({
      kind: 'free',
      position: { x: 500, y: 200 },
    });
    expect(modelStore.getState().past).toEqual([]);
    expect(currentAnnouncement().message).not.toBe('');
  });

  it('moves a free end by arrow key and by dragging, one undo step each, and offers it no actions', () => {
    openCanvas([probeFlow]);
    render(<DiagramCanvas />);
    const end = targetEnd();
    fireEvent.click(end);
    expect(
      screen.queryByRole('group', { name: 'Flow end actions' }),
    ).toBeNull();
    end.focus();
    press('ArrowLeft');
    press('ArrowDown', true);
    expect(target(probeFlow)).toEqual({
      kind: 'free',
      position: { x: 495, y: 220 },
    });
    expect(modelStore.getState().past).toHaveLength(2);
    const reader = laidOutNode(actorElement);
    dragHandle(targetEnd(), {
      x: reader.position.x + reader.size.width / 2,
      y: reader.position.y + reader.size.height / 2,
    });
    expect(target(probeFlow)).toEqual({
      kind: 'attached',
      element: actorElement,
    });
    expect(modelStore.getState().past).toHaveLength(3);
  });
});
