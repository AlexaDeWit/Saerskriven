import type { Point } from '@saerskriven/model';
import {
  assumptionOf,
  boxAt,
  elementId,
  flowFrom,
  modelWith,
} from '@saerskriven/model/fixtures';
import { badgeBox } from './badges.js';
import { everyGlyphModel } from './canvas.fixtures.js';
import { flowLabelPlacements, type FlowGeometry } from './flow-labels.js';
import {
  boxesOverlap,
  boxMeetsCircle,
  boxOfPoints,
  segmentMeetsBox,
  segmentsOfBox,
  segmentsOfPolyline,
  shiftedBy,
  type Box,
  type Segment,
} from './geometry.js';
import {
  asSolid,
  circleOf,
  drawnSolids,
  elementBadges,
  isEnclosure,
  openThreatOn,
  scenes,
  textBoxOf,
  type Drawn,
  type Solid,
} from './label-placement.fixtures.js';
import { nodeBox } from './handles.js';
import { layoutOf } from './layout.fixtures.js';
import type { CanvasLayout, CanvasNode } from './layout.js';
import { controlPolygon } from './paths.js';
import { textPlacementCorners } from './text-placement.js';
import { flowLabelClearance } from './typography.js';

const outlineOf = (node: CanvasNode): Segment[] => {
  if (node.kind === 'boundary-curve') {
    return segmentsOfPolyline(
      controlPolygon(node.waypoints).map((point) =>
        shiftedBy(point, node.position),
      ),
    );
  }
  return segmentsOfBox(nodeBox(node));
};

const elementNames = (layout: CanvasLayout): Drawn[] =>
  layout.nodes.flatMap((node) => {
    const text = textBoxOf(node);
    return text === undefined ? [] : [{ of: `${node.name} name`, box: text }];
  });

const elementBoxes = (layout: CanvasLayout): Solid[] => [
  ...drawnSolids(layout),
  ...elementNames(layout).map(asSolid),
];

const drawnLines = (layout: CanvasLayout): Segment[] => [
  ...layout.nodes.filter(isEnclosure).flatMap(outlineOf),
  ...layout.edges.flatMap((edge) =>
    segmentsOfPolyline([edge.source, ...edge.waypoints, edge.target]),
  ),
];

const flowBadges = (layout: CanvasLayout): Drawn[] =>
  layout.edges.flatMap((edge) =>
    edge.badge === undefined || edge.label.badge === undefined
      ? []
      : [
          {
            of: `"${edge.name}" badge`,
            box: badgeBox(edge.label.badge, edge.badge),
          },
        ],
  );

const flowNames = (layout: CanvasLayout): Drawn[] =>
  layout.edges.flatMap((edge) => {
    const name = boxOfPoints(textPlacementCorners(edge.label.name));
    return name === undefined ? [] : [{ of: `"${edge.name}"`, box: name }];
  });

const labelBoxes = (layout: CanvasLayout): Drawn[] => [
  ...flowNames(layout),
  ...flowBadges(layout),
];

const grownBy = (box: Box, by: number): Box => ({
  minX: box.minX - by,
  minY: box.minY - by,
  maxX: box.maxX + by,
  maxY: box.maxY + by,
});

const crowdedElementBadges = (layout: CanvasLayout): string[] => {
  const elements = elementBadges(layout);
  return flowBadges(layout).flatMap((flow) =>
    elements
      .filter((element) =>
        boxesOverlap(flow.box, grownBy(element.box, flowLabelClearance)),
      )
      .map((element) => `${flow.of} within a clearance of ${element.of}`),
  );
};

const collisionsIn = (layout: CanvasLayout): string[] => {
  const elements = elementBoxes(layout);
  const lines = drawnLines(layout);
  const labels = labelBoxes(layout);
  return labels.flatMap((label, index) => [
    ...elements
      .filter((element) => element.meets(label.box))
      .map((element) => `${label.of} over the element ${element.of}`),
    ...labels
      .slice(index + 1)
      .filter((other) => boxesOverlap(label.box, other.box))
      .map((other) => `${label.of} over ${other.of}`),
    ...lines
      .filter((line) => segmentMeetsBox(line, label.box))
      .map(() => `${label.of} across a line`),
  ]);
};

const placementsById = (layout: CanvasLayout): [string, Point][] =>
  layout.edges.map((edge) => [edge.id, edge.label.name.at]);

describe('the flow labels of a whole diagram', () => {
  it.each(scenes)('leaves nothing overlapping on $name', ({ layout }) => {
    expect(collisionsIn(layout)).toEqual([]);
  });

  it.each(scenes)('names every flow $name carries', ({ layout }) => {
    expect(labelBoxes(layout).length).toBeGreaterThanOrEqual(
      layout.edges.length,
    );
  });

  it.each(scenes)(
    'holds every flow badge of $name a clearance off an element badge',
    ({ layout }) => {
      expect(crowdedElementBadges(layout)).toEqual([]);
    },
  );
});

