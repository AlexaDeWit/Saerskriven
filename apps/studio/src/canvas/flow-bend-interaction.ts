import {
  keyboardResizeStep,
  nearestHandleSide,
  shiftedKeyboardResizeStep,
  type CanvasEdge,
  type NodeBox,
} from '@saerskriven/canvas';
import type { Point, Side } from '@saerskriven/model';
import { useReactFlow } from '@xyflow/react';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';
import { keyboardOwner } from '../commands/binding.js';
import { pressesContextualShortcut } from '../commands/contextual-shortcuts.js';
import { hostPlatform, type ChordEvent } from '../commands/shortcuts.js';
import { announce } from './announcements.js';
import { bendInsertionEvent } from './bend-insertion.js';
import { focusElement } from './edits.js';
import type { AnchorTarget, BendTarget, FlowBends } from './flow-bends.js';

/** Which end of a flow a handle stands for. */
export type FlowEnd = AnchorTarget['end'];

type BendMode =
  | { readonly kind: 'choose'; readonly index: number }
  | { readonly kind: 'place'; readonly target: BendTarget }
  | { readonly kind: 'actions'; readonly index: number }
  | { readonly kind: 'end-actions'; readonly end: FlowEnd };

type Held =
  | BendTarget
  | { readonly kind: 'end'; readonly end: FlowEnd; readonly box: NodeBox };

type Gesture = {
  readonly context: FlowBends['context'];
  readonly held: Held;
  readonly start: Point;
  readonly pointerId: number;
  readonly moved: boolean;
};

const dragThreshold = 3;

const controlSelector = 'button, input, textarea, [data-bend-toolbar]';

const sideOfArrow: ReadonlyMap<string, Side> = new Map([
  ['ArrowUp', 'top'],
  ['ArrowRight', 'right'],
  ['ArrowDown', 'bottom'],
  ['ArrowLeft', 'left'],
]);

type BendPointer = Pick<
  PointerEvent<HTMLButtonElement | SVGPathElement>,
  | 'button'
  | 'clientX'
  | 'clientY'
  | 'currentTarget'
  | 'isPrimary'
  | 'pointerId'
  | 'stopPropagation'
>;

