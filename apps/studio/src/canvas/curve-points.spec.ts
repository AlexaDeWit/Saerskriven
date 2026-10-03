import { act, renderHook } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { currentAnnouncement } from './announcements.js';
import {
  boundaryCurve,
  boundaryElement,
  curvedCanvasModel,
  openCanvas,
} from './canvas.fixtures.js';
import { addedPoint, useCurvePoints } from './curve-points.js';
import type { WaypointTarget } from './waypoints.js';

const firstHalfway = { x: 85.2, y: 18.1 };

const secondHalfway = { x: 324.1, y: 18.9 };

const tenth = (value: number): number => Math.round(value * 10) / 10;

const roughly = (target: WaypointTarget | undefined) =>
  target === undefined
    ? undefined
    : {
        ...target,
        point: { x: tenth(target.point.x), y: tenth(target.point.y) },
      };

describe('addedPoint', () => {
  it('goes halfway along the drawn curve to the next point, by length', () => {
    expect(roughly(addedPoint(boundaryCurve, 0))).toEqual({
      kind: 'insert',
      index: 1,
      point: firstHalfway,
    });
    expect(roughly(addedPoint(boundaryCurve, 1))).toEqual({
      kind: 'insert',
      index: 2,
      point: secondHalfway,
    });
  });

  it('goes from the last point halfway back to the one before it', () => {
    expect(roughly(addedPoint(boundaryCurve, 2))).toEqual({
      kind: 'insert',
      index: 2,
      point: secondHalfway,
    });
  });

  it('halves the line between the two points of a two-point curve', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 80, y: 40 },
    ];
    const halfway = { kind: 'insert', index: 1, point: { x: 40, y: 20 } };
    expect(roughly(addedPoint(line, 0))).toEqual(halfway);
    expect(roughly(addedPoint(line, 1))).toEqual(halfway);
  });

  it('finds no place for a point the curve does not have', () => {
    expect(addedPoint(boundaryCurve, 3)).toBeUndefined();
    expect(addedPoint(boundaryCurve, -1)).toBeUndefined();
  });
});

describe('useCurvePoints', () => {
  beforeEach(() => {
    openCanvas([boundaryElement], curvedCanvasModel);
  });

  it('adds a point as one undoable edit and answers the index it takes', () => {
    const { result } = renderHook(useCurvePoints);
    let added: number | undefined;
    act(() => {
      added = result.current.add(0);
    });
    expect(added).toBe(1);
    const waypoints = result.current.boundary?.shape.waypoints ?? [];
    expect(waypoints).toHaveLength(boundaryCurve.length + 1);
    expect(waypoints[0]).toEqual(boundaryCurve[0]);
    expect(waypoints.slice(2)).toEqual(boundaryCurve.slice(1));
    expect(modelStore.getState().past).toEqual([curvedCanvasModel]);
    expect(currentAnnouncement().message).toContain('Perimeter');
    act(() => {
      dispatch(Action.Undo());
    });
    expect(modelStore.getState().present).toBe(curvedCanvasModel);
  });

  it('adds nothing where the curve has no point', () => {
    const { result } = renderHook(useCurvePoints);
    act(() => {
      expect(result.current.add(boundaryCurve.length)).toBeUndefined();
    });
    expect(modelStore.getState().present).toBe(curvedCanvasModel);
  });
});
