import {
  setAccent,
  takesAccent,
  type Model,
  type Point,
} from '@saerskriven/model';
import { Either } from 'effect';
import {
  attached,
  curveBoundary,
  elementId,
  elementIn,
  flowBetween,
  modelWith,
} from '@saerskriven/model/fixtures';
import { badgeExtent } from './badges.js';
import { drawnBounds } from './bounds.js';
import {
  accentsLayout,
  accentsModel,
  edgeNamed,
  everyGlyphLayout,
  everyGlyphModel,
  layoutOf,
  nodeNamed,
  scenes,
  twoBoxDiagram,
} from './canvas.fixtures.js';
import { handlePositions } from './handles.js';
import type { CanvasNode, CanvasNodeKind } from './layout.js';
import { boundaryStrokeWidth } from './stylesheet.js';
import { noteFrameOffset } from './tokens.js';

const boxKinds = {
  actor: true,
  process: true,
  store: true,
  text: true,
  'boundary-box': true,
  'boundary-curve': true,
} as const satisfies Record<CanvasNodeKind, true>;

const unplacedFlows: Readonly<Record<string, readonly string[]>> = {
  'every glyph': ['el-replay'],
};

const curveLayout = (waypoints: readonly Point[]) =>
  layoutOf(modelWith({ elements: [curveBoundary('el-curve', waypoints)] }));

const curveNode = (waypoints: readonly Point[]): CanvasNode =>
  curveLayout(waypoints).nodes[0];

