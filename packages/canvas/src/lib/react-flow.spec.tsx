import { elementId } from '@saerskriven/model/fixtures';
import {
  Position,
  ReactFlowProvider,
  useStoreApi,
  type EdgeProps,
} from '@xyflow/react';
import {
  act,
  useLayoutEffect,
  useRef,
  type FocusEvent as ReactFocusEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { selectedBadgeAnchor } from './badges.js';
import {
  everyGlyphLayout,
  nodeNamed,
  specMarks,
  specResizeLabels,
} from './canvas.fixtures.js';
import { shiftedBy } from './geometry.js';
import { handleSides } from './handles.js';
import { svgNumber } from './numbers.js';
import { resizeControlPositions } from './resizing.js';
import { canvasClassNames, canvasInteractionClassNames } from './stylesheet.js';
import type { CanvasNode } from './layout.js';
import { resizeHandle } from './tokens.js';
import {
  CanvasEdgeBody,
  CanvasFreeEndBody,
  CanvasNodeBody,
  flowEndNodeId,
  freeEndNodeKind,
  freeEndNodes,
  layoutAtReactFlowNodes,
  toReactFlowEdges,
  toReactFlowNodes,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasEdgeData,
} from './react-flow.js';

const blockFocused = vi.fn<(event: ReactFocusEvent<SVGElement>) => void>();

const nodeProps = (node: CanvasNode) => ({
  id: node.id,
  data: { node },
  type: node.kind,
  dragging: false,
  zIndex: 0,
  selectable: false,
  deletable: false,
  selected: false,
  draggable: false,
  isConnectable: false,
  positionAbsoluteX: node.position.x,
  positionAbsoluteY: node.position.y,
});

const edgeProps = (
  data: CanvasEdgeData | undefined,
  selected = false,
): EdgeProps<CanvasFlowEdge> => ({
  id: 'el-request',
  source: 'el-client',
  target: 'el-api',
  sourceX: 0,
  sourceY: 0,
  targetX: 0,
  targetY: 0,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected,
  data,
});

const bodyMarkup = (
  node: CanvasNode,
  selected = false,
  isConnectable = false,
  controlsVisible = true,
  size?: { readonly width: number; readonly height: number },
  resizing = false,
  textVisible = true,
): string =>
  renderToStaticMarkup(
    <ReactFlowProvider>
      <CanvasNodeBody
        marks={specMarks}
        {...nodeProps(node)}
        selected={selected}
        isConnectable={isConnectable}
        controlsVisible={controlsVisible}
        resizeLabels={specResizeLabels(node)}
        width={size?.width}
        height={size?.height}
        resizing={resizing}
        textVisible={textVisible}
      />
    </ReactFlowProvider>,
  );

const edgeMarkup = (
  data: CanvasEdgeData | undefined,
  nodes: CanvasFlowNode[] = [],
  selected = false,
  textVisible = true,
  inspect?: (container: HTMLDivElement) => void,
): string => {
  const container = document.createElement('div');
  if (inspect !== undefined) {
    document.body.appendChild(container);
  }
  const root = createRoot(container);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  act(() => {
    root.render(
      <ReactFlowProvider initialNodes={nodes}>
        <EdgeFixture
          data={data}
          selected={selected}
          textVisible={textVisible}
        />
      </ReactFlowProvider>,
    );
  });
  try {
    inspect?.(container);
    return container.innerHTML;
  } finally {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  }
};

function EdgeFixture({
  data,
  selected,
  textVisible,
}: {
  readonly data: CanvasEdgeData | undefined;
  readonly selected: boolean;
  readonly textVisible: boolean;
}) {
  const store = useStoreApi();
  const surface = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    store.setState({ domNode: surface.current });
  }, [store]);
  return (
    <div ref={surface}>
      <svg>
        <g className="react-flow__edge" tabIndex={0}>
          <CanvasEdgeBody
            marks={specMarks}
            onBlockFocus={blockFocused}
            {...edgeProps(data, selected)}
            textVisible={textVisible}
          />
        </g>
      </svg>
      <div className="react-flow__viewport-portal" />
    </div>
  );
}

const nodesWith = (moved: string, by: number): CanvasFlowNode[] =>
  toReactFlowNodes(everyGlyphLayout).map((node) =>
    node.id === elementId(moved)
      ? { ...node, position: { x: node.position.x, y: node.position.y + by } }
      : node,
  );

