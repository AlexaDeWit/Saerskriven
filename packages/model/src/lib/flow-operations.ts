import { Either } from 'effect';
import {
  flowEndFailure,
  locatedElement,
  withElement,
  type Located,
} from './diagram-edits.js';
import { samePoint } from './element-geometry.js';
import type { Flow, FlowEndpoint } from './elements.js';
import type { Point, Side } from './geometry.js';
import type { ElementId } from './ids.js';
import { reversed, sameItems } from './lists.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';

/** The failures an edit of one flow's route or direction can produce. */
export type FlowEditFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotFlowElement' }
>;

/** The failures {@link reconnectFlow} can produce. */
export type ReconnectFlowFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownElement' | 'NotFlowElement' | 'InvalidFlowEndpoint' }
>;

/** Replaces a flow's ordered bends, preserving the model for an unchanged route. */
export function setFlowWaypoints(
  model: Model,
  elementId: ElementId,
  waypoints: readonly Point[],
): Either.Either<Model, FlowEditFailure> {
  return Either.map(locatedFlow(model, elementId), (located) => {
    const flow = located.element;
    return sameItems(flow.waypoints, waypoints, samePoint)
      ? model
      : withElement(model, located.diagramIndex, {
          ...flow,
          waypoints: waypoints.map((point) => ({ ...point })),
        });
  });
}

/**
 * Reattaches an endpoint inside its diagram, where `addElement` would accept
 * the end: on an actor, process or store in the flow's diagram that the
 * flow's other end does not already attach to, so a flow never connects an
 * element to itself. An absent anchor releases its pinned side.
 */
export function reconnectFlow(
  model: Model,
  elementId: ElementId,
  side: 'source' | 'target',
  endpointId: ElementId,
  anchor?: Side,
): Either.Either<Model, ReconnectFlowFailure> {
  return Either.flatMap(
    locatedFlow(model, elementId),
    (located): Either.Either<Model, ReconnectFlowFailure> => {
      const flow = located.element;
      const next = attachedEndpoint(endpointId, anchor);
      const refusal = flowEndFailure(
        model.diagrams[located.diagramIndex],
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
          : withElement(model, located.diagramIndex, { ...flow, [side]: next }),
      );
    },
  );
}

/**
 * Frees one end of a flow at a canvas position, or moves an end already free,
 * preserving the model for an end already free there. The other end may be
 * free too, as `addElement` accepts.
 */
export function setFlowEndPosition(
  model: Model,
  elementId: ElementId,
  side: 'source' | 'target',
  position: Point,
): Either.Either<Model, FlowEditFailure> {
  return Either.map(locatedFlow(model, elementId), (located) => {
    const held = located.element[side];
    return held.kind === 'free' && samePoint(held.position, position)
      ? model
      : withElement(model, located.diagramIndex, {
          ...located.element,
          [side]: { kind: 'free', position: { ...position } },
        });
  });
}

/** Makes a flow bidirectional or one-way, preserving the model where it already is. */
export function setFlowDirection(
  model: Model,
  elementId: ElementId,
  bidirectional: boolean,
): Either.Either<Model, FlowEditFailure> {
  return Either.map(locatedFlow(model, elementId), (located) =>
    located.element.bidirectional === bidirectional
      ? model
      : withElement(model, located.diagramIndex, {
          ...located.element,
          bidirectional,
        }),
  );
}

/**
 * Swaps a flow's two ends and reverses its bends, so it runs the other way
 * along the same route. Each end keeps its pinned side or its position. A
 * flow that reads the same both ways, its ends alike and its bends a
 * palindrome, returns the same model.
 */
export function reverseFlow(
  model: Model,
  elementId: ElementId,
): Either.Either<Model, FlowEditFailure> {
  return Either.map(locatedFlow(model, elementId), (located) => {
    const flow = located.element;
    const waypoints = reversed(flow.waypoints);
    return sameEndpoint(flow.source, flow.target) &&
      sameItems(flow.waypoints, waypoints, samePoint)
      ? model
      : withElement(model, located.diagramIndex, {
          ...flow,
          source: flow.target,
          target: flow.source,
          waypoints,
        });
  });
}

function locatedFlow(
  model: Model,
  elementId: ElementId,
): Either.Either<Located<Flow>, FlowEditFailure> {
  return Either.flatMap(
    locatedElement(model, elementId),
    ({
      diagramIndex,
      element,
    }): Either.Either<Located<Flow>, FlowEditFailure> =>
      element.kind === 'flow'
        ? Either.right({ diagramIndex, element })
        : Either.left(OperationFailure.NotFlowElement({ elementId })),
  );
}

function attachedEndpoint(
  element: ElementId,
  side: Side | undefined,
): FlowEndpoint {
  return side === undefined
    ? { kind: 'attached', element }
    : { kind: 'attached', element, side };
}

function sameEndpoint(left: FlowEndpoint, right: FlowEndpoint): boolean {
  if (left.kind === 'free' || right.kind === 'free') {
    return (
      left.kind === 'free' &&
      right.kind === 'free' &&
      samePoint(left.position, right.position)
    );
  }
  return left.element === right.element && left.side === right.side;
}
