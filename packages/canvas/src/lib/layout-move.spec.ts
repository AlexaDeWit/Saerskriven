import { attached, elementId, flowBetween } from '@saerskriven/model/fixtures';
import { flowLabelPlacements } from './flow-labels.js';
import { handlePositions, type NodeBox } from './handles.js';
import {
  flowLabelFollows,
  layoutDuringMove,
  reanchoredFlow,
} from './layout-move.js';
import { layoutOf, twoBoxDiagram } from './canvas.fixtures.js';

const nodeBoxAt = (x: number, y: number): NodeBox => ({
  position: { x, y },
  size: { width: 100, height: 100 },
});

describe('reanchoredFlow', () => {
  const settled = layoutOf(
    twoBoxDiagram(flowBetween(attached('el-left'), attached('el-right'), [])),
  ).edges[0];

  const left = nodeBoxAt(0, 0);
  const right = nodeBoxAt(400, 0);
  const badged = {
    ...settled,
    badge: {
      kind: 'counted',
      count: 1,
      severity: 'high',
      secondary: 0,
      flagged: false,
    },
    label: {
      ...settled.label,
      badge: { x: settled.label.name.at.x, y: 30 },
    },
  } as const;

  it('gives the settled flow back where each box is where the model has it', () => {
    expect(reanchoredFlow(settled, left, right)).toEqual(settled);
  });

  it('carries the anchor of an end whose box has moved', () => {
    expect(reanchoredFlow(settled, nodeBoxAt(0, 200), right).source).toEqual({
      x: 100,
      y: 250,
    });
  });

  it('leaves the end whose box stands where it was', () => {
    expect(reanchoredFlow(settled, nodeBoxAt(0, 200), right).target).toEqual(
      settled.target,
    );
  });

  it('settles the side of both ends afresh, as the layout would', () => {
    const moved = reanchoredFlow(settled, nodeBoxAt(0, -600), right);
    expect([moved.sourceSide, moved.targetSide]).toEqual(['bottom', 'top']);
    expect([moved.source, moved.target]).toEqual([
      { x: 50, y: -500 },
      { x: 450, y: 0 },
    ]);
  });

  it('moves the name and badge with the live path', () => {
    const moved = reanchoredFlow(badged, nodeBoxAt(0, 200), right);
    expect(moved.label.name.at).not.toEqual(settled.label.name.at);
    expect(moved.label.badge).not.toEqual(badged.label.badge);
  });

  it('recognizes whether a label kept its path candidate', () => {
    const moved = reanchoredFlow(settled, nodeBoxAt(0, 200), right);
    const changed = {
      ...moved,
      label: {
        ...moved.label,
        name: {
          ...moved.label.name,
          at: { ...moved.label.name.at, x: moved.label.name.at.x + 1 },
        },
      },
    };

    expect(flowLabelFollows(settled, moved)).toBe(true);
    expect(flowLabelFollows(settled, changed)).toBe(false);
  });

  it('matches a settled label when one endpoint moves', () => {
    const moved = reanchoredFlow(settled, nodeBoxAt(0, 200), right);
    const nodes = layoutOf(
      twoBoxDiagram(flowBetween(attached('el-left'), attached('el-right'), [])),
    ).nodes.map((node) =>
      node.id === elementId('el-left')
        ? { ...node, position: { x: 0, y: 200 } }
        : node,
    );
    expect(moved.label).toEqual(
      flowLabelPlacements(
        [
          {
            id: moved.id,
            name: moved.name,
            badge: moved.badge,
            points: [moved.source, ...moved.waypoints, moved.target],
          },
        ],
        nodes,
      )[0],
    );
  });

  it('translates the path, name and badge when both boxes move together', () => {
    const offset = { x: 80, y: 120 };
    const moved = reanchoredFlow(
      badged,
      nodeBoxAt(offset.x, offset.y),
      nodeBoxAt(400 + offset.x, offset.y),
    );
    expect(moved.source).toEqual({
      x: badged.source.x + offset.x,
      y: badged.source.y + offset.y,
    });
    expect(moved.target).toEqual({
      x: badged.target.x + offset.x,
      y: badged.target.y + offset.y,
    });
    expect(moved.label.name.at).toEqual({
      x: badged.label.name.at.x + offset.x,
      y: badged.label.name.at.y + offset.y,
    });
    expect(moved.label.badge).toEqual(
      badged.label.badge === undefined
        ? undefined
        : {
            x: badged.label.badge.x + offset.x,
            y: badged.label.badge.y + offset.y,
          },
    );
  });

  it('keeps a free end where it is, no box carrying one', () => {
    const loose = layoutOf(
      twoBoxDiagram(
        flowBetween(
          attached('el-left'),
          { kind: 'free', position: { x: 50, y: 400 } },
          [],
        ),
      ),
    ).edges[0];
    const moved = reanchoredFlow(loose, nodeBoxAt(0, 200), undefined);
    expect(moved.target).toEqual({ x: 50, y: 400 });
    expect(moved.source).toEqual({ x: 50, y: 300 });
  });

  it('keeps a pinned end on its side through a move', () => {
    const pinned = layoutOf(
      twoBoxDiagram(
        flowBetween(
          { ...attached('el-left'), side: 'bottom' },
          attached('el-right'),
          [{ x: 50, y: -300 }],
        ),
      ),
    ).edges[0];
    const moved = reanchoredFlow(pinned, nodeBoxAt(0, -900), undefined);
    expect(moved.sourceSide).toBe('bottom');
    expect(moved.source).toEqual(handlePositions(nodeBoxAt(0, -900)).bottom);
  });

  it('keeps both settled anchors where no box reaches it', () => {
    expect(reanchoredFlow(settled, undefined, undefined)).toEqual(settled);
  });

  it('carries a flow attached to a trust boundary as it carries any other', () => {
    const crossing = layoutOf(
      twoBoxDiagram(
        flowBetween(attached('el-left'), attached('el-fence'), []),
        [
          {
            kind: 'trust-boundary',
            id: 'el-fence',
            name: 'Fence',
            description: '',
            outOfScope: false,
            reasonOutOfScope: '',
            shape: {
              kind: 'box',
              position: { x: 400, y: 0 },
              size: { width: 100, height: 100 },
            },
          },
        ],
      ),
    ).edges[0];
    expect(reanchoredFlow(crossing, left, nodeBoxAt(400, 200)).target).toEqual({
      x: 400,
      y: 250,
    });
  });
});