const everyNodeSelectedAt = (offset: {
  readonly x: number;
  readonly y: number;
}): CanvasFlowNode[] =>
  toReactFlowNodes(everyGlyphLayout).map((node) => ({
    ...node,
    position: shiftedBy(node.position, offset),
    selected: true,
  }));

const badgePlace = (markup: string): readonly string[] =>
  /^[^>]*? transform="translate\(([^,]+), ([^)]+)\)"/u
    .exec(markup.slice(markup.indexOf(`class="${canvasClassNames.badge}"`)))
    ?.slice(1) ?? [];

const flowLabelPlace = (markup: string): readonly string[] => {
  const name = markup.slice(
    markup.indexOf(`class="${canvasClassNames.flowLabel}"`),
  );
  return [
    ...(/^[^>]*? x="([^"]+)" y="([^"]+)"/u.exec(name)?.slice(1) ?? []),
    ...badgePlace(markup),
  ];
};

const curveNode = everyGlyphLayout.nodes.find(
  (node) => node.kind === 'boundary-curve',
);

describe('CanvasNodeBody', () => {
  it('sizes its surface from the model and measures nothing', () => {
    const node = nodeNamed('el-client');
    expect(bodyMarkup(node)).toContain(
      `<svg width="${node.size.width}" height="${node.size.height}" style="display:block"`,
    );
  });

  it('draws the shared glyph and nothing of its own', () => {
    expect(bodyMarkup(nodeNamed('el-client'))).toContain('<rect');
  });

  it('draws the glyph at the transient extent React Flow reports', () => {
    const markup = bodyMarkup(
      nodeNamed('el-client'),
      false,
      false,
      true,
      { width: 200, height: 90 },
      true,
    );
    expect(markup).toContain('<svg width="200" height="90"');
    expect(markup).toContain(
      `<rect class="${canvasClassNames.shape} ${canvasClassNames.actor}" width="200" height="90"`,
    );
  });

  it('carries a handle at each side, named for that side', () => {
    const markup = bodyMarkup(nodeNamed('el-client'));
    for (const side of handleSides) {
      expect(markup).toContain(`data-handleid="${side}"`);
    }
  });

  it('lets React Flow connect only through handles of a connectable node', () => {
    expect(bodyMarkup(nodeNamed('el-client'), false, true)).toMatch(
      /class="[^"]*\bconnectable\b/u,
    );
    expect(bodyMarkup(nodeNamed('el-zone'))).not.toMatch(
      /class="[^"]*\bconnectable\b/u,
    );
  });

  it('offers four side controls and four corner controls on a selected resizable element, each under the name it is given', () => {
    const node = nodeNamed('el-client');
    const markup = bodyMarkup(node, true);
    expect(markup.match(/react-flow__resize-control/gu)).toHaveLength(8);
    for (const position of resizeControlPositions) {
      expect(markup).toContain(
        `aria-label="${specResizeLabels(node)[position]}"`,
      );
    }
    expect(markup).toContain('aria-keyshortcuts="ArrowUp ArrowDown"');
    expect(markup.match(/class="[^"]*\bline\b/gu)).toHaveLength(4);
    expect(markup.match(/class="[^"]*\bhandle\b/gu)).toHaveLength(4);
  });

  it('draws the badge once, after the resize controls, so they stack under it', () => {
    const markup = bodyMarkup(nodeNamed('el-client'), true);
    const badge = `class="${canvasClassNames.badge}"`;
    expect(markup.split(badge)).toHaveLength(2);
    expect(markup.indexOf(badge)).toBeGreaterThan(
      markup.lastIndexOf('react-flow__resize-control'),
    );
  });

  it("draws a selected element's badge stepped out past its top-right corner, and an unselected one on it", () => {
    const node = nodeNamed('el-api');
    const stepped = selectedBadgeAnchor(node);

    expect(badgePlace(bodyMarkup(node))).toEqual([
      svgNumber(node.size.width),
      '0',
    ]);
    expect(badgePlace(bodyMarkup(node, true))).toEqual([
      svgNumber(stepped.x),
      svgNumber(stepped.y),
    ]);
    expect(stepped.x).toBeGreaterThan(node.size.width);
    expect(stepped.y).toBeLessThan(0);
  });

  it("hands a selected boundary box's badge to React Flow's viewport portal, out of the boundary's own layer", () => {
    const zone = nodeNamed('el-zone');
    const badge = `class="${canvasClassNames.badge}"`;

    expect(bodyMarkup(zone)).toContain(badge);
    expect(bodyMarkup(zone, true)).not.toContain(badge);
  });

  it("keeps a selected boundary curve's badge in its own layer, on its corner", () => {
    assert.isDefined(curveNode);

    expect(badgePlace(bodyMarkup(curveNode, true))).toEqual([
      svgNumber(curveNode.size.width),
      '0',
    ]);
  });

  it('draws no badge layer for an element without a badge', () => {
    expect(bodyMarkup(nodeNamed('el-note'), true)).not.toContain(
      `class="${canvasClassNames.badge}"`,
    );
  });

  it("marks an out-of-scope element's badge layer as its glyph is marked", () => {
    const node = nodeNamed('el-db');
    expect(node.outOfScope).toBe(true);
    const markup = bodyMarkup(node);
    const layer = markup.slice(
      markup.indexOf(canvasInteractionClassNames.badgeLayer),
    );
    expect(layer).toContain(`<g class="${canvasClassNames.outOfScope}"`);
  });

  it('hides connection and resize controls while a name field is open', () => {
    const markup = bodyMarkup(nodeNamed('el-client'), true, true, false);
    expect(markup.match(/visibility:hidden/gu)).toHaveLength(12);
  });

  it('draws no text while a text field is open over it', () => {
    const node = nodeNamed('el-client');
    expect(bodyMarkup(node)).toContain(canvasClassNames.label);
    expect(
      bodyMarkup(node, true, true, false, undefined, false, false),
    ).not.toContain(canvasClassNames.label);
  });

  it('offers none while the element is not selected', () => {
    expect(bodyMarkup(nodeNamed('el-client'))).not.toContain(
      'react-flow__resize-control',
    );
  });

  it('offers a selected boundary curve every control, its corner handles outside the corners', () => {
    assert.isDefined(curveNode);
    const markup = bodyMarkup(curveNode, true);
    expect(markup.match(/react-flow__resize-control/gu)).toHaveLength(8);
    const outside = `calc(-100% - ${String(resizeHandle.curveGap)}px)`;
    expect(markup).toContain(`translate:${outside} ${outside}`);
    expect(markup).toContain(
      `translate:${String(resizeHandle.curveGap)}px ${String(resizeHandle.curveGap)}px`,
    );
  });

  it("draws a curve's points scaled to the transient extent React Flow reports", () => {
    assert.isDefined(curveNode);
    const settled = bodyMarkup(curveNode);
    const stretched = bodyMarkup(
      curveNode,
      false,
      false,
      true,
      { width: 484, height: curveNode.size.height },
      true,
    );
    expect(settled).toContain(' 242 2"');
    expect(stretched).not.toContain(' 242 2"');
    expect(stretched.match(/d="M 2 2 [^"]* 482 2"/gu)).toHaveLength(2);
  });

  it('gives each boundary outline a wider invisible pointer target', () => {
    for (const node of [nodeNamed('el-zone'), curveNode]) {
      expect(node).toBeDefined();
      const markup = node === undefined ? '' : bodyMarkup(node);
      expect(markup).toContain(
        `class="${canvasInteractionClassNames.boundaryHitTarget}" fill="none" ` +
          'pointer-events="stroke" stroke="transparent" stroke-width="20"',
      );
    }
  });
});

