import {
  layoutAtReactFlowNodes,
  layoutDiagram,
  type CanvasFlowEdge,
  type FlowLabelPlacement,
} from '@saerskriven/canvas';
import { act, renderHook } from '@testing-library/react';
import type { NodeChange } from '@xyflow/react';
import { activeTranslator } from '../messages/locale.js';
import { canvasModel, noteElement, openCanvas } from './canvas.fixtures.js';
import { useLiveEdges } from './live-edges.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  type DiagramNode,
} from './nodes.js';

const { t } = activeTranslator();
const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);
const moving = [noteElement];
const elements = elementIds(layout);
const positions = nodesById(layout);

const labelsOf = (edges: readonly CanvasFlowEdge[]): FlowLabelPlacement[] =>
  edges.flatMap((edge) =>
    edge.data === undefined ? [] : [edge.data.edge.label],
  );

const onto = (): { readonly x: number; readonly y: number } => {
  const covered = layout.edges[0].label.name.at;
  const note = layout.nodes.find((node) => node.id === noteElement);
  assert.isDefined(note, 'the layout draws the note');
  return {
    x: covered.x - note.size.width / 2,
    y: covered.y - note.size.height / 2,
  };
};

const dragTo = (at: {
  readonly x: number;
  readonly y: number;
}): NodeChange<DiagramNode>[] => [
  { id: noteElement, type: 'position', position: at, dragging: true },
];

beforeEach(() => {
  openCanvas(moving);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useLiveEdges', () => {
  it('lays every flow out in full once the pointer pauses', () => {
    const graph = diagramGraph(layout, canvasModel, moving, t);
    const at = onto();
    const settled = layout.edges.map((edge) => edge.label);
    const paused = layoutAtReactFlowNodes(
      layout,
      graph.nodes.map((node) =>
        node.id === noteElement ? { ...node, position: at } : node,
      ),
      moving,
    );
    expect(
      paused.edges.map((edge) => edge.label),
      'the note covers a label the full search then moves',
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
