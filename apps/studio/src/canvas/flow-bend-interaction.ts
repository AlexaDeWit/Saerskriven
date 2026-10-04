import {
  isBoundary,
  nearestHandleSide,
  type CanvasEdge,
  type CanvasNode,
  type GestureInput,
  type NodeBox,
} from '@saerskriven/canvas';
import type { Flow, Point, Side } from '@saerskriven/model';
import { useReactFlow } from '@xyflow/react';
import { useEffect, useEffectEvent, useState, type RefObject } from 'react';
import { keyboardOwner } from '../commands/binding.js';
import { pressesContextualShortcut } from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { announce } from './announcements.js';
import { bendInsertionEvent } from './bend-insertion.js';
import { focusElement } from './edits.js';
import { isFlowEnd } from './elements.js';
import { insideBounds } from './layout.js';
import type { AnchorTarget, EndTarget, FlowBends } from './flow-bends.js';
import { keyboardMoved } from './keyboard-moves.js';
import {
  draggedPoint,
  nudgedPoint,
  useHandleDrag,
  type DragSpan,
  type HandlePointer,
} from './handle-drag.js';
import { gestureDecimals } from './stored-decimals.js';
import type { WaypointTarget } from './waypoints.js';

/** Which end of a flow a handle stands for. */
export type FlowEnd = AnchorTarget['end'];

type BendMode =
  | { readonly kind: 'choose'; readonly index: number }
  | { readonly kind: 'place'; readonly target: WaypointTarget }
  | { readonly kind: 'actions'; readonly index: number }
  | { readonly kind: 'end-actions'; readonly end: FlowEnd };

type HeldEnd = {
  readonly kind: 'end';
  readonly end: FlowEnd;
  readonly origin: Point;
  readonly box: NodeBox | undefined;
};

type Held = WaypointTarget | HeldEnd;

const controlSelector = 'button, input, textarea, [data-bend-toolbar]';

const handleSelector =
  '[data-bend-index], [data-bend-segment], [data-flow-end]';

const sideOfArrow: ReadonlyMap<string, Side> = new Map([
  ['ArrowUp', 'top'],
  ['ArrowRight', 'right'],
  ['ArrowDown', 'bottom'],
  ['ArrowLeft', 'left'],
]);

