import {
  freeEndNodes,
  flowWithFollowedLabel,
  isBoundary,
  toReactFlowEdges,
  toReactFlowNodes,
  type CanvasEdge,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasFreeEndNode,
  type CanvasLayout,
  type CanvasNode,
} from '@saerskriven/canvas';
import type { ElementId, Model } from '@saerskriven/model';
import { flowEnds } from './elements.js';
import type { StudioTranslator } from '../messages/catalogues.js';
import { accessibleNames } from './names.js';

/** Every node the canvas mounts: an element's own, or a free end's anchor. */
export type DiagramNode = CanvasFlowNode | CanvasFreeEndNode;

/** What the canvas hands React Flow: the diagram's nodes and its flows. */
export type DiagramGraph = {
  readonly nodes: DiagramNode[];
  readonly edges: CanvasFlowEdge[];
};

/**
 * The laid-out diagram as React Flow takes it, each element carrying its
 * accessible name, its selection and whether a flow can end on it, followed
 * by the free-end anchors. Every object is new on each call. `layout` must be
 * laid out from `model`.
 */
export function diagramGraph(
  layout: CanvasLayout,
  model: Model,
  selection: readonly ElementId[],
  t: StudioTranslator['t'],
): DiagramGraph {
  const names = accessibleNames(layout, model, t);
  const ends = new Set<string>(flowEnds(layout).map((node) => node.id));
  const selected = new Set<string>(selection);
  return {
    nodes: [
      ...toReactFlowNodes(layout).map((node) => {
        const isSelected = selected.has(node.id);
        return {
          ...node,
          selected: isSelected,
          connectable: ends.has(node.id),
          ariaLabel: names.get(node.id),
          zIndex: isSelected && !isBoundary(node.data.node) ? 1 : node.zIndex,
        };
      }),
      ...freeEndNodes(layout),
    ],
    edges: toReactFlowEdges(layout).map((edge) => ({
      ...edge,
      selected: selected.has(edge.id),
      ariaLabel: names.get(edge.id),
    })),
  };
}

/** Every node the layout drew, keyed by the id React Flow knows it by. */
export function nodesById(
  layout: CanvasLayout,
): ReadonlyMap<string, CanvasNode> {
  return new Map(layout.nodes.map((node) => [node.id, node]));
}

/** Every element the layout drew, node or flow, keyed by React Flow id. A free end's anchor is not in it. */
export function elementIds(
  layout: CanvasLayout,
): ReadonlyMap<string, ElementId> {
  return new Map<string, ElementId>([
    ...layout.nodes.map((node) => [node.id, node.id] as const),
    ...layout.edges.map((edge) => [edge.id, edge.id] as const),
  ]);
}

/** Every laid-out flow keyed by its model id. */
export function canvasEdgesById(
  layout: CanvasLayout,
): ReadonlyMap<string, CanvasEdge> {
  return new Map(layout.edges.map((edge) => [edge.id, edge]));
}

/**
 * The nodes the model gives, carrying the extents React Flow measured for
 * those already on screen. React Flow drops a flow's ends until a node handed
 * without a measurement is measured again.
 */
export function withMeasurements(
  nodes: readonly DiagramNode[],
  onScreen: readonly DiagramNode[],
): DiagramNode[] {
  const measured = new Map(onScreen.map((node) => [node.id, node.measured]));
  return nodes.map((node) => {
    const extent = measured.get(node.id);
    return extent === undefined ? node : { ...node, measured: extent };
  });
}

/** Replaces only the React Flow edges whose transient geometry changed. */
export function withLiveEdges(
  edges: readonly CanvasFlowEdge[],
  layout: CanvasLayout,
): CanvasFlowEdge[] {
  const live = canvasEdgesById(layout);
  const boxes = new Map(
    layout.nodes.map((node) => [
      node.id,
      { position: node.position, size: node.size },
    ]),
  );
  return edges.map((edge) => {
    const next = live.get(edge.id);
    const current = edge.data?.edge;
    if (next === undefined || next === current) {
      return edge;
    }
    const shown =
      edge.selected && current !== undefined
        ? flowWithFollowedLabel(current, next)
        : next;
    return {
      ...edge,
      data: {
        edge: shown,
        boxes,
        sourceBox:
          shown.sourceElement === undefined
            ? undefined
            : boxes.get(shown.sourceElement),
        targetBox:
          shown.targetElement === undefined
            ? undefined
            : boxes.get(shown.targetElement),
      },
    };
  });
}
