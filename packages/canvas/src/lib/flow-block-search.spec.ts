import type { Point } from '@saerskriven/model';
import {
  boxObstacle,
  ellipseObstacle,
  lineObstacle,
  searchedBlock,
  type BlockSearch,
  type Obstacle,
} from './flow-block-search.js';
import { blockAt, flowBlocks, type FlowBlock } from './flow-blocks.js';
import {
  boxAround,
  boxesOverlap,
  boxMeetsEllipse,
  segmentMeetsBox,
  segmentsOfPolyline,
  type Box,
} from './geometry.js';
import { lineRuns, runsWithin, spotsOutward } from './line-spots.js';
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

const testedEverywhere = (search: BlockSearch) => {
  const hangings: { block: FlowBlock; side: number; standoff: number }[] = [
    { block: search.shapes[0], side: 0, standoff: 0 },
    ...[1, -1].flatMap((side) =>
      search.shapes.flatMap((block) =>
        search.standoffs.map((standoff) => ({ block, side, standoff })),
      ),
    ),
  ];
  let best: { placement: ReturnType<typeof blockAt>; cost: number } | undefined;
  for (const hanging of hangings) {
    for (const spot of search.spots) {
      const direction = search.runs[spot.run].direction;
      const side = fixedSide(direction);
      const normal = { x: side.x * hanging.side, y: side.y * hanging.side };
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
      if (
        hanging.side === 0 &&
        search.ends.some((end) => segmentMeetsBox(end, box))
      ) {
        continue;
      }
      const cost = [
        ...search.others,
        ...(hanging.side === 0 ? [] : search.own),
      ].filter((obstacle) => meets(obstacle, box)).length;
      if (best === undefined || cost < best.cost) {
        best = { placement: blockAt(hanging.block, centre), cost };
        if (cost === 0) {
          return best.placement;
        }
      }
    }
  }
  return best?.placement;
};

const randomSearch = (seed: number): BlockSearch => {
  const next = seeded(seed);
  const at = (): Point => ({
    x: Math.round(next() * 400),
    y: Math.round(next() * 300),
  });
  const points: [Point, ...Point[]] = [at(), at(), at()];
  const runs = lineRuns(points);
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
  return {
    runs,
    spots: spotsOutward(runs, 4),
    shapes: flowBlocks('send the record across', undefined),
    others,
    own: segmentsOfPolyline(points).map(lineObstacle),
    ends: [...runsWithin(points, 12), ...runsWithin(points, 30, true)],
    standoffs: [4, 10, 16],
  };
};

describe('searchedBlock', () => {
  it.each(Array.from({ length: 40 }, (_unused, seed) => seed + 1))(
    'settles where testing every obstacle at every spot would, on random scene %i',
    (seed) => {
      const search = randomSearch(seed);
      expect(searchedBlock(search)).toEqual(testedEverywhere(search));
    },
  );
});