describe("a flow whose badge would land beside an element's badge", () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-top', 0, 0),
        boxAt('el-bottom', 0, 300),
        boxAt('el-tag', -115, 190),
        flowFrom('el-carry', 'el-top', 'el-bottom', 'ship the parcel'),
      ],
      threats: [openThreatOn('el-carry'), openThreatOn('el-tag', 2)],
    }),
  );

  it('takes another anchor, so the two do not read as one pair', () => {
    expect(flowBadges(layout).map((badge) => badge.of)).toEqual([
      '"ship the parcel" badge',
    ]);
    expect(crowdedElementBadges(layout)).toEqual([]);
  });
});

describe("a flow's name where its badge would be moved on", () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-left', 0, 0),
        boxAt('el-right', 400, 0),
        boxAt('el-tag', 205, 70),
        flowFrom('el-carry', 'el-left', 'el-right', 'ship the parcel'),
      ],
      threats: [openThreatOn('el-tag')],
    }),
  );

  it('stands within a clearance of an element badge, clear of it', () => {
    const [name] = flowNames(layout);
    const [badge] = elementBadges(layout);
    expect(boxesOverlap(name.box, badge.box)).toBe(false);
    expect(boxesOverlap(name.box, grownBy(badge.box, flowLabelClearance))).toBe(
      true,
    );
  });
});

describe('two flows between one pair of elements', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-left', 0, 0),
        boxAt('el-right', 460, 0),
        flowFrom('el-out', 'el-left', 'el-right', 'ship the parcel'),
        flowFrom('el-back', 'el-right', 'el-left', 'return the parcel'),
      ],
    }),
  );

  it('shares one segment between them', () => {
    const [first, second] = layout.edges;
    expect(first.source).toEqual(second.target);
    expect(first.target).toEqual(second.source);
  });

  it('carries their names on opposite sides of it', () => {
    const [ship, back] = layout.edges;
    const line = ship.source.y;
    expect(back.label.name.at.y).toBeGreaterThan(line);
    expect(ship.label.name.at.y).toBeLessThan(line);
  });

  it('leaves nothing overlapping', () => {
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('two badged flows between one pair of elements', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-left', 0, 0),
        boxAt('el-right', 460, 0),
        flowFrom('el-out', 'el-left', 'el-right', 'ship the parcel'),
        flowFrom('el-back', 'el-right', 'el-left', 'return the parcel'),
      ],
      threats: [openThreatOn('el-out'), openThreatOn('el-back', 2)],
    }),
  );

  it('holds their badges a clearance apart, so the two read as one each', () => {
    const badges = flowBadges(layout);
    expect(badges).toHaveLength(2);
    const [one, other] = badges;
    expect(boxesOverlap(grownBy(one.box, flowLabelClearance), other.box)).toBe(
      false,
    );
  });
});

const carrying = (assumptions: unknown[]) =>
  layoutOf(
    modelWith({
      elements: [
        boxAt('el-left', 0, 0),
        boxAt('el-right', 460, 0),
        boxAt('el-floor', 130, 75, 'actor', { width: 320, height: 80 }),
        flowFrom('el-carry', 'el-left', 'el-right', 'ship the parcel'),
      ],
      threats: [openThreatOn('el-carry')],
      assumptions,
    }),
  );

describe('a flow whose badge carries a flag mark', () => {
  const flagged = carrying([
    assumptionOf({
      id: 'as-stale',
      status: 'invalidated',
      threats: ['th-el-carry'],
    }),
  ]);
  const plain = carrying([]);
  const [flaggedBadge] = flowBadges(flagged);
  const [plainBadge] = flowBadges(plain);

  it('hangs a deeper badge than the same flow unflagged', () => {
    expect(flaggedBadge.box.maxY - flaggedBadge.box.minY).toBeGreaterThan(
      plainBadge.box.maxY - plainBadge.box.minY,
    );
  });

  it('keeps its name clear of the larger badge, and the badge off every line and element', () => {
    expect(collisionsIn(flagged)).toEqual([]);
  });
});

describe('the every-glyph label beside the Order API process', () => {
  const layout = layoutOf(everyGlyphModel);
  const [orderApi] = layout.nodes.filter((node) => node.kind === 'process');
  const submitOrder = labelBoxes(layout).filter((label) =>
    label.of.startsWith('"Submit order"'),
  );
  const boxNamed = (of: string): Box => {
    const [found] = submitOrder.filter((label) => label.of === of);
    return found.box;
  };

  it('draws a name and a badge for that flow, and nothing else', () => {
    expect(orderApi.name).toBe('Order API');
    expect(submitOrder.map((label) => label.of)).toEqual([
      '"Submit order"',
      '"Submit order" badge',
    ]);
  });

  it('keeps the smaller name clear of the process box', () => {
    const name = boxNamed('"Submit order"');
    expect(boxesOverlap(name, nodeBox(orderApi))).toBe(false);
    expect(boxMeetsCircle(name, circleOf(orderApi))).toBe(false);
  });

  it('hangs the badge beside the flow rather than in that corner beside the name', () => {
    const badge = boxNamed('"Submit order" badge');
    expect(boxesOverlap(badge, nodeBox(orderApi))).toBe(false);
    expect(boxMeetsCircle(badge, circleOf(orderApi))).toBe(false);
  });
});