describe('CanvasEdgeBody', () => {
  const settled = 'd="M 200 100 L 240 100 L 280 120"';

  it('draws the flow from the geometry the layout resolved', () => {
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;
    expect(edgeMarkup(data, nodesWith('el-client', 0))).toContain(settled);
  });

  it('raises only the block and keeps its bounds with the line', () => {
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;
    const container = document.createElement('div');
    container.innerHTML = edgeMarkup(data);
    const lineLayer = container.querySelector('svg');
    const blockLayer = container.querySelector(
      `.${canvasInteractionClassNames.flowBlockLayer}`,
    );
    expect(
      lineLayer?.querySelector(`.${canvasClassNames.flow}`),
    ).not.toBeNull();
    expect(
      lineLayer?.querySelector(`.${canvasClassNames.flowBacking}`),
    ).toBeNull();
    expect(
      lineLayer?.querySelector('rect[pointer-events="none"]'),
    ).not.toBeNull();
    expect(blockLayer?.querySelector(`.${canvasClassNames.flow}`)).toBeNull();
    expect(
      blockLayer?.querySelector(`.${canvasClassNames.flowBacking}`),
    ).not.toBeNull();
    expect(
      blockLayer?.querySelector(`.${canvasClassNames.flowLabel}`),
    ).not.toBeNull();
  });

  it('hands block focus to the mounting canvas without adding a tab stop', () => {
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;
    edgeMarkup(data, [], false, true, (container) => {
      blockFocused.mockClear();
      const block = container.querySelector<SVGElement>(
        `.${canvasInteractionClassNames.flowBlockLayer}`,
      );
      act(() => {
        block?.focus();
      });
      expect(blockFocused).toHaveBeenCalledOnce();
      expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    });
  });

  it('draws no name while a name field is open over it', () => {
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;
    expect(edgeMarkup(data, nodesWith('el-client', 0))).toContain(
      canvasClassNames.flowLabel,
    );
    expect(
      edgeMarkup(data, nodesWith('el-client', 0), false, false),
    ).not.toContain(canvasClassNames.flowLabel);
  });

  it("adds React Flow's wider interaction path around the flow", () => {
    const markup = edgeMarkup({ edge: everyGlyphLayout.edges[0] });
    expect(markup).toContain('react-flow__edge-interaction');
    expect(markup).toContain('stroke-width="20"');
  });

  it('anchors an end on the node React Flow has, not the model position', () => {
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;
    expect(edgeMarkup(data, nodesWith('el-client', 200))).toContain(
      'd="M 120 260 L 240 100 L 280 120"',
    );
  });

  it('falls back on the settled geometry where React Flow has no node', () => {
    expect(edgeMarkup({ edge: everyGlyphLayout.edges[0] })).toContain(settled);
  });

  it('draws changed geometry from the transient layout', () => {
    const moved = {
      ...everyGlyphLayout.edges[0],
      source: { x: 120, y: 260 },
    };
    expect(edgeMarkup({ edge: moved })).toContain(
      'd="M 120 260 L 240 100 L 280 120"',
    );
  });

  it('moves a selected flow with an unrelated dragged node', () => {
    const nodes = toReactFlowNodes(everyGlyphLayout).map((node) =>
      node.id === elementId('el-note')
        ? {
            ...node,
            position: shiftedBy(node.position, { x: 40, y: 25 }),
            selected: true,
          }
        : node,
    );
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;

    expect(edgeMarkup(data, nodes, true)).toContain(
      'd="M 200 100 L 280 125 L 280 120"',
    );
  });

  it("moves a selected flow's name and badge with its group once", () => {
    const offset = { x: 40, y: 25 };
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;
    const atRest = flowLabelPlace(
      edgeMarkup(data, everyNodeSelectedAt({ x: 0, y: 0 }), true),
    );
    const moved = flowLabelPlace(
      edgeMarkup(data, everyNodeSelectedAt(offset), true),
    );

    expect(atRest).toHaveLength(4);
    expect(moved).toEqual(
      atRest.map((coordinate, index) =>
        svgNumber(Number(coordinate) + (index % 2 === 0 ? offset.x : offset.y)),
      ),
    );
  });

  it('keeps a selected flow still before its group moves', () => {
    const nodes = toReactFlowNodes(everyGlyphLayout).map((node) => ({
      ...node,
      selected: node.id === elementId('el-note'),
    }));
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;

    expect(edgeMarkup(data, nodes, true)).toContain(settled);
  });

  it('uses settled geometry while a live node has no extent', () => {
    const nodes = toReactFlowNodes(everyGlyphLayout).map((node) =>
      node.id === elementId('el-client')
        ? { ...node, width: undefined, height: undefined }
        : node,
    );
    const data = toReactFlowEdges(everyGlyphLayout)[0].data;

    expect(edgeMarkup(data, nodes)).toContain(settled);
  });

  it('draws nothing where React Flow hands it an edge with no data', () => {
    const container = document.createElement('div');
    container.innerHTML = edgeMarkup(undefined);
    expect(container.querySelector('.react-flow__edge')?.children).toHaveLength(
      0,
    );
    expect(
      container.querySelector('.react-flow__viewport-portal')?.children,
    ).toHaveLength(0);
  });
});

