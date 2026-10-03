import type { Point } from '@saerskriven/model';
import {
  boxAt,
  curveBoundary,
  flowBetween,
  elementId,
  flowFrom,
  modelWith,
} from '@saerskriven/model/fixtures';
import { badgeBox } from './badges.js';
import {
  asSolid,
  drawnSolids,
  isEnclosure,
  layoutOf,
  openThreatOn,
  scenes,
  textBoxOf,
  type Solid,
} from './canvas.fixtures.js';
import { edgePoints, flowGeometry } from './flow-anchors.js';
import type { FlowLabelPlacement } from './flow-blocks.js';
import {
  besideGap,
  besideReach,
  flowLabelPlacements,
  flowLabelPlacementsDuringMove,
  movedFlowLabel,
  shownLineAtEnds,
  slideStep,
  type FlowGeometry,
} from './flow-labels.js';
import {
  boxesOverlap,
  boxOfPoints,
  segmentMeetsBox,
  segmentsOfBox,
  segmentsOfPolyline,
  shiftedBy,
  type Box,
  type Segment,
} from './geometry.js';
import { nodeBox } from './handles.js';
import type { CanvasEdge, CanvasLayout, CanvasNode } from './layout.js';
import { runsWithin } from './line-spots.js';
import { arrowheadPoints, sampledCurve } from './paths.js';
import { textPlacementCorners } from './text-placement.js';
import { arrowhead } from './tokens.js';
import { looseLabelWidth, wrapText } from './typography.js';
import { projectedOn } from './vectors.js';

const centreOf = (box: Box): Point => ({
  x: (box.minX + box.maxX) / 2,
  y: (box.minY + box.maxY) / 2,
});

const backingOf = (edge: CanvasEdge): Box => {
  const { backing } = edge.label;
  if (backing === undefined) {
    throw new Error(`"${edge.name}" drew no block`);
  }
  return backing;
};

const edgeNamed = (layout: CanvasLayout, name: string): CanvasEdge => {
  const found = layout.edges.find((edge) => edge.name === name);
  if (found === undefined) {
    throw new Error(`No flow "${name}" in the layout`);
  }
  return found;
};

const linesOf = (edge: CanvasEdge): Segment[] =>
  segmentsOfPolyline(edgePoints(edge));

const distanceToLine = (edge: CanvasEdge, point: Point): number =>
  Math.min(...linesOf(edge).map((line) => projectedOn(line, point).distance));

const onItsLine = (edge: CanvasEdge): boolean =>
  distanceToLine(edge, centreOf(backingOf(edge))) < 1e-6;

const outlineOf = (node: CanvasNode): Segment[] =>
  node.kind === 'boundary-curve'
    ? segmentsOfPolyline(
        sampledCurve(node.waypoints).map((point) =>
          shiftedBy(point, node.position),
        ),
      )
    : segmentsOfBox(nodeBox(node));

const arrowheadsOf = (edge: CanvasEdge): Box[] => {
  const points = edgePoints(edge);
  const tips = [arrowheadPoints(edge.target, points[points.length - 2])];
  if (edge.bidirectional) {
    tips.push(arrowheadPoints(edge.source, points[1]));
  }
  return tips.flatMap((tip) => boxOfPoints(tip) ?? []);
};

const elementSolids = (layout: CanvasLayout): Solid[] => [
  ...drawnSolids(layout),
  ...layout.nodes.flatMap((node) => {
    const text = textBoxOf(node);
    return text === undefined
      ? []
      : [asSolid({ of: `${node.name} name`, box: text })];
  }),
];

const coveredBy = (layout: CanvasLayout, edge: CanvasEdge): string[] => {
  const block = edge.label.backing;
  if (block === undefined) {
    return [];
  }
  const others = layout.edges.filter((other) => other.id !== edge.id);
  return [
    ...elementSolids(layout)
      .filter((solid) => solid.meets(block))
      .map((solid) => solid.of),
    ...layout.nodes
      .filter(isEnclosure)
      .filter((node) =>
        outlineOf(node).some((line) => segmentMeetsBox(line, block)),
      )
      .map((node) => `the outline of ${node.name}`),
    ...others.flatMap((other) => [
      ...(linesOf(other).some((line) => segmentMeetsBox(line, block))
        ? [`the line of "${other.name}"`]
        : []),
      ...(arrowheadsOf(other).some((head) => boxesOverlap(head, block))
        ? [`an arrowhead of "${other.name}"`]
        : []),
      ...(other.label.backing !== undefined &&
      boxesOverlap(other.label.backing, block)
        ? [`the block of "${other.name}"`]
        : []),
    ]),
    ...(onItsLine(edge) ||
    !linesOf(edge).some((line) => segmentMeetsBox(line, block))
      ? []
      : ['its own line']),
  ];
};