describe('three flows converging on one element', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-hub', 400, 300),
        boxAt('el-one', 0, 0),
        boxAt('el-two', 0, 300),
        boxAt('el-three', 0, 600),
        flowFrom('el-a', 'el-one', 'el-hub', 'mint a token for the caller'),
        flowFrom('el-b', 'el-two', 'el-hub', 'mint a token for the worker'),
        flowFrom('el-c', 'el-three', 'el-hub', 'mint a token for the pilot'),
      ],
    }),
  );

  it('leaves nothing overlapping', () => {
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('a long diagonal crossing another flow', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-nw', 0, 0),
        boxAt('el-se', 600, 500),
        boxAt('el-ne', 600, 0),
        boxAt('el-sw', 0, 500),
        flowFrom('el-falling', 'el-nw', 'el-se', 'prune the stale versions'),
        flowFrom('el-rising', 'el-sw', 'el-ne', 'push the rebuilt index'),
      ],
    }),
  );

  it('leaves nothing overlapping', () => {
    expect(collisionsIn(layout)).toEqual([]);
  });
});

describe('a label beside a store', () => {
  const layout = layoutOf(
    modelWith({
      elements: [
        boxAt('el-worker', 0, 300),
        boxAt('el-store', 400, 280, 'store', { width: 200, height: 120 }),
        boxAt('el-far', 900, 300),
        flowFrom(
          'el-past',
          'el-worker',
          'el-far',
          'read through to the origin',
        ),
        flowFrom('el-into', 'el-worker', 'el-store', 'write the mirrored copy'),
      ],
    }),
  );

  it('leaves nothing overlapping', () => {
    expect(collisionsIn(layout)).toEqual([]);
  });
});

const twinFlow = (name: string): FlowGeometry => ({
  id: elementId('el-twin'),
  name,
  badge: undefined,
  points: [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ],
});

describe('the placement as a function of the model alone', () => {
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

  it('places a flow of one point beside the point it stands at', () => {
    const still = { x: 40, y: 60 };
    const [placement] = flowLabelPlacements(
      [
        {
          id: elementId('el-dot'),
          name: 'a flow of one point',
          badge: undefined,
          points: [still],
        },
      ],
      [],
    );
    expect(placement.name.at.x).toBe(still.x);
    expect(placement.name.at.y).toBeGreaterThan(still.y);
  });

  it('follows the flow ids, not the order the model holds them in', () => {
    const elements = [
      boxAt('el-left', 0, 0),
      boxAt('el-right', 460, 0),
      flowFrom('el-out', 'el-left', 'el-right', 'ship the parcel'),
      flowFrom('el-back', 'el-right', 'el-left', 'return the parcel'),
    ];
    const forwards = layoutOf(modelWith({ elements }));
    const backwards = layoutOf(
      modelWith({
        elements: [elements[0], elements[1], elements[3], elements[2]],
      }),
    );
    expect(new Map(placementsById(backwards))).toEqual(
      new Map(placementsById(forwards)),
    );
  });

  it('places a flow with no name at all beside its line', () => {
    const layout = layoutOf(
      modelWith({
        elements: [
          boxAt('el-left', 0, 0),
          boxAt('el-right', 460, 0),
          { ...flowFrom('el-quiet', 'el-left', 'el-right'), name: '' },
        ],
      }),
    );
    expect(textPlacementCorners(layout.edges[0].label.name)).toEqual([]);
    expect(layout.edges[0].label.name.at.y).toBeGreaterThan(0);
  });

  it('places a flow whose ends sit on one point', () => {
    const layout = layoutOf(
      modelWith({
        elements: [
          boxAt('el-still', 0, 0),
          {
            ...flowFrom('el-loop', 'el-still', 'el-still'),
            source: { kind: 'free', position: { x: 300, y: 300 } },
            target: { kind: 'free', position: { x: 300, y: 300 } },
            name: 'a flow of no length at all',
          },
        ],
      }),
    );
    expect(layout.edges[0].label.name.at.y).toBeGreaterThan(300);
  });

  it('keeps the label of a flow it cannot place clear inside a crowd', () => {
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
    expect(layout.edges).toHaveLength(1);
    expect(collisionsIn(layout).length).toBeGreaterThan(0);
  });
});
