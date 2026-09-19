import {
  reconnectFlow,
  setFlowWaypoints,
  type Flow,
  type Model,
  type OperationFailure,
  type Point,
  type Side,
} from '@saerskriven/model';
import { Either } from 'effect';
import { useMemo, useState } from 'react';
import { Action } from '../store/actions.js';
import { selectedElement, selectedElementRecord } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { articleKindMessages, sideMessages } from '../messages/enum-labels.js';
import type { Said, Speaker } from '../messages/said.js';
import { announce, quotedName } from './announcements.js';
import { currentLayout } from './layout.js';
import { currentTool, useTool } from './tools.js';

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

type RouteTarget = BendTarget | AnchorTarget;

type RouteDraft = RouteTarget & {
  readonly state: State;
  readonly transition: number;
  readonly flow: Flow;
};

/** Owns a transient route preview, a bend or an end's side, and commits one edit per gesture. */
export function useFlowBends() {
  const state = useModelStore((value) => value);
  const tool = useTool();
  const [held, setHeld] = useState<RouteDraft | undefined>();
  const element = selectedElementRecord(state);
  const flow =
    tool.active === 'select' &&
    state.inlineEditor === undefined &&
    element?.kind === 'flow'
      ? element
      : undefined;
  const context = useMemo(
    () => ({ flow, model: state.present, transition: tool.transition }),
    [flow, state.present, tool.transition],
  );
  const draft = held !== undefined && currentDraft(held) ? held : undefined;
  if (held !== undefined && draft === undefined) {
    setHeld(undefined);
  }
  const outcome = useMemo(
    () =>
      draft === undefined
        ? undefined
        : editedRoute(state.present, draft.flow, draft),
    [state.present, draft],
  );
  const present =
    outcome !== undefined && Either.isRight(outcome)
      ? outcome.right
      : state.present;

  const commit = (target: RouteTarget): void => {
    if (
      flow === undefined ||
      modelStore.getState().present !== state.present ||
      selectedElement(modelStore.getState()) !== flow.id ||
      currentTool().transition !== tool.transition ||
      (held !== undefined && !currentDraft(held))
    ) {
      return;
    }
    const action = routeAction(flow, target);
    if (action === undefined) {
      return;
    }
    const before = modelStore.getState().present;
    dispatch(action);
    setHeld(undefined);
    if (modelStore.getState().present !== before) {
      announce(routeAnnouncement(flow, target));
    }
  };

  return {
    context,
    flow,
    draft,
    layout: currentLayout({ present, activeDiagram: state.activeDiagram }),
    preview: (target: RouteTarget): void => {
      if (flow !== undefined) {
        setHeld({ ...target, state, transition: tool.transition, flow });
      }
    },
    commit,
    cancel: (): void => {
      setHeld(undefined);
    },
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
      setHeld(undefined);
      const { name } = flow;
      announce((t) =>
        t('canvas.bend-removed', {
          number: index + 1,
          flow: flowName(t, name),
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
  if (target.kind !== 'anchor') {
    return setFlowWaypoints(model, flow.id, editedBends(flow, target));
  }
  const end = flow[target.end];
  return end.kind === 'attached'
    ? reconnectFlow(model, flow.id, target.end, end.element, target.side)
    : Either.right(model);
}

function routeAction(flow: Flow, target: RouteTarget): Action | undefined {
  if (target.kind !== 'anchor') {
    return Action.SetFlowWaypoints({
      elementId: flow.id,
      waypoints: editedBends(flow, target),
    });
  }
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

function routeAnnouncement(flow: Flow, target: RouteTarget): Said {
  const { name } = flow;
  return (t) => {
    const named = flowName(t, name);
    if (target.kind !== 'anchor') {
      return t(
        target.kind === 'insert' ? 'canvas.bend-added' : 'canvas.bend-moved',
        { number: target.index + 1, flow: named },
      );
    }
    if (target.side === undefined) {
      return t(
        target.end === 'source'
          ? 'canvas.source-released'
          : 'canvas.target-released',
        { flow: named },
      );
    }
    return t(
      target.end === 'source' ? 'canvas.source-pinned' : 'canvas.target-pinned',
      { flow: named, side: t(sideMessages[target.side]) },
    );
  };
}

function flowName(t: Speaker, name: string): string {
  return quotedName(t, name, t(articleKindMessages.flow));
}

function currentDraft(draft: RouteDraft): boolean {
  const state = modelStore.getState();
  const tool = currentTool();
  return (
    state.present === draft.state.present &&
    selectedElement(state) === draft.flow.id &&
    state.inlineEditor === draft.state.inlineEditor &&
    tool.active === 'select' &&
    tool.transition === draft.transition
  );
}
