import {
  boxElementStrokeInsets,
  boxOfPoints,
  minimumNodeExtent,
  type CanvasLayout,
  type CanvasNode,
  type NodeBox,
} from '@saerskriven/canvas';
import {
  attachedEndpoint,
  generateElementId,
  type BoundaryShape,
  type Element,
  type ElementId,
  type Point,
  type Side,
  type Size,
} from '@saerskriven/model';
import { activeTranslator } from '../messages/locale.js';

/** The element tools in the toolbox. */
export const elementTools = [
  'actor',
  'process',
  'store',
  'boundary-box',
  'boundary-curve',
  'note',
] as const;

/** One kind of element the toolbox places. */
export type ElementTool = (typeof elementTools)[number];

/** The message naming each placed element until it is renamed. */
export const placeholderNames = {
  actor: 'defaults.new-actor',
  process: 'defaults.new-process',
  store: 'defaults.new-store',
  note: 'defaults.new-note',
  'boundary-box': 'defaults.new-boundary-box',
  'boundary-curve': 'defaults.new-boundary-curve',
} as const satisfies Record<ElementTool, string>;

/** The actors, processes and stores that a flow can connect. */
export function flowEnds(layout: CanvasLayout): CanvasNode[] {
  return layout.nodes.filter(isFlowEnd);
}

/** Whether a flow can end on `node`: an actor, a process or a store. */
export function isFlowEnd(node: CanvasNode): boolean {
  return (
    node.kind === 'actor' || node.kind === 'process' || node.kind === 'store'
  );
}

const nominalSizes = {
  actor: { width: 120, height: 60 },
  process: { width: 120, height: 60 },
  store: { width: 120, height: 60 },
  note: { width: 200, height: 80 },
  'boundary-box': { width: 240, height: 160 },
  'boundary-curve': { width: 240, height: 80 },
} as const satisfies Record<ElementTool, Size>;

/** The screen-pixel movement below which a placement remains a click. */
export const placementClickDistance = 4;

/** A pointer's offset, in screen pixels, from where a press started. */
export function pointerOffset(
  pointer: { readonly clientX: number; readonly clientY: number },
  start: Point,
): Point {
  return { x: pointer.clientX - start.x, y: pointer.clientY - start.y };
}

/** How far, in screen pixels, a pointer is from where a press started. */
export function pointerDistance(
  pointer: { readonly clientX: number; readonly clientY: number },
  start: Point,
): number {
  return lengthOf(pointerOffset(pointer, start));
}

/** The default size of an element placed by a click or by Enter. */
export function defaultSize(kind: ElementTool): Size {
  return nominalSizes[kind];
}

/** A default-sized element centred on `centre`. */
export function centredPlacement(kind: ElementTool, centre: Point): NodeBox {
  const size = defaultSize(kind);
  return {
    position: {
      x: centre.x - size.width / 2,
      y: centre.y - size.height / 2,
    },
    size,
  };
}

/**
 * An element between the pressed point and the pointer, its stroke inside
 * them, at least `minimumNodeExtent` wide and high. A shorter drag keeps the
 * pressed corner and grows toward the pointer, or right and down on an axis
 * the pointer has not moved along.
 */
export function draggedPlacement(
  kind: Exclude<ElementTool, 'boundary-curve'>,
  from: Point,
  to: Point,
): NodeBox {
  const inset = kind === 'note' ? noStroke : boxElementStrokeInsets(kind);
  const across = draggedSpan(from.x, to.x, inset.left, inset.right);
  const down = draggedSpan(from.y, to.y, inset.top, inset.bottom);
  return {
    position: { x: across.start, y: down.start },
    size: { width: across.extent, height: down.extent },
  };
}

/**
 * The geometry a pointer asks an element tool to place once it has `moved`,
 * an offset in screen pixels, from its press: the default size for a click,
 * and otherwise a drag from `from` to `to`. An axis the pointer is under
 * `placementClickDistance` along counts as not moved, so its side of the
 * press cannot flip the element.
 */
export function pointerPlacement(
  kind: Exclude<ElementTool, 'boundary-curve'>,
  from: Point,
  to: Point,
  moved: Point,
): NodeBox {
  return lengthOf(moved) < placementClickDistance
    ? centredPlacement(kind, from)
    : draggedPlacement(kind, from, {
        x: Math.abs(moved.x) < placementClickDistance ? from.x : to.x,
        y: Math.abs(moved.y) < placementClickDistance ? from.y : to.y,
      });
}

