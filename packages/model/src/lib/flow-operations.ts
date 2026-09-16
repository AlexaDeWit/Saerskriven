import { Either } from 'effect';
import { locatedElement, withElement, type Located } from './diagram-edits.js';
import type { Flow, FlowEndpoint } from './elements.js';
import type { Point, Side } from './geometry.js';
import type { ElementId } from './ids.js';
import { sameItems } from './lists.js';
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
 * Reattaches an endpoint inside its diagram. The new endpoint must be an
 * actor, process or store in the flow's diagram, and one the flow's other end
 * does not already attach to, so a flow never connects an element to itself.
 * An absent anchor releases its pinned side.
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
      const endpoint = model.diagrams[located.diagramIndex].elements.find(
        (element) => element.id === endpointId,
      );
      const other = side === 'source' ? flow.target : flow.source;
      if (
        endpoint === undefined ||
        !['actor', 'process', 'store'].includes(endpoint.kind) ||
        (other.kind === 'attached' && other.element === endpointId)
      ) {
        return Either.left(
          OperationFailure.InvalidFlowEndpoint({ side, reference: endpointId }),
        );
      }
      const previous = flow[side];
      return Either.right(
        previous.kind === 'attached' &&
          previous.element === endpointId &&
          previous.side === anchor
          ? model
          : withElement(model, located.diagramIndex, {
              ...flow,
              [side]: attachedEndpoint(endpointId, anchor),
            }),
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
  return Either.map(locatedFlow(model, elementId), (located) =>
    located.element.bidirectional === bidirectional
      ? model
      : withElement(model, located.diagramIndex, {
          ...located.element,
          bidirectional,
        }),
  );
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

function samePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}
