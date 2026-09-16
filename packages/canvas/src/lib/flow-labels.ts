import type { ElementId, Point } from '@saerskriven/model';
import {
  badgeBox,
  badgeExtent,
  type BadgeExtent,
  type ThreatBadge,
} from './badges.js';
import {
  boxOfPoints,
  segmentsOfPolyline,
  type Box,
  type Segment,
} from './geometry.js';
import type { CanvasNode } from './layout.js';
import { memoizedByIdentity } from './memoized.js';
import {
  boxCollisions,
  grownByClearance,
  nodeOutline,
  ownBadgeBox,
  type Solids,
} from './obstacles.js';
import { wrappedTextStyles } from './stylesheet.js';
import {
  nameBeside,
  placedTextCorners,
  projectedHalfExtent,
  textPlacementCorners,
  type TextPlacement,
} from './text-placement.js';
import {
  flowLabelClearance,
  looseLabelWidth,
  textExtent,
  wrapText,
  type TextExtent,
} from './typography.js';
import {
  alongSegment,
  labelNormal,
  negated,
  offsetBy,
  projectedOn,
  scaledBy,
  squaredDistance,
} from './vectors.js';

/**
 * Where a flow's name and badge hang. `badge` is absent for a flow no open
 * threat names.
 */
export type FlowLabelPlacement = {
  readonly name: TextPlacement;
  readonly badge: Point | undefined;
};

/**
 * What placing one flow's label needs of that flow. A flow has at least the
 * one point its label hangs beside.
 */
export type FlowGeometry = {
  readonly id: ElementId;
  readonly name: string;
  readonly badge: ThreatBadge | undefined;
  readonly points: readonly [Point, ...Point[]];
};

/**
 * Where every flow of one diagram hangs its name and badge, one placement per
 * flow in the order given.
 *
 * Each flow is offered a candidate at the midpoint and the quarter points of
 * each of its segments, on either side of the segment's normal, at three
 * standoffs a clearance apart, with the badge on the other side from the
 * name. A candidate costs one for every obstacle its name or badge box meets:
 * an element's drawn shape (a box, or a process's circle), name or badge, a
 * straight run of a trust boundary's outline or of any flow's line, its own
 * included, and every name or badge already placed. A badge box is tested
 * against every other badge grown by a clearance, so a badge within a
 * clearance of another costs as much as one drawn over it.
 *
 * Flows are placed in ascending id order and the cheapest candidate wins. A
 * tie goes to the candidate nearest the midpoint of the flow's longest
 * segment, then to the one beside that midpoint on the side its normal
 * names, then to the first in the order above. A flow with no clear
 * candidate takes the cheapest rather than being dropped. The search reads
 * only the model, so one diagram gives one set of placements on every run.
 */
export function flowLabelPlacements(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
): FlowLabelPlacement[] {
  return placeInIdOrder(flows, nodes, cheapestCandidate);
}

/**
 * {@link flowLabelPlacements} for a drag frame: a flow outside `moving` keeps
 * its `settled` placement, and a moving flow takes the clear candidate
 * nearest its midpoint rather than the cheapest.
 */
export function flowLabelPlacementsDuringMove(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
  settled: ReadonlyMap<ElementId, FlowLabelPlacement>,
  moving: ReadonlySet<ElementId>,
): FlowLabelPlacement[] {
  return placeInIdOrder(flows, nodes, (flow, drawn) => {
    const retained = moving.has(flow.id) ? undefined : settled.get(flow.id);
    return retained === undefined
      ? closestClearCandidate(flow, drawn)
      : candidateFromPlacement(flow, retained);
  });
}

/**
 * Moves a settled flow label with the segment that carries it, without the
 * diagram-wide search. The nearest segment of `from` supplies the fraction,
 * side and standoff, and the matching segment of `to` the new direction. A
 * path whose segment count changed keeps the label where it was.
 */