describe('toReactFlowNodes', () => {
  it('carries the model position and extent on the node itself', () => {
    const node = nodeNamed('el-api');
    const converted = toReactFlowNodes(everyGlyphLayout).find(
      (one: CanvasFlowNode) => one.id === node.id,
    );
    expect(converted).toEqual({
      id: node.id,
      type: 'process',
      position: node.position,
      width: node.size.width,
      height: node.size.height,
      data: { node },
      style: undefined,
      zIndex: 0,
    });
  });

  it('puts trust boundaries below every other React Flow item', () => {
    expect(toReactFlowNodes(everyGlyphLayout)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: elementId('el-zone'),
          style: { pointerEvents: 'none' },
          zIndex: -1,
        }),
        expect.objectContaining({
          id: elementId('el-client'),
          zIndex: 0,
        }),
      ]),
    );
  });

  it('carries one React Flow node per laid-out node, flows excluded', () => {
    expect(toReactFlowNodes(everyGlyphLayout)).toHaveLength(
      everyGlyphLayout.nodes.length,
    );
  });
});

const looseFlow = everyGlyphLayout.edges.find(
  (edge) => edge.sourceElement === undefined,
);

describe('CanvasFreeEndBody', () => {
  it('draws the one handle an edge end resolves from, and nothing else', () => {
    const markup = renderToStaticMarkup(
      <ReactFlowProvider>
        <CanvasFreeEndBody />
      </ReactFlowProvider>,
    );
    expect(markup).toContain('react-flow__handle');
    expect(markup).not.toContain('<svg');
  });
});

