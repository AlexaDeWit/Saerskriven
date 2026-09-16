import type { ElementId, Point } from '@saerskriven/model';
import {
  BaseEdge,
  Handle,
  Position,
  useInternalNode,
  useStore,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { ReactElement } from 'react';
import { badgeAnchor, ThreatBadgeGlyph } from './badges.js';
import { edgePoints } from './flow-anchors.js';
import { shiftedBy } from './geometry.js';
import { ElementGlyph, FlowGlyph } from './glyphs.js';
import {
  handleSides,
  nodeBoxesOf,
  type HandleSide,
  type NodeBox,
} from './handles.js';
import { layoutDuringMove, reanchoredFlow } from './layout-move.js';
import {
  isBoundary,
  type CanvasBoundaryNode,
  type CanvasEdge,
  type CanvasLayout,
  type CanvasNode,
  type CanvasNodeKind,
} from './layout.js';
import { svgNumber } from './numbers.js';
import { polylinePath, smoothPath } from './paths.js';
import { ResizeControls } from './resize-controls.js';
import { canvasClassNames } from './stylesheet.js';
import { interactionWidths } from './tokens.js';

/** What a React Flow node of a diagram carries: the laid-out node. */
export type CanvasNodeData = { readonly node: CanvasNode };

/** One React Flow node of a Saerskriven diagram. */
export type CanvasFlowNode = Node<CanvasNodeData, CanvasNodeKind>;

/** What a React Flow edge of a diagram carries: the laid-out flow. */
export type CanvasEdgeData = {
  readonly edge: CanvasEdge;
  readonly boxes?: ReadonlyMap<ElementId, NodeBox>;
  readonly sourceBox?: NodeBox;
  readonly targetBox?: NodeBox;
};

/** One React Flow edge of a Saerskriven diagram. */
export type CanvasFlowEdge = Edge<CanvasEdgeData, 'flow'>;

/** The React Flow node type of the anchor a flow's free end rides on. */
export const freeEndNodeKind = 'free-end';

/** Which end of a flow an anchor stands for. */
export type FlowEndSide = 'source' | 'target';

/** What a free-end anchor carries: nothing, since it draws nothing. */
export type CanvasFreeEndData = Record<string, never>;

/** One React Flow node standing in for a flow's free end. */
export type CanvasFreeEndNode = Node<CanvasFreeEndData, typeof freeEndNodeKind>;

/**
 * One element as a React Flow node: the shared glyph at the model's own size
 * and a `source` handle at each side midpoint, so the canvas mounting it
 * passes `connectionMode={ConnectionMode.Loose}` for a flow to end on one.
 * The drawing is hidden from assistive technology, so the mounting canvas
 * gives the node its accessible name. `textVisible` false leaves the glyph's
 * text out, for a canvas with a text editor over it. A selected element the
 * model can resize carries the resize controls. The badge draws last, in an
 * SVG layer classed `pn-badge-layer`, so a canvas can stack it above the
 * selection frame.
 */
export function CanvasNodeBody({
  controlsVisible = true,
  data,
  height,
  isConnectable,
  onResize,
  onResizeEnd,
  resizing = false,
  selected,
  textVisible = true,
  width,
}: NodeProps<CanvasFlowNode> & {
  readonly controlsVisible?: boolean;
  readonly onResize?: () => void;
  readonly onResizeEnd?: (box: NodeBox) => void;
  readonly resizing?: boolean;
  readonly textVisible?: boolean;
}): ReactElement {
  const shownSize = resizing
    ? {
        width: width ?? data.node.size.width,
        height: height ?? data.node.size.height,
      }
    : data.node.size;
  const shownNode =
    shownSize.width === data.node.size.width &&
    shownSize.height === data.node.size.height
      ? data.node
      : { ...data.node, size: shownSize };
  return (
    <>
      <svg
        width={svgNumber(shownSize.width)}
        height={svgNumber(shownSize.height)}
        style={{ display: 'block' }}
        overflow="visible"
        aria-hidden="true"
      >
        {isBoundary(shownNode) ? <BoundaryHitTarget node={shownNode} /> : null}
        <ElementGlyph
          badgeVisible={false}
          node={shownNode}
          textVisible={textVisible}
        />
      </svg>
      {handleSides.map((side) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={handlePlacement[side]}
          isConnectable={isConnectable}
          style={controlsVisible ? undefined : { visibility: 'hidden' }}
        />
      ))}
      {selected && resizableKinds.has(data.node.kind) ? (
        <ResizeControls
          node={data.node}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
          visible={controlsVisible}
        />
      ) : null}
      <BadgeLayer node={shownNode} />
    </>
  );
}

/**
 * One flow from the transient layout a controlled canvas supplies. During a
 * drag it follows the live endpoint boxes and translates selected flow
 * geometry by the shared group offset. `textVisible` false leaves the name
 * out, as on {@link CanvasNodeBody}.
 */
