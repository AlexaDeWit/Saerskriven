import type { Point } from '@saerskriven/model';
import {
  blockAt,
  type FlowBlock,
  type FlowLabelPlacement,
} from './flow-blocks.js';
import {
  boxAround,
  boxMeetsEllipse,
  boxSegmentGap,
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
 * the line stands off the line through its run by each standoff of each of
 * `bands`, a band tried on both sides before the next, nearest first, and
 * counts only where its backing lies `within` the band's distance of the
 * run as drawn.
 */
export type BlockSearch = {
  readonly runs: readonly LineRun[];
  readonly spots: readonly LineSpot[];
  readonly shapes: readonly FlowBlock[];
  readonly others: readonly Obstacle[];
  readonly own: readonly Obstacle[];
  readonly ends: readonly Segment[];
  readonly bands: readonly {
    readonly standoffs: readonly number[];
    readonly within: number;
  }[];
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
 * then beside it band by band, on the fixed side and then the other, each
 * shape widest first, at each standoff nearest first, at each spot in turn.
 * The first candidate covering nothing wins, a candidate on the line counting
 * only where it leaves `ends` uncovered and one beside it only within its
 * band's distance of the run, and where none is clear the first of those
 * covering the fewest obstacles.
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
  readonly band: number;
  readonly side: number;
  readonly standoff: number;
};

type SpotsOnRun = {
  readonly order: readonly number[];
  readonly alongs: Float64Array;
};

type NearRuns = {
  readonly others: readonly (readonly Obstacle[])[];
  readonly beside: readonly (readonly (readonly (readonly Obstacle[])[])[])[];
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
  yield {
    block: search.shapes[0],
    shape: 0,
    band: 0,
    side: onTheLine,
    standoff: 0,
  };
  for (const [band, { standoffs }] of search.bands.entries()) {
    for (const side of [1, -1]) {
      for (const [shape, block] of search.shapes.entries()) {
        for (const standoff of standoffs) {
          yield { block, shape, band, side, standoff };
        }
      }
    }
  }
}

function obstaclesNearRuns(search: BlockSearch): NearRuns {
  const [onLine] = search.shapes;
  const reach =
    Math.max(...search.bands.flatMap(({ standoffs }) => standoffs)) +
    Math.max(
      ...search.shapes.map(
        (block) =>
          block.halfWidth +
          block.halfHeight +
          Math.max(block.halfWidth, block.halfHeight),
      ),
    ) +
    margin;
  const ends = search.ends.map(lineObstacle);
  const near = (
    run: LineRun,
    obstacles: readonly Obstacle[],
    within: number,
  ): Obstacle[] =>
    obstacles.filter((obstacle) => runPassesNear(run, obstacle.box, within));
  const onLineReach = Math.max(onLine.halfWidth, onLine.halfHeight) + margin;
  return {
    others: search.runs.map((run) => near(run, search.others, onLineReach)),
    beside: search.runs.map((run) => {
      const all = [
        ...near(run, search.others, reach),
        ...near(run, search.own, reach),
      ];
      const projected = all.map((obstacle) =>
        projectedOnRun(run, obstacle.box),
      );
      return search.bands.map(({ standoffs }) =>
        [1, -1].flatMap((sign) =>
          search.shapes.map((block) => {
            const low = Math.min(...standoffs) - margin;
            const high =
              Math.max(...standoffs) +
              2 * acrossReach(block, run.direction) +
              margin;
            const ahead = alongReach(block, run.direction) + margin;
            return all.filter((_obstacle, at) => {
              const { across, acrossSpread, along, alongSpread } =
                projected[at];
              return (
                sign * across + acrossSpread >= low &&
                sign * across - acrossSpread <= high &&
                along + alongSpread >= -ahead &&
                along - alongSpread <= run.length + ahead
              );
            });
          }),
        ),
      );
    }),
    ends: search.runs.map((run) => near(run, ends, onLineReach)),
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
    const within = onLine
      ? Number.POSITIVE_INFINITY
      : search.bands[hanging.band].within;
    const reachesRun = (step: number): boolean =>
      boxSegmentGap(
        blockBox(hanging.block, search.spots[order[step]].at, offset),
        run.segment,
      ) <= within;
    let lowest = 0;
    while (lowest < order.length && !reachesRun(lowest)) {
      lowest += 1;
    }
    let highest = order.length - 1;
    while (highest >= lowest && !reachesRun(highest)) {
      highest -= 1;
    }
    if (lowest > highest) {
      continue;
    }
    const counted = new Int32Array(order.length + 1);
    const refused = new Int32Array(order.length + 1);
    const range = new Float64Array(2);
    const tally = (obstacles: readonly Obstacle[], into: Int32Array): void => {
      for (const obstacle of obstacles) {
        if (!reachOf(obstacle, origin, run.direction, hanging.block, range)) {
          continue;
        }
        const first = Math.max(lowest, firstAtLeast(alongs, range[0]));
        const last = Math.min(
          highest,
          firstAtLeast(alongs, range[1], true) - 1,
        );
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
      const lists = near.beside[index][hanging.band];
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
    for (let step = lowest; step <= highest; step += 1) {
      covering += counted[step];
      refusing += refused[step];
      costs[order[step]] = refusing > 0 ? unmeasured : covering;
    }
  }
}

function firstAtLeast(
  alongs: Float64Array,
  value: number,
  past = false,
): number {
  const count = alongs.length;
  const before = (at: number): boolean =>
    past ? alongs[at] <= value : alongs[at] < value;
  const spacing = count > 1 ? (alongs[count - 1] - alongs[0]) / (count - 1) : 1;
  let at = Math.min(
    count,
    Math.max(0, Math.ceil((value - alongs[0]) / spacing)),
  );
  while (at < count && before(at)) {
    at += 1;
  }
  while (at > 0 && !before(at - 1)) {
    at -= 1;
  }
  return at;
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

function projectedOnRun(
  run: LineRun,
  box: Box,
): {
  readonly across: number;
  readonly acrossSpread: number;
  readonly along: number;
  readonly alongSpread: number;
} {
  const { direction } = run;
  const { from } = run.segment;
  const x = (box.minX + box.maxX) / 2 - from.x;
  const y = (box.minY + box.maxY) / 2 - from.y;
  const width = (box.maxX - box.minX) / 2;
  const height = (box.maxY - box.minY) / 2;
  return {
    across: direction.x * y - direction.y * x,
    acrossSpread:
      Math.abs(direction.y) * width + Math.abs(direction.x) * height,
    along: direction.x * x + direction.y * y,
    alongSpread: Math.abs(direction.x) * width + Math.abs(direction.y) * height,
  };
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
