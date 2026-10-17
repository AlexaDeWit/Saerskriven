import { Either } from 'effect';
import {
  flowEndFailure,
  locatedDrawn,
  locatedElement,
  withDiagram,
  withDrawn,
  withElement,
  withPlacement,
  type LocatedDrawn,
  type UndrawnElementFailure,
} from './diagram-edits.js';
import { storedPoint, storedPoints, type Decimals } from './decimals.js';
import { drawnElementOn, placementOf } from './drawing.js';
import type { DrawnFlow, DrawnFlowEndpoint } from './drawn-elements.js';
import { samePoint } from './element-geometry.js';
import type { Flow } from './elements.js';
import type { Point, Side } from './geometry.js';
import type { DiagramId, ElementId } from './ids.js';
import { reversed, sameItems } from './lists.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { withPlacedEnds } from './placed-ends.js';

/** The failures an edit of one flow's direction can produce. */
export type FlowEditFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotFlowElement' }
>;

/** The failures an edit of one flow's route on one diagram can produce. */
export type FlowRouteFailure =
  | UndrawnElementFailure
  | Extract<OperationFailure, { _tag: 'NotFlowElement' }>;

/** The failures {@link setAwayEndPosition} can produce. */
export type SetAwayEndPositionFailure =
  | FlowRouteFailure
  | Extract<OperationFailure, { _tag: 'FlowEndNotAway' }>;

/** The failures {@link reconnectFlow} can produce. */
export type ReconnectFlowFailure =
  | FlowRouteFailure
  | Extract<OperationFailure, { _tag: 'InvalidFlowEndpoint' }>;

/**
 * Replaces a flow's ordered bends on the diagram `diagramId` names, each
 * stored at `decimals`, preserving the model for a route the flow already
 * has, as given or as it would be stored.
 */
export function setFlowWaypoints(
  model: Model,
  diagramId: DiagramId,
  elementId: ElementId,
  waypoints: readonly Point[],
  decimals?: Decimals,
): Either.Either<Model, FlowRouteFailure> {
  return Either.map(
    locatedFlow(model, diagramId, elementId),
    ({ diagramIndex, drawn: flow }) => {
      const stored = storedPoints(waypoints, decimals);
      return sameItems(flow.waypoints, waypoints, samePoint) ||
        sameItems(flow.waypoints, stored, samePoint)
        ? model
        : withPlacement(
            model,
            diagramIndex,
            placementOf({ ...flow, waypoints: stored }),
          );
    },
  );
}

/**
 * Reattaches an endpoint where `addElement` would accept the end: on an
 * actor, process or store the diagram `diagramId` names places, that the
 * flow's other end does not already attach to, so a flow never connects an
 * element to itself. The end is pinned to `anchor` on that diagram, and an
 * absent anchor releases its pinned side. Which element the end reaches is
 * the flow's on every diagram drawing it: on one that does not place the new
 * element the end is drawn away, where it was drawn before.
 */
export function reconnectFlow(
  model: Model,
  diagramId: DiagramId,
  elementId: ElementId,
  side: 'source' | 'target',
  endpointId: ElementId,
  anchor?: Side,
): Either.Either<Model, ReconnectFlowFailure> {
  return Either.flatMap(
    locatedFlow(model, diagramId, elementId),
    ({
      diagramIndex,
      drawn: flow,
    }): Either.Either<Model, ReconnectFlowFailure> => {
      const next = attachedEndpoint(endpointId, anchor);
      const refusal = flowEndFailure(
        model,
        model.diagrams[diagramIndex],
        side,
        next,
        side === 'source' ? flow.target : flow.source,
      );
      if (refusal !== undefined) {
        return Either.left(refusal);
      }
      const previous = flow[side];
      return Either.right(
        previous.kind === 'attached' &&
          previous.element === endpointId &&
          previous.side === anchor
          ? model
          : withPlacedEnds(
              model,
              withDrawn(model, diagramIndex, { ...flow, [side]: next }),
            ),
      );
    },
  );
}

/**
 * Frees one end of a flow at a canvas position on the diagram `diagramId`
 * names, or moves an end already free there, storing the position at
 * `decimals` and preserving the model for a free end already at it, as given
 * or as it would be stored. An end attached to an element, placed on that
 * diagram or drawn away from it, is freed on every diagram drawing the flow,
 * each keeping the point it was drawn at. The other end may be free too, as
 * `addElement` accepts.
 */
export function setFlowEndPosition(
  model: Model,
  diagramId: DiagramId,
  elementId: ElementId,
  side: 'source' | 'target',
  position: Point,
  decimals?: Decimals,
): Either.Either<Model, FlowRouteFailure> {
  return Either.map(
    locatedFlow(model, diagramId, elementId),
    ({ diagramIndex, drawn: flow }) => {
      const held = flow[side];
      const stored = storedPoint(position, decimals);
      if (held.kind !== 'free') {
        return withPlacedEnds(
          model,
          withDrawn(model, diagramIndex, {
            ...flow,
            [side]: { kind: 'free', position: stored },
          }),
          decimals,
        );
      }
      return samePoint(held.position, position) ||
        samePoint(held.position, stored)
        ? model
        : withDrawn(model, diagramIndex, {
            ...flow,
            [side]: { kind: 'free', position: stored },
          });
    },
  );
}