export function movedFlowLabel(
  label: FlowLabelPlacement,
  badge: ThreatBadge | undefined,
  from: readonly [Point, ...Point[]],
  to: readonly [Point, ...Point[]],
): FlowLabelPlacement {
  const oldSegments = segmentsOfPolyline(from);
  const newSegments = segmentsOfPolyline(to);
  if (oldSegments.length === 0 || oldSegments.length !== newSegments.length) {
    return label;
  }
  const nameRule = wrappedTextStyles[label.name.textStyle];
  const nameExtent = textExtent(
    wrapText(label.name.text, nameRule.fontSize, label.name.width),
    nameRule.fontSize,
  );
  return {
    name: {
      ...label.name,
      at: movedWithNearestSegment(
        label.name.at,
        oldSegments,
        newSegments,
        (direction) => projectedHalfExtent(nameExtent, direction),
      ),
    },
    badge:
      label.badge === undefined || badge === undefined
        ? undefined
        : movedWithNearestSegment(
            label.badge,
            oldSegments,
            newSegments,
            (direction) => badgeReach(badge, direction),
          ),
  };
}

type Candidate = {
  readonly placement: FlowLabelPlacement;
  readonly nameBox: Box | undefined;
  readonly badgeBox: Box | undefined;
  readonly fromMiddle: number;
};

type CandidateMetrics = {
  readonly name: TextExtent;
  readonly badge: BadgeExtent | undefined;
};

type Obstacles = {
  readonly forName: Solids;
  readonly forBadge: Solids;
};

type SearchStart = {
  readonly segments: readonly Segment[];
  readonly middle: Point;
  readonly metrics: CandidateMetrics;
  readonly initial: Candidate;
};

const anchorFractions = [0.5, 0.25, 0.75];

const standoffSteps = [0, 1, 2];

const normalSides = [1, -1];

const translationNoiseTolerance = 1e-6;

const flowNameExtentLimit = 256;

const flowNameExtents = new Map<string, TextExtent>();

const placementCandidates = new WeakMap<FlowLabelPlacement, Candidate>();

const segmentsForFlow = memoizedByIdentity((flow: FlowGeometry) =>
  segmentsOfPolyline(flow.points),
);

const ownTextBox = memoizedByIdentity((node: CanvasNode): Box[] => {
  const box = boxOfPoints(placedTextCorners(node));
  return box === undefined ? [] : [box];
});

function placeInIdOrder(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
  choose: (flow: FlowGeometry, drawn: Obstacles) => Candidate,
): FlowLabelPlacement[] {
  const ordered = flows.map((flow, index) => ({ flow, index }));
  ordered.sort((one, other) => byIdAscending(one.flow, other.flow));
  const placements: FlowLabelPlacement[] = [];
  let drawn = drawnObstacles(flows, nodes);
  for (const { flow, index } of ordered) {
    const chosen = choose(flow, drawn);
    placements[index] = chosen.placement;
    drawn = withLabelPlaced(drawn, chosen);
  }
  return placements;
}

function byIdAscending(one: FlowGeometry, other: FlowGeometry): number {
  if (one.id === other.id) {
    return 0;
  }
  return one.id < other.id ? -1 : 1;
}

function drawnObstacles(
  flows: readonly FlowGeometry[],
  nodes: readonly CanvasNode[],
): Obstacles {
  const outlines = nodes.map(nodeOutline);
  const boxes = [
    ...outlines.flatMap((outline) => outline.boxes),
    ...nodes.flatMap(ownTextBox),
  ];
  const badges = nodes.flatMap(ownBadgeBox);
  const circles = outlines.flatMap((outline) => outline.circles);
  const lines = [
    ...outlines.flatMap((outline) => outline.lines),
    ...flows.flatMap(segmentsForFlow),
  ];
  return {
    forName: { boxes: [...boxes, ...badges], circles, lines },
    forBadge: {
      boxes: [...boxes, ...badges.map(grownByClearance)],
      circles,
      lines,
    },
  };
}

