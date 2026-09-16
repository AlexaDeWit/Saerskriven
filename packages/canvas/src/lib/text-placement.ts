import type { Point, Size } from '@saerskriven/model';
import { boxOfPoints, segmentsOfPolyline, shiftedBy } from './geometry.js';
import type { TextAnchor } from './labels.js';
import type { CanvasNode } from './layout.js';
import { boxCollisions, elementSolids, type Solids } from './obstacles.js';
import { sampledCurve } from './paths.js';
import { wrappedTextStyles, type WrappedTextStyle } from './stylesheet.js';
import {
  flowLabelClearance,
  innerWidth,
  looseLabelWidth,
  textExtent,
  textPadding,
  wrapText,
  type TextExtent,
} from './typography.js';
import { labelNormal, negated, offsetBy } from './vectors.js';

/**
 * One run of text a glyph draws, exactly the props `WrappedText` takes, so a
 * caller sizing a picture measures the placement the glyph drew.
 */
export type TextPlacement = {
  readonly text: string;
  readonly at: Point;
  readonly anchor: TextAnchor;
  readonly width: number;
  readonly textStyle: WrappedTextStyle;
};

/**
 * Which bend of a curve carries its name and on which side of that bend: the
 * index of the waypoint the name hangs beside, and whether the side is the
 * mirror of the convex one there.
 */
export type CurveNameSide = {
  readonly at: number;
  readonly mirrored: boolean;
};

/**
 * The run of text one node's glyph draws, in the node's own coordinates: a
 * text element's prose centred in its box, a box boundary's name below its
 * top edge, a curve boundary's name beside the bend its `nameSide` names (see
 * {@link settledCurveNames}), and every other kind's name centred in its box.
 * A process wraps to the width of the square inscribed in its circle rather
 * than to its box.
 */
export function nodeTextPlacement(node: CanvasNode): TextPlacement {
  if (node.kind === 'text') {
    return {
      text: node.text,
      at: boxCentre(node.size),
      anchor: 'centre',
      width: innerWidth(node.size.width),
      textStyle: 'note',
    };
  }
  if (node.kind === 'boundary-box') {
    return {
      text: node.name,
      at: {
        x: node.size.width / 2,
        y: textPadding + wrappedTextStyles.label.fontSize / 2,
      },
      anchor: 'top',
      width: innerWidth(node.size.width),
      textStyle: 'label',
    };
  }
  if (node.kind === 'boundary-curve') {
    return curveNamePlacement(node);
  }
  return {
    text: node.name,
    at: boxCentre(node.size),
    anchor: 'centre',
    width: innerWidth(
      node.kind === 'process'
        ? Math.min(node.size.width, node.size.height) * Math.SQRT1_2
        : node.size.width,
    ),
    textStyle: 'label',
  };
}

/**
 * The two opposite corners of the box a placement's text fills, wrapped and
 * measured the way `WrappedText` lays it out. Text that wraps to no line, as
 * an empty name does, gives no corners.
 */
export function textPlacementCorners(
  placement: TextPlacement,
): readonly Point[] {
  const rule = wrappedTextStyles[placement.textStyle];
  const lines = wrapText(placement.text, rule.fontSize, placement.width);
  if (lines.length === 0) {
    return [];
  }
  const extent = textExtent(lines, rule.fontSize);
  const top =
    placement.anchor === 'top'
      ? placement.at.y - rule.fontSize / 2
      : placement.at.y - extent.height / 2;
  return [
    { x: placement.at.x - extent.width / 2, y: top },
    { x: placement.at.x + extent.width / 2, y: top + extent.height },
  ];
}

/** {@link textPlacementCorners} of a node's text, in diagram coordinates. */
export function placedTextCorners(node: CanvasNode): Point[] {
  return textPlacementCorners(nodeTextPlacement(node)).map((corner) =>
    shiftedBy(corner, node.position),
  );
}

/**
 * The given nodes with every curve boundary's name settled on one bend of its
 * curve and one side of that bend.
 *
 * A side hangs the name off the unit normal of the curve's tangent at that
 * waypoint, the run from the waypoint before to the one after, at a
 * clearance plus the name's extent projected onto the normal. The convex
 * side is the normal pointing away from the bend, and where the bend lies
 * along the tangent it is the normal {@link labelNormal} picks for a flow.
 *
 * The candidates, in order, are the convex side of the middle waypoint, then
 * its mirror, then both sides of each further bend, walking outwards a
 * waypoint at a time and taking at each distance the bend nearer the origin
 * first, by x and then by y. The middle waypoint of an even run is the one of
 * the two central ones nearer the origin. The first candidate clear of the
 * curve as {@link sampledCurve} draws it, of every element's outline and of
 * every element's badge wins, and where none is clear the convex side of the
 * middle waypoint stands. Element names and flow labels are not consulted:
 * the flow labels are placed afterwards, around the curve's name.
 *
 * Every candidate is fixed by the waypoints, so reversing a curve's
 * waypoints or reordering the elements gives the same side, and the side
 * says nothing about which region the name describes. A curve that doubles
 * back over its own bend between two samples is not caught.
 */
