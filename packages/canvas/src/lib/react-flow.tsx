import type { ElementId, Point } from '@saerskriven/model';
import {
  BaseEdge,
  Handle,
  Position,
  useInternalNode,
  useStore,
  ViewportPortal,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  useId,
  useState,
  type FocusEventHandler,
  type ReactElement,
  type Ref,
} from 'react';
import {
  badgeAnchor,
  badgeStepsOut,
  selectedBadgeAnchor,
  ThreatBadgeGlyph,
  type BadgeMarks,
} from './badges.js';
import { edgePoints } from './flow-anchors.js';
import { shiftedBy, type Box } from './geometry.js';
import {
  ElementGlyph,
  flowBlockGlyph,
  FlowGlyph,
  rectOfBox,
} from './glyphs.js';
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
import { ResizeControls, type ResizeLabels } from './resize-controls.js';
import { nodeAtSize, type GestureInput } from './resizing.js';
import { canvasClassNames, canvasInteractionClassNames } from './stylesheet.js';
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
 * Draws at the live extent during resizing and leaves accessible naming to the mounting canvas.
 * A selected boundary raises its badge through the viewport portal.
 * Side handles require `connectionMode={ConnectionMode.Loose}`.
 */
export function CanvasNodeBody({
  controlsVisible = true,
  data,
  drawingRef,
  height,
  isConnectable,
  marks,
  onResize,
  onResizeEnd,
  positionAbsoluteX,
  positionAbsoluteY,
  resizeLabels,
  resizing = false,
  selected,
  textVisible = true,
  width,
}: NodeProps<CanvasFlowNode> & {
  readonly controlsVisible?: boolean;
  readonly drawingRef?: Ref<SVGSVGElement>;
  readonly marks: BadgeMarks;
  readonly resizeLabels: ResizeLabels;
  readonly onResize?: () => void;
  readonly onResizeEnd?: (box: NodeBox, input: GestureInput) => void;
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
      : nodeAtSize(data.node, shownSize);
  const raised = selected && isBoundary(shownNode) && badgeStepsOut(shownNode);
  const badge = (
    <BadgeLayer
      at={raised ? { x: positionAbsoluteX, y: positionAbsoluteY } : undefined}
      marks={marks}
      node={shownNode}
      selected={selected}
    />
  );
  return (
    <>
      <svg
        ref={drawingRef}
        width={svgNumber(shownSize.width)}
        height={svgNumber(shownSize.height)}
        style={{ display: 'block' }}
        overflow="visible"
        aria-hidden="true"
      >
        {isBoundary(shownNode) ? <BoundaryHitTarget node={shownNode} /> : null}
        <ElementGlyph
          badgeVisible={false}
          marks={marks}
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
      {selected ? (
        <ResizeControls
          labels={resizeLabels}
          node={data.node}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
          visible={controlsVisible}
        />
      ) : null}
      {raised ? <ViewportPortal>{badge}</ViewportPortal> : badge}
    </>
  );
}

/**
 * Follows live endpoints and raises the name block while its line stays in the edge layer.
 * The mounting canvas redirects native focus through `onBlockFocus`.
 */
export function CanvasEdgeBody({
  data,
  id,
  interactionWidth,
  marks,
  onBlockFocus,
  renderBlock = defaultBlockPortal,
  selected,
  selectable,
  source,
  target,
  textVisible = true,
}: EdgeProps<CanvasFlowEdge> & {
  readonly marks: BadgeMarks;
  readonly onBlockFocus?: FocusEventHandler<SVGElement>;
  readonly renderBlock?: (block: ReactElement) => ReactElement | null;
  readonly textVisible?: boolean;
}): ReactElement | null {
  const [blockHovered, setBlockHovered] = useState(false);
  const clipId = useId();
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const groupMovement = useStore((state) => {
    if (!selected || data?.boxes === undefined) {
      return '0,0';
    }
    for (const [nodeId, settled] of data.boxes) {
      const node = state.nodeLookup.get(nodeId);
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
  const backing = edge.label.backing;
  return (
    <>
      <BaseEdge
        path={path}
        interactionWidth={interactionWidth ?? interactionWidths.flow}
        strokeOpacity={0}
      />
      <g aria-hidden="true" data-flow-block-hovered={blockHovered || undefined}>
        {backing === undefined
          ? null
          : rectOfBox(undefined, backing, {
              fill: 'none',
              pointerEvents: 'none',
            })}
        <FlowGlyph blockVisible={false} edge={edge} marks={marks} />
      </g>
      {backing === undefined
        ? null
        : renderBlock(
            flowBlockLayer({
              backing,
              clipId,
              edge,
              id,
              interactionWidth: interactionWidth ?? interactionWidths.flow,
              marks,
              onHover: setBlockHovered,
              onFocus: onBlockFocus,
              path,
              selectable,
              textVisible,
            }),
          )}
    </>
  );
}

/** Resolves a free endpoint without adding a mark to the drawing. */
export function CanvasFreeEndBody(): ReactElement {
  return <Handle type="source" position={Position.Top} />;
}

/** Keeps model extents and places boundaries below regular nodes. */
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

/** Uses the layout's handle sides and supplies invisible anchors for free ends. */
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

/** Free endpoints resolve through anchors excluded from gestures and accessibility. */
export function freeEndNodes(layout: CanvasLayout): CanvasFreeEndNode[] {
  return layout.edges.flatMap((edge) => [
    ...anchorOf(edge, 'source'),
    ...anchorOf(edge, 'target'),
  ]);
}

/** Derives the same anchor ID for an edge and its free-end node. */
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

const handlePlacement = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
} as const satisfies Record<HandleSide, Position>;

function flowBlockLayer({
  backing,
  clipId,
  edge,
  id,
  interactionWidth,
  marks,
  onHover,
  onFocus,
  path,
  selectable,
  textVisible,
}: {
  readonly backing: Box;
  readonly clipId: string;
  readonly edge: CanvasEdge;
  readonly id: string;
  readonly interactionWidth: number;
  readonly marks: BadgeMarks;
  readonly onHover: (hovered: boolean) => void;
  readonly onFocus: FocusEventHandler<SVGElement> | undefined;
  readonly path: string;
  readonly selectable: boolean | undefined;
  readonly textVisible: boolean;
}): ReactElement {
  return (
    <g
      aria-hidden="true"
      className={`${canvasInteractionClassNames.flowBlockLayer} ${canvasClassNames.element} nopan`}
      data-id={id}
      data-testid={`rf__flow-block-${id}`}
      pointerEvents={selectable === false ? 'none' : 'visibleStroke'}
      onFocus={onFocus}
      tabIndex={-1}
      onMouseEnter={() => {
        onHover(true);
      }}
      onMouseLeave={() => {
        onHover(false);
      }}
      style={{
        cursor: selectable ? 'pointer' : undefined,
      }}
    >
      <defs>
        <clipPath id={clipId}>{rectOfBox(undefined, backing)}</clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <BaseEdge
          path={path}
          interactionWidth={0}
          strokeOpacity={0}
          style={{ strokeWidth: Math.max(1, interactionWidth) }}
        />
      </g>
      {flowBlockGlyph({ edge, marks, textVisible })}
    </g>
  );
}

function defaultBlockPortal(block: ReactElement): ReactElement {
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className={canvasInteractionClassNames.flowBlockSurface}
        width={1}
        height={1}
        overflow="visible"
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        {block}
      </svg>
    </ViewportPortal>
  );
}

function BadgeLayer({
  at = { x: 0, y: 0 },
  marks,
  node,
  selected,
}: {
  readonly at?: Point;
  readonly marks: BadgeMarks;
  readonly node: CanvasNode;
  readonly selected: boolean;
}): ReactElement | null {
  if (node.badge === undefined) {
    return null;
  }
  return (
    <svg
      aria-hidden="true"
      className={canvasInteractionClassNames.badgeLayer}
      height={svgNumber(node.size.height)}
      overflow="visible"
      pointerEvents="none"
      style={{ position: 'absolute', left: at.x, top: at.y }}
      width={svgNumber(node.size.width)}
    >
      <g
        className={node.outOfScope ? canvasClassNames.outOfScope : undefined}
        pointerEvents={isBoundary(node) ? undefined : 'visiblePainted'}
      >
        <ThreatBadgeGlyph
          badge={node.badge}
          at={selected ? selectedBadgeAnchor(node) : badgeAnchor(node.size)}
          marks={marks}
        />
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
    className: canvasInteractionClassNames.boundaryHitTarget,
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
      domAttributes: { 'aria-hidden': true, 'aria-roledescription': undefined },
    },
  ];
}