function withLabelPlaced(drawn: Obstacles, candidate: Candidate): Obstacles {
  const name = candidate.nameBox === undefined ? [] : [candidate.nameBox];
  const badge = candidate.badgeBox === undefined ? [] : [candidate.badgeBox];
  return {
    forName: withBoxes(drawn.forName, [...name, ...badge]),
    forBadge: withBoxes(drawn.forBadge, [
      ...name,
      ...badge.map(grownByClearance),
    ]),
  };
}

function withBoxes(solids: Solids, boxes: readonly Box[]): Solids {
  solids.boxes.push(...boxes);
  return solids;
}

function cheapestCandidate(flow: FlowGeometry, drawn: Obstacles): Candidate {
  const { segments, middle, metrics, initial } = searchStart(flow);
  let best = initial;
  let cost = collisionsOf(best, drawn, Number.POSITIVE_INFINITY);
  for (const next of candidatesOf(flow, segments, middle, metrics)) {
    if (cost === 0 && next.fromMiddle >= best.fromMiddle) {
      continue;
    }
    const held = collisionsOf(next, drawn, cost + 1);
    if (held < cost || (held === cost && next.fromMiddle < best.fromMiddle)) {
      best = next;
      cost = held;
    }
  }
  return best;
}

function closestClearCandidate(
  flow: FlowGeometry,
  drawn: Obstacles,
): Candidate {
  const { segments, middle, metrics, initial } = searchStart(flow);
  const candidates = candidatesByDistance([
    initial,
    ...candidatesOf(flow, segments, middle, metrics),
  ]);
  let best = initial;
  let cost = Number.POSITIVE_INFINITY;
  for (const next of candidates) {
    const held = collisionsOf(next, drawn, cost);
    if (held < cost) {
      best = next;
      cost = held;
    }
    if (cost === 0) {
      return best;
    }
  }
  return best;
}

function searchStart(flow: FlowGeometry): SearchStart {
  const segments = segmentsForFlow(flow);
  const home = homeSegment(flow.points, segments);
  const middle = alongSegment(home, 0.5);
  const metrics = candidateMetrics(flow);
  return {
    segments,
    middle,
    metrics,
    initial: candidateAt(flow, home, 0.5, 0, 1, middle, metrics),
  };
}

function homeSegment(
  points: readonly [Point, ...Point[]],
  segments: readonly Segment[],
): Segment {
  let longest: Segment = { from: points[0], to: points[0] };
  for (const segment of segments) {
    if (
      squaredDistance(segment.from, segment.to) >
      squaredDistance(longest.from, longest.to)
    ) {
      longest = segment;
    }
  }
  return longest;
}

function candidateMetrics(flow: FlowGeometry): CandidateMetrics {
  return {
    name: flowNameExtent(flow.name),
    badge: flow.badge === undefined ? undefined : badgeExtent(flow.badge),
  };
}

function flowNameExtent(name: string): TextExtent {
  const cached = flowNameExtents.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const fontSize = wrappedTextStyles.flowLabel.fontSize;
  const measured = textExtent(
    wrapText(name, fontSize, looseLabelWidth),
    fontSize,
  );
  if (flowNameExtents.size >= flowNameExtentLimit) {
    flowNameExtents.clear();
  }
  flowNameExtents.set(name, measured);
  return measured;
}

function candidatesByDistance(candidates: readonly Candidate[]): Candidate[] {
  const ordered: Candidate[] = [];
  for (const candidate of candidates) {
    const index = ordered.findIndex(
      (other) =>
        candidate.fromMiddle < other.fromMiddle - translationNoiseTolerance,
    );
    if (index === -1) {
      ordered.push(candidate);
    } else {
      ordered.splice(index, 0, candidate);
    }
  }
  return ordered;
}

function* candidatesOf(
  flow: FlowGeometry,
  segments: readonly Segment[],
  middle: Point,
  metrics: CandidateMetrics,
): Generator<Candidate> {
  for (const segment of segments) {
    for (const fraction of anchorFractions) {
      for (const step of standoffSteps) {
        for (const side of normalSides) {
          yield candidateAt(
            flow,
            segment,
            fraction,
            step,
            side,
            middle,
            metrics,
          );
        }
      }
    }
  }
}

