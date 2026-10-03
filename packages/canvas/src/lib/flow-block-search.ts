import type { Point } from '@saerskriven/model';
import {
  blockAt,
  type FlowBlock,
  type FlowLabelPlacement,
} from './flow-blocks.js';
import {
  boxAround,
  boxMeetsEllipse,
  type Box,
  type Ellipse,
  type Segment,
} from './geometry.js';
import type { LineRun, LineSpot } from './line-spots.js';
import { memoizedByIdentity } from './memoized.js';
import { projectedHalfExtent } from './text-placement.js';
import { negated, offsetBy, scaledBy } from './vectors.js';

/**
 * Something drawn that a block keeps clear of, with the box that bounds it:
 * a box, an ellipse, or a straight run of line.
 */
export type Obstacle =
  | { readonly kind: 'box'; readonly box: Box }
  | { readonly kind: 'ellipse'; readonly box: Box; readonly ellipse: Ellipse }
  | { readonly kind: 'line'; readonly box: Box; readonly line: Segment };

/**
 * What placing one flow's block reads. `others` is everything drawn but the
 * flow's own line and arrowheads, which are `own`. `ends` are the stretches
 * of the flow's own line a block on the line leaves showing. A block beside
 * the line stands off it by each of `standoffs`, nearest first.
 */
export type BlockSearch = {
  readonly runs: readonly LineRun[];
  readonly spots: readonly LineSpot[];
  readonly shapes: readonly FlowBlock[];
  readonly others: readonly Obstacle[];
  readonly own: readonly Obstacle[];
  readonly ends: readonly Segment[];
  readonly standoffs: readonly number[];
};

/** A box as an obstacle. */
export function boxObstacle(box: Box): Obstacle {
  return { kind: 'box', box };
}

/** A straight run of line as an obstacle. */
export function lineObstacle(line: Segment): Obstacle {
  return {
    kind: 'line',
    line,
    box: {
      minX: Math.min(line.from.x, line.to.x),
      minY: Math.min(line.from.y, line.to.y),
      maxX: Math.max(line.from.x, line.to.x),
      maxY: Math.max(line.from.y, line.to.y),
    },
  };
}

/** An ellipse as an obstacle. */
export function ellipseObstacle(ellipse: Ellipse): Obstacle {
  return {
    kind: 'ellipse',
    ellipse,
    box: boxAround(ellipse.centre, ellipse.radiusX, ellipse.radiusY),
  };
}

/**
 * The block a flow's search settles on: on the line at each spot in turn,
 * then beside it on the fixed side and then the other, each shape widest
 * first, at each standoff nearest first, at each spot in turn. The first
 * candidate covering nothing wins, a candidate on the line counting only
 * where it leaves `ends` uncovered, and where none is clear the first of
 * those covering the fewest obstacles.
 *
 * A block hung one way slides along a run in a straight line, so it meets a
 * box or a straight run of line over one interval of the run, which the
 * search works out from the inequalities the box and line tests use, a hair
 * wider so that rounding never clears a spot those tests would not. Each
 * interval adds one to the spots it holds, and an ellipse is tested at each
 * spot its bounding box's interval holds.
 */
export function searchedBlock(search: BlockSearch): FlowLabelPlacement {
  const near = obstaclesNearRuns(search);
  const costs = new Int32Array(search.spots.length);
  let fewest = Number.POSITIVE_INFINITY;
  let chosen: { readonly hanging: Hanging; readonly index: number } | undefined;
  for (const hanging of hangingsOf(search)) {
    measureCosts(search, near, hanging, costs);
    for (let index = 0; index < costs.length; index += 1) {
      const cost = costs[index];
      if (cost !== unmeasured && cost < fewest) {
        fewest = cost;
        chosen = { hanging, index };
        if (cost === 0) {
          return placedAt(search, chosen.hanging, chosen.index);
        }
      }
    }
  }
  return chosen === undefined
    ? blockAt(search.shapes[0], search.spots[0].at)
    : placedAt(search, chosen.hanging, chosen.index);
}

type Hanging = {
  readonly block: FlowBlock;
  readonly shape: number;
  readonly side: number;
  readonly standoff: number;
};

type SpotsOnRun = {
  readonly order: readonly number[];
  readonly alongs: Float64Array;
};

type NearRuns = {
  readonly others: readonly (readonly Obstacle[])[];
  readonly beside: readonly (readonly (readonly Obstacle[])[])[];
  readonly ends: readonly (readonly Obstacle[])[];
};

const margin = 1e-6;

const onTheLine = 0;

const unmeasured = -1;

const spotsByRun = memoizedByIdentity((spots: readonly LineSpot[]) => {
  const before: number[] = [];
  const after: number[] = [];
  for (const [at, spot] of spots.entries()) {
    if (spot.offset < 0) {
      before.push(at);
    } else if (spot.offset > 0) {
      after.push(at);
    }
  }
  return {
    ascending: [
      ...before.map((_unused, at) => before[before.length - 1 - at]),
      0,
      ...after,
    ],
    measured: new Map<number, SpotsOnRun>(),
  };
});

