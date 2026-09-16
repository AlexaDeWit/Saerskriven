import type {
  Diagram,
  Element,
  ElementId,
  Flow,
  FlowEndpoint,
  Model,
  Point,
  Size,
  TrustBoundary,
} from '@saerskriven/model';
import { badgesByElement, type ThreatBadge } from './badges.js';
import { boundsOfPoints, drawnBounds, type CanvasBounds } from './bounds.js';
import {
  anchorsOf,
  flowGeometry,
  type PlacedEndpoint,
} from './flow-anchors.js';
import { flowLabelPlacements, type FlowLabelPlacement } from './flow-labels.js';
import { nodeBoxesOf, type HandleSide, type NodeBox } from './handles.js';
import { boundaryStrokeWidth } from './stylesheet.js';
import { settledCurveNames, type CurveNameSide } from './text-placement.js';

/**
 * A laid-out element: its model box, its badge, and for a boundary curve its
 * waypoints in the node's own coordinates and a box grown by the stroke
 * width, so the stroke falls inside the node.
 */
export type CanvasNode =
  | (CanvasNodeBase & { readonly kind: 'actor' })
  | (CanvasNodeBase & { readonly kind: 'process' })
  | (CanvasNodeBase & { readonly kind: 'store' })
  | (CanvasNodeBase & { readonly kind: 'text'; readonly text: string })
  | (CanvasNodeBase & { readonly kind: 'boundary-box' })
  | (CanvasNodeBase & {
      readonly kind: 'boundary-curve';
      readonly waypoints: readonly Point[];
      readonly nameSide: CurveNameSide | undefined;
    });

/** What kind of box an element takes on the canvas. */
export type CanvasNodeKind = CanvasNode['kind'];

/** A laid-out trust boundary. */
export type CanvasBoundaryNode = Extract<
  CanvasNode,
  { readonly kind: 'boundary-box' | 'boundary-curve' }
>;

/** A laid-out flow before its label is placed. */
export type CanvasEdgeGeometry = {
  readonly id: ElementId;
  readonly name: string;
  readonly outOfScope: boolean;
  readonly badge: ThreatBadge | undefined;
  readonly source: Point;
  readonly target: Point;
  readonly sourceSide: HandleSide | undefined;
  readonly targetSide: HandleSide | undefined;
  readonly sourcePin: HandleSide | undefined;
  readonly targetPin: HandleSide | undefined;
  readonly sourceElement: ElementId | undefined;
  readonly targetElement: ElementId | undefined;
  readonly waypoints: readonly Point[];
  readonly bidirectional: boolean;
};

/**
 * A flow with its ends resolved to points and its label placed.
 * `sourceSide` and `targetSide` are the sides the ends were drawn at.
 * `sourcePin` and `targetPin` are the sides the model pins them to, which a
 * move keeps while an unpinned end follows the route.
 */
export type CanvasEdge = CanvasEdgeGeometry & {
  readonly label: FlowLabelPlacement;
};

/**
 * A flow endpoint the layout could not place, because it names an element
 * the canvas draws as no box, another flow for instance. The flow is left out
 * of the layout rather than given invented geometry.
 */
export type UnplacedEndpoint = {
  readonly flow: ElementId;
  readonly side: 'source' | 'target';
  readonly element: ElementId;
};

/**
 * A diagram ready to draw: the boundaries first, so they sit behind what
 * they enclose, then the remaining nodes in diagram order, then the flows.
 * Painting `nodes` and then `edges` gives that order, since a flow ends on
 * the outline of the node it points at rather than under it. `bounds` holds
 * everything that painting draws, on the terms of {@link CanvasBounds}.
 */
export type CanvasLayout = {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
  readonly unplaced: readonly UnplacedEndpoint[];
  readonly bounds: CanvasBounds;
};

/**
 * One diagram of the model laid out. Every position and extent comes from
 * the model, and nothing is measured. Badges are read from the whole model,
 * since a threat names elements without naming a diagram.
 */
export function layoutDiagram(diagram: Diagram, model: Model): CanvasLayout {
  const badges = badgesByElement(model);
  const nodes = diagram.elements.flatMap((element) => nodesOf(element, badges));
  const boxes = nodeBoxesOf(nodes);
  const placed = diagram.elements.flatMap((element) =>
    element.kind === 'flow' ? [placeFlow(element, boxes, badges)] : [],
  );
  const ordered = settledCurveNames([
    ...nodes.filter((node) => isBoundary(node)),
    ...nodes.filter((node) => !isBoundary(node)),
  ]);
  const drawn = placed.flatMap((flow) =>
    flow.edge === undefined ? [] : [flow.edge],
  );
  const labels = flowLabelPlacements(drawn.map(flowGeometry), ordered);
  const edges = drawn.map((edge, index) => ({ ...edge, label: labels[index] }));
  return {
    nodes: ordered,
    edges,
    unplaced: placed.flatMap((flow) => flow.unplaced),
    bounds: drawnBounds(ordered, edges),
  };
}