export function CanvasEdgeBody({
  data,
  interactionWidth,
  selected,
  source,
  target,
  textVisible = true,
}: EdgeProps<CanvasFlowEdge> & {
  readonly textVisible?: boolean;
}): ReactElement | null {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const groupMovement = useStore((state) => {
    if (!selected || data?.boxes === undefined) {
      return '0,0';
    }
    for (const [id, settled] of data.boxes) {
      const node = state.nodeLookup.get(id);
      if (node?.selected !== true) {
        continue;
      }
      const x = node.internals.positionAbsolute.x - settled.position.x;
      const y = node.internals.positionAbsolute.y - settled.position.y;
      if (x !== 0 || y !== 0) {
        return `${String(x)},${String(y)}`;
      }
    }
    return '0,0';
  });
  if (data === undefined) {
    return null;
  }
  const [x = 0, y = 0] = groupMovement.split(',').map(Number);
  const offset = { x, y };
  const edge = reanchoredFlow(
    data.edge,
    liveBox(data.sourceBox, sourceNode, offset),
    liveBox(data.targetBox, targetNode, offset),
    offset,
  );
  const path = polylinePath(edgePoints(edge));
  return (
    <>
      <BaseEdge
        path={path}
        interactionWidth={interactionWidth ?? interactionWidths.flow}
        strokeOpacity={0}
      />
      <g aria-hidden="true">
        <FlowGlyph edge={edge} textVisible={textVisible} />
      </g>
    </>
  );
}

/**
 * The anchor a flow's free end rides on: one handle, so React Flow can
 * resolve an edge that ends there, and nothing drawn. The flow's own glyph
 * carries the line all the way to the free position, so a mark here would be
 * ink the headless render does not lay down.
 */
export function CanvasFreeEndBody(): ReactElement {
  return <Handle type="source" position={Position.Top} />;
}

/**
 * The React Flow node type of every element kind a diagram places as a box,
 * plus the anchor a flow's free end rides on.
 */
export const canvasNodeTypes = {
  actor: CanvasNodeBody,
  process: CanvasNodeBody,
  store: CanvasNodeBody,
  text: CanvasNodeBody,
  'boundary-box': CanvasNodeBody,
  'boundary-curve': CanvasNodeBody,
  [freeEndNodeKind]: CanvasFreeEndBody,
} as const satisfies Record<CanvasNodeKind, typeof CanvasNodeBody> &
  Record<typeof freeEndNodeKind, typeof CanvasFreeEndBody>;

/** The React Flow edge type of a flow. */
export const canvasEdgeTypes = { flow: CanvasEdgeBody } as const;

/**
 * The laid-out nodes as React Flow's own, each carrying the model's position
 * and extent so React Flow measures nothing. A boundary curve rides as a node
 * sized to the box its waypoints span, so it drags and selects as one thing.
 * A boundary sits below the other nodes and takes pointer events only on its
 * outline. Flows come over through {@link toReactFlowEdges}.
 */
export function toReactFlowNodes(layout: CanvasLayout): CanvasFlowNode[] {
  return layout.nodes.map((node) => {
    const boundary = isBoundary(node);
    return {
      id: node.id,
      type: node.kind,
      position: node.position,
      width: node.size.width,
      height: node.size.height,
      data: { node },
      style: boundary ? { pointerEvents: 'none' } : undefined,
      zIndex: boundary ? boundaryZIndex : nodeZIndex,
    };
  });
}

/**
 * The laid-out flows as React Flow's own edges. A React Flow edge runs
 * between two nodes, so an end the model leaves free takes the anchor
 * {@link freeEndNodes} places at that position. The handle each attached end
 * names is the side the layout resolved, so React Flow's own idea of where
 * an edge runs matches the drawn line.
 */
export function toReactFlowEdges(layout: CanvasLayout): CanvasFlowEdge[] {
  const boxes = nodeBoxesOf(layout.nodes);
  return layout.edges.map((edge) => ({
    id: edge.id,
    type: 'flow',
    source: edge.sourceElement ?? flowEndNodeId(edge.id, 'source'),
    target: edge.targetElement ?? flowEndNodeId(edge.id, 'target'),
    sourceHandle: edge.sourceSide,
    targetHandle: edge.targetSide,
    data: {
      edge,
      boxes,
      sourceBox:
        edge.sourceElement === undefined
          ? undefined
          : boxes.get(edge.sourceElement),
      targetBox:
        edge.targetElement === undefined
          ? undefined
          : boxes.get(edge.targetElement),
    },
    interactionWidth: interactionWidths.flow,
  }));
}

/**
 * One anchor node per free flow end, so React Flow resolves an edge that
 * ends at a position belonging to no element. An anchor is not draggable,
 * not selectable, not focusable and hidden from assistive technology: it is
 * a place for an edge to end, not a thing on the diagram.
 */
export function freeEndNodes(layout: CanvasLayout): CanvasFreeEndNode[] {
  return layout.edges.flatMap((edge) => [
    ...anchorOf(edge, 'source'),
    ...anchorOf(edge, 'target'),
  ]);
}

