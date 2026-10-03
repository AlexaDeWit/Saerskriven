import {
  flowLabelFollows,
  layoutAtReactFlowNodes,
  type CanvasEdge,
  type CanvasFlowEdge,
  type CanvasLayout,
  type CanvasNode,
  type GestureInput,
} from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import { applyNodeChanges, type NodeChange } from '@xyflow/react';
import { useRef, useState } from 'react';
import { applyChanges, gestureSelection } from './changes.js';
import {
  canvasEdgesById,
  withLiveEdges,
  withMeasurements,
  type DiagramGraph,
  type DiagramNode,
} from './nodes.js';

/**
 * The nodes React Flow draws and the flows laid out against them while a drag
 * or resize is in flight. On each change a flow whose block no longer follows
 * its segment is placed again, clear of the blocks every other flow keeps
 * where it was, and every block is placed afresh once the gesture ends. The
 * nodes fold back onto the model's own as soon as the model moves. `rebase`
 * takes the settled layout's flows as the base for the next gesture, and
 * `onNodesChange` is told what made the gesture its changes report.
 */
export function useLiveEdges(
  layout: CanvasLayout,
  graph: DiagramGraph,
  selection: readonly ElementId[],
  elements: ReadonlyMap<string, ElementId>,
  positions: ReadonlyMap<string, CanvasNode>,
) {
  const [onScreen, setOnScreen] = useState<DiagramNode[]>(graph.nodes);
  const [folded, setFolded] = useState<DiagramNode[]>(graph.nodes);
  const [exactEdges, setExactEdges] = useState<CanvasFlowEdge[] | undefined>();
  const edgeBases = useRef<ReadonlyMap<string, CanvasEdge>>(new Map());

  if (folded !== graph.nodes) {
    setFolded(graph.nodes);
    setOnScreen(withMeasurements(graph.nodes, onScreen));
    setExactEdges(undefined);
  }

  return {
    nodes: onScreen,
    edges: exactEdges ?? graph.edges,
    rebase: (): void => {
      edgeBases.current = canvasEdgesById(layout);
    },
    onNodesChange: (
      changes: NodeChange<DiagramNode>[],
      input: GestureInput,
    ): void => {
      const next = applyNodeChanges(changes, onScreen);
      setOnScreen(next);
      const active = changes.some(
        (change) =>
          (change.type === 'position' && change.dragging === true) ||
          (change.type === 'dimensions' && change.resizing === true),
      );
      const finished = changes.some(
        (change) =>
          (change.type === 'position' && change.dragging === false) ||
          (change.type === 'dimensions' && change.resizing === false),
      );
      if (active || finished) {
        const live = layoutAtReactFlowNodes(
          layout,
          next,
          gestureSelection(changes, positions, selection),
          finished,
          edgeBases.current,
        );
        const blockReplaced = live.edges.some((edge) => {
          const base = edgeBases.current.get(edge.id);
          return (
            base === undefined ||
            (base !== edge && !flowLabelFollows(base, edge))
          );
        });
        if (finished || blockReplaced) {
          setExactEdges(withLiveEdges(graph.edges, live));
          edgeBases.current = canvasEdgesById(live);
        }
      }
      applyChanges(changes, elements, positions, input);
    },
  };
}
