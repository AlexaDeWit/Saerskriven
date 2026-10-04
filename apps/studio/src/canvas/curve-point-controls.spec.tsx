import { mouseEvent } from '@saerskriven/canvas/fixtures';
import { elementIn } from '@saerskriven/model/fixtures';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { currentAnnouncement } from './announcements.js';
import {
  boundaryCurve,
  boundaryElement,
  canvasModel,
  clickSuppressionLifted,
  curvedCanvasModel,
  dragHandle,
  openCanvas,
  pointerOn,
  requestFlow,
  viewportTransform,
} from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { followKeyboardMoves } from './keyboard-moves.js';

const press = (key: string, shiftKey = false): void => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });
};

const point = (number: number) =>
  screen.getByRole('button', { name: `Point ${String(number)}` });

const pointCount = () =>
  screen.queryAllByRole('button', { name: /^Point \d+$/u }).length;

const midpoint = (segment: number): HTMLElement => {
  const handle = document.querySelector<HTMLElement>(
    `[data-curve-segment="${String(segment)}"]`,
  );
  assert.isNotNull(handle);
  return handle;
};

const midpointCount = () =>
  document.querySelectorAll('[data-curve-segment]').length;

const tenths = (
  points: readonly { readonly x: number; readonly y: number }[],
) =>
  points.map(({ x, y }) => ({
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  }));

const reshaped = (
  waypoints: readonly { readonly x: number; readonly y: number }[],
): void => {
  act(() => {
    dispatch(
      Action.SetBoundaryShape({
        elementId: boundaryElement,
        shape: { kind: 'curve', waypoints: [...waypoints] },
        decimals: undefined,
      }),
    );
  });
};

const waypoints = () => {
  const boundary = elementIn(modelStore.getState().present, boundaryElement);
  return boundary.kind === 'trust-boundary' && boundary.shape.kind === 'curve'
    ? boundary.shape.waypoints
    : [];
};

beforeEach(() => {
  openCanvas([boundaryElement], curvedCanvasModel);
});