/** Binds route gestures while preserving the settled model until commit. */
export function useFlowBendInteraction(
  bends: FlowBends,
  edge: CanvasEdge | undefined,
  toolbar: RefObject<HTMLFieldSetElement | null>,
) {
  const view = useReactFlow();
  const [mode, setMode] = useState<BendMode | undefined>();
  const [owner, setOwner] = useState(bends.context);
  if (owner !== bends.context) {
    setOwner(bends.context);
    setMode(undefined);
  }

  const drag = useHandleDrag<Held>(bends.context, {
    preview: (held, span) => {
      setMode(undefined);
      const target = draggedTarget(bends, held, span);
      if (target === undefined) {
        bends.cancel();
      } else {
        bends.preview(target);
      }
    },
    commit: (held, span) => {
      const target = draggedTarget(bends, held, span);
      if (target === undefined) {
        cancel();
      } else {
        commit(target, 'pointer');
      }
    },
    cancel: () => {
      cancel();
    },
  });
  const handBack = (): void => {
    if (bends.flow !== undefined) {
      focusElement(bends.flow.id);
    }
  };
  const cancel = (focus = true): void => {
    drag.drop();
    setMode(undefined);
    bends.cancel();
    if (focus) {
      handBack();
    }
  };
  const choose = (index: number): void => {
    setMode({ kind: 'choose', index });
    announce((t) => t('tools.bend-choose-help', { number: index + 1 }));
  };
  const place = (target: WaypointTarget): void => {
    setMode({ kind: 'place', target });
    bends.preview(target);
    announce((t) => t('tools.bend-place-help'));
  };
  const commit = (
    target: WaypointTarget | EndTarget,
    input: GestureInput | undefined,
  ): void => {
    bends.commit(
      target,
      input === undefined ? undefined : gestureDecimals[input],
    );
    setMode(undefined);
    handBack();
  };
  const pinEnd = (end: FlowEnd, side: Side | undefined): void => {
    commit({ kind: 'anchor', end, side }, undefined);
  };
  const remove = (index: number): void => {
    bends.remove(index);
    setMode(undefined);
    handBack();
  };
  const begin = useEffectEvent((): void => {
    if (edge !== undefined && bends.flow !== undefined) {
      bends.cancel();
      choose(0);
      toolbar.current?.focus();
    }
  });
  const keyDown = useEffectEvent((event: globalThis.KeyboardEvent): void => {
    if (
      bends.flow === undefined ||
      edge === undefined ||
      keyboardOwner(event.target) !== 'page'
    ) {
      return;
    }
    if (
      !(event.target instanceof Element) ||
      event.target.closest('[data-testid="canvas-container"]') === null
    ) {
      return;
    }
    if (
      pressesContextualShortcut('cancel-bend', event, hostPlatform) &&
      (mode !== undefined || drag.active())
    ) {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (
      event.key === 'Tab' &&
      mode !== undefined &&
      mode.kind !== 'actions' &&
      mode.kind !== 'end-actions'
    ) {
      cancel(false);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const handled =
      mode?.kind === 'choose'
        ? choosingKey(event, mode.index, edge, choose, place)
        : mode?.kind === 'place'
          ? placingKey(event, mode.target, bends, setMode, commit)
          : event.target.closest('[data-flow-end]') === null
            ? bendHandleKey(event, event.target, bends, remove)
            : flowEndKey(event, event.target, bends, pinEnd);
    if (!handled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  const clicked = useEffectEvent((event: globalThis.MouseEvent): void => {
    if (
      drag.closedBy(event) &&
      event.target instanceof Element &&
      event.target.closest(handleSelector) !== null
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      mode === undefined ||
      edge === undefined ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    if (event.target.closest(controlSelector) !== null) {
      return;
    }
    if (event.target.closest('.react-flow') === null) {
      return;
    }
    if (mode.kind === 'choose') {
      const segment = event.target.closest('[data-bend-segment]');
      if (segment === null) {
        return;
      }
      const index = Number(segment.getAttribute('data-bend-segment'));
      place(segmentBend(edge, index));
    } else if (mode.kind === 'place') {
      commit(
        {
          ...mode.target,
          point: view.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        },
        'pointer',
      );
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  const pointerStarted = useEffectEvent(
    (event: globalThis.PointerEvent): void => {
      drag.forget();
      if (mode?.kind !== 'place' || !(event.target instanceof Element)) {
        return;
      }
      if (
        event.target.closest(`${controlSelector}, ${handleSelector}`) !== null
      ) {
        return;
      }
      if (event.target.closest('.react-flow') !== null) {
        event.stopPropagation();
      }
    },
  );
  const blurred = useEffectEvent((): void => {
    cancel(false);
  });
  useEffect(() => {
    document.addEventListener(bendInsertionEvent, begin);
    document.addEventListener('keydown', keyDown, true);
    document.addEventListener('click', clicked, true);
    document.addEventListener('pointerdown', pointerStarted, true);
    window.addEventListener('blur', blurred);
    return () => {
      document.removeEventListener(bendInsertionEvent, begin);
      document.removeEventListener('keydown', keyDown, true);
      document.removeEventListener('click', clicked, true);
      document.removeEventListener('pointerdown', pointerStarted, true);
      window.removeEventListener('blur', blurred);
    };
  }, []);

  const down = (event: HandlePointer, held: Held): void => {
    const target =
      mode?.kind === 'place' &&
      held.kind === 'move' &&
      held.index === mode.target.index
        ? mode.target
        : held;
    drag.down(event, target);
  };
  return {
    mode,
    cancel,
    remove,
    place,
    pinEnd,
    actions: (index: number): void => {
      openActions(mode, { kind: 'actions', index }, commit, setMode);
    },
    endActions: (end: FlowEnd): void => {
      openActions(mode, { kind: 'end-actions', end }, commit, setMode);
    },
    down,
    downEnd: (event: HandlePointer, end: FlowEnd): void => {
      if (edge !== undefined) {
        down(event, {
          kind: 'end',
          end,
          origin: end === 'source' ? edge.source : edge.target,
          box: endBox(bends, edge, end),
        });
      }
    },
    move: drag.move,
    up: drag.up,
  };
}

function choosingKey(
  event: KeyboardEvent,
  index: number,
  edge: CanvasEdge,
  choose: (index: number) => void,
  place: (target: WaypointTarget) => void,
): boolean {
  if (pressesContextualShortcut('choose-bend-segment', event, hostPlatform)) {
    choose(
      Math.max(
        0,
        Math.min(
          edge.waypoints.length,
          index + (event.key === 'ArrowLeft' ? -1 : 1),
        ),
      ),
    );
    return true;
  }
  if (pressesContextualShortcut('commit-bend', event, hostPlatform)) {
    place(segmentBend(edge, index));
    return true;
  }
  return false;
}

function placingKey(
  event: KeyboardEvent,
  target: WaypointTarget,
  bends: FlowBends,
  setMode: (mode: BendMode) => void,
  commit: (target: WaypointTarget, input: GestureInput) => void,
): boolean {
  const point = nudgedPoint(target.point, event, 'move-bend', 'move-bend-far');
  if (point !== undefined) {
    const moved = { ...target, point };
    setMode({ kind: 'place', target: moved });
    bends.preview(moved);
    announce((t) => t('canvas.bend-at', point));
    keyboardMoved({ placedBend: target.index });
    return true;
  }
  if (pressesContextualShortcut('commit-bend', event, hostPlatform)) {
    commit(target, 'keyboard');
    return true;
  }
  return false;
}

function flowEndKey(
  event: KeyboardEvent,
  target: Element,
  bends: FlowBends,
  pinEnd: (end: FlowEnd, side: Side | undefined) => void,
): boolean {
  const end =
    target.closest('[data-flow-end]')?.getAttribute('data-flow-end') ===
    'target'
      ? 'target'
      : 'source';
  const endpoint = bends.flow?.[end];
  if (endpoint?.kind === 'free') {
    const point = nudgedPoint(
      endpoint.position,
      event,
      'move-free-end',
      'move-free-end-far',
    );
    if (point !== undefined) {
      bends.commit({ kind: 'free', end, point }, gestureDecimals.keyboard);
      keyboardMoved();
      return true;
    }
    if (pressesContextualShortcut('keep-free-end', event, hostPlatform)) {
      announce((t) => t('canvas.free-end-kept'));
      return true;
    }
    return false;
  }
  const side = sideOfArrow.get(event.key);
  if (
    side !== undefined &&
    pressesContextualShortcut('pin-flow-end', event, hostPlatform)
  ) {
    pinEnd(end, side);
    return true;
  }
  if (pressesContextualShortcut('release-flow-end', event, hostPlatform)) {
    pinEnd(end, undefined);
    return true;
  }
  return false;
}

function bendHandleKey(
  event: KeyboardEvent,
  target: Element,
  bends: FlowBends,
  remove: (index: number) => void,
): boolean {
  const handle = target.closest('[data-bend-index]');
  if (handle === null) {
    return false;
  }
  const index = Number(handle.getAttribute('data-bend-index'));
  const point = bends.flow?.waypoints[index];
  if (point === undefined) {
    return false;
  }
  const moved = nudgedPoint(point, event, 'move-bend', 'move-bend-far');
  if (moved !== undefined) {
    bends.commit(
      { kind: 'move', index, point: moved },
      gestureDecimals.keyboard,
    );
    keyboardMoved();
    return true;
  }
  if (pressesContextualShortcut('remove-bend', event, hostPlatform)) {
    remove(index);
    return true;
  }
  return false;
}

function openActions(
  mode: BendMode | undefined,
  next: BendMode,
  commit: (target: WaypointTarget, input: GestureInput) => void,
  setMode: (mode: BendMode) => void,
): void {
  if (mode?.kind === 'place') {
    commit(mode.target, 'keyboard');
    return;
  }
  if (mode?.kind !== 'choose') {
    setMode(next);
  }
}

function endBox(
  bends: FlowBends,
  edge: CanvasEdge,
  end: FlowEnd,
): NodeBox | undefined {
  const element = end === 'source' ? edge.sourceElement : edge.targetElement;
  const node = bends.layout.nodes.find((candidate) => candidate.id === element);
  return node === undefined
    ? undefined
    : { position: node.position, size: node.size };
}

function draggedTarget(
  bends: FlowBends,
  held: Held,
  span: DragSpan,
): WaypointTarget | EndTarget | undefined {
  if (held.kind !== 'end') {
    return { ...held, point: draggedPoint(held.point, span) };
  }
  return bends.flow === undefined
    ? undefined
    : landing(
        bends.flow,
        bends.layout.nodes,
        held,
        draggedPoint(held.origin, span),
      );
}

function landing(
  flow: Flow,
  nodes: readonly CanvasNode[],
  held: HeldEnd,
  point: Point,
): EndTarget | undefined {
  const { end, box } = held;
  if (
    box !== undefined &&
    insideBounds(point, { ...box.position, ...box.size })
  ) {
    return { kind: 'anchor', end, side: nearestHandleSide(box, point) };
  }
  const under = nodes
    .filter(
      (node) =>
        !isBoundary(node) &&
        insideBounds(point, { ...node.position, ...node.size }),
    )
    .at(-1);
  if (under === undefined) {
    return { kind: 'free', end, point };
  }
  const other = flow[end === 'source' ? 'target' : 'source'];
  const attachable =
    isFlowEnd(under) &&
    (other.kind !== 'attached' || other.element !== under.id);
  return attachable ? { kind: 'attach', end, element: under.id } : undefined;
}

function segmentBend(edge: CanvasEdge, index: number): WaypointTarget {
  const points = [edge.source, ...edge.waypoints, edge.target];
  const from = points[index];
  const to = points[index + 1];
  return {
    kind: 'insert',
    index,
    point: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
  };
}
