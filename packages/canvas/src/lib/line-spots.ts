import type { Point } from '@saerskriven/model';
import { segmentsOfPolyline, type Segment } from './geometry.js';
import { alongSegment, squaredDistance, unitDirection } from './vectors.js';

/**
 * One straight run of a polyline: how far along the line it starts, how long
 * it is, measured by a correctly rounded root, and its unit direction.
 */
export type LineRun = {
  readonly segment: Segment;
  readonly start: number;
  readonly length: number;
  readonly direction: Point;
};

/**
 * A point on a polyline: the index of the run it lies on, how far along that
 * run it lies, and its signed distance along the line from the spot a walk
 * started at, negative toward the line's first point.
 */
export type LineSpot = {
  readonly at: Point;
  readonly run: number;
  readonly along: number;
  readonly offset: number;
};

/**
 * The straight runs of a polyline, one of no length for a polyline of one
 * point.
 */
export function lineRuns(points: readonly Point[]): LineRun[] {
  const segments =
    points.length === 1
      ? [{ from: points[0], to: points[0] }]
      : segmentsOfPolyline(points);
  let start = 0;
  return segments.map((segment) => {
    const length = Math.sqrt(squaredDistance(segment.from, segment.to));
    const run = {
      segment,
      start,
      length,
      direction: unitDirection(segment.from, segment.to),
    };
    start += length;
    return run;
  });
}

/**
 * The run that carries the point a length along a polyline, and how far
 * along that run the point lies as a fraction: the first run of any length
 * reaching that far, or the last run where none does.
 */
export function runAtLength(
  runs: readonly LineRun[],
  length: number,
): { readonly index: number; readonly fraction: number } {
  const found = runs.findIndex(
    (run) => run.length > 0 && length <= run.start + run.length,
  );
  const index = found === -1 ? runs.length - 1 : found;
  const run = runs[index];
  return {
    index,
    fraction: run.length === 0 ? 0.5 : (length - run.start) / run.length,
  };
}

/**
 * Spots a `step` apart along a polyline's runs, walking out from the middle
 * of its longest run, the first of equal runs: that middle, then a step
 * toward the first point, a step toward the last, and so on until both ends
 * are passed. A run of no length carries no spot of its own, and a polyline
 * of no length gives the one spot at its middle.
 */
export function spotsOutward(
  runs: readonly LineRun[],
  step: number,
): LineSpot[] {
  const home = longestRun(runs);
  const middle = runs[home].start + runs[home].length / 2;
  const last = runs[runs.length - 1];
  const total = last.start + last.length;
  const toward: number[] = [];
  const away: number[] = [];
  for (let walked = step; walked <= total; walked += step) {
    if (middle - walked >= 0) {
      toward.push(-walked);
    }
    if (middle + walked <= total) {
      away.push(walked);
    }
  }
  const before = toward.length;
  const offsets = [
    ...toward.map((_unused, at) => toward[before - 1 - at]),
    0,
    ...away,
  ];
  let index = 0;
  const ascending = offsets.map((offset): LineSpot => {
    if (offset === 0) {
      return {
        at: alongSegment(runs[home].segment, 0.5),
        run: home,
        along: runs[home].length / 2,
        offset,
      };
    }
    const reached = middle + offset;
    while (
      index < runs.length - 1 &&
      (runs[index].length === 0 ||
        reached > runs[index].start + runs[index].length)
    ) {
      index += 1;
    }
    const run = runs[index];
    const fraction =
      run.length === 0 ? 0.5 : (reached - run.start) / run.length;
    return {
      at: alongSegment(run.segment, fraction),
      run: index,
      along: run.length * fraction,
      offset,
    };
  });
  const outward = [ascending[before]];
  for (let apart = 1; apart < ascending.length; apart += 1) {
    if (before - apart >= 0) {
      outward.push(ascending[before - apart]);
    }
    if (before + apart < ascending.length) {
      outward.push(ascending[before + apart]);
    }
  }
  return outward;
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
  for (const run of lineRuns(ordered)) {
    if (left <= 0) {
      break;
    }
    runs.push(
      run.length <= left
        ? run.segment
        : {
            from: run.segment.from,
            to: alongSegment(run.segment, left / run.length),
          },
    );
    left -= run.length;
  }
  return runs;
}

const noLength = 1e-6;

function longestRun(runs: readonly LineRun[]): number {
  let longest = 0;
  for (const [index, run] of runs.entries()) {
    if (run.length > runs[longest].length + noLength) {
      longest = index;
    }
  }
  return longest;
}