function* hangingsOf(search: BlockSearch): Generator<Hanging> {
  yield { block: search.shapes[0], shape: 0, side: onTheLine, standoff: 0 };
  for (const side of [1, -1]) {
    for (const [shape, block] of search.shapes.entries()) {
      for (const standoff of search.standoffs) {
        yield { block, shape, side, standoff };
      }
    }
  }
}

function obstaclesNearRuns(search: BlockSearch): NearRuns {
  const [onLine] = search.shapes;
  const nearest = Math.min(...search.standoffs);
  const farthest = Math.max(...search.standoffs);
  const reach =
    farthest +
    Math.max(
      ...search.shapes.map(
        (block) =>
          block.halfWidth +
          block.halfHeight +
          Math.max(block.halfWidth, block.halfHeight),
      ),
    );
  const ends = search.ends.map(lineObstacle);
  const near = (
    run: LineRun,
    obstacles: readonly Obstacle[],
    within: number,
  ): Obstacle[] =>
    obstacles.filter((obstacle) => runPassesNear(run, obstacle.box, within));
  const along = Math.max(onLine.halfWidth, onLine.halfHeight);
  return {
    others: search.runs.map((run) => near(run, search.others, along)),
    beside: search.runs.map((run) => {
      const all = [
        ...near(run, search.others, reach),
        ...near(run, search.own, reach),
      ];
      return [1, -1].flatMap((sign) =>
        search.shapes.map((block) => {
          const across = acrossReach(block, run.direction);
          return all.filter((obstacle) =>
            meetsBand(
              run,
              obstacle.box,
              sign,
              nearest,
              farthest + 2 * across,
              alongReach(block, run.direction),
            ),
          );
        }),
      );
    }),
    ends: search.runs.map((run) => near(run, ends, along)),
  };
}

function spotsOnRun(spots: readonly LineSpot[], run: number): SpotsOnRun {
  const { ascending, measured } = spotsByRun(spots);
  const cached = measured.get(run);
  if (cached !== undefined) {
    return cached;
  }
  const order = ascending.filter((at) => spots[at].run === run);
  const alongs = new Float64Array(order.length);
  for (const [step, at] of order.entries()) {
    alongs[step] = spots[at].along;
  }
  const onRun = { order, alongs };
  measured.set(run, onRun);
  return onRun;
}

function measureCosts(
  search: BlockSearch,
  near: NearRuns,
  hanging: Hanging,
  costs: Int32Array,
): void {
  costs.fill(unmeasured);
  const onLine = hanging.side === onTheLine;
  for (const [index, run] of search.runs.entries()) {
    const { order, alongs } = spotsOnRun(search.spots, index);
    if (order.length === 0) {
      continue;
    }
    const offset = hangingOffset(hanging, run.direction);
    const origin = {
      x: run.segment.from.x + offset.x,
      y: run.segment.from.y + offset.y,
    };
    const counted = new Int32Array(order.length + 1);
    const refused = new Int32Array(order.length + 1);
    const range = new Float64Array(2);
    const tally = (obstacles: readonly Obstacle[], into: Int32Array): void => {
      for (const obstacle of obstacles) {
        if (!reachOf(obstacle, origin, run.direction, hanging.block, range)) {
          continue;
        }
        const first = firstAtLeast(alongs, range[0]);
        const last = firstAtLeast(alongs, range[1], true) - 1;
        if (obstacle.kind !== 'ellipse') {
          if (first <= last) {
            into[first] += 1;
            into[last + 1] -= 1;
          }
          continue;
        }
        for (let step = first; step <= last; step += 1) {
          const box = blockBox(
            hanging.block,
            search.spots[order[step]].at,
            offset,
          );
          if (boxMeetsEllipse(box, obstacle.ellipse)) {
            into[step] += 1;
            into[step + 1] -= 1;
          }
        }
      }
    };
    if (onLine) {
      tally(near.others[index], counted);
      tally(near.ends[index], refused);
    } else {
      const lists = near.beside[index];
      tally(
        lists[
          (sideOf(run.direction, hanging.side) > 0 ? 0 : 1) *
            search.shapes.length +
            hanging.shape
        ],
        counted,
      );
    }
    let covering = 0;
    let refusing = 0;
    for (const [step, at] of order.entries()) {
      covering += counted[step];
      refusing += refused[step];
      costs[at] = refusing > 0 ? unmeasured : covering;
    }
  }
}