describe('DiagramCanvas, the points of a trust boundary curve', () => {
  it('draws a handle on each point while the curve alone is selected', () => {
    render(<DiagramCanvas />);
    expect(pointCount()).toBe(boundaryCurve.length);
    act(() => {
      dispatch(Action.Select({ elementIds: [requestFlow] }));
    });
    expect(pointCount()).toBe(0);
  });

  it('stands the point handles aside while the curve is scaled, and draws them again once it settles', async () => {
    render(<DiagramCanvas />);
    const control = screen.getByRole('button', {
      name: 'Resize Perimeter from right',
    }).parentElement;
    assert.isNotNull(control);

    fireEvent(control, mouseEvent('mousedown', 100));
    fireEvent(window, mouseEvent('mousemove', 160));
    expect(pointCount()).toBe(0);
    expect(midpointCount()).toBe(0);
    fireEvent(window, mouseEvent('mouseup', 160));

    expect(pointCount()).toBe(boundaryCurve.length);
    expect(midpointCount()).toBe(boundaryCurve.length - 1);
    expect(modelStore.getState().past).toHaveLength(1);
    await clickSuppressionLifted();
  });

  it('draws no point handles on a box boundary', () => {
    openCanvas([boundaryElement], canvasModel);
    render(<DiagramCanvas />);
    expect(pointCount()).toBe(0);
    expect(midpointCount()).toBe(0);
  });

  it('draws one midpoint handle to a segment, kept from assistive technology', () => {
    render(<DiagramCanvas />);
    expect(midpointCount()).toBe(boundaryCurve.length - 1);
    expect(midpoint(0).getAttribute('aria-hidden')).toBe('true');
  });

  it('hides the midpoint handle of a segment drawn shorter than twice a point handle', () => {
    render(<DiagramCanvas />);
    const { zoom } = viewportTransform();
    const drawnAcross = (length: number) => [
      { x: 0, y: 0 },
      { x: length / zoom, y: 0 },
    ];
    reshaped(drawnAcross(56.5));
    expect(midpointCount()).toBe(1);
    reshaped(drawnAcross(55.5));
    expect(midpointCount()).toBe(0);
  });

  it('keeps a double-click on a midpoint handle from renaming the boundary', () => {
    render(<DiagramCanvas />);
    const handle = midpoint(0);
    fireEvent.click(handle, { detail: 1 });
    fireEvent.click(handle, { detail: 2 });
    fireEvent.doubleClick(handle);
    expect(modelStore.getState().inlineEditor).toBeUndefined();
  });

  it('moves a focused point by arrow key, one undo step each', () => {
    render(<DiagramCanvas />);
    point(2).focus();
    press('ArrowUp');
    press('ArrowRight', true);
    expect(waypoints()).toEqual([
      boundaryCurve[0],
      { x: boundaryCurve[1].x + 20, y: boundaryCurve[1].y - 5 },
      boundaryCurve[2],
    ]);
    expect(modelStore.getState().past).toHaveLength(2);
    expect(currentAnnouncement().message).toContain('Perimeter');
  });

  it('tells the view of each arrow nudge of a focused point, and of no other key on it', () => {
    render(<DiagramCanvas />);
    const told = vi.fn<() => void>();
    const release = followKeyboardMoves(told);
    point(2).focus();

    press('ArrowUp');
    press('ArrowRight', true);
    expect(told).toHaveBeenCalledTimes(2);

    press('Delete');
    expect(told).toHaveBeenCalledTimes(2);
    release();
  });

  it('removes a focused point by Delete, keeping the boundary, its last two points and the focus', () => {
    render(<DiagramCanvas />);
    point(2).focus();
    press('Delete');
    expect(waypoints()).toEqual([boundaryCurve[0], boundaryCurve[2]]);
    point(1).focus();
    press('Backspace');
    expect(document.activeElement).toBe(point(1));
    press('Delete');
    expect(waypoints()).toEqual([boundaryCurve[0], boundaryCurve[2]]);
    expect(modelStore.getState().past).toHaveLength(1);
    expect(currentAnnouncement().message).not.toBe('');
  });

  it('removes a point through the actions a click opens, which Escape closes', () => {
    render(<DiagramCanvas />);
    fireEvent.click(point(3));
    expect(screen.getByRole('group', { name: 'Point actions' })).not.toBeNull();
    press('Escape');
    expect(screen.queryByRole('group', { name: 'Point actions' })).toBeNull();
    fireEvent.click(point(3));
    const remove = screen.getByRole('button', { name: 'Remove point' });
    expect(remove).toBe(document.activeElement);
    fireEvent.click(remove);
    expect(waypoints()).toEqual([boundaryCurve[0], boundaryCurve[1]]);
    expect(screen.queryByRole('group', { name: 'Point actions' })).toBeNull();
    fireEvent.click(point(2));
    fireEvent.click(screen.getByRole('button', { name: 'Remove point' }));
    expect(waypoints()).toEqual([boundaryCurve[0], boundaryCurve[1]]);
    expect(document.activeElement).toBe(point(2));
  });

  it('leaves Escape to the Select tool once the actions it would close are gone, with focus handed to the curve', () => {
    render(<DiagramCanvas />);
    fireEvent.click(point(3));
    point(2).focus();
    press('ArrowUp');
    expect(screen.queryByRole('group', { name: 'Point actions' })).toBeNull();

    press('Escape');

    expect(modelStore.getState().selection).toEqual([]);
    expect(document.activeElement?.getAttribute('data-id')).toBe(
      boundaryElement,
    );
  });

  it('moves a dragged point on release alone, as one undo step', () => {
    render(<DiagramCanvas />);
    dragHandle(point(1), { x: -40, y: 120 }, false);
    expect(modelStore.getState().present).toBe(curvedCanvasModel);
    dragHandle(point(1), { x: -40, y: 120 });
    const [moved] = waypoints();
    expect(moved?.x).toBeCloseTo(-40);
    expect(moved?.y).toBeCloseTo(120);
    expect(waypoints().slice(1)).toEqual(boundaryCurve.slice(1));
    expect(modelStore.getState().past).toHaveLength(1);
    fireEvent.click(point(1), { detail: 1 });
    expect(screen.queryByRole('group', { name: 'Point actions' })).toBeNull();
  });

  it('drops a drag in flight on Escape, leaving the model as it was', () => {
    render(<DiagramCanvas />);
    const handle = point(1);
    pointerOn(handle, 'pointerdown', 0, 0);
    pointerOn(handle, 'pointermove', 0, 60);
    expect(Number.parseFloat(point(1).style.top)).toBeGreaterThan(
      boundaryCurve[0].y,
    );
    handle.focus();
    press('Escape');
    pointerOn(handle, 'pointerup', 0, 60);
    expect(modelStore.getState().present).toBe(curvedCanvasModel);
    expect(Number.parseFloat(point(1).style.top)).toBeCloseTo(
      boundaryCurve[0].y,
    );
  });

  it('pulls a new point out of a dragged midpoint handle on release alone, as one undo step', () => {
    render(<DiagramCanvas />);
    const pulling = midpoint(0);
    pointerOn(pulling, 'pointerdown', 0, 0);
    pointerOn(pulling, 'pointermove', 0, 60);
    expect(pointCount()).toBe(boundaryCurve.length + 1);
    expect(midpointCount()).toBe(1);
    expect(pulling.isConnected).toBe(true);
    pointerOn(pulling, 'pointercancel', 0, 60);
    expect(pointCount()).toBe(boundaryCurve.length);
    expect(modelStore.getState().present).toBe(curvedCanvasModel);
    dragHandle(midpoint(0), { x: 60, y: 150 });
    const [first, pulled, ...rest] = waypoints();
    expect([first, ...rest]).toEqual([...boundaryCurve]);
    expect(pulled?.x).toBeCloseTo(60);
    expect(pulled?.y).toBeCloseTo(150);
    expect(pointCount()).toBe(boundaryCurve.length + 1);
    expect(modelStore.getState().past).toEqual([curvedCanvasModel]);
    expect(currentAnnouncement().message).toContain('Perimeter');
    fireEvent.click(midpoint(0), { detail: 1 });
    fireEvent.click(point(1), { detail: 1 });
    expect(screen.getByRole('group', { name: 'Point actions' })).not.toBeNull();
    act(() => {
      dispatch(Action.Undo());
    });
    expect(waypoints()).toEqual(boundaryCurve);
  });

  it('keeps a dragged midpoint handle under its pointer while the segment it shortens is too short to show one', () => {
    render(<DiagramCanvas />);
    dragHandle(midpoint(0), { x: -14, y: 80 });
    const [, pulled] = waypoints();
    expect(waypoints()).toHaveLength(boundaryCurve.length + 1);
    expect(pulled?.x).toBeCloseTo(-14);
    expect(pulled?.y).toBeCloseTo(80);
  });

  it('opens the actions of a point from the keyboard after a midpoint drag whose handle is gone before its click', () => {
    render(<DiagramCanvas />);
    dragHandle(midpoint(0), { x: -14, y: 80 });
    expect(document.querySelector('[data-curve-segment="0"]')).toBeNull();
    fireEvent.click(point(4));
    expect(screen.getByRole('group', { name: 'Point actions' })).not.toBeNull();
  });

  it('drops a midpoint drag on Escape, leaving the model as it was', () => {
    render(<DiagramCanvas />);
    const pulling = midpoint(0);
    pointerOn(pulling, 'pointerdown', 0, 0);
    pointerOn(pulling, 'pointermove', 0, 60);
    expect(pointCount()).toBe(boundaryCurve.length + 1);
    document.querySelector<HTMLElement>('.react-flow')?.focus();
    expect(document.activeElement?.classList.contains('react-flow')).toBe(true);
    press('Escape');
    pointerOn(pulling, 'pointerup', 0, 60);
    fireEvent.click(pulling, { detail: 1 });
    expect(modelStore.getState().present).toBe(curvedCanvasModel);
    expect(pointCount()).toBe(boundaryCurve.length);
  });

  it('adds a point halfway to the next through Add point, stored at three decimals, focusing the new one for the arrow keys', () => {
    render(<DiagramCanvas />);
    fireEvent.click(point(1));
    fireEvent.click(screen.getByRole('button', { name: 'Add point' }));
    expect(waypoints()).toEqual([
      boundaryCurve[0],
      { x: 85.212, y: 18.129 },
      boundaryCurve[1],
      boundaryCurve[2],
    ]);
    expect(screen.queryByRole('group', { name: 'Point actions' })).toBeNull();
    expect(document.activeElement).toBe(point(2));
    expect(modelStore.getState().past).toEqual([curvedCanvasModel]);
    press('ArrowDown');
    expect(waypoints()[1]).toEqual({ x: 85.2, y: 23.1 });
    expect(modelStore.getState().past).toHaveLength(2);
  });

  it('stores the curve at one decimal once an arrow key moves a point, and at three once a drag does', () => {
    reshaped([
      { x: -20.123456, y: 80.98765 },
      { x: 200.4444, y: -20.5558 },
      boundaryCurve[2],
    ]);
    render(<DiagramCanvas />);

    point(2).focus();
    press('ArrowRight');
    expect(waypoints()).toEqual([
      { x: -20.1, y: 81 },
      { x: 205.4, y: -20.6 },
      boundaryCurve[2],
    ]);

    dragHandle(point(1), { x: -40.12345, y: 100.6789 });
    expect(waypoints()).toEqual([
      { x: -40.123, y: 100.679 },
      { x: 205.4, y: -20.6 },
      boundaryCurve[2],
    ]);
  });

  it('adds a point before the last one through the Add point of the last', () => {
    render(<DiagramCanvas />);
    fireEvent.click(point(3));
    fireEvent.click(screen.getByRole('button', { name: 'Add point' }));
    expect(tenths(waypoints())).toEqual([
      boundaryCurve[0],
      boundaryCurve[1],
      { x: 324.1, y: 18.9 },
      boundaryCurve[2],
    ]);
    expect(document.activeElement).toBe(point(3));
  });
});