const collisionsIn = (layout: CanvasLayout): string[] =>
  layout.edges.flatMap((edge) =>
    coveredBy(layout, edge).map((what) => `"${edge.name}" over ${what}`),
  );

const holds = (outer: Box, inner: Box): boolean =>
  outer.minX <= inner.minX &&
  outer.minY <= inner.minY &&
  outer.maxX >= inner.maxX &&
  outer.maxY >= inner.maxY;

const nameBoxOf = (label: FlowLabelPlacement): Box | undefined =>
  boxOfPoints(textPlacementCorners(label.name));

const endsCovered = (edge: CanvasEdge): boolean => {
  const block = backingOf(edge);
  const points = edgePoints(edge);
  return [
    ...runsWithin(
      points,
      shownLineAtEnds + (edge.bidirectional ? arrowhead.length : 0),
    ),
    ...runsWithin(points, shownLineAtEnds + arrowhead.length, true),
  ].some((run) => segmentMeetsBox(run, block));
};

const twoBoxes = (gap: number, extra: unknown[] = [], height = 80) =>
  layoutOf(
    modelWith({
      elements: [
        boxAt('el-left', 0, 0, 'actor', { width: 120, height }),
        boxAt('el-right', 120 + gap, 0, 'actor', { width: 120, height }),
        flowFrom('el-short', 'el-left', 'el-right', 'Book appointment'),
        ...extra,
      ],
    }),
  );

const twinFlow = (name: string): FlowGeometry => ({
  id: elementId('el-twin'),
  name,
  badge: undefined,
  bidirectional: false,
  points: [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ],
});

const placementsById = (layout: CanvasLayout) =>
  new Map(layout.edges.map((edge) => [edge.id, edge.label]));

const placedAlone = (points: readonly [Point, ...Point[]]) =>
  flowLabelPlacements(
    [
      {
        id: elementId('el-carried'),
        name: 'carried along',
        badge: undefined,
        bidirectional: false,
        points,
      },
    ],
    [],
  )[0];

describe('the flow blocks of a whole diagram', () => {
  it.each(scenes)('leaves nothing covered on $name', ({ layout }) => {
    expect(collisionsIn(layout)).toEqual([]);
  });

  it.each(scenes)(
    'draws one block holding the name and badge of every flow on $name',
    ({ layout }) => {
      const loose = layout.edges.flatMap((edge) => {
        const block = backingOf(edge);
        const name = nameBoxOf(edge.label);
        const badge =
          edge.badge === undefined || edge.label.badge === undefined
            ? undefined
            : badgeBox(edge.label.badge, edge.badge);
        return [name, badge].some(
          (part) => part !== undefined && !holds(block, part),
        )
          ? [edge.name]
          : [];
      });
      expect(loose).toEqual([]);
    },
  );

  it.each(scenes)(
    'leaves line and arrowhead showing at both ends of a block on its line, on $name',
    ({ layout }) => {
      const covered = layout.edges.filter(
        (edge) => onItsLine(edge) && endsCovered(edge),
      );
      expect(covered.map((edge) => edge.name)).toEqual([]);
    },
  );
});