/**
 * The id of the node a flow's free end rides on, the flow's own id with the
 * side appended. It is derived rather than stored, so the edge and the
 * anchor agree without either holding a reference to the other.
 */
export function flowEndNodeId(flow: ElementId, side: FlowEndSide): string {
  return `${flow}-${side}`;
}

/**
 * The layout at the positions React Flow holds during a gesture. The first
 * moving selected node supplies the shared offset for selected flows.
 */
export function layoutAtReactFlowNodes(
  layout: CanvasLayout,
  nodes: readonly (CanvasFlowNode | CanvasFreeEndNode)[],
  selection: readonly ElementId[],
  exactLabels = true,
  labelBases: ReadonlyMap<string, CanvasEdge> = new Map(),
): CanvasLayout {
  const original = new Map<string, CanvasNode>(
    layout.nodes.map((node) => [node.id, node]),
  );
  const selected = new Set(selection);
  const boxes = new Map<ElementId, NodeBox>();
  let offset = { x: 0, y: 0 };
  for (const node of nodes) {
    const settled = original.get(node.id);
    if (
      settled !== undefined &&
      selected.has(settled.id) &&
      offset.x === 0 &&
      offset.y === 0
    ) {
      offset = {
        x: node.position.x - settled.position.x,
        y: node.position.y - settled.position.y,
      };
    }
  }
  for (const node of nodes) {
    const settled = original.get(node.id);
    if (settled === undefined) {
      continue;
    }
    boxes.set(settled.id, {
      position:
        selected.has(settled.id) && (offset.x !== 0 || offset.y !== 0)
          ? shiftedBy(settled.position, offset)
          : node.position,
      size: {
        width: node.measured?.width ?? node.width ?? settled.size.width,
        height: node.measured?.height ?? node.height ?? settled.size.height,
      },
    });
  }
  return layoutDuringMove(
    layout,
    boxes,
    selected,
    offset,
    exactLabels,
    labelBases,
  );
}

const anchorExtent = 1;

const boundaryZIndex = -1;

const nodeZIndex = 0;

const boundaryHitTargetClass = 'pn-boundary-hit-target';

const badgeLayerClass = 'pn-badge-layer';

const resizableKinds = new Set<CanvasNodeKind>([
  'actor',
  'process',
  'store',
  'text',
  'boundary-box',
]);

const handlePlacement = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
} as const satisfies Record<HandleSide, Position>;

function BadgeLayer({
  node,
}: {
  readonly node: CanvasNode;
}): ReactElement | null {
  if (node.badge === undefined) {
    return null;
  }
  return (
    <svg
      aria-hidden="true"
      className={badgeLayerClass}
      height={svgNumber(node.size.height)}
      overflow="visible"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0 }}
      width={svgNumber(node.size.width)}
    >
      <g
        className={node.outOfScope ? canvasClassNames.outOfScope : undefined}
        pointerEvents={isBoundary(node) ? undefined : 'visiblePainted'}
      >
        <ThreatBadgeGlyph badge={node.badge} at={badgeAnchor(node.size)} />
      </g>
    </svg>
  );
}

function BoundaryHitTarget({
  node,
}: {
  readonly node: CanvasBoundaryNode;
}): ReactElement {
  const interaction = {
    'aria-hidden': true,
    className: boundaryHitTargetClass,
    fill: 'none',
    pointerEvents: 'stroke',
    stroke: 'transparent',
    strokeWidth: svgNumber(interactionWidths.boundary),
  } as const;
  return node.kind === 'boundary-box' ? (
    <rect
      {...interaction}
      width={svgNumber(node.size.width)}
      height={svgNumber(node.size.height)}
    />
  ) : (
    <path {...interaction} d={smoothPath(node.waypoints)} />
  );
}

function liveBox(
  settled: NodeBox | undefined,
  node: InternalNode | undefined,
  groupOffset: Point,
): NodeBox | undefined {
  if (settled === undefined || node === undefined) {
    return undefined;
  }
  const { width, height } = node;
  if (width === undefined || height === undefined) {
    return undefined;
  }
  return {
    position:
      node.selected && (groupOffset.x !== 0 || groupOffset.y !== 0)
        ? shiftedBy(settled.position, groupOffset)
        : node.internals.positionAbsolute,
    size: { width, height },
  };
}

function anchorOf(edge: CanvasEdge, side: FlowEndSide): CanvasFreeEndNode[] {
  const element = side === 'source' ? edge.sourceElement : edge.targetElement;
  if (element !== undefined) {
    return [];
  }
  return [
    {
      id: flowEndNodeId(edge.id, side),
      type: freeEndNodeKind,
      position: side === 'source' ? edge.source : edge.target,
      width: anchorExtent,
      height: anchorExtent,
      data: {},
      draggable: false,
      selectable: false,
      focusable: false,
      connectable: false,
      deletable: false,
      domAttributes: { 'aria-hidden': true },
    },
  ];
}
