import type { Point } from '@saerskriven/model';
import type { CanvasBounds } from './bounds.js';
import {
  boxOfPoints,
  segmentMeetsBox,
  segmentsOfPolyline,
  shiftedBy,
  type Box,
  type Segment,
} from './geometry.js';
import {
  boxAt,
  diagramOf,
  elementSolids,
  openThreatOn,
  scenes,
  textBoxOf,
} from './label-placement.fixtures.js';
import { layoutOf } from './layout.fixtures.js';
import type { CanvasLayout, CanvasNode } from './layout.js';
import { sampledCurve } from './paths.js';
import { nodeTextPlacement, textPlacementCorners } from './text-placement.js';

const curveOf = (value: string, waypoints: readonly Point[], name: string) => ({
  kind: 'trust-boundary',
  id: value,
  name,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  shape: { kind: 'curve', waypoints },
});

const dividerName = 'a divider named at length, over more than one line';

const curveRuns = (node: CanvasNode): Segment[] =>
  node.kind === 'boundary-curve'
    ? segmentsOfPolyline(
        sampledCurve(node.waypoints).map((point) =>
          shiftedBy(point, node.position),
        ),
      )
    : [];

const boxStruckBy = (node: CanvasNode, box: Box | undefined): string[] =>
  box === undefined
    ? []
    : curveRuns(node)
        .filter((run) => segmentMeetsBox(run, box))
        .map(() => `${node.name} over its own curve`);

const nameStruckBy = (node: CanvasNode): string[] =>
  boxStruckBy(node, textBoxOf(node));

const curveBeside = (
  waypoints: readonly Point[],
  name: string,
  elements: unknown[],
): CanvasLayout =>
  layoutOf(diagramOf([curveOf('el-divider', waypoints, name), ...elements]));

const layoutOfCurve = (
  waypoints: readonly Point[],
  name = dividerName,
): CanvasLayout => curveBeside(waypoints, name, []);

const curveNameOverlaps = (layout: CanvasLayout): string[] => {
  const solids = elementSolids(layout);
  return layout.nodes.flatMap((node) => {
    const box = node.kind === 'boundary-curve' ? textBoxOf(node) : undefined;
    return box === undefined
      ? []
      : solids
          .filter((solid) => solid.meets(box))
          .map((solid) => `${node.name} over ${solid.of}`);
  });
};

const firstWaypointOf = (node: CanvasNode): Point =>
  node.kind === 'boundary-curve' ? node.waypoints[0] : { x: 0, y: 0 };

const middleWaypointOf = (node: CanvasNode): Point =>
  node.kind === 'boundary-curve'
    ? node.waypoints[Math.floor(node.waypoints.length / 2)]
    : { x: 0, y: 0 };

const mirrorBoxOf = (node: CanvasNode): Box | undefined => {
  const placement = nodeTextPlacement(node);
  const middle = middleWaypointOf(node);
  return boxOfPoints(
    textPlacementCorners({
      ...placement,
      at: {
        x: middle.x * 2 - placement.at.x,
        y: middle.y * 2 - placement.at.y,
      },
    }).map((corner) => shiftedBy(corner, node.position)),
  );
};

const distanceBetween = (one: Point, other: Point): number =>
  Math.hypot(other.x - one.x, other.y - one.y);

const rightEdge = (bounds: CanvasBounds): number => bounds.x + bounds.width;

