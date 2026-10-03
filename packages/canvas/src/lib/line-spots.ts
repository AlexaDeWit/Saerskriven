import type { Point } from '@saerskriven/model';
import { segmentsOfPolyline, type Segment } from './geometry.js';
import { alongSegment, squaredDistance } from './vectors.js';

/**
 * A point on a polyline: the run it lies on, that run's unit direction, and
 * its signed distance along the line from the spot a walk started at,
 * negative toward the line's first point.
 */
export type LineSpot = {
  readonly at: Point;
  readonly segment: Segment;
  readonly direction: Point;
  readonly offset: number;
};

/**
 * Spots a `step` apart along a polyline, walking out from the middle of its
 * longest run, the first of equal runs: that middle, then a step toward the
 * first point, a step toward the last, and so on until both ends are
 * passed. A run of no length carries no spot of its own, and a polyline of
 * no length gives the one spot at its middle.
 */
export function spotsOutward(
  points: readonly [Point, ...Point[]],
  step: number,
): LineSpot[] {
  const runs = measuredRuns(points);
  const home = longestRun(runs);
  const start = home.from + home.length / 2;
  const total = runs.reduce((sum, run) => sum + run.length, 0);
  const spots = [spotOn(home, 0.5, 0)];
  for (let walked = step; walked <= total; walked += step) {
    for (const offset of [-walked, walked]) {
      const reached = start + offset;
      if (reached >= 0 && reached <= total) {
        spots.push(spotAtLength(runs, reached, offset));
      }
    }
  }
  return spots;
}

/**
 * The straight runs of a polyline's first `length` units, or of its last
 * where `fromEnd` holds. A length past the whole line gives every run.
 */
export function runsWithin(
  points: readonly Point[],
  length: number,
  fromEnd = false,
): Segment[] {
  const ordered = fromEnd
    ? points.map((_point, index) => points[points.length - 1 - index])
    : points;
  const runs: Segment[] = [];
  let left = length;
  for (const run of measuredRuns(ordered)) {
    if (left <= 0) {
      break;
    }
    const kept =
      run.length <= left
        ? run.segment
        : {
            from: run.segment.from,
            to: alongSegment(run.segment, left / run.length),
          };
    runs.push(kept);
    left -= run.length;
  }
  return runs;
}

type MeasuredRun = {
  readonly segment: Segment;
  readonly from: number;
  readonly length: number;
  readonly direction: Point;
};

const noLength = 1e-6;

function measuredRuns(points: readonly Point[]): MeasuredRun[] {
  const segments =
    points.length === 1
      ? [{ from: points[0], to: points[0] }]
      : segmentsOfPolyline(points);
  const runs: MeasuredRun[] = [];
  let from = 0;
  for (const segment of segments) {
    const length = Math.sqrt(squaredDistance(segment.from, segment.to));
    runs.push({
      segment,
      from,
      length,
      direction:
        length === 0
          ? { x: 1, y: 0 }
          : {
              x: (segment.to.x - segment.from.x) / length,
              y: (segment.to.y - segment.from.y) / length,
            },
    });
    from += length;
  }
  return runs;
}

function longestRun(runs: readonly MeasuredRun[]): MeasuredRun {
  let longest = runs[0];
  for (const run of runs) {
    if (run.length > longest.length + noLength) {
      longest = run;
    }
  }
  return longest;
}

function spotAtLength(
  runs: readonly MeasuredRun[],
  reached: number,
  offset: number,
): LineSpot {
  const run =
    runs.find(
      (candidate) =>
        candidate.length > 0 && reached <= candidate.from + candidate.length,
    ) ?? runs[runs.length - 1];
  return spotOn(
    run,
    run.length === 0 ? 0.5 : (reached - run.from) / run.length,
    offset,
  );
}

function spotOn(run: MeasuredRun, fraction: number, offset: number): LineSpot {
  return {
    at: alongSegment(run.segment, fraction),
    segment: run.segment,
    direction: run.direction,
    offset,
  };
}
