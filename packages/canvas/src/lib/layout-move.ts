import type { ElementId, Point } from '@saerskriven/model';
import {
  anchorsOf,
  edgePoints,
  flowGeometry,
  type PlacedEndpoint,
} from './flow-anchors.js';
import type { FlowLabelPlacement } from './flow-blocks.js';
import {
  flowLabelPlacements,
  flowLabelPlacementsDuringMove,
  movedFlowLabel,
} from './flow-labels.js';
import { sameCoordinate, shiftedBy } from './geometry.js';
import { sameNodeBox, type NodeBox } from './handles.js';
import type {
  CanvasEdge,
  CanvasEdgeGeometry,
  CanvasLayout,
  CanvasNode,
} from './layout.js';

/**
 * A settled layout with its nodes at the boxes React Flow holds during a
 * gesture. A flow in `moving` shifts its waypoints and free ends by `offset`,
 * and a flow on a box that changed re-anchors its attached ends. With
 * `exactLabels` every block is placed afresh, as the settled layout places
 * it. Without it, a flow whose shape changed and that is not in `moving` is
 * placed by the same rules clear of the other blocks, and every other flow
 * keeps its block, carried along its path from the edge in `labelBases` or
 * else the settled one. An edge
 * whose geometry and label are unchanged comes back as the settled object,
 * and the bounds stay the settled ones.
 */
export function layoutDuringMove(
  layout: CanvasLayout,
  boxes: ReadonlyMap<ElementId, NodeBox>,
  moving: ReadonlySet<ElementId>,
  offset: Point,
  exactLabels = true,
  labelBases: ReadonlyMap<string, CanvasEdge> = new Map(),
): CanvasLayout {
  const { nodes, changed } = movedNodes(layout.nodes, boxes);
  const affected = affectedFlowIds(layout.edges, moving, offset, changed);
  const geometry = layout.edges.map((edge) =>
    affected.has(edge.id) ? movedGeometry(edge, boxes, moving, offset) : edge,
  );
  const flows = geometry.map(flowGeometry);
  const labels = exactLabels
    ? flowLabelPlacements(flows, nodes)
    : flowLabelPlacementsDuringMove(
        flows,
        nodes,
        retainedLabels(layout.edges, geometry, labelBases),
        reshapedFlowIds(layout.edges, geometry, moving, affected),
      );
  const edges = geometry.map((edge, index) => {
    const settled = layout.edges[index];
    return edge === settled && sameFlowLabel(labels[index], settled.label)
      ? settled
      : { ...edge, label: labels[index] };
  });
  return {
    nodes,
    edges,
    unplaced: layout.unplaced,
    bounds: layout.bounds,
  };
}

/** Whether `to` keeps the block `from` held, carried along its new path. */
export function flowLabelFollows(from: CanvasEdge, to: CanvasEdge): boolean {
  return sameFlowLabel(flowWithFollowedLabel(from, to).label, to.label);
}

/** The new flow geometry with its prior block carried onto it. */
export function flowWithFollowedLabel(
  from: CanvasEdge,
  to: CanvasEdge,
): CanvasEdge {
  return {
    ...to,
    label: movedFlowLabel(from.label, edgePoints(from), edgePoints(to)),
  };
}

/**
 * A flow re-anchored to the boxes its ends are on, its waypoints and free
 * ends shifted first by `flowOffset`. An end with no box keeps its point. The
 * block follows its segment from `edge` to the re-anchored path, without
 * the diagram-wide search, so it moves with the path once.
 */
export function reanchoredFlow(
  edge: CanvasEdge,
  sourceBox: NodeBox | undefined,
  targetBox: NodeBox | undefined,
  flowOffset: Point = { x: 0, y: 0 },
): CanvasEdge {
  const shifted =
    flowOffset.x === 0 && flowOffset.y === 0
      ? edge
      : shiftedFlow(edge, flowOffset);
  const anchored = reanchoredGeometry(shifted, sourceBox, targetBox);
  return {
    ...anchored,
    label: movedFlowLabel(edge.label, edgePoints(edge), edgePoints(anchored)),
  };
}

function movedNodes(
  nodes: readonly CanvasNode[],
  boxes: ReadonlyMap<ElementId, NodeBox>,
): { readonly nodes: CanvasNode[]; readonly changed: Set<ElementId> } {
  const changed = new Set<ElementId>();
  const moved = nodes.map((node) => {
    const box = boxes.get(node.id);
    if (box === undefined || sameNodeBox(box, node)) {
      return node;
    }
    changed.add(node.id);
    return { ...node, position: box.position, size: box.size };
  });
  return { nodes: moved, changed };
}