function candidateAt(
  flow: FlowGeometry,
  segment: Segment,
  fraction: number,
  step: number,
  side: number,
  middle: Point,
  metrics: CandidateMetrics,
): Candidate {
  const anchor = alongSegment(segment, fraction);
  const normal = scaledBy(labelNormal(segment), side);
  const standoff = flowLabelClearance * (step + 1);
  const name = nameBeside(
    flow.name,
    anchor,
    normal,
    standoff,
    'flowLabel',
    metrics.name,
  );
  const nameBox = boxOfPoints(textPlacementCorners(name));
  const badge = badgeBeside(
    flow.badge,
    anchor,
    negated(normal),
    standoff,
    metrics.badge,
  );
  return {
    placement: { name, badge: badge?.at },
    nameBox,
    badgeBox: badge?.box,
    fromMiddle: Math.hypot(name.at.x - middle.x, name.at.y - middle.y),
  };
}

function candidateFromPlacement(
  flow: FlowGeometry,
  placement: FlowLabelPlacement,
): Candidate {
  const cached = placementCandidates.get(placement);
  if (cached !== undefined) {
    return cached;
  }
  const nameExtent = flowNameExtent(flow.name);
  const candidate = {
    placement,
    nameBox: {
      minX: placement.name.at.x - nameExtent.width / 2,
      minY: placement.name.at.y - nameExtent.height / 2,
      maxX: placement.name.at.x + nameExtent.width / 2,
      maxY: placement.name.at.y + nameExtent.height / 2,
    },
    badgeBox:
      flow.badge === undefined || placement.badge === undefined
        ? undefined
        : badgeBox(placement.badge, flow.badge),
    fromMiddle: 0,
  };
  placementCandidates.set(placement, candidate);
  return candidate;
}

function badgeBeside(
  badge: ThreatBadge | undefined,
  anchor: Point,
  direction: Point,
  standoff: number,
  extent?: BadgeExtent,
): { readonly at: Point; readonly box: Box } | undefined {
  if (badge === undefined) {
    return undefined;
  }
  const at = offsetBy(
    anchor,
    direction,
    standoff + badgeReach(badge, direction, extent),
  );
  return { at, box: badgeBox(at, badge) };
}

function collisionsOf(
  candidate: Candidate,
  drawn: Obstacles,
  stopAt: number,
): number {
  const names = boxCollisions(candidate.nameBox, drawn.forName, stopAt);
  return names >= stopAt
    ? names
    : names + boxCollisions(candidate.badgeBox, drawn.forBadge, stopAt - names);
}

function movedWithNearestSegment(
  point: Point,
  from: readonly Segment[],
  to: readonly Segment[],
  reach: (direction: Point) => number,
): Point {
  let nearest = projectedOn(from[0], point);
  let index = 0;
  for (let candidate = 1; candidate < from.length; candidate += 1) {
    const projected = projectedOn(from[candidate], point);
    if (projected.distance < nearest.distance) {
      nearest = projected;
      index = candidate;
    }
  }
  const side = nearest.signedDistance < 0 ? -1 : 1;
  const oldDirection = scaledBy(labelNormal(from[index]), side);
  const newDirection = scaledBy(labelNormal(to[index]), side);
  const standoff = Math.abs(nearest.signedDistance) - reach(oldDirection);
  return offsetBy(
    alongSegment(to[index], nearest.fraction),
    newDirection,
    standoff + reach(newDirection),
  );
}

function badgeReach(
  badge: ThreatBadge,
  direction: Point,
  measured?: BadgeExtent,
): number {
  const extent = measured ?? badgeExtent(badge);
  const across =
    direction.y < 0 ? extent.depth * -direction.y : extent.radius * direction.y;
  return extent.radius * Math.abs(direction.x) + across;
}