describe('layoutDuringMove', () => {
  it('places a moving label while retaining a static flow label', () => {
    const movingFlow = flowBetween(
      attached('el-left'),
      attached('el-right'),
      [],
    );
    const staticFlow = {
      ...flowBetween(
        { kind: 'free', position: { x: 0, y: 300 } },
        { kind: 'free', position: { x: 500, y: 300 } },
        [],
      ),
      id: 'el-static',
      name: 'Static',
    };
    const settled = layoutOf(twoBoxDiagram(movingFlow, [staticFlow]));
    const rightNode = settled.nodes.find(
      (node) => node.id === elementId('el-right'),
    );
    if (rightNode === undefined) {
      throw new Error('No right node in the layout');
    }
    const boxes = new Map([
      [
        elementId('el-right'),
        {
          position: { x: 400, y: 200 },
          size: rightNode.size,
        },
      ],
    ]);

    const moved = layoutDuringMove(
      settled,
      boxes,
      new Set(),
      { x: 0, y: 0 },
      false,
    );

    expect(moved.edges.find((edge) => edge.id === elementId('el-static'))).toBe(
      settled.edges.find((edge) => edge.id === elementId('el-static')),
    );
    expect(
      moved.edges.find((edge) => edge.id === elementId('el-flow'))?.label,
    ).not.toEqual(
      settled.edges.find((edge) => edge.id === elementId('el-flow'))?.label,
    );
  });

  it('reuses an edge whose geometry and exact label stay unchanged', () => {
    const settled = layoutOf(
      twoBoxDiagram(flowBetween(attached('el-left'), attached('el-right'), [])),
    );

    const unchanged = layoutDuringMove(settled, new Map(), new Set(), {
      x: 0,
      y: 0,
    });

    expect(unchanged.edges[0]).toBe(settled.edges[0]);
  });

  it('moves selected flow waypoints with the live group', () => {
    const settled = layoutOf(
      twoBoxDiagram(
        flowBetween(attached('el-left'), attached('el-right'), [
          { x: 250, y: 180 },
        ]),
      ),
    );
    const offset = { x: 60, y: 45 };
    const boxes = new Map(
      settled.nodes.map((node) => [
        node.id,
        {
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
          size: node.size,
        },
      ]),
    );

    const moved = layoutDuringMove(
      settled,
      boxes,
      new Set(settled.edges.map((edge) => edge.id)),
      offset,
    );

    expect(moved.edges[0].waypoints).toEqual([{ x: 310, y: 225 }]);
    expect(moved.edges[0].source).toEqual({
      x: settled.edges[0].source.x + offset.x,
      y: settled.edges[0].source.y + offset.y,
    });
    expect(moved.edges[0].target).toEqual({
      x: settled.edges[0].target.x + offset.x,
      y: settled.edges[0].target.y + offset.y,
    });
  });

  it('moves selected free ends with their flow', () => {
    const settled = layoutOf(
      twoBoxDiagram(
        flowBetween(
          { kind: 'free', position: { x: 20, y: 30 } },
          { kind: 'free', position: { x: 380, y: 70 } },
          [{ x: 200, y: 140 }],
        ),
      ),
    );
    const edge = settled.edges[0];
    const offset = { x: 15, y: 25 };

    const moved = layoutDuringMove(
      settled,
      new Map(),
      new Set([edge.id]),
      offset,
    ).edges[0];

    expect(moved.source).toEqual({ x: 35, y: 55 });
    expect(moved.target).toEqual({ x: 395, y: 95 });
    expect(moved.waypoints).toEqual([{ x: 215, y: 165 }]);
  });
});