/** Binds route gestures while preserving the settled model until commit. */
export function useFlowBendInteraction(
  bends: FlowBends,
  edge: CanvasEdge | undefined,
  toolbar: RefObject<HTMLFieldSetElement | null>,
) {
  const view = useReactFlow();
  const gesture = useRef<Gesture | undefined>(undefined);
  const suppressClick = useRef(false);
  const [mode, setMode] = useState<BendMode | undefined>();
  const [owner, setOwner] = useState(bends.context);
  if (owner !== bends.context) {
    setOwner(bends.context);
    setMode(undefined);
  }

  const handBack = (): void => {
    if (bends.flow !== undefined) {
      focusElement(bends.flow.id);
    }
  };
  const cancel = (focus = true): void => {
    if (gesture.current !== undefined) {
      suppressClick.current = true;
    }
    gesture.current = undefined;
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
  const place = (target: BendTarget): void => {
    setMode({ kind: 'place', target });
    bends.preview(target);
    announce((t) => t('tools.bend-place-help'));
  };
  const commit = (target: BendTarget | AnchorTarget): void => {
    bends.commit(target);
    setMode(undefined);
    handBack();
  };
  const pinEnd = (end: FlowEnd, side: Side | undefined): void => {
    commit({ kind: 'anchor', end, side });
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
      (mode !== undefined || gesture.current !== undefined)
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
            : flowEndKey(event, event.target, pinEnd);
    if (!handled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  const clicked = useEffectEvent((event: globalThis.MouseEvent): void => {
    if (suppressClick.current) {
      suppressClick.current = false;
      if (
        event.target instanceof Element &&
        event.target.closest(
          '[data-bend-index], [data-bend-segment], [data-flow-end]',
        ) !== null
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
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
      commit({
        ...mode.target,
        point: view.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      });
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  const pointerStarted = useEffectEvent(
    (event: globalThis.PointerEvent): void => {
      if (mode?.kind !== 'place' || !(event.target instanceof Element)) {
        return;
      }
      if (event.target.closest(controlSelector) !== null) {
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

  const movedTarget = (
    event: BendPointer,
    started: Gesture,
  ): BendTarget | AnchorTarget => {
    const from = view.screenToFlowPosition(started.start);
    const at = view.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    if (started.held.kind === 'end') {
      return {
        kind: 'anchor',
        end: started.held.end,
        side: nearestHandleSide(started.held.box, at),
      };
    }
    return {
      ...started.held,
      point: {
        x: started.held.point.x + at.x - from.x,
        y: started.held.point.y + at.y - from.y,
      },
    };
  };
  const down = (event: BendPointer, held: Held): void => {
    if (
      mode?.kind === 'place' ||
      mode?.kind === 'choose' ||
      event.button !== 0 ||
      !event.isPrimary
    ) {
      return;
    }
    suppressClick.current = false;
    setMode(undefined);
    gesture.current = {
      context: bends.context,
      held,
      start: { x: event.clientX, y: event.clientY },
      pointerId: event.pointerId,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
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
    downEnd: (event: BendPointer, end: FlowEnd): void => {
      if (edge === undefined) {
        return;
      }
      const box = endBox(bends, edge, end);
      if (box !== undefined) {
        down(event, { kind: 'end', end, box });
      }
    },
    move: (event: BendPointer): void => {
      const started = gesture.current;
      if (
        started === undefined ||
        started.context !== bends.context ||
        started.pointerId !== event.pointerId
      ) {
        return;
      }
      if (
        !started.moved &&
        pointerDistance(event, started.start) < dragThreshold
      ) {
        return;
      }
      gesture.current = { ...started, moved: true };
      bends.preview(movedTarget(event, started));
    },
    up: (event: BendPointer): void => {
      const started = gesture.current;
      if (
        started === undefined ||
        started.context !== bends.context ||
        started.pointerId !== event.pointerId
      ) {
        return;
      }
      gesture.current = undefined;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (started.moved) {
        suppressClick.current = true;
        if (pointerDistance(event, started.start) < dragThreshold) {
          cancel();
        } else {
          commit(movedTarget(event, started));
        }
      }
    },
  };
}

function choosingKey(
  event: KeyboardEvent,
  index: number,
  edge: CanvasEdge,
  choose: (index: number) => void,
  place: (target: BendTarget) => void,
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
  target: BendTarget,
  bends: FlowBends,
  setMode: (mode: BendMode) => void,
  commit: (target: BendTarget) => void,
): boolean {
  const point = nudgedBend(target.point, event);
  if (point !== undefined) {
    const moved = { ...target, point };
    setMode({ kind: 'place', target: moved });
    bends.preview(moved);
    announce((t) => t('canvas.bend-at', point));
    return true;
  }
  if (pressesContextualShortcut('commit-bend', event, hostPlatform)) {
    commit(target);
    return true;
  }
  return false;
}

function flowEndKey(
  event: KeyboardEvent,
  target: Element,
  pinEnd: (end: FlowEnd, side: Side | undefined) => void,
): boolean {
  const end =
    target.closest('[data-flow-end]')?.getAttribute('data-flow-end') ===
    'target'
      ? 'target'
      : 'source';
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
  const moved = nudgedBend(point, event);
  if (moved !== undefined) {
    bends.commit({ kind: 'move', index, point: moved });
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
  commit: (target: BendTarget) => void,
  setMode: (mode: BendMode) => void,
): void {
  if (mode?.kind === 'place') {
    commit(mode.target);
    return;
  }
  if (mode?.kind !== 'choose') {
    setMode(next);
  }
}

function pointerDistance(event: BendPointer, start: Point): number {
  return Math.hypot(event.clientX - start.x, event.clientY - start.y);
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

function segmentBend(edge: CanvasEdge, index: number): BendTarget {
  const points = [edge.source, ...edge.waypoints, edge.target];
  const from = points[index];
  const to = points[index + 1];
  return {
    kind: 'insert',
    index,
    point: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
  };
}

function nudgedBend(point: Point, event: ChordEvent): Point | undefined {
  const far = pressesContextualShortcut('move-bend-far', event, hostPlatform);
  if (!far && !pressesContextualShortcut('move-bend', event, hostPlatform)) {
    return undefined;
  }
  const step = far ? shiftedKeyboardResizeStep : keyboardResizeStep;
  switch (event.key) {
    case 'ArrowLeft':
      return { x: point.x - step, y: point.y };
    case 'ArrowRight':
      return { x: point.x + step, y: point.y };
    case 'ArrowUp':
      return { x: point.x, y: point.y - step };
    case 'ArrowDown':
      return { x: point.x, y: point.y + step };
    default:
      return undefined;
  }
}
