import type { ElementId, Point } from '@saerskriven/model';
import { badgeExtent, type ThreatBadge } from './badges.js';
import {
  boxObstacle,
  ellipseObstacle,
  lineObstacle,
  searchedBlock,
  type Obstacle,
} from './flow-block-search.js';
import {
  blockAt,
  blockCentre,
  flowBlocks,
  shiftedPlacement,
  type FlowBlock,
  type FlowLabelPlacement,
} from './flow-blocks.js';
import {
  boxOfPoints,
  segmentsOfPolyline,
  shiftedBy,
  type Segment,
} from './geometry.js';
import type { CanvasNode } from './layout.js';
import { lineRuns, runsWithin, spotsOutward } from './line-spots.js';
import { memoizedByIdentity } from './memoized.js';
import { nodeOutline, ownBadgeBox } from './obstacles.js';
import { arrowheadPoints, sampledCurve } from './paths.js';
import { placedTextCorners, projectedHalfExtent } from './text-placement.js';
import { arrowhead } from './tokens.js';
import {
  alongSegment,
  labelNormal,
  offsetBy,
  projectedOn,
  scaledBy,
} from './vectors.js';

/**
 * What placing one flow's block needs of that flow. A flow has at least the
 * one point its block hangs on.
 */
export type FlowGeometry = {
  readonly id: ElementId;
  readonly name: string;
  readonly badge: ThreatBadge | undefined;
  readonly bidirectional: boolean;
  readonly points: readonly [Point, ...Point[]];
};

/** How far apart the spots a block is tried at lie along a flow's line. */
export const slideStep = 4;

/**
 * How much of a flow's line a block on it leaves showing at each end, past
 * any arrowhead there.
 */
export const shownLineAtEnds = 12;

/** How far a block beside a flow's line keeps its backing off the line. */
export const besideGap = 4;

/**
 * How far past {@link besideGap} a block beside a line may step out, in two
 * equal steps, so its backing stays within 16 units of the line it names.
 */
export const besideReach = 12;

/**
 * Where every flow of one diagram hangs its block of badge and name, one
 * placement per flow in the order given. Flows are placed in ascending id
 * order, each clear of the blocks placed before it, and the placement reads
 * only the flows and nodes given, so one diagram gives one set of
 * placements on every run. The package README describes where a block goes.
 */
export function flowLabelPlacements(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
): FlowLabelPlacement[] {
  return placedInIdOrder(flows, nodes, () => undefined);
}

/**
 * {@link flowLabelPlacements} for a drag frame: a flow outside `moving`
 * keeps its `settled` placement, and every flow in `moving` is placed by the
 * same rules, clear of those kept blocks.
 */
export function flowLabelPlacementsDuringMove(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
  settled: ReadonlyMap<ElementId, FlowLabelPlacement>,
  moving: ReadonlySet<ElementId>,
): FlowLabelPlacement[] {
  return placedInIdOrder(flows, nodes, (flow) =>
    moving.has(flow.id) ? undefined : settled.get(flow.id),
  );
}

/**
 * Moves a settled block with the run of line that carries it, without the
 * diagram-wide search. The nearest run of `from` supplies the fraction along
 * it and, for a block beside the line, the side and the gap, and the
 * matching run of `to` the new direction. A block on the line stays on it.
 * A path whose run count changed keeps the block where it was.
 */
export function movedFlowLabel(
  label: FlowLabelPlacement,
  from: readonly [Point, ...Point[]],
  to: readonly [Point, ...Point[]],
): FlowLabelPlacement {
  const oldSegments = segmentsOfPolyline(from);
  const newSegments = segmentsOfPolyline(to);
  if (oldSegments.length === 0 || oldSegments.length !== newSegments.length) {
    return label;
  }
  const centre = blockCentre(label);
  const { backing } = label;
  const extent =
    backing === undefined
      ? { width: 0, height: 0 }
      : {
          width: backing.maxX - backing.minX,
          height: backing.maxY - backing.minY,
        };
  const moved = movedWithNearestSegment(
    centre,
    oldSegments,
    newSegments,
    (direction) => projectedHalfExtent(extent, direction),
  );
  return shiftedPlacement(label, {
    x: moved.x - centre.x,
    y: moved.y - centre.y,
  });
}

type Scene = {
  readonly elements: readonly Obstacle[];
  readonly lines: readonly (readonly Obstacle[])[];
  readonly arrowheads: readonly (readonly Obstacle[])[];
};

const onLineTolerance = 1e-6;

const besideStandoffs = [
  besideGap,
  besideGap + besideReach / 2,
  besideGap + besideReach,
];

const blocksByName = new Map<string, readonly FlowBlock[]>();

const blocksByNameLimit = 512;

const blocksOf = memoizedByIdentity((flow: FlowGeometry) => {
  const extent = flow.badge === undefined ? undefined : badgeExtent(flow.badge);
  const key = `${flow.name}\u0000${extent === undefined ? '' : `${String(extent.radius)} ${String(extent.depth)}`}`;
  const cached = blocksByName.get(key);
  if (cached !== undefined) {
    return cached;
  }
  if (blocksByName.size >= blocksByNameLimit) {
    blocksByName.clear();
  }
  const blocks = flowBlocks(flow.name, flow.badge);
  blocksByName.set(key, blocks);
  return blocks;
});