describe("a flow's block", () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-left', 0, 0),
        boxAt('el-right', 520, 0),
        flowFrom('el-carry', 'el-left', 'el-right', 'ship the parcel'),
      ],
      threats: [openThreatOn('el-carry')],
    }),
  );
  const carry = edgeNamed(layout, 'ship the parcel');

  it('draws the badge first and the name after it, inside one backing', () => {
    const name = nameBoxOf(carry.label);
    const badge =
      carry.badge === undefined || carry.label.badge === undefined
        ? undefined
        : badgeBox(carry.label.badge, carry.badge);
    expect(name).toBeDefined();
    expect(badge).toBeDefined();
    if (name === undefined || badge === undefined) {
      return;
    }
    expect(badge.maxX).toBeLessThan(name.minX);
    expect(holds(backingOf(carry), name)).toBe(true);
    expect(holds(backingOf(carry), badge)).toBe(true);
  });

  it('sits on the middle of its line, which the backing breaks', () => {
    const centre = centreOf(backingOf(carry));
    expect(onItsLine(carry)).toBe(true);
    expect(centre.x).toBeCloseTo((carry.source.x + carry.target.x) / 2);
  });

  it('places a name with no badge the same way', () => {
    const plain = layoutOf(
      modelWith({
        elements: [
          boxAt('el-left', 0, 0),
          boxAt('el-right', 520, 0),
          flowFrom('el-plain', 'el-left', 'el-right', 'a name alone'),
        ],
      }),
    ).edges[0];
    const name = nameBoxOf(plain.label);
    expect(plain.label.badge).toBeUndefined();
    expect(onItsLine(plain)).toBe(true);
    expect(name !== undefined && holds(backingOf(plain), name)).toBe(true);
  });

  it('starts at the middle of the longest run of a bent line', () => {
    const [placement] = flowLabelPlacements(
      [
        {
          id: elementId('el-bent'),
          name: 'down the long side',
          badge: undefined,
          bidirectional: false,
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 400 },
            { x: 160, y: 400 },
          ],
        },
      ],
      [],
    );
    expect(placement.backing && centreOf(placement.backing)).toEqual({
      x: 100,
      y: 200,
    });
  });
});

describe('a flow crossing a trust boundary', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        curveBoundary('el-fence', [
          { x: 360, y: -200 },
          { x: 360, y: 300 },
        ]),
        boxAt('el-left', 0, 0),
        boxAt('el-right', 600, 0),
        flowFrom('el-cross', 'el-left', 'el-right', 'cross the fence'),
      ],
    }),
  );
  const crossing = layout.edges[0];

  it('slides its block along its own line off the boundary', () => {
    expect(onItsLine(crossing)).toBe(true);
    expect(collisionsIn(layout)).toEqual([]);
  });

  it('stops at the nearest clear spot, toward the source', () => {
    const clearance = 360 - backingOf(crossing).maxX;
    expect(clearance).toBeGreaterThan(0);
    expect(clearance).toBeLessThanOrEqual(slideStep);
  });
});

const fanNames = [
  'mint a token',
  'read a token',
  'refresh a token',
  'revoke a token',
  'list the tokens',
];

describe('flows fanning out of one element', () => {
  const pitch = 30;
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-hub', 0, 200),
        ...fanNames.map((_name, row) =>
          boxAt(
            `el-to-${String(row)}`,
            420,
            240 + (row - 2) * pitch - 12,
            'actor',
            {
              width: 120,
              height: 24,
            },
          ),
        ),
        ...fanNames.map((name, row) =>
          flowFrom(
            `el-fan-${String(row)}`,
            'el-hub',
            `el-to-${String(row)}`,
            name,
          ),
        ),
      ],
    }),
  );
  const slid = (edge: CanvasEdge): number => {
    const centre = centreOf(backingOf(edge));
    return Math.hypot(
      centre.x - (edge.source.x + edge.target.x) / 2,
      centre.y - (edge.source.y + edge.target.y) / 2,
    );
  };

  it('leave from one point', () => {
    const [first, ...rest] = layout.edges;
    expect(rest.map((edge) => edge.source)).toEqual(
      rest.map(() => first.source),
    );
  });

  it('slide blocks off the middles where the lines run close', () => {
    expect(
      layout.edges.filter((edge) => slid(edge) > slideStep).length,
    ).toBeGreaterThan(0);
  });

  it('carry each block on its own line, nothing covered', () => {
    expect(layout.edges.filter((edge) => !onItsLine(edge))).toEqual([]);
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('two flows crossing', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-nw', 0, 0),
        boxAt('el-se', 600, 400),
        boxAt('el-ne', 600, 0),
        boxAt('el-sw', 0, 400),
        flowFrom('el-falling', 'el-nw', 'el-se', 'prune the stale versions'),
        flowFrom('el-rising', 'el-sw', 'el-ne', 'push the rebuilt index'),
      ],
    }),
  );
  const crossing = { x: 360, y: 240 };

  it('cross at the middle of both lines', () => {
    for (const edge of layout.edges) {
      expect(distanceToLine(edge, crossing)).toBeCloseTo(0);
    }
  });

  it('slide both blocks along their own lines off the crossing', () => {
    expect(layout.edges.filter((edge) => !onItsLine(edge))).toEqual([]);
    expect(
      layout.edges.filter((edge) =>
        boxesOverlap(backingOf(edge), {
          minX: crossing.x,
          minY: crossing.y,
          maxX: crossing.x,
          maxY: crossing.y,
        }),
      ),
    ).toEqual([]);
    expect(collisionsIn(layout)).toEqual([]);
  });

  it('slide each toward its own source', () => {
    for (const edge of layout.edges) {
      expect(centreOf(backingOf(edge)).x).toBeLessThan(crossing.x);
    }
  });
});