/** The default boundary curve centred on a click or on the viewport. */
export function defaultCurveWaypoints(centre: Point): readonly Point[] {
  const placed = centredPlacement('boundary-curve', centre);
  return arch(placed.position, placed.size);
}

/**
 * A new element with its required defaults and a fresh id. Its name is
 * written in the active locale at creation and is model content from then on.
 */
export function freshElement(
  kind: ElementTool,
  position: Point,
  size: Size = defaultSize(kind),
): Element {
  const { t } = activeTranslator();
  const named = namedElement(t(placeholderNames[kind]));
  if (kind === 'boundary-box') {
    return {
      ...named,
      kind: 'trust-boundary',
      shape: { kind: 'box', position, size },
    };
  }
  if (kind === 'boundary-curve') {
    return {
      ...named,
      kind: 'trust-boundary',
      shape: { kind: 'curve', waypoints: arch(position, size) },
    };
  }
  if (kind === 'note') {
    return {
      ...named,
      kind: 'text',
      text: t('defaults.new-note-text'),
      position,
      size,
    };
  }
  return { ...named, kind, position, size };
}

/** Moves and sizes a box placement without changing its content or id. */
export function withPlacement(
  element: Element,
  position: Point,
  size: Size,
): Element {
  if (element.kind === 'flow') {
    return element;
  }
  if (element.kind === 'trust-boundary') {
    return element.shape.kind === 'box'
      ? { ...element, shape: { ...element.shape, position, size } }
      : element;
  }
  return { ...element, position, size };
}

/** A boundary curve through the waypoints a person committed. */
export function freshBoundaryCurve(waypoints: readonly Point[]): Element {
  return {
    ...namedElement(activeTranslator().t(placeholderNames['boundary-curve'])),
    kind: 'trust-boundary',
    shape: { kind: 'curve', waypoints: [...waypoints] },
  };
}

/**
 * A trust boundary's other shape: the arch the curve tool places in a box, or
 * the box around a curve's points, grown about their middle to
 * `minimumNodeExtent` on an axis they span less of. A box at least that
 * extent each way comes back from its arch as the same box.
 */
export function switchedShape(shape: BoundaryShape): BoundaryShape {
  if (shape.kind === 'box') {
    return { kind: 'curve', waypoints: arch(shape.position, shape.size) };
  }
  const box = boxOfPoints(shape.waypoints);
  if (box === undefined) {
    return shape;
  }
  const across = spanOf(box.minX, box.maxX);
  const down = spanOf(box.minY, box.maxY);
  return {
    kind: 'box',
    position: { x: across.start, y: down.start },
    size: { width: across.extent, height: down.extent },
  };
}

/** The sides a new flow's ends are pinned to. An end without one follows the route. */
export interface FlowSides {
  readonly source?: Side | undefined;
  readonly target?: Side | undefined;
}

/** A new flow attached at both ends, with a fresh id and no waypoints. */
export function freshFlow(
  source: ElementId,
  target: ElementId,
  sides: FlowSides = {},
): Element {
  return {
    kind: 'flow',
    ...namedElement(activeTranslator().t('defaults.new-flow')),
    source: attachedEndpoint(source, sides.source),
    target: attachedEndpoint(target, sides.target),
    waypoints: [],
    bidirectional: false,
  };
}

function namedElement(name: string) {
  return {
    id: generateElementId(),
    name,
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
  };
}

function lengthOf(offset: Point): number {
  return Math.hypot(offset.x, offset.y);
}

function arch(position: Point, size: Size): Point[] {
  return [
    { x: position.x, y: position.y + size.height },
    { x: position.x + size.width / 2, y: position.y },
    { x: position.x + size.width, y: position.y + size.height },
  ];
}

type Span = { readonly start: number; readonly extent: number };

function spanOf(low: number, high: number): Span {
  const extent = Math.max(high - low, minimumNodeExtent);
  return { start: (low + high - extent) / 2, extent };
}

const noStroke = { top: 0, right: 0, bottom: 0, left: 0 } as const;

function draggedSpan(
  from: number,
  to: number,
  before: number,
  after: number,
): Span {
  const drawn = Math.max(
    Math.abs(to - from),
    minimumNodeExtent + before + after,
  );
  return {
    start: (to < from ? from - drawn : from) + before,
    extent: drawn - before - after,
  };
}