const runsOf = memoizedByIdentity((flow: FlowGeometry) =>
  lineRuns(flow.points),
);

const spotsOf = memoizedByIdentity((flow: FlowGeometry) =>
  spotsOutward(runsOf(flow), slideStep),
);

const linesOf = memoizedByIdentity((flow: FlowGeometry) =>
  segmentsOfPolyline(flow.points).map(lineObstacle),
);

const arrowheadsOf = memoizedByIdentity((flow: FlowGeometry): Obstacle[] => {
  const { points } = flow;
  if (points.length < 2) {
    return [];
  }
  const tips = [
    arrowheadPoints(points[points.length - 1], points[points.length - 2]),
  ];
  if (flow.bidirectional) {
    tips.push(arrowheadPoints(points[0], points[1]));
  }
  return tips.flatMap((tip) => {
    const box = boxOfPoints(tip);
    return box === undefined ? [] : [boxObstacle(box)];
  });
});

const endRunsOf = memoizedByIdentity((flow: FlowGeometry): Segment[] => [
  ...runsWithin(
    flow.points,
    shownLineAtEnds + (flow.bidirectional ? arrowhead.length : 0),
  ),
  ...runsWithin(flow.points, shownLineAtEnds + arrowhead.length, true),
]);

const drawnObstacles = memoizedByIdentity((node: CanvasNode): Obstacle[] => {
  const text = boxOfPoints(placedTextCorners(node));
  const outline =
    node.kind === 'boundary-curve'
      ? segmentsOfPolyline(
          sampledCurve(node.waypoints).map((point) =>
            shiftedBy(point, node.position),
          ),
        ).map(lineObstacle)
      : [
          ...nodeOutline(node).boxes.map(boxObstacle),
          ...nodeOutline(node).ellipses.map(ellipseObstacle),
          ...nodeOutline(node).lines.map(lineObstacle),
        ];
  return [
    ...outline,
    ...(text === undefined ? [] : [boxObstacle(text)]),
    ...ownBadgeBox(node).map(boxObstacle),
  ];
});

function placedInIdOrder(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
  retained: (flow: FlowGeometry) => FlowLabelPlacement | undefined,
): FlowLabelPlacement[] {
  const scene: Scene = {
    elements: nodes.flatMap(drawnObstacles),
    lines: flows.map(linesOf),
    arrowheads: flows.map(arrowheadsOf),
  };
  const placements = flows.map(retained);
  const blocks = placements.flatMap((placement) =>
    placement?.backing === undefined ? [] : [boxObstacle(placement.backing)],
  );
  for (const index of idOrder(flows)) {
    if (placements[index] === undefined) {
      const chosen = placedFlow(flows[index], index, scene, blocks);
      placements[index] = chosen;
      if (chosen.backing !== undefined) {
        blocks.push(boxObstacle(chosen.backing));
      }
    }
  }
  return placements.map(
    (placement, index) => placement ?? atLineMiddle(flows[index]),
  );
}

function idOrder(flows: readonly FlowGeometry[]): number[] {
  const indices = flows.map((_flow, index) => index);
  indices.sort((one, other) => {
    const left = flows[one].id;
    const right = flows[other].id;
    if (left === right) {
      return 0;
    }
    return left < right ? -1 : 1;
  });
  return indices;
}

function atLineMiddle(flow: FlowGeometry): FlowLabelPlacement {
  const [middle] = spotsOf(flow);
  return blockAt(blocksOf(flow)[0], middle.at);
}

function placedFlow(
  flow: FlowGeometry,
  index: number,
  scene: Scene,
  blocks: readonly Obstacle[],
): FlowLabelPlacement {
  const shapes = blocksOf(flow);
  if (shapes[0].halfWidth === 0 && shapes[0].halfHeight === 0) {
    return atLineMiddle(flow);
  }
  return searchedBlock({
    runs: runsOf(flow),
    spots: spotsOf(flow),
    shapes,
    others: [
      ...scene.elements,
      ...scene.lines.flatMap((lines, other) => (other === index ? [] : lines)),
      ...scene.arrowheads.flatMap((heads, other) =>
        other === index ? [] : heads,
      ),
      ...blocks,
    ],
    own: [...scene.lines[index], ...scene.arrowheads[index]],
    ends: endRunsOf(flow),
    standoffs: besideStandoffs,
  });
}

function movedWithNearestSegment(
  point: Point,
  from: readonly Segment[],
  to: readonly Segment[],
  reach: (direction: Point) => number,
): Point {
  let nearest = projectedOn(from[0], point);
  let index = 0;
  for (let run = 1; run < from.length; run += 1) {
    const projected = projectedOn(from[run], point);
    if (projected.distance < nearest.distance) {
      nearest = projected;
      index = run;
    }
  }
  const foot = alongSegment(to[index], nearest.fraction);
  if (nearest.distance <= onLineTolerance) {
    return foot;
  }
  const side = nearest.signedDistance < 0 ? -1 : 1;
  const oldDirection = scaledBy(labelNormal(from[index]), side);
  const newDirection = scaledBy(labelNormal(to[index]), side);
  const standoff = Math.abs(nearest.signedDistance) - reach(oldDirection);
  return offsetBy(foot, newDirection, standoff + reach(newDirection));
}