describe('a short flow', () => {
  const line = 40;
  const lowLine = 12;

  it('takes its block above a horizontal line too short to carry it', () => {
    const layout = twoBoxes(40, [], lowLine * 2);
    const short = layout.edges[0];
    const block = backingOf(short);
    expect(onItsLine(short)).toBe(false);
    expect(block.maxY).toBeLessThanOrEqual(lowLine - besideGap);
    expect(lowLine - block.maxY).toBeLessThanOrEqual(besideGap + besideReach);
    expect(centreOf(block).x).toBeCloseTo(140);
    expect(collisionsIn(layout)).toEqual([]);
  });

  it('keeps a block it cannot clear beside its line, over as few things as it can', () => {
    const layout = twoBoxes(40);
    const short = layout.edges[0];
    const block = backingOf(short);
    expect(line - block.maxY).toBeGreaterThanOrEqual(besideGap);
    expect(line - block.maxY).toBeLessThanOrEqual(besideGap + besideReach);
    expect(coveredBy(layout, short)).toHaveLength(1);
  });

  it('wraps the name where that lets the block stay beside the line', () => {
    const layout = twoBoxes(80);
    const short = layout.edges[0];
    const block = backingOf(short);
    expect(short.label.name.width).toBeLessThan(looseLabelWidth);
    expect(
      wrapText(short.label.name.text, 10, short.label.name.width),
    ).toHaveLength(2);
    expect(block.maxY).toBeLessThanOrEqual(line - besideGap);
    expect(line - block.maxY).toBeLessThanOrEqual(besideGap + besideReach);
    expect(collisionsIn(layout)).toEqual([]);
  });

  it('keeps the name unwrapped where stepping out a little clears it', () => {
    const layout = twoBoxes(80, [], lowLine * 2);
    const short = layout.edges[0];
    expect(short.label.name.width).toBe(looseLabelWidth);
    expect(backingOf(short).maxY).toBeLessThan(0);
    expect(collisionsIn(layout)).toEqual([]);
  });

  it('goes beside a line that could carry it only over its arrowhead', () => {
    const layout = twoBoxes(116);
    const [short] = layout.edges;
    expect(onItsLine(short)).toBe(false);
    expect(backingOf(short).maxY).toBeLessThanOrEqual(line - besideGap);
  });

  it('takes its block right of a vertical line too short to carry it', () => {
    const layout = layoutOf(
      modelWith({
        elements: [
          boxAt('el-top', 0, 0),
          boxAt('el-bottom', 0, 110),
          flowFrom('el-short', 'el-top', 'el-bottom', 'Book appointment'),
        ],
      }),
    );
    const short = layout.edges[0];
    expect(backingOf(short).minX).toBeGreaterThanOrEqual(
      short.source.x + besideGap,
    );
    expect(collisionsIn(layout)).toEqual([]);
  });

  it('uses the other side only where the fixed side is blocked', () => {
    const layout = twoBoxes(
      40,
      [boxAt('el-lid', 100, -60, 'actor', { width: 80, height: 50 })],
      lowLine * 2,
    );
    const short = layout.edges[0];
    expect(backingOf(short).minY).toBeGreaterThanOrEqual(lowLine + besideGap);
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('a two-way flow whose middle is blocked', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-wall', 50, -30, 'actor', { width: 330, height: 60 }),
        {
          ...flowBetween(
            { kind: 'free', position: { x: 0, y: 0 } },
            { kind: 'free', position: { x: 400, y: 0 } },
            [],
          ),
          name: 'sync',
          bidirectional: true,
        },
      ],
    }),
  );
  const [sync] = layout.edges;

  it('slides no nearer the source than its arrowhead and some line', () => {
    expect(onItsLine(sync) && endsCovered(sync)).toBe(false);
  });

  it('goes beside the line where that leaves no room on it', () => {
    expect(onItsLine(sync)).toBe(false);
  });
});

