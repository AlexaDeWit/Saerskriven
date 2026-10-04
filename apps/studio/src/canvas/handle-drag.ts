import {
  keyboardResizeStep,
  shiftedKeyboardResizeStep,
} from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
import { useReactFlow } from '@xyflow/react';
import { useRef, type PointerEvent } from 'react';
import {
  pressesContextualShortcut,
  type ContextualShortcutId,
} from '../commands/contextual-shortcuts.js';
import { hostPlatform, type ChordEvent } from '../commands/shortcuts.js';
import { pointerDistance } from './elements.js';

/** The pointer fields a handle drag reads. */
export type HandlePointer = Pick<
  PointerEvent,
  | 'button'
  | 'clientX'
  | 'clientY'
  | 'currentTarget'
  | 'isPrimary'
  | 'pointerId'
  | 'stopPropagation'
>;

/** Where a drag started and where its pointer is now, in flow coordinates. */
export type DragSpan = { readonly from: Point; readonly at: Point };

type Gesture<Held> = {
  readonly context: unknown;
  readonly held: Held;
  readonly start: Point;
  readonly pointerId: number;
  readonly moved: boolean;
};

const dragThreshold = 3;

/**
 * A primary-pointer drag of one handle, holding `Held` for it. `down` starts
 * one on a primary press and says whether it did. It previews once the
 * pointer passes the drag threshold, commits on release, and cancels on a
 * release back where it started. A pointer or a release that arrives after
 * `context` changed is ignored. `drop` abandons a drag in flight, and
 * `closedBy` answers once whether a click closes a drag, released or dropped,
 * rather than pressing the handle. A click the keyboard sent closes none, and
 * leaves the answer for the pointer's click. `forget` withdraws the answer,
 * for a caller that takes that click itself or sees a later press, which
 * shows the click is not coming.
 */
export function useHandleDrag<Held>(
  context: unknown,
  on: {
    readonly preview: (held: Held, span: DragSpan) => void;
    readonly commit: (held: Held, span: DragSpan) => void;
    readonly cancel: () => void;
  },
) {
  const view = useReactFlow();
  const gesture = useRef<Gesture<Held> | undefined>(undefined);
  const dragged = useRef(false);
  const ongoing = (event: HandlePointer): Gesture<Held> | undefined => {
    const started = gesture.current;
    return started !== undefined &&
      started.context === context &&
      started.pointerId === event.pointerId
      ? started
      : undefined;
  };
  const span = (event: HandlePointer, started: Gesture<Held>): DragSpan => ({
    from: view.screenToFlowPosition(started.start),
    at: view.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
  });
  return {
    down: (event: HandlePointer, held: Held): boolean => {
      if (event.button !== 0 || !event.isPrimary) {
        return false;
      }
      dragged.current = false;
      gesture.current = {
        context,
        held,
        start: { x: event.clientX, y: event.clientY },
        pointerId: event.pointerId,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.stopPropagation();
      return true;
    },
    move: (event: HandlePointer): void => {
      const started = ongoing(event);
      if (
        started === undefined ||
        (!started.moved &&
          pointerDistance(event, started.start) < dragThreshold)
      ) {
        return;
      }
      gesture.current = { ...started, moved: true };
      on.preview(started.held, span(event, started));
    },
    up: (event: HandlePointer): void => {
      const started = ongoing(event);
      if (started === undefined) {
        return;
      }
      gesture.current = undefined;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (!started.moved) {
        return;
      }
      dragged.current = true;
      if (pointerDistance(event, started.start) < dragThreshold) {
        on.cancel();
      } else {
        on.commit(started.held, span(event, started));
      }
    },
    active: (): boolean => gesture.current !== undefined,
    drop: (): void => {
      if (gesture.current !== undefined) {
        dragged.current = true;
      }
      gesture.current = undefined;
    },
    forget: (): void => {
      dragged.current = false;
    },
    closedBy: (click: Pick<MouseEvent, 'detail'>): boolean => {
      if (click.detail === 0) {
        return false;
      }
      const ended = dragged.current;
      dragged.current = false;
      return ended;
    },
  };
}

/** `point` moved by the span of a drag. */
export function draggedPoint(point: Point, { from, at }: DragSpan): Point {
  return { x: point.x + at.x - from.x, y: point.y + at.y - from.y };
}

/**
 * `point` moved by an arrow key: the keyboard resize step for the `near`
 * shortcut, or the shifted step for `far`. Nothing for another key.
 */
export function nudgedPoint(
  point: Point,
  event: ChordEvent,
  near: ContextualShortcutId,
  far: ContextualShortcutId,
): Point | undefined {
  const shifted = pressesContextualShortcut(far, event, hostPlatform);
  if (!shifted && !pressesContextualShortcut(near, event, hostPlatform)) {
    return undefined;
  }
  const step = shifted ? shiftedKeyboardResizeStep : keyboardResizeStep;
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
