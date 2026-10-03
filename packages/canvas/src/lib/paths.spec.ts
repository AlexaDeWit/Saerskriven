import type { Point } from '@saerskriven/model';
import {
  arrowheadPath,
  controlPolygon,
  curveMidpoints,
  polylinePath,
  sampledCurve,
  smoothPath,
  smoothSegments,
  translate,
} from './paths.js';

const lowestOf = (points: readonly Point[]): number =>
  Math.min(...points.map((point) => point.y));

const lengthOf = (points: readonly Point[]): number =>
  points
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + Math.hypot(point.x - points[index].x, point.y - points[index].y),
      0,
    );

describe('translate', () => {
  it('writes the point as an SVG transform', () => {
    expect(translate({ x: 40, y: -12.5 })).toBe('translate(40, -12.5)');
  });
});

describe('polylinePath', () => {
  it('moves to the first point and draws to the rest', () => {
    expect(
      polylinePath([
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 20 },
      ]),
    ).toBe('M 0 0 L 10 20 L 30 20');
  });

  it('draws nothing through no points', () => {
    expect(polylinePath([])).toBe('');
  });
});

describe('smoothPath', () => {
  it('draws a cubic segment between each pair of waypoints', () => {
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 100, y: 40 },
        { x: 200, y: 0 },
      ]),
    ).toBe(
      'M 0 0 C 16.667 6.667 66.667 40 100 40 ' +
        'C 133.333 40 183.333 6.667 200 0',
    );
  });

  it('gives the same path for the same waypoints every time', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      { x: 200, y: 0 },
    ];
    expect(smoothPath(waypoints)).toBe(smoothPath(waypoints));
  });

  it('joins a pair of waypoints as one segment', () => {
    expect(
      smoothPath([
        { x: 0, y: 0 },
        { x: 60, y: 0 },
      ]),
    ).toBe('M 0 0 C 10 0 50 0 60 0');
  });

  it('falls back to straight segments where there is nothing to smooth', () => {
    expect(smoothPath([{ x: 5, y: 5 }])).toBe('M 5 5');
  });
});

describe('arrowheadPath', () => {
  it('points along the segment it ends', () => {
    expect(arrowheadPath({ x: 100, y: 0 }, { x: 0, y: 0 })).toBe(
      'M 100 0 L 82 7 L 82 -7 Z',
    );
  });

  it('turns with the segment', () => {
    expect(arrowheadPath({ x: 0, y: 100 }, { x: 0, y: 0 })).toBe(
      'M 0 100 L -7 82 L 7 82 Z',
    );
  });

  it('points to the right where the segment has no length', () => {
    expect(arrowheadPath({ x: 40, y: 40 }, { x: 40, y: 40 })).toBe(
      'M 40 40 L 22 47 L 22 33 Z',
    );
  });
});

describe('smoothSegments', () => {
  it('leaves a run of fewer than two points unsmoothed', () => {
    expect(smoothSegments([{ x: 5, y: 5 }])).toEqual([]);
  });

  it('throws a control point outside the box a sharp turn spans', () => {
    const [first, second] = smoothSegments([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
    ]);
    expect(first.secondControl.y).toBeLessThan(0);
    expect(second.firstControl.x).toBeGreaterThan(400);
  });
});

describe('controlPolygon', () => {
  it('traces the first point and then each cubic control point in turn', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      { x: 200, y: 0 },
    ];
    const drawn = smoothSegments(waypoints);
    expect(controlPolygon(waypoints)).toEqual([
      waypoints[0],
      ...drawn.flatMap((segment) => [
        segment.firstControl,
        segment.secondControl,
        segment.end,
      ]),
    ]);
  });

  it('gives back the points where there is nothing to smooth', () => {
    expect(controlPolygon([{ x: 5, y: 5 }])).toEqual([{ x: 5, y: 5 }]);
    expect(controlPolygon([])).toEqual([]);
  });
});

describe('sampledCurve', () => {
  it('runs from the first point to the last, 64 samples to a cubic', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      { x: 200, y: 0 },
    ];
    const sampled = sampledCurve(waypoints);
    expect(sampled).toHaveLength(129);
    expect(sampled[0]).toEqual(waypoints[0]);
    expect(sampled.at(-1)).toEqual(waypoints[2]);
  });

  it('stays inside the reach of the control polygon on a sharp turn', () => {
    const waypoints = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
    ];
    expect(lowestOf(sampledCurve(waypoints))).toBeGreaterThan(
      lowestOf(controlPolygon(waypoints)),
    );
  });

  it('gives back the points where there is nothing to smooth', () => {
    expect(sampledCurve([{ x: 5, y: 5 }])).toEqual([{ x: 5, y: 5 }]);
    expect(sampledCurve([])).toEqual([]);
  });
});

describe('curveMidpoints', () => {
  it('finds the point halfway along each segment by length, not by parameter', () => {
    const arch = [
      { x: 0, y: 330 },
      { x: 420, y: 400 },
      { x: 860, y: 330 },
    ];
    const [first, second] = curveMidpoints(arch);
    expect(first?.point.x).toBeCloseTo(208.6, 1);
    expect(first?.point.y).toBeCloseTo(374.6, 1);
    expect(second?.point.x).toBeCloseTo(641.3, 1);
    expect(second?.point.y).toBeCloseTo(374.1, 1);
    expect(
      (first?.segmentLength ?? 0) + (second?.segmentLength ?? 0),
    ).toBeCloseTo(lengthOf(sampledCurve(arch)));
  });

  it('halves the chord of a curve through two points, as long as the chord', () => {
    const [only] = curveMidpoints([
      { x: 0, y: 0 },
      { x: 60, y: 30 },
    ]);
    expect(only?.point.x).toBeCloseTo(30);
    expect(only?.point.y).toBeCloseTo(15);
    expect(only?.segmentLength).toBeCloseTo(Math.hypot(60, 30));
  });

  it('gives a segment of no length its point and a length of zero', () => {
    expect(
      curveMidpoints([
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ]),
    ).toEqual([{ point: { x: 5, y: 5 }, segmentLength: 0 }]);
  });

  it('finds no segment where there is nothing to smooth', () => {
    expect(curveMidpoints([{ x: 5, y: 5 }])).toEqual([]);
  });
});
