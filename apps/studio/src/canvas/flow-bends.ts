import {
  reconnectFlow,
  setFlowEndPosition,
  setFlowWaypoints,
  type ElementId,
  type Flow,
  type Model,
  type OperationFailure,
  type Point,
  type Side,
} from '@saerskriven/model';
import { Either } from 'effect';
import { Action } from '../store/actions.js';
import { dispatch } from '../store/store.js';
import { sideMessages } from '../messages/enum-labels.js';
import type { Said } from '../messages/said.js';
import { announce, spokenElement } from './announcements.js';
import { useElementDraft, type ElementEdit } from './element-draft.js';

/** An insertion slot or an existing bend in source-to-target order. */
export type BendTarget = {
  readonly kind: 'insert' | 'move';
  readonly index: number;
  readonly point: Point;
};

/** One attached end of a flow, pinned to a side of its element or released to follow the route. */
export type AnchorTarget = {
  readonly kind: 'anchor';
  readonly end: 'source' | 'target';
  readonly side: Side | undefined;
};

/** One end of a flow attached to another element, where it follows the route. */
export type AttachTarget = {
  readonly kind: 'attach';
  readonly end: 'source' | 'target';
  readonly element: ElementId;
};

/** One end of a flow free at a canvas position. */
export type FreeTarget = {
  readonly kind: 'free';
  readonly end: 'source' | 'target';
  readonly point: Point;
};

/**
 * Where a dragged or nudged end of a flow lands. Released within the element
 * it is attached to, it pins that element's nearest side. Released on another
 * actor, process or store, it attaches there. Released on empty canvas, a
 * trust boundary's interior included, it goes free. Released on the element
 * the other end holds, or on a Note, it lands nowhere.
 */
export type EndTarget = AnchorTarget | AttachTarget | FreeTarget;

type RouteTarget = BendTarget | EndTarget;

const routeEdit: ElementEdit<Flow, RouteTarget> = {
  subject: (element) => (element.kind === 'flow' ? element : undefined),
  edited: editedRoute,
  action: routeAction,
  said: routeAnnouncement,
};

/** Owns a transient route preview, a bend or an end, and commits one edit per gesture. */
export function useFlowBends() {
  const route = useElementDraft(routeEdit);
  const flow = route.subject;
  return {
    ...route,
    flow,
    remove: (index: number): void => {
      if (flow === undefined || flow.waypoints[index] === undefined) {
        return;
      }
      dispatch(
        Action.SetFlowWaypoints({
          elementId: flow.id,
          waypoints: flow.waypoints.filter((_point, at) => at !== index),
        }),
      );
      route.cancel();
      announce((t) =>
        t('canvas.bend-removed', {
          number: index + 1,
          flow: spokenElement(t, flow),
        }),
      );
    },
  };
}

/** The state and operations exposed to the bend controls. */
export type FlowBends = ReturnType<typeof useFlowBends>;

function editedBends(flow: Flow, target: BendTarget): Point[] {
  return [
    ...flow.waypoints.slice(0, target.index),
    target.point,
    ...flow.waypoints.slice(target.index + (target.kind === 'move' ? 1 : 0)),
  ];
}

function editedRoute(
  model: Model,
  flow: Flow,
  target: RouteTarget,
): Either.Either<Model, OperationFailure> {
  if (target.kind === 'anchor') {
    const end = flow[target.end];
    return end.kind === 'attached'
      ? reconnectFlow(model, flow.id, target.end, end.element, target.side)
      : Either.right(model);
  }
  if (target.kind === 'attach') {
    return reconnectFlow(model, flow.id, target.end, target.element);
  }
  if (target.kind === 'free') {
    return setFlowEndPosition(model, flow.id, target.end, target.point);
  }
  return setFlowWaypoints(model, flow.id, editedBends(flow, target));
}

function routeAction(flow: Flow, target: RouteTarget): Action | undefined {
  if (target.kind === 'anchor') {
    const end = flow[target.end];
    return end.kind === 'attached'
      ? Action.ReconnectFlow({
          elementId: flow.id,
          side: target.end,
          endpointId: end.element,
          anchor: target.side,
        })
      : undefined;
  }
  if (target.kind === 'attach') {
    return Action.ReconnectFlow({
      elementId: flow.id,
      side: target.end,
      endpointId: target.element,
    });
  }
  if (target.kind === 'free') {
    return Action.SetFlowEndPosition({
      elementId: flow.id,
      side: target.end,
      position: target.point,
    });
  }
  return Action.SetFlowWaypoints({
    elementId: flow.id,
    waypoints: editedBends(flow, target),
  });
}

function routeAnnouncement(flow: Flow, target: RouteTarget): Said {
  return (t) => {
    const named = spokenElement(t, flow);
    if (target.kind === 'anchor') {
      const source = target.end === 'source';
      return target.side === undefined
        ? t(source ? 'canvas.source-released' : 'canvas.target-released', {
            flow: named,
          })
        : t(source ? 'canvas.source-pinned' : 'canvas.target-pinned', {
            flow: named,
            side: t(sideMessages[target.side]),
          });
    }
    if (target.kind === 'attach') {
      return t(
        target.end === 'source'
          ? 'canvas.source-changed'
          : 'canvas.target-changed',
      );
    }
    if (target.kind === 'free') {
      return freeEndSaid(flow, target.end)(t);
    }
    return t(
      target.kind === 'insert' ? 'canvas.bend-added' : 'canvas.bend-moved',
      { number: target.index + 1, flow: named },
    );
  };
}

/** What freeing one end of `flow`, or moving it where it is already free, says. */
export function freeEndSaid(flow: Flow, end: 'source' | 'target'): Said {
  const moved = flow[end].kind === 'free';
  return (t) => {
    const named = { flow: spokenElement(t, flow) };
    if (end === 'source') {
      return t(moved ? 'canvas.source-moved' : 'canvas.source-freed', named);
    }
    return t(moved ? 'canvas.target-moved' : 'canvas.target-freed', named);
  };
}
