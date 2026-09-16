import type { ElementId, Point } from '@saerskriven/model';
import {
  anchorsOf,
  edgePoints,
  flowGeometry,
  type PlacedEndpoint,
} from './flow-anchors.js';
import {
  flowLabelPlacements,
  flowLabelPlacementsDuringMove,
  movedFlowLabel,
  type FlowLabelPlacement,
} from './flow-labels.js';
import { shiftedBy } from './geometry.js';
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
 * `exactLabels` every label goes through the full search. Without it, a flow
 * whose shape changed and that is not in `moving` takes the clear candidate
 * nearest its midpoint, and every other flow keeps its label, carried along
 * its path from the edge in `labelBases` or else the settled one. An edge
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

/** Whether `to` keeps the label candidate that `from` used on its old path. */
export function flowLabelFollows(from: CanvasEdge, to: CanvasEdge): boolean {
  return sameFlowLabel(flowWithFollowedLabel(from, to).label, to.label);
}

/** The new flow geometry with its prior label candidate moved onto it. */
export function flowWithFollowedLabel(
  from: CanvasEdge,
  to: CanvasEdge,
): CanvasEdge {
  return {
    ...to,
    label: movedFlowLabel(
      from.label,
      from.badge,
      edgePoints(from),
      edgePoints(to),
    ),
  };
}

/**
 * A flow re-anchored to the boxes its ends are on, shifted first by
 * `flowOffset`. An end with no box keeps its point. The label and badge
 * follow their segment without the diagram-wide search.
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
    label: movedFlowLabel(
      shifted.label,
      shifted.badge,
      edgePoints(shifted),
      edgePoints(anchored),
    ),
  };
}

const layoutCoordinateTolerance = 1e-6;

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
          : movedFlowLabel(
              base.label,
              base.badge,
              edgePoints(base),
              edgePoints(edge),
            ),
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

function shiftedFlow(edge: CanvasEdge, offset: Point): CanvasEdge {
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
    label: {
      name: {
        ...edge.label.name,
        at: shiftedBy(edge.label.name.at, offset),
      },
      badge:
        edge.label.badge === undefined
          ? undefined
          : shiftedBy(edge.label.badge, offset),
    },
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
    sameCoordinate(one.name.at.x, other.name.at.x) &&
    sameCoordinate(one.name.at.y, other.name.at.y) &&
    one.name.anchor === other.name.anchor &&
    one.name.width === other.name.width &&
    one.name.textStyle === other.name.textStyle &&
    ((one.badge === undefined && other.badge === undefined) ||
      (one.badge !== undefined &&
        other.badge !== undefined &&
        sameCoordinate(one.badge.x, other.badge.x) &&
        sameCoordinate(one.badge.y, other.badge.y)))
  );
}

function sameCoordinate(one: number, other: number): boolean {
  return Math.abs(one - other) <= layoutCoordinateTolerance;
}