describe('a flow with no clear spot anywhere', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-a', 0, 0, 'actor', { width: 300, height: 300 }),
        boxAt('el-b', 300, 0, 'actor', { width: 300, height: 300 }),
        boxAt('el-c', 0, 300, 'actor', { width: 300, height: 300 }),
        boxAt('el-d', 300, 300, 'actor', { width: 300, height: 300 }),
        flowFrom('el-boxed', 'el-a', 'el-d', 'nowhere at all to put this'),
      ],
    }),
  );

  it('still draws the name', () => {
    const [boxed] = layout.edges;
    expect(nameBoxOf(boxed.label)).toBeDefined();
    expect(coveredBy(layout, boxed)).toEqual(['el-b']);
  });

  it('takes the spot that covers the fewest things, though it is not the middle', () => {
    const floored = layoutOf(
      modelWith({
        elements: [
          boxAt('el-a', 0, 0),
          boxAt('el-b', 520, 0),
          boxAt('el-floor', 100, -100, 'actor', { width: 440, height: 700 }),
          boxAt('el-post', 310, 30, 'actor', { width: 20, height: 20 }),
          flowFrom('el-over', 'el-a', 'el-b', 'over the floor'),
        ],
      }),
    );
    const over = edgeNamed(floored, 'over the floor');
    expect(coveredBy(floored, over)).toEqual(['el-floor']);
  });
});

const crossingRows = 40;

const crossingFans = () =>
  modelWith({
    elements: [
      ...Array.from({ length: crossingRows }, (_unused, row) => [
        boxAt(`el-left-${String(row)}`, 0, row * 120),
        boxAt(`el-right-${String(row)}`, 900, row * 120),
      ]).flat(),
      ...Array.from({ length: crossingRows * 4 }, (_unused, flow) => {
        const row = Math.floor(flow / 4);
        const to = (row + ((flow % 4) * crossingRows) / 4) % crossingRows;
        return flowFrom(
          `el-batch-${String(flow).padStart(3, '0')}`,
          `el-left-${String(row)}`,
          `el-right-${String(to)}`,
          `send batch ${String(row)} ${String(flow % 4)}`,
        );
      }),
    ],
  });

const crossingBudget = 4000;

describe('the placement on a diagram crowded with crossings', () => {
  it('places 160 crossing flows within a generous time budget', () => {
    const model = crossingFans();
    const started = performance.now();
    const layout = layoutOf(model);
    const took = performance.now() - started;
    expect(layout.edges).toHaveLength(crossingRows * 4);
    expect(
      layout.edges.filter((edge) => edge.label.backing === undefined),
    ).toEqual([]);
    expect(took).toBeLessThan(crossingBudget);
  });
});

