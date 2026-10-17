import { storedPoint, type Decimals } from './decimals.js';
import { drawnElementOn } from './drawing.js';
import { anchorPoint } from './element-geometry.js';
import type { FlowEndpoint } from './elements.js';
import type { Point } from './geometry.js';
import { sameItems } from './lists.js';
import type { Model } from './parse.js';
import type { PlacedFlowEnd, Placement } from './placements.js';
import { elementIdsIn, elementsById } from './references.js';

/**
 * `after` with each flow placement it kept from `before` holding ends its
 * diagram can draw, once an edit changed where a flow attaches or which
 * elements a diagram places. A placement the edit wrote is taken as written.
 * An end attached to an element its diagram places holds no position, and
 * keeps its pinned side while it attaches to the same element. Every other
 * end holds a position: the one it held, or the anchor `before` drew its
 * element at on that diagram, stored at `decimals`. A placement that already
 * fits is kept as it is, and `after` itself comes back where every one does.
 */
export function withPlacedEnds(
  before: Model,
  after: Model,
  decimals?: Decimals,
): Model {
  const flowsBefore = elementsById(before.elements);
  const flowsAfter = elementsById(after.elements);
  const kept = new Set(before.diagrams.flatMap(({ placements }) => placements));
  const diagrams = after.diagrams.map((diagram) => {
    const placed = elementIdsIn(diagram);
    const drawnBefore = before.diagrams.find(({ id }) => id === diagram.id);
    const anchor = (end: FlowEndpoint): Point | undefined => {
      const drawn =
        end.kind === 'attached' && drawnBefore !== undefined
          ? drawnElementOn(before, drawnBefore, end.element)
          : undefined;
      return drawn === undefined
        ? undefined
        : storedPoint(anchorPoint(drawn), decimals);
    };
    const placements = diagram.placements.map((placement): Placement => {
      const flow = flowsAfter.get(placement.element);
      if (
        flow?.kind !== 'flow' ||
        !('waypoints' in placement) ||
        !kept.has(placement)
      ) {
        return placement;
      }
      const held = flowsBefore.get(placement.element);
      const was = held?.kind === 'flow' ? held : flow;
      const source = placedEnd(
        placed,
        was.source,
        flow.source,
        placement.source,
        anchor,
      );
      const target = placedEnd(
        placed,
        was.target,
        flow.target,
        placement.target,
        anchor,
      );
      return source === placement.source && target === placement.target
        ? placement
        : { ...placement, source, target };
    });
    return sameItems(placements, diagram.placements)
      ? diagram
      : { ...diagram, placements };
  });
  return sameItems(diagrams, after.diagrams) ? after : { ...after, diagrams };
}

function placedEnd(
  placed: ReadonlySet<string>,
  was: FlowEndpoint,
  now: FlowEndpoint,
  held: PlacedFlowEnd,
  anchor: (end: FlowEndpoint) => Point | undefined,
): PlacedFlowEnd {
  if (now.kind === 'attached' && placed.has(now.element)) {
    return held.position === undefined &&
      was.kind === 'attached' &&
      was.element === now.element
      ? held
      : {};
  }
  if (held.position !== undefined) {
    return held.side === undefined ? held : { position: held.position };
  }
  const position = anchor(was);
  return position === undefined ? held : { position };
}