const curveOrientations = [
  [
    'vertical',
    [
      { x: 0, y: 0 },
      { x: 60, y: 200 },
      { x: 0, y: 400 },
    ],
    dividerName,
  ],
  [
    'horizontal',
    [
      { x: 0, y: 0 },
      { x: 200, y: 60 },
      { x: 400, y: 0 },
    ],
    dividerName,
  ],
  [
    'diagonal',
    [
      { x: 0, y: 0 },
      { x: 200, y: 140 },
      { x: 400, y: 400 },
    ],
    dividerName,
  ],
  [
    'arched, 300 wide and 100 tall',
    [
      { x: 0, y: 100 },
      { x: 150, y: 0 },
      { x: 300, y: 100 },
    ],
    'Untrusted callers',
  ],
  [
    'arched, 120 wide and 40 tall under a long name',
    [
      { x: 0, y: 40 },
      { x: 60, y: 0 },
      { x: 120, y: 40 },
    ],
    'a boundary with a fairly long name',
  ],
  [
    'vertical and opening to the right',
    [
      { x: 40, y: 0 },
      { x: 0, y: 200 },
      { x: 40, y: 400 },
    ],
    dividerName,
  ],
] as const;

const reversedRuns = [
  [
    'a run of three waypoints',
    [
      { x: 0, y: 0 },
      { x: 60, y: 200 },
      { x: 0, y: 400 },
    ],
    [
      { x: 0, y: 400 },
      { x: 60, y: 200 },
      { x: 0, y: 0 },
    ],
  ],
  [
    'a run of four waypoints',
    [
      { x: 300, y: 60 },
      { x: 340, y: 250 },
      { x: 300, y: 470 },
      { x: 340, y: 680 },
    ],
    [
      { x: 340, y: 680 },
      { x: 300, y: 470 },
      { x: 340, y: 250 },
      { x: 300, y: 60 },
    ],
  ],
] as const;

describe("a curve boundary's name, over the curve as it is sampled", () => {
  it.each(curveOrientations)(
    'clears a curve %s',
    (_orientation, waypoints, name) => {
      expect(nameStruckBy(layoutOfCurve(waypoints, name).nodes[0])).toEqual([]);
    },
  );

  it.each(scenes)(
    'clears every curve $name draws, and some draw none',
    ({ layout }) => {
      expect(layout.nodes.flatMap(nameStruckBy)).toEqual([]);
    },
  );

  it.each(reversedRuns)(
    'takes its side from the waypoints of %s, not the end drawn from',
    (_shape, forwards, backwards) => {
      expect(nodeTextPlacement(layoutOfCurve(backwards).nodes[0]).at).toEqual(
        nodeTextPlacement(layoutOfCurve(forwards).nodes[0]).at,
      );
    },
  );

  it('is reached by the bounds the layout reports', () => {
    const layout = layoutOfCurve(curveOrientations[0][1]);
    expect(rightEdge(layout.bounds)).toBe(textBoxOf(layout.nodes[0])?.maxX);
  });

  it.each(scenes)('lands on no element box or badge of $name', ({ layout }) => {
    expect(curveNameOverlaps(layout)).toEqual([]);
  });

  it('sits on the outside of the bend, not inside it', () => {
    const arch = layoutOfCurve(curveOrientations[3][1], 'Untrusted callers');
    const bowl = layoutOfCurve([
      { x: 0, y: 0 },
      { x: 150, y: 100 },
      { x: 300, y: 0 },
    ]);
    expect(nodeTextPlacement(arch.nodes[0]).at.y).toBeLessThan(0);
    expect(nodeTextPlacement(bowl.nodes[0]).at.y).toBeGreaterThan(100);
  });
});

const dividerWaypoints = [
  { x: 0, y: 0 },
  { x: 60, y: 200 },
  { x: 0, y: 400 },
];

const dividerBeside = (
  elements: unknown[],
  threats: unknown[] = [],
): CanvasLayout =>
  layoutOf(
    diagramOf(
      [curveOf('el-divider', dividerWaypoints, dividerName), ...elements],
      threats,
    ),
  );

const dividerNameX = (layout: CanvasLayout): number =>
  nodeTextPlacement(layout.nodes[0]).at.x;

const dividerReversed = [
  { x: 0, y: 400 },
  { x: 60, y: 200 },
  { x: 0, y: 0 },
];

const coveringBothSides = [
  boxAt('el-block', 100, 150),
  boxAt('el-other', -80, 150),
];

