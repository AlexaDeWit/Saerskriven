import { elementIn } from '@saerskriven/model/fixtures';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { currentAnnouncement } from './announcements.js';
import {
  boundaryCurve,
  boundaryElement,
  canvasModel,
  curvedCanvasModel,
  dragHandle,
  openCanvas,
  pointerOn,
  requestFlow,
} from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';

const press = (key: string, shiftKey = false): void => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });
};

const point = (number: number) =>
  screen.getByRole('button', { name: `Point ${String(number)}` });

const pointCount = () =>
  screen.queryAllByRole('button', { name: /^Point \d+$/u }).length;

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

  it('draws no point handles on a box boundary', () => {
    openCanvas([boundaryElement], canvasModel);
    render(<DiagramCanvas />);
    expect(pointCount()).toBe(0);
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

  it('leaves Escape to the page once the actions it would close are gone', () => {
    render(<DiagramCanvas />);
    fireEvent.click(point(3));
    point(2).focus();
    press('ArrowUp');
    expect(screen.queryByRole('group', { name: 'Point actions' })).toBeNull();
    expect(fireEvent.keyDown(point(2), { key: 'Escape' })).toBe(true);
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
    fireEvent.click(point(1));
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
});