function affectedFlowIds(
  edges: readonly CanvasEdge[],
  moving: ReadonlySet<ElementId>,
  offset: Point,
  changed: ReadonlySet<ElementId>,
): Set<ElementId> {
  return new Set(
    edges.flatMap((edge) =>
      (moving.has(edge.id) && (offset.x !== 0 || offset.y !== 0)) ||
      (edge.sourceElement !== undefined && changed.has(edge.sourceElement)) ||
      (edge.targetElement !== undefined && changed.has(edge.targetElement))
        ? [edge.id]
        : [],
    ),
  );
}

function movedGeometry(
  edge: CanvasEdge,
  boxes: ReadonlyMap<ElementId, NodeBox>,
  moving: ReadonlySet<ElementId>,
  offset: Point,
): CanvasEdgeGeometry {
  const shifted = moving.has(edge.id) ? shiftedFlow(edge, offset) : edge;
  return reanchoredGeometry(
    shifted,
    shifted.sourceElement === undefined
      ? undefined
      : boxes.get(shifted.sourceElement),
    shifted.targetElement === undefined
      ? undefined
      : boxes.get(shifted.targetElement),
  );
}

function retainedLabels(
  settled: readonly CanvasEdge[],
  geometry: readonly CanvasEdgeGeometry[],
  labelBases: ReadonlyMap<string, CanvasEdge>,
): Map<ElementId, FlowLabelPlacement> {
  return new Map(
    geometry.map((edge, index) => {
      const base = labelBases.get(edge.id) ?? settled[index];
      return [
        edge.id,
        edge === base
          ? base.label
          : movedFlowLabel(base.label, edgePoints(base), edgePoints(edge)),
      ];
    }),
  );
}

function reshapedFlowIds(
  settled: readonly CanvasEdge[],
  geometry: readonly CanvasEdgeGeometry[],
  moving: ReadonlySet<ElementId>,
  affected: ReadonlySet<ElementId>,
): Set<ElementId> {
  return new Set(
    geometry.flatMap((edge, index) =>
      affected.has(edge.id) &&
      !moving.has(edge.id) &&
      !flowIsTranslation(settled[index], edge)
        ? [edge.id]
        : [],
    ),
  );
}

function reanchoredGeometry(
  edge: CanvasEdgeGeometry,
  sourceBox: NodeBox | undefined,
  targetBox: NodeBox | undefined,
): CanvasEdgeGeometry {
  const anchors = anchorsOf(
    endpointAt(sourceBox, edge.source, edge.sourceElement),
    endpointAt(targetBox, edge.target, edge.targetElement),
    edge.waypoints,
    edge.sourcePin,
    edge.targetPin,
  );
  return {
    ...edge,
    source: anchors.source.point,
    target: anchors.target.point,
    sourceSide: anchors.source.side ?? edge.sourceSide,
    targetSide: anchors.target.side ?? edge.targetSide,
  };
}

function endpointAt(
  box: NodeBox | undefined,
  settled: Point,
  element: ElementId | undefined,
): PlacedEndpoint {
  return box === undefined || element === undefined
    ? { kind: 'free', point: settled }
    : { kind: 'node', element, box };
}

function shiftedFlow(
  edge: CanvasEdgeGeometry,
  offset: Point,
): CanvasEdgeGeometry {
  return {
    ...edge,
    source:
      edge.sourceElement === undefined
        ? shiftedBy(edge.source, offset)
        : edge.source,
    target:
      edge.targetElement === undefined
        ? shiftedBy(edge.target, offset)
        : edge.target,
    waypoints: edge.waypoints.map((point) => shiftedBy(point, offset)),
  };
}

function flowIsTranslation(
  from: CanvasEdgeGeometry,
  to: CanvasEdgeGeometry,
): boolean {
  const oldPoints = edgePoints(from);
  const newPoints = edgePoints(to);
  const offset = {
    x: newPoints[0].x - oldPoints[0].x,
    y: newPoints[0].y - oldPoints[0].y,
  };
  return oldPoints.every((point, index) => {
    const moved = newPoints[index];
    return (
      sameCoordinate(moved.x, point.x + offset.x) &&
      sameCoordinate(moved.y, point.y + offset.y)
    );
  });
}

function sameFlowLabel(
  one: FlowLabelPlacement,
  other: FlowLabelPlacement,
): boolean {
  return (
    one.name.text === other.name.text &&
    samePoint(one.name.at, other.name.at) &&
    one.name.anchor === other.name.anchor &&
    one.name.width === other.name.width &&
    one.name.textStyle === other.name.textStyle &&
    sameWhereHeld(one.badge, other.badge, samePoint) &&
    sameWhereHeld(one.backing, other.backing, (box, held) =>
      samePoint({ x: box.minX, y: box.minY }, { x: held.minX, y: held.minY }),
    )
  );
}

function samePoint(one: Point, other: Point): boolean {
  return sameCoordinate(one.x, other.x) && sameCoordinate(one.y, other.y);
}

function sameWhereHeld<T>(
  one: T | undefined,
  other: T | undefined,
  same: (one: T, other: T) => boolean,
): boolean {
  return one === undefined || other === undefined
    ? one === other
    : same(one, other);
}
