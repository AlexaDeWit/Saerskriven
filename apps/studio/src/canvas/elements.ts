import {
  boxElementStrokeInsets,
  type BoxElementKind,
  type CanvasLayout,
  type CanvasNode,
  type NodeBox,
} from '@saerskriven/canvas';
import {
  generateElementId,
  type Element,
  type ElementId,
  type Point,
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
  return layout.nodes.filter(
    (node) =>
      node.kind === 'actor' || node.kind === 'process' || node.kind === 'store',
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
 * An element sized between opposite corners. A process takes the shorter
 * side.
 */
export function draggedPlacement(
  kind: Exclude<ElementTool, 'boundary-curve'>,
  from: Point,
  to: Point,
): NodeBox {
  const width = Math.max(Math.abs(to.x - from.x), 1);
  const height = Math.max(Math.abs(to.y - from.y), 1);
  if (kind === 'note') {
    return {
      position: { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) },
      size: { width, height },
    };
  }
  if (kind === 'process') {
    const side = Math.min(width, height);
    return insideStroke(kind, {
      position: {
        x: to.x < from.x ? from.x - side : from.x,
        y: to.y < from.y ? from.y - side : from.y,
      },
      size: { width: side, height: side },
    });
  }
  return insideStroke(kind, {
    position: { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) },
    size: { width, height },
  });
}

/** The geometry a completed pointer press asks an element tool to place. */
export function pointerPlacement(
  kind: Exclude<ElementTool, 'boundary-curve'>,
  from: Point,
  to: Point,
  screenDistance: number,
): NodeBox {
  return screenDistance < placementClickDistance
    ? centredPlacement(kind, from)
    : draggedPlacement(kind, from, to);
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

/** A new flow attached at both ends, with a fresh id and no waypoints. */
export function freshFlow(source: ElementId, target: ElementId): Element {
  return {
    kind: 'flow',
    ...namedElement(activeTranslator().t('defaults.new-flow')),
    source: { kind: 'attached', element: source },
    target: { kind: 'attached', element: target },
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

function arch(position: Point, size: Size): Point[] {
  return [
    { x: position.x, y: position.y + size.height },
    { x: position.x + size.width / 2, y: position.y },
    { x: position.x + size.width, y: position.y + size.height },
  ];
}

function insideStroke(kind: BoxElementKind, outer: NodeBox): NodeBox {
  const nominal = boxElementStrokeInsets(kind);
  const nominalWidth = nominal.top + nominal.bottom;
  const available =
    kind === 'store'
      ? outer.size.height / 2
      : Math.min(outer.size.width, outer.size.height) / 2;
  const strokeWidth = Math.min(nominalWidth, available);
  const halfStroke = strokeWidth / 2;
  const inset =
    kind === 'store'
      ? { top: halfStroke, right: 0, bottom: halfStroke, left: 0 }
      : {
          top: halfStroke,
          right: halfStroke,
          bottom: halfStroke,
          left: halfStroke,
        };
  const width = outer.size.width - inset.left - inset.right;
  const height = outer.size.height - inset.top - inset.bottom;
  return {
    position: {
      x: outer.position.x + (outer.size.width - width) / 2,
      y: outer.position.y + (outer.size.height - height) / 2,
    },
    size: { width, height },
  };
}