/**
 * Moves one end of a flow drawn away from its element on the diagram
 * `diagramId` names to a canvas position there, stored at `decimals`, and
 * keeps it attached to that element. Preserves the model for an end already
 * at the position, as given or as it would be stored. Refuses an end that
 * diagram does not draw away with `FlowEndNotAway`.
 */
export function setAwayEndPosition(
  model: Model,
  diagramId: DiagramId,
  elementId: ElementId,
  side: 'source' | 'target',
  position: Point,
  decimals?: Decimals,
): Either.Either<Model, SetAwayEndPositionFailure> {
  return Either.flatMap(
    locatedFlow(model, diagramId, elementId),
    ({
      diagramIndex,
      drawn: flow,
    }): Either.Either<Model, SetAwayEndPositionFailure> => {
      const held = flow[side];
      if (held.kind !== 'away') {
        return Either.left(
          OperationFailure.FlowEndNotAway({ elementId, diagramId, side }),
        );
      }
      const stored = storedPoint(position, decimals);
      return Either.right(
        samePoint(held.position, position) || samePoint(held.position, stored)
          ? model
          : withPlacement(
              model,
              diagramIndex,
              placementOf({ ...flow, [side]: { ...held, position: stored } }),
            ),
      );
    },
  );
}

/** Makes a flow bidirectional or one-way, preserving the model where it already is. */
export function setFlowDirection(
  model: Model,
  elementId: ElementId,
  bidirectional: boolean,
): Either.Either<Model, FlowEditFailure> {
  return Either.map(heldFlow(model, elementId), (flow) =>
    flow.bidirectional === bidirectional
      ? model
      : withElement(model, { ...flow, bidirectional }),
  );
}

/**
 * Swaps a flow's two ends and reverses its bends on every diagram that draws
 * it, so it runs the other way along the same routes. Each end keeps its
 * pinned side or its position. A flow that reads the same both ways, its
 * ends alike and its bends a palindrome on every diagram, returns the same
 * model.
 */
export function reverseFlow(
  model: Model,
  elementId: ElementId,
): Either.Either<Model, FlowEditFailure> {
  return Either.map(heldFlow(model, elementId), (flow) => {
    const drawings = model.diagrams.flatMap((diagram, diagramIndex) => {
      const drawn = drawnElementOn(model, diagram, elementId);
      return drawn?.kind === 'flow' ? [{ diagramIndex, drawn }] : [];
    });
    if (drawings.every(({ drawn }) => readsBothWays(drawn))) {
      return model;
    }
    return drawings.reduce(
      (current, { diagramIndex, drawn }) =>
        withDiagram(current, diagramIndex, (diagram) => ({
          ...diagram,
          placements: diagram.placements.map((placement) =>
            placement.element === elementId
              ? placementOf(reversedFlow(drawn))
              : placement,
          ),
        })),
      withElement(model, { ...flow, source: flow.target, target: flow.source }),
    );
  });
}

function heldFlow(
  model: Model,
  elementId: ElementId,
): Either.Either<Flow, FlowEditFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    ({ element }): Either.Either<Flow, FlowEditFailure> =>
      element.kind === 'flow'
        ? Either.right(element)
        : Either.left(OperationFailure.NotFlowElement({ elementId })),
  );
}

function locatedFlow(
  model: Model,
  diagramId: DiagramId,
  elementId: ElementId,
): Either.Either<LocatedDrawn<DrawnFlow>, FlowRouteFailure> {
  return Either.flatMap(
    locatedDrawn(model, diagramId, elementId),
    ({
      diagramIndex,
      drawn,
    }): Either.Either<LocatedDrawn<DrawnFlow>, FlowRouteFailure> =>
      drawn.kind === 'flow'
        ? Either.right({ diagramIndex, drawn })
        : Either.left(OperationFailure.NotFlowElement({ elementId })),
  );
}

function readsBothWays(flow: DrawnFlow): boolean {
  return (
    sameEndpoint(flow.source, flow.target) &&
    sameItems(flow.waypoints, reversed(flow.waypoints), samePoint)
  );
}

function reversedFlow(flow: DrawnFlow): DrawnFlow {
  return {
    ...flow,
    source: flow.target,
    target: flow.source,
    waypoints: reversed(flow.waypoints),
  };
}

/** An endpoint attached to an element, pinned to `side` when one is given. */
export function attachedEndpoint(
  element: ElementId,
  side: Side | undefined,
): Extract<DrawnFlowEndpoint, { readonly kind: 'attached' }> {
  return side === undefined
    ? { kind: 'attached', element }
    : { kind: 'attached', element, side };
}

function sameEndpoint(
  left: DrawnFlowEndpoint,
  right: DrawnFlowEndpoint,
): boolean {
  if (left.kind === 'attached' || right.kind === 'attached') {
    return (
      left.kind === 'attached' &&
      right.kind === 'attached' &&
      left.element === right.element &&
      left.side === right.side
    );
  }
  return (
    left.kind === right.kind &&
    samePoint(left.position, right.position) &&
    (left.kind === 'free' ||
      (right.kind === 'away' && left.element === right.element))
  );
}