describe("a curve boundary's name beside what the diagram already draws", () => {
  it('stays on the convex side where nothing is drawn there', () => {
    const layout = dividerBeside([]);
    expect(dividerNameX(layout)).toBeGreaterThan(
      middleWaypointOf(layout.nodes[0]).x,
    );
    expect(curveNameOverlaps(layout)).toEqual([]);
  });

  it('takes the mirror side where an element box covers the convex one', () => {
    const clear = dividerBeside([]);
    const blocked = dividerBeside([boxAt('el-block', 100, 150)]);
    const middle = middleWaypointOf(blocked.nodes[0]);
    expect(dividerNameX(blocked)).toBeLessThan(middle.x);
    expect(dividerNameX(blocked) + dividerNameX(clear)).toBe(middle.x * 2);
    expect(curveNameOverlaps(blocked)).toEqual([]);
  });

  it('takes the mirror side where a badge alone covers the convex one', () => {
    const badged = boxAt('el-badged', 0, 226);
    const clear = dividerBeside([badged]);
    const blocked = dividerBeside([badged], [openThreatOn('el-badged')]);
    const middle = middleWaypointOf(blocked.nodes[0]);
    expect(dividerNameX(clear)).toBeGreaterThan(middle.x);
    expect(dividerNameX(blocked)).toBeLessThan(middle.x);
  });

  it('walks to a further bend where both sides of the middle are covered', () => {
    const boxed = dividerBeside(coveringBothSides);
    const [curve] = boxed.nodes;
    const at = nodeTextPlacement(curve).at;
    expect(distanceBetween(at, firstWaypointOf(curve))).toBeLessThan(
      distanceBetween(at, middleWaypointOf(curve)),
    );
    expect(curveNameOverlaps(boxed)).toEqual([]);
    expect(nameStruckBy(curve)).toEqual([]);
  });

  it('walks to the same place on a run reversed, not to the same index', () => {
    const forwards = curveBeside(
      dividerWaypoints,
      dividerName,
      coveringBothSides,
    );
    const backwards = curveBeside(
      dividerReversed,
      dividerName,
      coveringBothSides,
    );
    expect(nodeTextPlacement(backwards.nodes[0]).at).toEqual(
      nodeTextPlacement(forwards.nodes[0]).at,
    );
  });

  it('keeps the convex side of the middle where no bend is clear', () => {
    const smothered = dividerBeside([
      boxAt('el-smother', -300, -300, 'actor', { width: 800, height: 1000 }),
    ]);
    expect(nodeTextPlacement(smothered.nodes[0]).at).toEqual(
      nodeTextPlacement(dividerBeside([]).nodes[0]).at,
    );
    expect(curveNameOverlaps(smothered)).not.toEqual([]);
  });
});

const archWaypoints = [
  { x: 0, y: 100 },
  { x: 150, y: 0 },
  { x: 300, y: 100 },
];

const archName = 'Untrusted callers';

describe('the name of a 300 by 100 arch', () => {
  const overTheConvexSide = boxAt('el-over', 120, -60, 'actor', {
    width: 60,
    height: 40,
  });

  it('would cross its own curve on the mirror of the middle bend', () => {
    const [arch] = layoutOfCurve(archWaypoints, archName).nodes;
    expect(boxStruckBy(arch, mirrorBoxOf(arch))).not.toEqual([]);
  });

  it('walks past that mirror, clear of the curve and of what covers it', () => {
    const pushed = curveBeside(archWaypoints, archName, [overTheConvexSide]);
    const [arch] = pushed.nodes;
    const at = nodeTextPlacement(arch).at;
    expect(distanceBetween(at, firstWaypointOf(arch))).toBeLessThan(
      distanceBetween(at, middleWaypointOf(arch)),
    );
    expect(nameStruckBy(arch)).toEqual([]);
    expect(curveNameOverlaps(pushed)).toEqual([]);
  });
});