/** Whether a laid-out node is a trust boundary. */
export function isBoundary(node: CanvasNode): node is CanvasBoundaryNode {
  return node.kind === 'boundary-box' || node.kind === 'boundary-curve';
}

/** Converts one model element into the node the canvas draws, if any. */
export function canvasNodeOf(
  element: Element,
  badge?: ThreatBadge,
): CanvasNode | undefined {
  if (element.kind === 'flow') {
    return undefined;
  }
  if (element.kind === 'trust-boundary') {
    return boundaryNode(element, badge);
  }
  const base = {
    id: element.id,
    name: element.name,
    outOfScope: element.outOfScope,
    position: element.position,
    size: element.size,
    badge,
  };
  if (element.kind === 'text') {
    return { ...base, kind: 'text', text: element.text };
  }
  return { ...base, kind: element.kind };
}

type CanvasNodeBase = {
  readonly id: ElementId;
  readonly name: string;
  readonly outOfScope: boolean;
  readonly position: Point;
  readonly size: Size;
  readonly badge: ThreatBadge | undefined;
};

type ResolvedEndpoint =
  | PlacedEndpoint
  | { readonly kind: 'unplaced'; readonly element: ElementId };

type PlacedFlow = {
  readonly edge: CanvasEdgeGeometry | undefined;
  readonly unplaced: readonly UnplacedEndpoint[];
};

function nodesOf(
  element: Element,
  badges: ReadonlyMap<ElementId, ThreatBadge>,
): CanvasNode[] {
  const node = canvasNodeOf(element, badges.get(element.id));
  return node === undefined ? [] : [node];
}

function boundaryNode(
  element: TrustBoundary,
  badge: ThreatBadge | undefined,
): CanvasNode {
  const base = {
    id: element.id,
    name: element.name,
    outOfScope: element.outOfScope,
    badge,
  };
  if (element.shape.kind === 'curve') {
    const box = boundsOfPoints(element.shape.waypoints);
    const origin = {
      x: box.x - boundaryStrokeWidth,
      y: box.y - boundaryStrokeWidth,
    };
    return {
      ...base,
      kind: 'boundary-curve',
      nameSide: undefined,
      position: origin,
      size: {
        width: box.width + boundaryStrokeWidth * 2,
        height: box.height + boundaryStrokeWidth * 2,
      },
      waypoints: element.shape.waypoints.map((point) => ({
        x: point.x - origin.x,
        y: point.y - origin.y,
      })),
    };
  }
  return {
    ...base,
    kind: 'boundary-box',
    position: element.shape.position,
    size: element.shape.size,
  };
}

function placeFlow(
  flow: Flow,
  boxes: ReadonlyMap<ElementId, NodeBox>,
  badges: ReadonlyMap<ElementId, ThreatBadge>,
): PlacedFlow {
  const source = resolveEndpoint(flow.source, boxes);
  const target = resolveEndpoint(flow.target, boxes);
  const unplaced = [
    ...unplacedOf(flow, 'source', source),
    ...unplacedOf(flow, 'target', target),
  ];
  if (source.kind === 'unplaced' || target.kind === 'unplaced') {
    return { edge: undefined, unplaced };
  }
  const sourcePin = pinOf(flow.source);
  const targetPin = pinOf(flow.target);
  const anchors = anchorsOf(
    source,
    target,
    flow.waypoints,
    sourcePin,
    targetPin,
  );
  return {
    edge: {
      id: flow.id,
      name: flow.name,
      outOfScope: flow.outOfScope,
      badge: badges.get(flow.id),
      source: anchors.source.point,
      target: anchors.target.point,
      sourceSide: anchors.source.side,
      targetSide: anchors.target.side,
      sourcePin,
      targetPin,
      sourceElement: anchors.source.element,
      targetElement: anchors.target.element,
      waypoints: flow.waypoints,
      bidirectional: flow.bidirectional,
    },
    unplaced,
  };
}

function resolveEndpoint(
  endpoint: FlowEndpoint,
  boxes: ReadonlyMap<ElementId, NodeBox>,
): ResolvedEndpoint {
  if (endpoint.kind === 'free') {
    return { kind: 'free', point: endpoint.position };
  }
  const box = boxes.get(endpoint.element);
  return box === undefined
    ? { kind: 'unplaced', element: endpoint.element }
    : { kind: 'node', element: endpoint.element, box };
}

function unplacedOf(
  flow: Flow,
  side: 'source' | 'target',
  resolved: ResolvedEndpoint,
): UnplacedEndpoint[] {
  return resolved.kind === 'unplaced'
    ? [{ flow: flow.id, side, element: resolved.element }]
    : [];
}

function pinOf(endpoint: FlowEndpoint): HandleSide | undefined {
  return endpoint.kind === 'attached' ? endpoint.side : undefined;
}
