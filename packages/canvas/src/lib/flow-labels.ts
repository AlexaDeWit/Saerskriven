import type { ElementId, Point } from '@saerskriven/model';
import type { ThreatBadge } from './badges.js';
import {
  blockAt,
  blockCentre,
  flowBlocks,
  shiftedPlacement,
  type FlowBlock,
  type FlowLabelPlacement,
} from './flow-blocks.js';
import {
  boxesOverlap,
  boxMeetsEllipse,
  boxOfPoints,
  segmentMeetsBox,
  segmentsOfPolyline,
  shiftedBy,
  type Box,
  type Segment,
} from './geometry.js';
import type { CanvasNode } from './layout.js';
import { runsWithin, spotsOutward, type LineSpot } from './line-spots.js';
import { memoizedByIdentity } from './memoized.js';
import {
  boxCollisions,
  nodeOutline,
  ownBadgeBox,
  type Solids,
} from './obstacles.js';
import { arrowheadPoints, sampledCurve } from './paths.js';
import { placedTextCorners, projectedHalfExtent } from './text-placement.js';
import { arrowhead } from './tokens.js';
import {
  alongSegment,
  labelNormal,
  negated,
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

/** How far past {@link besideGap} a block beside a line may step out. */
export const besideReach = 40;

/**
 * Where every flow of one diagram hangs its block, one placement per flow
 * in the order given, flows placed in ascending id order.
 *
 * A block starts on the flow's line, centred on the middle of the line's
 * longest run, and slides along the line a {@link slideStep} at a time to
 * the nearest spot where it covers nothing, a step toward the source before
 * the same step toward the target. On the line it leaves
 * {@link shownLineAtEnds} of line and every arrowhead showing at both ends.
 * Where no spot on the line is clear it goes beside the line on a fixed
 * side, above a run nearer horizontal and right of a run nearer vertical.
 * There it starts {@link besideGap} off the line and steps out a
 * {@link slideStep} at a time to {@link besideReach} further, trying at each
 * distance every spot along the line with each wrap of {@link flowBlocks},
 * widest first. The other side is tried the same way only once the fixed
 * side is blocked. Where nothing is clear the block takes the spot that
 * covers the fewest things, the first in that order among equals.
 *
 * A block covers an element's drawn shape (a box, or a process's ellipse),
 * name or badge, a trust boundary's outline as drawn, another flow's line
 * or arrowhead, and every block already placed. Beside the line it covers
 * its own flow's line and arrowheads too. An element badge counts where it
 * hangs on the element's corner. The search reads only the model, so one
 * diagram gives one set of placements on every run.
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
  readonly elements: Solids;
  readonly lines: readonly (readonly Segment[])[];
  readonly arrowheads: readonly (readonly Box[])[];
};

type Candidate = {
  readonly block: FlowBlock;
  readonly centre: Point;
  readonly box: Box;
  readonly onLine: boolean;
};

const onLineTolerance = 1e-6;

const besideStandoffs = Array.from(
  { length: besideReach / slideStep + 1 },
  (_unused, step) => besideGap + step * slideStep,
);

const blocksOf = memoizedByIdentity((flow: FlowGeometry) =>
  flowBlocks(flow.name, flow.badge),
);

const spotsOf = memoizedByIdentity((flow: FlowGeometry) =>
  spotsOutward(flow.points, slideStep),
);

const linesOf = memoizedByIdentity((flow: FlowGeometry) =>
  segmentsOfPolyline(flow.points),
);

const arrowheadsOf = memoizedByIdentity((flow: FlowGeometry): Box[] => {
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
    return box === undefined ? [] : [box];
  });
});

const endRunsOf = memoizedByIdentity((flow: FlowGeometry): Segment[] => [
  ...runsWithin(
    flow.points,
    shownLineAtEnds + (flow.bidirectional ? arrowhead.length : 0),
  ),
  ...runsWithin(flow.points, shownLineAtEnds + arrowhead.length, true),
]);

const ownTextBox = memoizedByIdentity((node: CanvasNode): Box[] => {
  const box = boxOfPoints(placedTextCorners(node));
  return box === undefined ? [] : [box];
});

const drawnOutline = memoizedByIdentity((node: CanvasNode): Solids =>
  node.kind === 'boundary-curve'
    ? {
        boxes: [],
        ellipses: [],
        lines: segmentsOfPolyline(
          sampledCurve(node.waypoints).map((point) =>
            shiftedBy(point, node.position),
          ),
        ),
      }
    : nodeOutline(node),
);

function placedInIdOrder(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
  retained: (flow: FlowGeometry) => FlowLabelPlacement | undefined,
): FlowLabelPlacement[] {
  const scene = sceneOf(flows, nodes);
  const placements = flows.map(retained);
  const blocks = placements.flatMap((placement) =>
    placement?.backing === undefined ? [] : [placement.backing],
  );
  for (const index of idOrder(flows)) {
    if (placements[index] === undefined) {
      const chosen = placedFlow(flows[index], index, scene, blocks);
      placements[index] = chosen;
      if (chosen.backing !== undefined) {
        blocks.push(chosen.backing);
      }
    }
  }
  return placements.map(
    (placement, index) => placement ?? atLineStart(flows[index]),
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

function sceneOf(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
): Scene {
  const outlines = nodes.map(drawnOutline);
  return {
    elements: {
      boxes: [
        ...outlines.flatMap((outline) => outline.boxes),
        ...nodes.flatMap(ownTextBox),
        ...nodes.flatMap(ownBadgeBox),
      ],
      ellipses: outlines.flatMap((outline) => outline.ellipses),
      lines: outlines.flatMap((outline) => outline.lines),
    },
    lines: flows.map(linesOf),
    arrowheads: flows.map(arrowheadsOf),
  };
}

function atLineStart(flow: FlowGeometry): FlowLabelPlacement {
  const [start] = spotsOf(flow);
  return blockAt(blocksOf(flow)[0], start.at);
}

function placedFlow(
  flow: FlowGeometry,
  index: number,
  scene: Scene,
  blocks: readonly Box[],
): FlowLabelPlacement {
  const shapes = blocksOf(flow);
  if (shapes[0].halfWidth === 0 && shapes[0].halfHeight === 0) {
    return atLineStart(flow);
  }
  const near = solidsNear(flow, index, scene, blocks);
  const own: Solids = {
    boxes: [...scene.arrowheads[index]],
    ellipses: [],
    lines: scene.lines[index],
  };
  const ends = endRunsOf(flow);
  let best: Candidate | undefined;
  let cost = Number.POSITIVE_INFINITY;
  for (const candidate of candidatesOf(flow, shapes)) {
    if (
      candidate.onLine &&
      ends.some((run) => segmentMeetsBox(run, candidate.box))
    ) {
      continue;
    }
    const held = coveredBy(candidate, near, own, cost);
    if (held < cost) {
      best = candidate;
      cost = held;
      if (cost === 0) {
        break;
      }
    }
  }
  return best === undefined
    ? atLineStart(flow)
    : blockAt(best.block, best.centre);
}

function coveredBy(
  candidate: Candidate,
  near: Solids,
  own: Solids,
  stopAt: number,
): number {
  const others = boxCollisions(candidate.box, near, stopAt);
  return candidate.onLine || others >= stopAt
    ? others
    : others + boxCollisions(candidate.box, own, stopAt - others);
}

function* candidatesOf(
  flow: FlowGeometry,
  shapes: readonly FlowBlock[],
): Generator<Candidate> {
  const spots = spotsOf(flow);
  for (const spot of spots) {
    yield candidateAt(shapes[0], spot.at, true);
  }
  for (const side of [1, -1]) {
    for (const standoff of besideStandoffs) {
      for (const shape of shapes) {
        for (const spot of spots) {
          yield candidateAt(
            shape,
            besideCentre(shape, spot, side, standoff),
            false,
          );
        }
      }
    }
  }
}

function candidateAt(
  block: FlowBlock,
  centre: Point,
  onLine: boolean,
): Candidate {
  return {
    block,
    centre,
    onLine,
    box: {
      minX: centre.x - block.halfWidth,
      minY: centre.y - block.halfHeight,
      maxX: centre.x + block.halfWidth,
      maxY: centre.y + block.halfHeight,
    },
  };
}

function besideCentre(
  block: FlowBlock,
  spot: LineSpot,
  side: number,
  standoff: number,
): Point {
  const normal = scaledBy(fixedSide(spot.direction), side);
  const reach = projectedHalfExtent(
    { width: block.halfWidth * 2, height: block.halfHeight * 2 },
    normal,
  );
  return offsetBy(spot.at, normal, standoff + reach);
}

function fixedSide(direction: Point): Point {
  const normal = { x: -direction.y, y: direction.x };
  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    return normal.y <= 0 ? normal : negated(normal);
  }
  return normal.x >= 0 ? normal : negated(normal);
}

function solidsNear(
  flow: FlowGeometry,
  index: number,
  scene: Scene,
  blocks: readonly Box[],
): Solids {
  const region = regionOf(flow);
  const otherLines = scene.lines.flatMap((lines, other) =>
    other === index ? [] : lines,
  );
  const otherArrowheads = scene.arrowheads.flatMap((boxes, other) =>
    other === index ? [] : boxes,
  );
  return {
    boxes: [...scene.elements.boxes, ...otherArrowheads, ...blocks].filter(
      (box) => boxesOverlap(box, region),
    ),
    ellipses: scene.elements.ellipses.filter((ellipse) =>
      boxMeetsEllipse(region, ellipse),
    ),
    lines: [...scene.elements.lines, ...otherLines].filter((line) =>
      segmentMeetsBox(line, region),
    ),
  };
}

function regionOf(flow: FlowGeometry): Box {
  const span = boxOfPoints(flow.points) ?? {
    minX: flow.points[0].x,
    minY: flow.points[0].y,
    maxX: flow.points[0].x,
    maxY: flow.points[0].y,
  };
  const reach =
    besideGap +
    besideReach +
    2 *
      Math.max(
        ...blocksOf(flow).map((block) => block.halfWidth + block.halfHeight),
      );
  return {
    minX: span.minX - reach,
    minY: span.minY - reach,
    maxX: span.maxX + reach,
    maxY: span.maxY + reach,
  };
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
