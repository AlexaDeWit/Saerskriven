import {
  layoutAtReactFlowNodes,
  layoutDiagram,
  type CanvasFlowEdge,
  type FlowLabelPlacement,
} from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
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
const endSize = { width: 120, height: 60 };
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
  const at = labelled.label.name.at;
  const beyond = at.y < labelled.source.y;
  return {
    x: at.x - drifterSize.width / 2,
    y: beyond ? at.y - drifterSize.height + overlap : at.y - overlap,
  };
};

const dragTo = (at: Point): NodeChange<DiagramNode>[] => [
  { id: drifter, type: 'position', position: at, dragging: true },
];

const labelsOf = (edges: readonly CanvasFlowEdge[]): FlowLabelPlacement[] =>
  edges.flatMap((edge) =>
    edge.data === undefined ? [] : [edge.data.edge.label],
  );

beforeEach(() => {
  openCanvas(moving, model);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useLiveEdges', () => {
  it('lays every flow out in full once the pointer pauses', () => {
    const graph = diagramGraph(layout, model, moving, t);
    const at = onto();
    const paused = layoutAtReactFlowNodes(
      layout,
      graph.nodes.map((node) =>
        node.id === drifter ? { ...node, position: at } : node,
      ),
      moving,
    );
    expect(
      paused.edges.map((edge) => edge.label),
      'the drifter covers a label the full search then moves',
    ).not.toEqual(settled);

    const { result } = renderHook(() =>
      useLiveEdges(layout, graph, moving, elements, positions),
    );
    act(() => {
      result.current.onNodesChange(dragTo(at));
    });

    expect(labelsOf(result.current.edges)).toEqual(settled);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(labelsOf(result.current.edges)).toEqual(
      paused.edges.map((edge) => edge.label),
    );
  });
});