export function settledCurveNames(
  nodes: readonly CanvasNode[],
): readonly CanvasNode[] {
  const blocked = elementSolids(nodes);
  return nodes.map((node) =>
    node.kind === 'boundary-curve'
      ? { ...node, nameSide: settledSide(node, blocked) }
      : node,
  );
}

/**
 * A name hung off `anchor` along `normal`, its near edge a `standoff` away
 * whichever way the normal points. `measured` saves wrapping a name whose
 * extent the caller already holds.
 */
export function nameBeside(
  name: string,
  anchor: Point,
  normal: Point,
  standoff: number,
  textStyle: WrappedTextStyle,
  measured?: TextExtent,
): TextPlacement {
  const fontSize = wrappedTextStyles[textStyle].fontSize;
  const extent =
    measured ?? textExtent(wrapText(name, fontSize, looseLabelWidth), fontSize);
  return {
    text: name,
    at: offsetBy(
      anchor,
      normal,
      standoff + projectedHalfExtent(extent, normal),
    ),
    anchor: 'centre',
    width: looseLabelWidth,
    textStyle,
  };
}

/** How far a block of text reaches from its centre along a unit direction. */
export function projectedHalfExtent(extent: TextExtent, normal: Point): number {
  return (
    (extent.width / 2) * Math.abs(normal.x) +
    (extent.height / 2) * Math.abs(normal.y)
  );
}

type BoundaryCurve = Extract<CanvasNode, { readonly kind: 'boundary-curve' }>;

type Bend = {
  readonly before: Point;
  readonly middle: Point;
  readonly after: Point;
};

function boxCentre(size: Size): Point {
  return { x: size.width / 2, y: size.height / 2 };
}

function curveNamePlacement(node: BoundaryCurve): TextPlacement {
  const side = node.nameSide ?? convexMiddle(node.waypoints);
  const bend = bendAt(node.waypoints, side.at);
  const convex = convexNormal(bend);
  return nameBeside(
    node.name,
    bend.middle,
    side.mirrored ? negated(convex) : convex,
    flowLabelClearance,
    'label',
  );
}

function convexMiddle(waypoints: readonly Point[]): CurveNameSide {
  return { at: middleWaypoint(waypoints), mirrored: false };
}

function middleWaypoint(waypoints: readonly Point[]): number {
  const at = Math.floor(waypoints.length / 2);
  if (waypoints.length % 2 === 1) {
    return at;
  }
  return nearerOrigin(waypoints[at - 1], waypoints[at]) ? at - 1 : at;
}

function nearerOrigin(one: Point, other: Point): boolean {
  return one.x < other.x || (one.x === other.x && one.y < other.y);
}

function bendAt(waypoints: readonly Point[], at: number): Bend {
  return {
    before: waypoints[Math.max(0, at - 1)],
    middle: waypoints[at],
    after: waypoints[Math.min(waypoints.length - 1, at + 1)],
  };
}

function convexNormal(bend: Bend): Point {
  const normal = labelNormal({ from: bend.before, to: bend.after });
  const into =
    (bend.after.x + bend.before.x - bend.middle.x * 2) * normal.x +
    (bend.after.y + bend.before.y - bend.middle.y * 2) * normal.y;
  return into > 0 ? negated(normal) : normal;
}

function settledSide(node: BoundaryCurve, elements: Solids): CurveNameSide {
  const obstacles = withOwnCurve(node, elements);
  const clear = sidesInOrder(node.waypoints).find(
    (side) => !nameMeetsAny(node, side, obstacles),
  );
  return clear ?? convexMiddle(node.waypoints);
}

function sidesInOrder(waypoints: readonly Point[]): CurveNameSide[] {
  return bendsInOrder(waypoints).flatMap((at) => [
    { at, mirrored: false },
    { at, mirrored: true },
  ]);
}

function bendsInOrder(waypoints: readonly Point[]): number[] {
  const middle = middleWaypoint(waypoints);
  const steps = Math.max(middle, waypoints.length - 1 - middle);
  return [
    middle,
    ...Array.from({ length: steps }, (_unused, step) =>
      bendsEitherSide(waypoints, middle, step + 1),
    ).flat(),
  ];
}

function bendsEitherSide(
  waypoints: readonly Point[],
  middle: number,
  step: number,
): number[] {
  const held = [middle - step, middle + step].filter(
    (at) => at >= 0 && at < waypoints.length,
  );
  return held.length === 2 &&
    nearerOrigin(waypoints[held[1]], waypoints[held[0]])
    ? [held[1], held[0]]
    : held;
}

function nameMeetsAny(
  node: BoundaryCurve,
  side: CurveNameSide,
  obstacles: Solids,
): boolean {
  const box = boxOfPoints(placedTextCorners({ ...node, nameSide: side }));
  return box !== undefined && boxCollisions(box, obstacles) > 0;
}

function withOwnCurve(node: BoundaryCurve, solids: Solids): Solids {
  return {
    ...solids,
    lines: [
      ...solids.lines,
      ...segmentsOfPolyline(
        sampledCurve(node.waypoints).map((point) =>
          shiftedBy(point, node.position),
        ),
      ),
    ],
  };
}
