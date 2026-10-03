import {
  layoutAtReactFlowNodes,
  layoutDiagram,
  type CanvasEdge,
  type CanvasFlowEdge,
  type FlowLabelPlacement,
} from '@saerskriven/canvas';
import type { Point, Size } from '@saerskriven/model';
import {
  boxAt,
  elementId,
  flowFrom,
  modelWith,
} from '@saerskriven/model/fixtures';
import { act, renderHook } from '@testing-library/react';
import type { NodeChange } from '@xyflow/react';
import { activeTranslator } from '../messages/locale.js';
import { openCanvas } from './canvas.fixtures.js';
import { useLiveEdges } from './live-edges.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  type DiagramNode,
} from './nodes.js';

const { t } = activeTranslator();

const drifter = elementId('el-drifter');
const drifterSize = { width: 120, height: 80 };
const source = elementId('el-source');
const endSize = { width: 120, height: 60 };
const grown = { width: 200, height: endSize.height };
const measured = { width: endSize.width + 1, height: endSize.height };
const overlap = 5;

const model = modelWith({
  elements: [
    boxAt('el-source', 0, 0, 'actor', endSize),
    boxAt('el-target', 600, 0, 'actor', endSize),
    flowFrom('el-flow', 'el-source', 'el-target', 'a flow with room'),
    boxAt('el-drifter', 0, 600, 'actor', drifterSize),
  ],
});

const layout = layoutDiagram(model.diagrams[0], model);
const moving = [drifter];
const elements = elementIds(layout);
const positions = nodesById(layout);
const labelled = layout.edges[0];
const settled = layout.edges.map((edge) => edge.label);

const onto = (): Point => {
  const block = labelled.label.backing ?? {
    minX: labelled.label.name.at.x,
    minY: labelled.label.name.at.y,
    maxX: labelled.label.name.at.x,
    maxY: labelled.label.name.at.y,
  };
  return {
    x: (block.minX + block.maxX) / 2 - drifterSize.width / 2,
    y: block.maxY - overlap,
  };
};

const dragTo = (at: Point, dragging = true): NodeChange<DiagramNode>[] => [
  { id: drifter, type: 'position', position: at, dragging },
];

const sized = (size: Size, resizing: boolean): NodeChange<DiagramNode>[] => [
  { id: source, type: 'dimensions', dimensions: size, resizing },
];

const flowsOf = (edges: readonly CanvasFlowEdge[]): CanvasEdge[] =>
  edges.flatMap((edge) => (edge.data === undefined ? [] : [edge.data.edge]));

const labelsOf = (edges: readonly CanvasFlowEdge[]): FlowLabelPlacement[] =>
  flowsOf(edges).map((edge) => edge.label);

beforeEach(() => {
  openCanvas(moving, model);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useLiveEdges', () => {
  const graph = diagramGraph(layout, model, moving, t);
  const at = onto();
  const dropped = layoutAtReactFlowNodes(
    layout,
    graph.nodes.map((node) =>
      node.id === drifter ? { ...node, position: at } : node,
    ),
    moving,
  );

  it('keeps the block of a flow outside the drag where it was, pause or no pause', () => {
    expect(
      dropped.edges.map((edge) => edge.label),
      'the drifter covers a block the settled placement then moves',
    ).not.toEqual(settled);

    const { result } = renderHook(() =>
      useLiveEdges(layout, graph, moving, elements, positions),
    );
    act(() => {
      result.current.onNodesChange(dragTo(at));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(labelsOf(result.current.edges)).toEqual(settled);
  });

  it('places every block afresh once the drag ends', () => {
    const { result } = renderHook(() =>
      useLiveEdges(layout, graph, moving, elements, positions),
    );
    act(() => {
      result.current.onNodesChange(dragTo(at));
    });
    act(() => {
      result.current.onNodesChange(dragTo(at, false));
    });

    expect(labelsOf(result.current.edges)).toEqual(
      dropped.edges.map((edge) => edge.label),
    );
  });

  it('lays the flows out at the resized extent once a resize ends', () => {
    const resized = layoutAtReactFlowNodes(
      layout,
      graph.nodes.map((node) =>
        node.id === source ? { ...node, measured: grown } : node,
      ),
      [source],
    );
    expect(
      resized.edges,
      'the resize moves the end of the flow on the resized element',
    ).not.toEqual(layout.edges);

    const { result } = renderHook(() =>
      useLiveEdges(layout, graph, moving, elements, positions),
    );
    act(() => {
      result.current.rebase();
      result.current.onNodesChange(sized(grown, true));
    });
    act(() => {
      result.current.onNodesChange(sized(grown, false));
    });

    expect(flowsOf(result.current.edges)).toEqual(resized.edges);
  });

  it('keeps every flow where it was when React Flow ends a resize it never began', () => {
    const { result } = renderHook(() =>
      useLiveEdges(layout, graph, moving, elements, positions),
    );
    act(() => {
      result.current.rebase();
      result.current.onNodesChange(sized(measured, false));
    });

    expect(flowsOf(result.current.edges)).toEqual(layout.edges);
  });

  it('forgets a resize that never ended once the nodes fold back, so a later end re-lays nothing', () => {
    const { result, rerender } = renderHook(
      (drawn) => useLiveEdges(layout, drawn, moving, elements, positions),
      { initialProps: graph },
    );
    act(() => {
      result.current.rebase();
      result.current.onNodesChange(sized(grown, true));
    });
    rerender(diagramGraph(layout, model, [], t));
    act(() => {
      result.current.rebase();
      result.current.onNodesChange(sized(measured, false));
    });

    expect(flowsOf(result.current.edges)).toEqual(layout.edges);
  });
});
