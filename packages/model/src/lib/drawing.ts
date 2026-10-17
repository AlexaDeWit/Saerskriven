import type { DrawnElement, DrawnFlowEndpoint } from './drawn-elements.js';
import type { Element, FlowEndpoint } from './elements.js';
import type { ElementId } from './ids.js';
import type { Diagram } from './model.js';
import type { Model } from './parse.js';
import {
  accentField,
  type PlacedFlowEnd,
  type Placement,
} from './placements.js';
import { elementsById } from './references.js';

type Drawing = {
  readonly element: Element;
  readonly drawn: DrawnElement | undefined;
};

const drawings = new WeakMap<Placement, Drawing>();

const lookups = new WeakMap<readonly Element[], Map<ElementId, Element>>();

/**
 * `element` as `placement` draws it, with its keys in the order
 * `drawnElementSchema` lists them, or undefined where the placement does
 * not fit the element: geometry of another kind, or a flow end whose
 * placement does not match how the element holds it. Every placement of a
 * parsed model fits its element. The same element and placement draw the
 * same object each time, so a reader holding one can compare by identity,
 * as a store selector does. An element or a placement changed in place after
 * it was drawn draws as it was, so an edit builds new records, as every
 * operation does.
 */
export function drawnElement(
  element: Element,
  placement: Placement,
): DrawnElement | undefined {
  const held = drawings.get(placement);
  if (held?.element === element) {
    return held.drawn;
  }
  const drawn = drawnFresh(element, placement);
  drawings.set(placement, { element, drawn });
  return drawn;
}

function drawnFresh(
  element: Element,
  placement: Placement,
): DrawnElement | undefined {
  const { id, name, description, outOfScope, reasonOutOfScope, ...facts } =
    element;
  const base = {
    id,
    name,
    description,
    outOfScope,
    reasonOutOfScope,
    ...accentField(placement),
  };
  if (facts.kind === 'flow') {
    if (!('waypoints' in placement)) {
      return undefined;
    }
    const source = drawnEndpoint(facts.source, placement.source);
    const target = drawnEndpoint(facts.target, placement.target);
    const { bidirectional, ...flow } = facts;
    return source === undefined || target === undefined
      ? undefined
      : {
          ...base,
          ...flow,
          source,
          target,
          waypoints: placement.waypoints,
          bidirectional,
        };
  }
  if (facts.kind === 'trust-boundary') {
    return 'shape' in placement
      ? { ...base, ...facts, shape: placement.shape }
      : undefined;
  }
  return 'position' in placement
    ? {
        ...base,
        position: placement.position,
        size: placement.size,
        ...facts,
      }
    : undefined;
}

/** The element `drawn` stands for, without the diagram's accent and geometry. */
export function elementOf(drawn: DrawnElement): Element {
  if (drawn.kind === 'flow') {
    const { accent: _accent, waypoints: _waypoints, ...flow } = drawn;
    return {
      ...flow,
      source: endpointOf(drawn.source),
      target: endpointOf(drawn.target),
    };
  }
  if (drawn.kind === 'trust-boundary') {
    const { accent: _accent, shape: _shape, ...boundary } = drawn;
    return boundary;
  }
  const { accent: _accent, position: _position, size: _size, ...node } = drawn;
  return node;
}

/** The placement that draws `drawn` on its diagram. */
export function placementOf(drawn: DrawnElement): Placement {
  const held = { element: drawn.id, ...accentField(drawn) };
  if (drawn.kind === 'flow') {
    return {
      ...held,
      waypoints: drawn.waypoints,
      source: placedEndOf(drawn.source),
      target: placedEndOf(drawn.target),
    };
  }
  if (drawn.kind === 'trust-boundary') {
    return { ...held, shape: drawn.shape };
  }
  return { ...held, position: drawn.position, size: drawn.size };
}

/** The elements `diagram` draws, each with its geometry there, in the order it draws them. */
export function drawnElements(
  model: Pick<Model, 'elements'>,
  diagram: Diagram,
): DrawnElement[] {
  const elements = lookupOf(model.elements);
  return diagram.placements.flatMap((placement) => {
    const element = elements.get(placement.element);
    const drawn =
      element === undefined ? undefined : drawnElement(element, placement);
    return drawn === undefined ? [] : [drawn];
  });
}

/** The element `elementId` names as `diagram` draws it, and undefined where the diagram does not place it. */
export function drawnElementOn(
  model: Pick<Model, 'elements'>,
  diagram: Diagram,
  elementId: ElementId,
): DrawnElement | undefined {
  const placement = placementOn(diagram, elementId);
  const element = lookupOf(model.elements).get(elementId);
  return placement === undefined || element === undefined
    ? undefined
    : drawnElement(element, placement);
}

/** The placement of `elementId` on `diagram`, and undefined where it has none there. */
export function placementOn(
  diagram: Diagram,
  elementId: ElementId,
): Placement | undefined {
  return diagram.placements.find(({ element }) => element === elementId);
}

/** One element the model holds, as the first of some diagrams placing it draws it. */
export type FirstDrawing = {
  readonly element: Element;
  readonly drawn: DrawnElement;
  readonly diagram: Diagram;
};

/**
 * Every element `diagrams` place, once each, as the first of them placing
 * it draws it, in the order they draw them: by diagram, then by draw order.
 * `diagrams` defaults to every diagram of the model.
 */
export function firstDrawings(
  model: Pick<Model, 'elements' | 'diagrams'>,
  diagrams: readonly Diagram[] = model.diagrams,
): readonly FirstDrawing[] {
  const elements = lookupOf(model.elements);
  const seen = new Set<ElementId>();
  return diagrams.flatMap((diagram) =>
    diagram.placements.flatMap((placement): FirstDrawing[] => {
      const element = elements.get(placement.element);
      const drawn =
        element === undefined || seen.has(placement.element)
          ? undefined
          : drawnElement(element, placement);
      if (element === undefined || drawn === undefined) {
        return [];
      }
      seen.add(element.id);
      return [{ element, drawn, diagram }];
    }),
  );
}

/** The diagrams that place `elementId`, in diagram order. */
export function diagramsOf(
  model: Pick<Model, 'diagrams'>,
  elementId: ElementId,
): Diagram[] {
  return model.diagrams.filter(
    (diagram) => placementOn(diagram, elementId) !== undefined,
  );
}

function lookupOf(elements: readonly Element[]): Map<ElementId, Element> {
  const held = lookups.get(elements);
  if (held !== undefined) {
    return held;
  }
  const lookup = elementsById(elements);
  lookups.set(elements, lookup);
  return lookup;
}

function drawnEndpoint(
  end: FlowEndpoint,
  placed: PlacedFlowEnd,
): DrawnFlowEndpoint | undefined {
  if (placed.position !== undefined) {
    if (placed.side !== undefined) {
      return undefined;
    }
    return end.kind === 'free'
      ? { kind: 'free', position: placed.position }
      : { kind: 'away', element: end.element, position: placed.position };
  }
  if (end.kind === 'free') {
    return undefined;
  }
  return placed.side === undefined
    ? { kind: 'attached', element: end.element }
    : { kind: 'attached', element: end.element, side: placed.side };
}

function endpointOf(drawn: DrawnFlowEndpoint): FlowEndpoint {
  return drawn.kind === 'free'
    ? { kind: 'free' }
    : { kind: 'attached', element: drawn.element };
}

function placedEndOf(drawn: DrawnFlowEndpoint): PlacedFlowEnd {
  if (drawn.kind !== 'attached') {
    return { position: drawn.position };
  }
  return drawn.side === undefined ? {} : { side: drawn.side };
}
