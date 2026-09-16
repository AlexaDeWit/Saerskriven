import type { Model, Point } from '@saerskriven/model';
import {
  attached,
  curveBoundary,
  elementId,
  elementIn,
  flowBetween,
  modelWith,
} from '@saerskriven/model/fixtures';
import { badgeExtent } from './badges.js';
import {
  edgeNamed,
  everyGlyphLayout,
  everyGlyphModel,
  nodeNamed,
} from './canvas.fixtures.js';
import { handlePositions } from './handles.js';
import { reanchoredFlow } from './layout-move.js';
import { layoutOf, twoBoxDiagram } from './layout.fixtures.js';
import type { CanvasNode, CanvasNodeKind } from './layout.js';
import { boundaryStrokeWidth } from './stylesheet.js';

const boxKinds = {
  actor: true,
  process: true,
  store: true,
  text: true,
  'boundary-box': true,
  'boundary-curve': true,
} as const satisfies Record<CanvasNodeKind, true>;

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
      height: 423,
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

  it('keeps a pinned end on its side whatever the route, and keeps the pin through a move', () => {
    const model = twoBoxDiagram(
      flowBetween(
        { ...attached('el-left'), side: 'bottom' },
        attached('el-right'),
        [{ x: 50, y: -300 }],
      ),
    );
    const laid = layoutOf(model);
    const edge = laid.edges[0];
    expect(edge.sourceSide).toBe('bottom');
    expect(edge.sourcePin).toBe('bottom');
    expect(edge.targetPin).toBeUndefined();
    const leftBox = laid.nodes.find((node) => node.id === elementId('el-left'));
    if (leftBox === undefined) {
      throw new Error('No left box');
    }
    const moved = reanchoredFlow(
      edge,
      { position: { x: 0, y: -900 }, size: leftBox.size },
      undefined,
    );
    expect(moved.sourceSide).toBe('bottom');
    expect(moved.source).toEqual(
      handlePositions({ position: { x: 0, y: -900 }, size: leftBox.size })
        .bottom,
    );
  });
});

describe('layoutDiagram, a bidirectional flow', () => {
  it('carries the direction and bounds the arrowhead at the source too', () => {
    const oneWay = layoutOf(
      twoBoxDiagram(flowBetween(attached('el-left'), attached('el-right'), [])),
    );
    const bothWays = layoutOf(
      twoBoxDiagram({
        ...flowBetween(attached('el-left'), attached('el-right'), []),
        bidirectional: true,
      }),
    );
    expect(oneWay.edges[0].bidirectional).toBe(false);
    expect(bothWays.edges[0].bidirectional).toBe(true);
    expect(bothWays.edges[0].source).toEqual(oneWay.edges[0].source);
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