function firstAtLeast(
  alongs: Float64Array,
  value: number,
  past = false,
): number {
  let low = 0;
  let high = alongs.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (past ? alongs[middle] <= value : alongs[middle] < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function reachOf(
  obstacle: Obstacle,
  origin: Point,
  direction: Point,
  block: FlowBlock,
  range: Float64Array,
): boolean {
  range[0] = Number.NEGATIVE_INFINITY;
  range[1] = Number.POSITIVE_INFINITY;
  const { box } = obstacle;
  if (
    !narrowed(
      range,
      origin.x,
      direction.x,
      box.minX - block.halfWidth - margin,
      box.maxX + block.halfWidth + margin,
    ) ||
    !narrowed(
      range,
      origin.y,
      direction.y,
      box.minY - block.halfHeight - margin,
      box.maxY + block.halfHeight + margin,
    )
  ) {
    return false;
  }
  if (obstacle.kind !== 'line') {
    return true;
  }
  const { from, to } = obstacle.line;
  const normalX = from.y - to.y;
  const normalY = to.x - from.x;
  const spread =
    Math.abs(normalX) * (block.halfWidth + margin) +
    Math.abs(normalY) * (block.halfHeight + margin);
  return narrowed(
    range,
    normalX * (origin.x - from.x) + normalY * (origin.y - from.y),
    normalX * direction.x + normalY * direction.y,
    -spread,
    spread,
  );
}

function narrowed(
  range: Float64Array,
  value: number,
  rate: number,
  low: number,
  high: number,
): boolean {
  if (rate === 0) {
    return value >= low && value <= high;
  }
  const one = (low - value) / rate;
  const other = (high - value) / rate;
  range[0] = Math.max(range[0], Math.min(one, other));
  range[1] = Math.min(range[1], Math.max(one, other));
  return range[0] <= range[1];
}

function hangingOffset(hanging: Hanging, direction: Point): Point {
  if (hanging.side === onTheLine) {
    return { x: 0, y: 0 };
  }
  const normal = scaledBy(fixedSide(direction), hanging.side);
  const reach = projectedHalfExtent(
    {
      width: hanging.block.halfWidth * 2,
      height: hanging.block.halfHeight * 2,
    },
    normal,
  );
  return scaledBy(normal, hanging.standoff + reach);
}

function placedAt(
  search: BlockSearch,
  hanging: Hanging,
  index: number,
): FlowLabelPlacement {
  const spot = search.spots[index];
  return blockAt(
    hanging.block,
    offsetBy(
      spot.at,
      hangingOffset(hanging, search.runs[spot.run].direction),
      1,
    ),
  );
}

function sideOf(direction: Point, side: number): number {
  const fixed = fixedSide(direction);
  return side * (fixed.y * direction.x - fixed.x * direction.y);
}

function acrossReach(block: FlowBlock, direction: Point): number {
  return (
    block.halfWidth * Math.abs(direction.y) +
    block.halfHeight * Math.abs(direction.x)
  );
}

function alongReach(block: FlowBlock, direction: Point): number {
  return (
    block.halfWidth * Math.abs(direction.x) +
    block.halfHeight * Math.abs(direction.y)
  );
}

function meetsBand(
  run: LineRun,
  box: Box,
  sign: number,
  low: number,
  high: number,
  along: number,
): boolean {
  const { direction, length } = run;
  const { from } = run.segment;
  const x = (box.minX + box.maxX) / 2 - from.x;
  const y = (box.minY + box.maxY) / 2 - from.y;
  const width = (box.maxX - box.minX) / 2;
  const height = (box.maxY - box.minY) / 2;
  const across = sign * (direction.x * y - direction.y * x);
  const acrossSpread =
    Math.abs(direction.y) * width + Math.abs(direction.x) * height;
  const ahead = direction.x * x + direction.y * y;
  const aheadSpread =
    Math.abs(direction.x) * width + Math.abs(direction.y) * height;
  return (
    across + acrossSpread >= low - margin &&
    across - acrossSpread <= high + margin &&
    ahead + aheadSpread >= -along - margin &&
    ahead - aheadSpread <= length + along + margin
  );
}

function blockBox(block: FlowBlock, at: Point, offset: Point): Box {
  return boxAround(offsetBy(at, offset, 1), block.halfWidth, block.halfHeight);
}

function fixedSide(direction: Point): Point {
  const normal = { x: -direction.y, y: direction.x };
  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    return normal.y <= 0 ? normal : negated(normal);
  }
  return normal.x >= 0 ? normal : negated(normal);
}

function runPassesNear(run: LineRun, box: Box, reach: number): boolean {
  const { from, to } = run.segment;
  const minX = box.minX - reach;
  const minY = box.minY - reach;
  const maxX = box.maxX + reach;
  const maxY = box.maxY + reach;
  if (
    Math.min(from.x, to.x) > maxX ||
    Math.max(from.x, to.x) < minX ||
    Math.min(from.y, to.y) > maxY ||
    Math.max(from.y, to.y) < minY
  ) {
    return false;
  }
  const normalX = from.y - to.y;
  const normalY = to.x - from.x;
  const centre =
    normalX * ((minX + maxX) / 2 - from.x) +
    normalY * ((minY + maxY) / 2 - from.y);
  const spread =
    (Math.abs(normalX) * (maxX - minX) + Math.abs(normalY) * (maxY - minY)) / 2;
  return Math.abs(centre) <= spread;
}
