import {
  flowLabelFollows,
  layoutAtReactFlowNodes,
  type CanvasEdge,
  type CanvasFlowEdge,
  type CanvasLayout,
  type CanvasNode,
} from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import { applyNodeChanges, type NodeChange } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { applyChanges, gestureSelection } from './changes.js';
import {
  canvasEdgesById,
  withLiveEdges,
  withMeasurements,
  type DiagramGraph,
  type DiagramNode,
} from './nodes.js';

const exactLabelDelay = 50;

/**
 * The nodes React Flow draws and the flows laid out against them while a drag
 * or resize is in flight. A flow is laid out again on each change only where
 * its label no longer follows its segment, and in full once the pointer
 * pauses for `exactLabelDelay` milliseconds and once the gesture ends. The
 * nodes fold back onto the model's own as soon as the model moves. `rebase`
 * takes the settled layout's flows as the base for the next gesture.
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
  const [moving, setMoving] = useState(false);
  const edgeBases = useRef<ReadonlyMap<string, CanvasEdge>>(new Map());
  const pause = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const movingElements = useRef<readonly ElementId[]>(selection);

  if (folded !== graph.nodes) {
    setFolded(graph.nodes);
    setOnScreen(withMeasurements(graph.nodes, onScreen));
    setExactEdges(undefined);
  }

  useEffect(() => {
    if (!moving) {
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      const paused = layoutAtReactFlowNodes(
        layout,
        onScreen,
        movingElements.current,
      );
      setExactEdges(withLiveEdges(graph.edges, paused));
      edgeBases.current = canvasEdgesById(paused);
    }, exactLabelDelay);
    pause.current = timer;
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [graph.edges, layout, moving, onScreen]);

  return {
    nodes: onScreen,
    edges: exactEdges ?? graph.edges,
    rebase: (): void => {
      edgeBases.current = canvasEdgesById(layout);
    },
    onNodesChange: (changes: NodeChange<DiagramNode>[]): void => {
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
        globalThis.clearTimeout(pause.current);
        movingElements.current = gestureSelection(
          changes,
          positions,
          selection,
        );
        setMoving(active);
        const live = layoutAtReactFlowNodes(
          layout,
          next,
          movingElements.current,
          finished,
          edgeBases.current,
        );
        const candidateChanged = live.edges.some((edge) => {
          const base = edgeBases.current.get(edge.id);
          return (
            base === undefined ||
            (base !== edge && !flowLabelFollows(base, edge))
          );
        });
        if (finished || candidateChanged) {
          setExactEdges(withLiveEdges(graph.edges, live));
          edgeBases.current = canvasEdgesById(live);
        }
      }
      applyChanges(changes, elements, positions);
    },
  };
}