describe('layoutDiagram', () => {
  it('lays out a node of every kind the canvas draws as a box', () => {
    expect(new Set(everyGlyphLayout.nodes.map((node) => node.kind))).toEqual(
      new Set<string>(Object.keys(boxKinds)),
    );
    expect(everyGlyphLayout.edges).toHaveLength(3);
  });

  it.each(scenes)(
    'draws or reports every element of $name',
    ({ name, model, diagram, layout }) => {
      expect(layout.unplaced.map((end) => end.flow)).toEqual(
        unplacedFlows[name] ?? [],
      );
      expect(
        layout.nodes.length + layout.edges.length + layout.unplaced.length,
      ).toBe(model.diagrams[diagram].elements.length);
    },
  );

  it('takes a node position and size from the model and nowhere else', () => {
    const element = elementIn(everyGlyphModel, 'el-api');
    const node = nodeNamed('el-api');
    expect(element.kind === 'process' && element.position).toEqual(
      node.position,
    );
    expect(element.kind === 'process' && element.size).toEqual(node.size);
  });

  it('takes a box boundary position and size from its own shape', () => {
    expect(nodeNamed('el-zone').position).toEqual({ x: 0, y: 0 });
    expect(nodeNamed('el-zone').size).toEqual({ width: 640, height: 260 });
  });

  it('sizes a curve boundary to its waypoints grown by the stroke width', () => {
    const node = nodeNamed('el-edge-zone');
    const grown = boundaryStrokeWidth;
    expect(node.position).toEqual({ x: 300 - grown, y: 300 - grown });
    expect(node.size).toEqual({
      width: 240 + grown * 2,
      height: 40 + grown * 2,
    });
    expect(node.kind === 'boundary-curve' && node.waypoints).toEqual([
      { x: grown, y: grown },
      { x: 120 + grown, y: 40 + grown },
      { x: 240 + grown, y: grown },
    ]);
  });

  it('works a curve boundary box out at the decimals its points are written with', () => {
    const node = curveNode([
      { x: 65.1, y: 0.3 },
      { x: 100.3, y: 0.1 },
    ]);

    expect(node.position).toEqual({ x: 63.1, y: -1.9 });
    expect(node.size).toEqual({ width: 39.2, height: 4.2 });
  });

  it('carries a text element its own prose', () => {
    const node = nodeNamed('el-note');
    expect(node.kind === 'text' && node.text).toBe(
      'Orders are kept for seven years.',
    );
  });

  it('puts boundaries first even when the model lists them last', () => {
    const diagram = everyGlyphModel.diagrams[0];
    const reordered: Model = {
      ...everyGlyphModel,
      diagrams: [
        {
          ...diagram,
          elements: [
            ...diagram.elements.filter(
              (element) => element.kind !== 'trust-boundary',
            ),
            ...diagram.elements.filter(
              (element) => element.kind === 'trust-boundary',
            ),
          ],
        },
      ],
    };
    expect(
      layoutOf(reordered)
        .nodes.slice(0, 2)
        .map((node) => node.id),
    ).toEqual([elementId('el-zone'), elementId('el-edge-zone')]);
  });

  it('carries the badge of each element the threats name', () => {
    expect(nodeNamed('el-client').badge).toEqual({
      kind: 'counted',
      count: 1,
      severity: 'critical',
      secondary: 0,
      flagged: false,
    });
    expect(nodeNamed('el-note').badge).toBeUndefined();
  });

  it('anchors an attached end at the handle midpoint of the side it takes', () => {
    const edge = edgeNamed('el-request');
    const client = nodeNamed('el-client');
    expect(edge.sourceSide).toBe('right');
    expect(edge.source).toEqual(handlePositions(client).right);
    expect(edge.sourceElement).toBe(elementId('el-client'));
  });

  it('leaves a free end at its own position, on no side of anything', () => {
    const edge = edgeNamed('el-probe');
    expect(edge.source).toEqual({ x: 620, y: 320 });
    expect(edge.sourceSide).toBeUndefined();
    expect(edge.sourceElement).toBeUndefined();
  });

  it('reports the fixture flow whose endpoint names another flow', () => {
    expect(everyGlyphLayout.unplaced).toEqual([
      {
        flow: elementId('el-replay'),
        side: 'source',
        element: elementId('el-request'),
      },
    ]);
  });

  it('bounds everything it draws', () => {
    expect(everyGlyphLayout.bounds).toEqual({
      x: 0,
      y: -13,
      width: 653,
      height: 523,
    });
  });

  it("reaches past an out-of-scope note's box for the frame drawn around it", () => {
    const note = nodeNamed('el-scope-note');
    const inScope = drawnBounds([{ ...note, outOfScope: false }], []);
    expect(inScope).toEqual({ ...note.position, ...note.size });
    expect(drawnBounds([note], [])).toEqual({
      x: inScope.x - noteFrameOffset,
      y: inScope.y - noteFrameOffset,
      width: inScope.width + noteFrameOffset * 2,
      height: inScope.height + noteFrameOffset * 2,
    });
  });

  it('reaches past a node box for the badge hanging off its corner', () => {
    const zone = nodeNamed('el-zone');
    const reach = zone.badge === undefined ? 0 : badgeExtent(zone.badge).radius;
    expect(reach).toBeGreaterThan(0);
    expect(everyGlyphLayout.bounds.y).toBe(zone.position.y - reach);
    expect(everyGlyphLayout.bounds.x + everyGlyphLayout.bounds.width).toBe(
      zone.position.x + zone.size.width + reach,
    );
  });

  it('bounds a sharp curve by the cubics that draw it, not by its box', () => {
    const sharp = curveLayout([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
    ]);
    const node = sharp.nodes[0];
    expect(sharp.bounds.x + sharp.bounds.width).toBeGreaterThan(
      node.position.x + node.size.width,
    );
    expect(sharp.bounds.y).toBeLessThan(node.position.y);
  });

  it('gives a straight curve boundary an extent to pick', () => {
    const straight = curveNode([
      { x: 0, y: 50 },
      { x: 400, y: 50 },
    ]);
    expect(straight.size).toEqual({
      width: 400 + boundaryStrokeWidth * 2,
      height: boundaryStrokeWidth * 2,
    });
  });

  it('gives a curve boundary of one repeated point an extent to pick', () => {
    const degenerate = curveNode([
      { x: 20, y: 20 },
      { x: 20, y: 20 },
    ]);
    expect(degenerate.size).toEqual({
      width: boundaryStrokeWidth * 2,
      height: boundaryStrokeWidth * 2,
    });
    expect(
      degenerate.kind === 'boundary-curve' && degenerate.waypoints,
    ).toEqual([
      { x: boundaryStrokeWidth, y: boundaryStrokeWidth },
      { x: boundaryStrokeWidth, y: boundaryStrokeWidth },
    ]);
  });

  it('bounds an empty diagram at the origin', () => {
    const empty = modelWith({ elements: [] });
    expect(layoutOf(empty)).toEqual({
      nodes: [],
      edges: [],
      unplaced: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });
  });
});

const accentsOf = (items: readonly { readonly id: string }[]) =>
  Object.fromEntries(
    items.flatMap((item) => ('accent' in item ? [[item.id, item.accent]] : [])),
  );

const withoutAccents = (items: readonly object[]) =>
  items.map((item) =>
    Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== 'accent'),
    ),
  );

