import type { Point } from '@saerskriven/model';
import type { ThreatBadge } from './badges.js';
import {
  boxObstacle,
  ellipseObstacle,
  lineObstacle,
  searchedBlock,
  type BlockSearch,
  type Obstacle,
} from './flow-block-search.js';
import {
  blockAt,
  flowBlocks,
  type FlowBlock,
  type FlowLabelPlacement,
} from './flow-blocks.js';
import {
  boxAround,
  boxesOverlap,
  boxMeetsEllipse,
  boxOfPoints,
  segmentMeetsBox,
  segmentsOfPolyline,
  type Box,
} from './geometry.js';
import { lineRuns, runsWithin, spotsOutward } from './line-spots.js';
import { arrowheadPoints } from './paths.js';
import { projectedHalfExtent } from './text-placement.js';

const seeded = (start: number): (() => number) => {
  let seed = start;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
};

const meets = (obstacle: Obstacle, box: Box): boolean => {
  if (obstacle.kind === 'box') {
    return boxesOverlap(obstacle.box, box);
  }
  if (obstacle.kind === 'ellipse') {
    return boxMeetsEllipse(box, obstacle.ellipse);
  }
  return segmentMeetsBox(obstacle.line, box);
};

const fixedSide = (direction: Point): Point => {
  const normal = { x: -direction.y, y: direction.x };
  const flip = { x: -normal.x, y: -normal.y };
  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    return normal.y <= 0 ? normal : flip;
  }
  return normal.x >= 0 ? normal : flip;
};

type Settled = {
  readonly placement: FlowLabelPlacement | undefined;
  readonly cost: number;
};

const testedEverywhere = (search: BlockSearch): Settled => {
  const hangings: { block: FlowBlock; side: number; standoff: number }[] = [
    { block: search.shapes[0], side: 0, standoff: 0 },
    ...search.bands.flatMap((standoffs) =>
      [1, -1].flatMap((side) =>
        search.shapes.flatMap((block) =>
          standoffs.map((standoff) => ({ block, side, standoff })),
        ),
      ),
    ),
  ];
  let best: Settled = { placement: undefined, cost: Number.POSITIVE_INFINITY };
  for (const hanging of hangings) {
    for (const spot of search.spots) {
      const run = search.runs[spot.run];
      const fixed = fixedSide(run.direction);
      const normal = { x: fixed.x * hanging.side, y: fixed.y * hanging.side };
      const reach = projectedHalfExtent(
        {
          width: hanging.block.halfWidth * 2,
          height: hanging.block.halfHeight * 2,
        },
        normal,
      );
      const offset = {
        x: normal.x * (hanging.standoff + reach),
        y: normal.y * (hanging.standoff + reach),
      };
      const centre =
        hanging.side === 0
          ? spot.at
          : { x: spot.at.x + offset.x * 1, y: spot.at.y + offset.y * 1 };
      const box = boxAround(
        centre,
        hanging.block.halfWidth,
        hanging.block.halfHeight,
      );
      const corner =
        hanging.side === 0
          ? 0
          : -Math.sign(normal.x) * hanging.block.halfWidth * run.direction.x -
            Math.sign(normal.y) * hanging.block.halfHeight * run.direction.y;
      const cornerAt = spot.along + corner;
      if (
        (hanging.side === 0 &&
          search.ends.some((end) => segmentMeetsBox(end, box))) ||
        cornerAt < 0 ||
        cornerAt > run.length
      ) {
        continue;
      }
      const cost = [
        ...search.others,
        ...(hanging.side === 0 ? [] : search.own),
      ].filter((obstacle) => meets(obstacle, box)).length;
      if (cost < best.cost) {
        best = { placement: blockAt(hanging.block, centre), cost };
        if (cost === 0) {
          return best;
        }
      }
    }
  }
  return best;
};

const names = [
  'send the record across',
  'sync',
  'Book appointment',
  'read the product listings and the stock',
  '',
];

const badges: readonly (ThreatBadge | undefined)[] = [
  undefined,
  { kind: 'counted', count: 2, severity: 'high', secondary: 1, flagged: false },
  { kind: 'counted', count: 1, severity: 'low', secondary: 0, flagged: true },
  { kind: 'flag-only' },
];

const searchOf = (
  points: [Point, ...Point[]],
  others: Obstacle[],
  shape: number,
  twoWay: boolean,
): BlockSearch => {
  const runs = lineRuns(points);
  const name = names[shape % names.length];
  const badge = badges[shape % badges.length];
  const heads =
    points.length < 2
      ? []
      : [
          arrowheadPoints(points[points.length - 1], points[points.length - 2]),
          ...(twoWay ? [arrowheadPoints(points[0], points[1])] : []),
        ];
  return {
    runs,
    spots: spotsOutward(runs, 4),
    shapes: flowBlocks(
      name,
      name === '' && badge === undefined ? badges[1] : badge,
    ),
    others,
    own: [
      ...segmentsOfPolyline(points).map(lineObstacle),
      ...heads.flatMap((head) => {
        const box = boxOfPoints(head);
        return box === undefined ? [] : [boxObstacle(box)];
      }),
    ],
    ends: [
      ...runsWithin(points, twoWay ? 30 : 12),
      ...runsWithin(points, 30, true),
    ],
    bands: [
      [4, 10, 16],
      [24, 34, 44],
    ],
  };
};