describe('the placement as a function of the model alone', () => {
  const sharedLine = [
    boxAt('el-left', 0, 0),
    boxAt('el-right', 460, 0),
    flowFrom('el-out', 'el-left', 'el-right', 'ship the parcel'),
    flowFrom('el-back', 'el-right', 'el-left', 'return the parcel'),
  ];

  it('answers two flows of one id in the order it was handed them', () => {
    const placed = flowLabelPlacements(
      [twinFlow('first'), twinFlow('second')],
      [],
    );
    expect(placed.map((placement) => placement.name.text)).toEqual([
      'first',
      'second',
    ]);
  });

  it('places flows in id order, so the lower id keeps the middle', () => {
    const layout = layoutOf(modelWith({ elements: sharedLine }));
    const back = edgeNamed(layout, 'return the parcel');
    const out = edgeNamed(layout, 'ship the parcel');
    expect(centreOf(backingOf(back)).x).toBeCloseTo(
      (back.source.x + back.target.x) / 2,
    );
    expect(centreOf(backingOf(out)).x).not.toBeCloseTo(
      (out.source.x + out.target.x) / 2,
    );
    expect(collisionsIn(layout)).toEqual([]);
  });

  it('follows the flow ids, not the order the model holds them in', () => {
    const forwards = layoutOf(modelWith({ elements: sharedLine }));
    const backwards = layoutOf(
      modelWith({
        elements: [sharedLine[0], sharedLine[1], sharedLine[3], sharedLine[2]],
      }),
    );
    expect(placementsById(backwards)).toEqual(placementsById(forwards));
  });

  it.each(scenes)('places $name the same way on a second run', ({ layout }) => {
    const flows = layout.edges.map(flowGeometry);
    expect(
      flowLabelPlacements(
        flows.map((flow) => ({ ...flow })),
        layout.nodes.map((node) => ({ ...node })),
      ),
    ).toEqual(layout.edges.map((edge) => edge.label));
  });

  it.each(scenes)(
    'moves every block with $name moved as a whole',
    ({ layout }) => {
      const by = { x: 100.3, y: 37.7 };
      const flows = layout.edges.map(flowGeometry);
      const moved = flowLabelPlacements(
        flows.map((flow) => ({
          ...flow,
          points: [
            shiftedBy(flow.points[0], by),
            ...flow.points.slice(1).map((point) => shiftedBy(point, by)),
          ],
        })),
        layout.nodes.map((node) => ({
          ...node,
          position: shiftedBy(node.position, by),
        })),
      );
      const drift = moved.map((placement, index) => {
        const settled = layout.edges[index].label;
        return Math.hypot(
          placement.name.at.x - settled.name.at.x - by.x,
          placement.name.at.y - settled.name.at.y - by.y,
        );
      });
      expect(Math.max(...drift)).toBeLessThan(1e-6);
    },
  );

  it('places a flow of one point beside the point it stands at', () => {
    const still = { x: 40, y: 60 };
    const [placement] = flowLabelPlacements(
      [
        {
          id: elementId('el-dot'),
          name: 'a flow of one point',
          badge: undefined,
          bidirectional: false,
          points: [still],
        },
      ],
      [],
    );
    expect(placement.name.at.x).toBe(still.x);
    expect(placement.backing?.maxY).toBeLessThan(still.y);
  });

  it('draws nothing for a flow with no name and no badge, its name on the line', () => {
    const layout = layoutOf(
      modelWith({
        elements: [
          boxAt('el-left', 0, 0),
          boxAt('el-right', 460, 0),
          { ...flowFrom('el-quiet', 'el-left', 'el-right'), name: '' },
        ],
      }),
    );
    const [quiet] = layout.edges;
    expect(quiet.label.backing).toBeUndefined();
    expect(textPlacementCorners(quiet.label.name)).toEqual([]);
    expect(distanceToLine(quiet, quiet.label.name.at)).toBeCloseTo(0);
  });

  it('carries the badge of a flow with no name on its line', () => {
    const layout = layoutOf(
      modelWith({
        elements: [
          boxAt('el-left', 0, 0),
          boxAt('el-right', 460, 0),
          { ...flowFrom('el-quiet', 'el-left', 'el-right'), name: '' },
        ],
        threats: [openThreatOn('el-quiet')],
      }),
    );
    const [quiet] = layout.edges;
    expect(quiet.label.badge).toBeDefined();
    expect(onItsLine(quiet)).toBe(true);
  });
});

describe('the placement during a drag', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-left', 0, 0),
        boxAt('el-right', 520, 0),
        flowFrom('el-z-kept', 'el-left', 'el-right', 'a flow left alone'),
        flowFrom('el-a-moving', 'el-left', 'el-right', 'a flow on the move'),
      ],
    }),
  );
  const flows = layout.edges.map(flowGeometry);
  const kept = layout.edges.findIndex(
    (edge) => edge.name === 'a flow left alone',
  );
  const moving = layout.edges.findIndex(
    (edge) => edge.name === 'a flow on the move',
  );
  const where = layout.edges[moving].label;
  const settled = new Map([[layout.edges[kept].id, where]]);
  const during = flowLabelPlacementsDuringMove(
    flows,
    layout.nodes,
    settled,
    new Set([layout.edges[moving].id]),
  );

  it('keeps the block of a flow outside the drag where it was', () => {
    expect(during[kept]).toBe(where);
  });

  it('places a moving flow clear of a kept block, though its own id is lower', () => {
    const placed = during[moving].backing;
    expect(placed).toBeDefined();
    expect(
      placed !== undefined &&
        where.backing !== undefined &&
        boxesOverlap(placed, where.backing),
    ).toBe(false);
  });
});

describe('a block carried along a changed path', () => {
  it('keeps a block on the line on the line as the line turns', () => {
    const from: [Point, Point] = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ];
    const to: [Point, Point] = [
      { x: 0, y: 0 },
      { x: 300, y: 300 },
    ];
    const moved = movedFlowLabel(placedAlone(from), from, to);
    expect(moved.backing && centreOf(moved.backing)).toEqual({
      x: 150,
      y: 150,
    });
  });

  it('keeps a block beside the line on its side, the same gap off it', () => {
    const from: [Point, Point] = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ];
    const to: [Point, Point] = [
      { x: 0, y: 100 },
      { x: 40, y: 100 },
    ];
    const settledBlock = placedAlone(from);
    const moved = movedFlowLabel(settledBlock, from, to);
    expect(moved.backing?.maxY).toBeCloseTo(
      (settledBlock.backing?.maxY ?? Number.NaN) + 100,
    );
  });
});