describe('toReactFlowEdges', () => {
  it('carries one edge per drawn flow, ends named by the layout', () => {
    const edges = toReactFlowEdges(everyGlyphLayout);
    expect(edges).toHaveLength(everyGlyphLayout.edges.length);
    expect(
      edges.find((edge) => edge.id === elementId('el-request')),
    ).toMatchObject({
      type: 'flow',
      source: elementId('el-client'),
      target: elementId('el-api'),
      data: { edge: everyGlyphLayout.edges[0] },
      interactionWidth: 20,
    });
  });

  it('ends a flow with a free end on the anchor of that end', () => {
    const converted = toReactFlowEdges(everyGlyphLayout).find(
      (edge) => edge.id === looseFlow?.id,
    );
    expect(looseFlow).toBeDefined();
    expect(converted?.source).toBe(
      flowEndNodeId(elementId('el-probe'), 'source'),
    );
  });
});

describe('layoutAtReactFlowNodes', () => {
  it('moves selected flow waypoints by the live group offset', () => {
    const offset = { x: 50, y: 40 };
    const movedNodes = [elementId('el-client'), elementId('el-api')];
    const nodes = toReactFlowNodes(everyGlyphLayout).map((node) =>
      node.id === movedNodes[0]
        ? { ...node, position: shiftedBy(node.position, offset) }
        : node,
    );
    const edge = everyGlyphLayout.edges[0];

    const moved = layoutAtReactFlowNodes(everyGlyphLayout, nodes, [
      ...movedNodes,
      edge.id,
    ]);

    expect(moved.edges[0].waypoints).toEqual(
      edge.waypoints.map((point) => shiftedBy(point, offset)),
    );
    expect(
      moved.nodes.find((node) => node.id === movedNodes[1])?.position,
    ).toEqual(shiftedBy(nodeNamed('el-api').position, offset));
  });

  it('ignores React Flow anchors that name no diagram node', () => {
    expect(
      layoutAtReactFlowNodes(
        everyGlyphLayout,
        [
          ...toReactFlowNodes(everyGlyphLayout),
          ...freeEndNodes(everyGlyphLayout),
        ],
        [],
      ).edges,
    ).toHaveLength(everyGlyphLayout.edges.length);
  });

  it('falls back to settled extents when React Flow has none', () => {
    const nodes = toReactFlowNodes(everyGlyphLayout).map((node) => ({
      ...node,
      measured: undefined,
      width: undefined,
      height: undefined,
    }));

    expect(
      layoutAtReactFlowNodes(everyGlyphLayout, nodes, []).nodes[0].size,
    ).toEqual(everyGlyphLayout.nodes[0].size);
  });
});

describe('freeEndNodes', () => {
  it('anchors every free end and nothing else', () => {
    const free = everyGlyphLayout.edges.flatMap((edge) => [
      ...(edge.sourceElement === undefined ? ['source'] : []),
      ...(edge.targetElement === undefined ? ['target'] : []),
    ]);
    expect(free.length).toBeGreaterThan(0);
    expect(freeEndNodes(everyGlyphLayout)).toHaveLength(free.length);
  });

  it('places an anchor where the layout put the free end, out of reach', () => {
    const anchor = freeEndNodes(everyGlyphLayout)[0];
    expect(anchor.position).toEqual(looseFlow?.source);
    expect(anchor.type).toBe(freeEndNodeKind);
    expect(anchor.selectable).toBe(false);
    expect(anchor.draggable).toBe(false);
    expect(anchor.focusable).toBe(false);
  });
});