const randomSearch = (seed: number): BlockSearch => {
  const next = seeded(seed);
  const at = (): Point => ({
    x: Math.round(next() * 400),
    y: Math.round(next() * 300),
  });
  const points: [Point, ...Point[]] = [at(), at(), at()];
  const others: Obstacle[] = Array.from({ length: 24 }, (_unused, index) => {
    const corner = at();
    if (index % 3 === 0) {
      return lineObstacle({ from: corner, to: at() });
    }
    if (index % 3 === 1) {
      return ellipseObstacle({
        centre: corner,
        radiusX: 5 + next() * 30,
        radiusY: 5 + next() * 30,
      });
    }
    return boxObstacle(boxAround(corner, 4 + next() * 20, 4 + next() * 12));
  });
  return searchOf(points, others, 0, false);
};

const gridSearch = (seed: number, crowd: number): BlockSearch => {
  const next = seeded(seed);
  const on = (step: number, span: number): number =>
    Math.floor(next() * (span / step + 1)) * step;
  const at = (): Point => ({ x: on(20, 400), y: on(20, 300) });
  const count = 2 + Math.floor(next() * 3);
  const points = Array.from({ length: count }, (_unused, index) => {
    const point = at();
    return index > 0 && next() < 0.4
      ? next() < 0.5
        ? { x: point.x, y: 0 }
        : { x: 0, y: point.y }
      : point;
  });
  const snapped: [Point, ...Point[]] = [
    points[0],
    ...points.slice(1).map((point, index) => {
      const previous = points[index];
      if (point.x === 0 && next() < 0.5) {
        return { x: previous.x, y: point.y };
      }
      if (point.y === 0 && next() < 0.5) {
        return { x: point.x, y: previous.y };
      }
      return next() < 0.1 ? previous : point;
    }),
  ];
  const others: Obstacle[] = Array.from({ length: crowd }, (_unused, index) => {
    const corner = at();
    if (index % 3 === 0) {
      return lineObstacle({
        from: corner,
        to: next() < 0.5 ? { x: corner.x, y: on(20, 300) } : at(),
      });
    }
    if (index % 3 === 1) {
      return ellipseObstacle({
        centre: corner,
        radiusX: 10 + on(10, 30),
        radiusY: 10 + on(10, 30),
      });
    }
    return boxObstacle({
      minX: corner.x,
      minY: corner.y,
      maxX: corner.x + 10 + on(10, 40),
      maxY: corner.y + 10 + on(10, 20),
    });
  });
  return searchOf(snapped, others, seed, seed % 3 === 0);
};

const touchingSearch = (seed: number): BlockSearch => {
  const plain = gridSearch(seed, 6);
  const [middle] = plain.spots;
  const block = plain.shapes[0];
  const edge = boxAround(middle.at, block.halfWidth, block.halfHeight);
  const touching: Obstacle[] = [
    boxObstacle({
      minX: edge.maxX,
      minY: edge.minY - 10,
      maxX: edge.maxX + 20,
      maxY: edge.minY,
    }),
    lineObstacle({
      from: { x: edge.minX - 30, y: edge.maxY },
      to: { x: edge.minX, y: edge.maxY },
    }),
  ];
  return { ...plain, others: [...plain.others, ...touching.slice(seed % 2)] };
};

const scenes = (from: number, count: number): number[] =>
  Array.from({ length: count }, (_unused, index) => from + index);

describe('searchedBlock', () => {
  it.each(scenes(1, 40))(
    'settles where testing every obstacle at every spot would, on random scene %i',
    (seed) => {
      const search = randomSearch(seed);
      expect(searchedBlock(search)).toEqual(testedEverywhere(search).placement);
    },
  );

  it.each(scenes(1, 60))(
    'settles where testing every obstacle at every spot would, on grid scene %i',
    (seed) => {
      const search = gridSearch(seed, 24);
      expect(searchedBlock(search)).toEqual(testedEverywhere(search).placement);
    },
  );

  it.each(scenes(1, 30))(
    'settles on the spot covering least that testing everywhere finds, on crowded grid scene %i',
    (seed) => {
      const search = gridSearch(1000 + seed, 90);
      expect(searchedBlock(search)).toEqual(testedEverywhere(search).placement);
    },
  );

  it.each(scenes(1, 20))(
    'counts an obstacle that only touches the block, on touching scene %i',
    (seed) => {
      const search = touchingSearch(seed);
      expect(searchedBlock(search)).toEqual(testedEverywhere(search).placement);
    },
  );

  it('meets the edges those scenes exist for', () => {
    const grid = scenes(1, 60).map((seed) => gridSearch(seed, 24));
    const crowded = scenes(1, 30).map((seed) => gridSearch(1000 + seed, 90));
    const runs = grid.flatMap((search) => search.runs);
    expect(runs.some((run) => run.direction.x === 0 && run.length > 0)).toBe(
      true,
    );
    expect(runs.some((run) => run.direction.y === 0 && run.length > 0)).toBe(
      true,
    );
    expect(runs.some((run) => run.length === 0)).toBe(true);
    expect(
      crowded.filter((search) => testedEverywhere(search).cost > 0).length,
    ).toBeGreaterThan(5);
  });
});