describe('layoutDiagram, an accent', () => {
  it('carries the key of each element and flow that holds one, and no key for the rest', () => {
    expect(accentsOf(accentsLayout.nodes)).toEqual({
      'ac-zone-strong': 's3',
      'ac-zone-light': 'l2',
      'ac-edge-strong': 's4',
      'ac-zone-out': 'l1',
      'ac-strong-1': 's1',
      'ac-strong-2': 's2',
      'ac-strong-3': 's3',
      'ac-strong-4': 's4',
      'ac-light-1': 'l1',
      'ac-light-2': 'l2',
      'ac-light-3': 'l3',
      'ac-light-4': 'l4',
      'ac-badged': 's1',
      'ac-out-strong': 's2',
      'ac-out-light': 'l4',
    });
    expect(accentsOf(accentsLayout.edges)).toEqual({
      'ac-flow-strong': 's1',
      'ac-flow-both': 's4',
      'ac-flow-light': 'l3',
      'ac-flow-badged': 'l1',
      'ac-flow-out': 's2',
    });
    expect(accentsOf(everyGlyphLayout.nodes)).toEqual({});
  });

  it('is paint alone: the diagram lays out as it does with every accent cleared, every flow name where it was', () => {
    const cleared = Either.getOrThrow(
      setAccent(
        accentsModel,
        accentsModel.diagrams[0].elements
          .filter(takesAccent)
          .map((element) => element.id),
        undefined,
      ),
    );
    const plain = layoutOf(cleared);
    expect(withoutAccents(accentsLayout.nodes)).toEqual(plain.nodes);
    expect(withoutAccents(accentsLayout.edges)).toEqual(plain.edges);
    expect(accentsLayout.bounds).toEqual(plain.bounds);
  });
});

describe('layoutDiagram, choosing a side', () => {
  it('turns the source toward the first waypoint', () => {
    const model = twoBoxDiagram(
      flowBetween(attached('el-left'), attached('el-right'), [
        { x: 50, y: -300 },
      ]),
    );
    expect(layoutOf(model).edges[0].sourceSide).toBe('top');
  });

  it('turns the target toward the last waypoint', () => {
    const model = twoBoxDiagram(
      flowBetween(attached('el-left'), attached('el-right'), [
        { x: 50, y: -300 },
        { x: 450, y: 400 },
      ]),
    );
    expect(layoutOf(model).edges[0].targetSide).toBe('bottom');
  });

  it('turns each end toward the other centre where there is no waypoint', () => {
    const model = twoBoxDiagram(
      flowBetween(attached('el-left'), attached('el-right'), []),
    );
    expect(layoutOf(model).edges[0].sourceSide).toBe('right');
    expect(layoutOf(model).edges[0].targetSide).toBe('left');
  });

  it('turns an attached end toward the free position at the other end', () => {
    const model = twoBoxDiagram(
      flowBetween(
        attached('el-left'),
        { kind: 'free', position: { x: 50, y: 400 } },
        [],
      ),
    );
    expect(layoutOf(model).edges[0].sourceSide).toBe('bottom');
  });

  it('keeps a pinned end on its side whatever the route', () => {
    const edge = layoutOf(
      twoBoxDiagram(
        flowBetween(
          { ...attached('el-left'), side: 'bottom' },
          attached('el-right'),
          [{ x: 50, y: -300 }],
        ),
      ),
    ).edges[0];
    expect(edge.sourceSide).toBe('bottom');
    expect(edge.sourcePin).toBe('bottom');
    expect(edge.targetPin).toBeUndefined();
  });
});

describe('layoutDiagram, a bidirectional flow', () => {
  it('carries the direction and bounds the arrowhead at the source too', () => {
    const flow = {
      ...flowBetween(
        { kind: 'free', position: { x: 1000, y: 900 } },
        attached('el-right'),
        [{ x: 1000, y: 50 }],
      ),
      name: '',
    };
    const oneWay = layoutOf(twoBoxDiagram(flow));
    const bothWays = layoutOf(twoBoxDiagram({ ...flow, bidirectional: true }));
    expect(oneWay.edges[0].bidirectional).toBe(false);
    expect(bothWays.edges[0].bidirectional).toBe(true);
    expect(bothWays.edges[0].source).toEqual(oneWay.edges[0].source);
    expect(oneWay.bounds.x + oneWay.bounds.width).toBe(1000);
    expect(bothWays.bounds.x + bothWays.bounds.width).toBeGreaterThan(1000);
  });
});

describe('layoutDiagram, an end it cannot place', () => {
  const placed = layoutOf(
    twoBoxDiagram(
      {
        ...flowBetween(attached('el-left'), attached('el-right'), []),
        id: 'el-carrier',
      },
      [
        {
          ...flowBetween(attached('el-left'), attached('el-carrier'), []),
          id: 'el-rider',
        },
      ],
    ),
  );

  it('names an endpoint pointing at an element the canvas draws as no box', () => {
    expect(placed.unplaced).toEqual([
      {
        flow: elementId('el-rider'),
        side: 'target',
        element: elementId('el-carrier'),
      },
    ]);
  });

  it('leaves that flow out rather than inventing geometry for it', () => {
    expect(placed.edges.map((edge) => edge.id)).toEqual([
      elementId('el-carrier'),
    ]);
  });
});
