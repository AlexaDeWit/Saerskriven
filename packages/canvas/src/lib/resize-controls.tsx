import {
  NodeResizeControl,
  ResizeControlVariant,
  type OnResizeEnd,
  type OnResizeStart,
  type ResizeDragEvent,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type TouchEvent,
} from 'react';
import { handleSides, type NodeBox } from './handles.js';
import type { CanvasNode } from './layout.js';
import { svgNumber } from './numbers.js';
import {
  keyboardResizeStep,
  minimumNodeExtent,
  resizeBoxByKey,
  resizeBoxOnControlAxes,
  resizeControlsOf,
  resizeKeys,
  shiftedKeyboardResizeStep,
  type GestureInput,
  type ResizeControlPosition,
} from './resizing.js';
import { resizeHandle } from './tokens.js';

/** The accessible name of each resize control, which the mounting canvas words. */
export type ResizeLabels = Readonly<Record<ResizeControlPosition, string>>;

type ResizeSubject = {
  readonly node: CanvasNode;
  readonly onResize: (() => void) | undefined;
  readonly onResizeEnd:
    | ((box: NodeBox, input: GestureInput) => void)
    | undefined;
};

type Gesture = ResizeDragEvent['identifier'];

type Settled = (pressed: CanvasNode) => NodeBox;

type Press = {
  readonly position: ResizeControlPosition;
  readonly subject: ResizeSubject;
  readonly gestures: Set<Gesture>;
  resized: boolean;
  cancelled: boolean;
};

type NodePress = {
  readonly refuses: (
    position: ResizeControlPosition,
    gestures: readonly Gesture[],
  ) => boolean;
  readonly pressed: () => boolean;
  readonly start: (position: ResizeControlPosition, gesture: Gesture) => void;
  readonly holds: (position: ResizeControlPosition) => boolean;
  readonly resize: (position: ResizeControlPosition) => void;
  readonly end: (
    position: ResizeControlPosition,
    gesture: Gesture,
    cancelled: boolean,
    settled: Settled,
  ) => void;
  readonly unmount: (position: ResizeControlPosition) => void;
};

/**
 * The resize controls of a selected node: a line control on each side, which
 * resizes one axis, and a handle at each corner, which resizes both, less
 * those {@link resizeControlsOf} leaves off a boundary curve. Each
 * holds a button named from `labels` that resizes by arrow key in
 * model-space steps. Both routes hand `onResizeEnd` the settled position and
 * size together, so a resize from the top or left is one edit, and which of
 * the two the resize came by: `pointer` for a mouse or a touch, `keyboard`
 * for an arrow key. A pointer press that never resized the node does not
 * reach `onResizeEnd`: React Flow ends it with the extent it measured, a
 * fractional size rounded to whole pixels. `onResize` and `onResizeEnd` may
 * be new functions on every render: a pointer resize calls those of the
 * render its press began on, and settles against that render's `node`.
 *
 * One control holds the node's press at a time. Another finger on that
 * control joins the press. Until the press is over, another pointer's press
 * anywhere on another control starts nothing, and an arrow key on any control
 * resizes nothing. A resize ends when the last finger or the mouse of its
 * press lifts, with the box it finished on. It ends put back instead, with the
 * box the node had when pressed, when a touch of its press was cancelled or
 * when its control unmounts with no mouse down on it. A mouse press outlives
 * its control and ends on its release.
 *
 * A release that never comes leaves the press held: another pointer on its
 * control joins it, resizes the node on screen and gets no end. Its only
 * pointer pressing a control again ends it put back and starts a new press,
 * and a drag of that press resizes from the extent the node then has on
 * screen, not from the box it was put back to.
 *
 * A boundary curve's corner handles sit `resizeHandle.curveGap` outside its
 * corners, clear of a handle on a point there.
 */
export function ResizeControls({
  labels,
  node,
  onResize,
  onResizeEnd,
  visible,
}: ResizeSubject & {
  readonly labels: ResizeLabels;
  readonly visible: boolean;
}): ReactElement {
  const press = useNodePress({ node, onResize, onResizeEnd });
  return (
    <>
      {resizeControlsOf(node).map((position) => (
        <ResizeControl
          key={position}
          label={labels[position]}
          node={node}
          onResizeEnd={onResizeEnd}
          position={position}
          press={press}
          visible={visible}
        />
      ))}
    </>
  );
}

function useNodePress(subject: ResizeSubject): NodePress {
  const rendered = useRef(subject);
  const press = useRef<Press>(undefined);
  useLayoutEffect(() => {
    rendered.current = subject;
  });

  const [nodePress] = useState((): NodePress => {
    const settle = (settled: Settled): void => {
      const held = press.current;
      if (held === undefined || held.gestures.size > 0) {
        return;
      }
      press.current = undefined;
      if (held.resized) {
        const box = held.cancelled ? ownBox : settled;
        held.subject.onResizeEnd?.(box(held.subject.node), 'pointer');
      }
    };
    return {
      refuses: (position, gestures) =>
        press.current !== undefined &&
        press.current.position !== position &&
        !gestures.some((gesture) => press.current?.gestures.has(gesture)),
      pressed: () => press.current !== undefined,
      start: (position, gesture) => {
        if (press.current?.gestures.delete(gesture) === true) {
          settle(ownBox);
        }
        press.current ??= {
          position,
          subject: rendered.current,
          gestures: new Set(),
          resized: false,
          cancelled: false,
        };
        if (press.current.position === position) {
          press.current.gestures.add(gesture);
        }
      },
      holds: (position) => press.current?.position === position,
      resize: (position) => {
        if (press.current?.position === position) {
          press.current.resized = true;
          press.current.subject.onResize?.();
        }
      },
      end: (position, gesture, cancelled, settled) => {
        if (press.current?.position === position) {
          press.current.gestures.delete(gesture);
          press.current.cancelled ||= cancelled;
          settle(settled);
        }
      },
      unmount: (position) => {
        if (press.current?.position === position) {
          dropTouches(press.current.gestures);
          settle(ownBox);
        }
      },
    };
  });
  return nodePress;
}

function ResizeControl({
  label,
  node,
  onResizeEnd,
  position,
  press,
  visible,
}: Pick<ResizeSubject, 'node' | 'onResizeEnd'> & {
  readonly label: string;
  readonly position: ResizeControlPosition;
  readonly press: NodePress;
  readonly visible: boolean;
}): ReactElement {
  const start = useCallback<OnResizeStart>(
    (event) => {
      press.start(position, event.identifier);
    },
    [position, press],
  );
  const holds = useCallback(
    (): boolean => press.holds(position),
    [position, press],
  );
  const resize = useCallback((): void => {
    press.resize(position);
  }, [position, press]);
  const end = useCallback<OnResizeEnd>(
    (event, extent) => {
      press.end(position, event.identifier, cancels(event), (pressed) =>
        resizeBoxOnControlAxes(pressed, position, {
          position: { x: extent.x, y: extent.y },
          size: { width: extent.width, height: extent.height },
        }),
      );
    },
    [position, press],
  );
  useEffect(
    () => () => {
      press.unmount(position);
    },
    [position, press],
  );
  const refuse = (event: MouseEvent | TouchEvent): void => {
    if (press.refuses(position, pressing(event))) {
      event.stopPropagation();
    }
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const box = resizeBoxByKey(
      node,
      position,
      event.key,
      event.shiftKey ? shiftedKeyboardResizeStep : keyboardResizeStep,
    );
    if (box === undefined || onResizeEnd === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!press.pressed()) {
      onResizeEnd(box, 'keyboard');
    }
  };

  return (
    <span
      onMouseDownCapture={refuse}
      onTouchStartCapture={refuse}
      style={wholeControl}
    >
      <NodeResizeControl
        minHeight={minimumNodeExtent}
        minWidth={minimumNodeExtent}
        onResize={resize}
        onResizeEnd={end}
        onResizeStart={start}
        position={position}
        resizeDirection={
          position === 'left' || position === 'right'
            ? 'horizontal'
            : position === 'top' || position === 'bottom'
              ? 'vertical'
              : undefined
        }
        shouldResize={holds}
        style={controlStyle(node, position, visible)}
        variant={
          sideControls.has(position)
            ? ResizeControlVariant.Line
            : ResizeControlVariant.Handle
        }
      >
        <button
          aria-keyshortcuts={resizeControlKeys[position].join(' ')}
          aria-label={label}
          onKeyDown={keyDown}
          type="button"
        />
      </NodeResizeControl>
    </span>
  );
}

const wholeControl: CSSProperties = { display: 'contents' };

function pressing(event: MouseEvent | TouchEvent): readonly Gesture[] {
  return 'changedTouches' in event
    ? Array.from(event.changedTouches, (touch) => touch.identifier)
    : ['mouse'];
}

function cancels({ sourceEvent }: ResizeDragEvent): boolean {
  const source: unknown = sourceEvent;
  return source instanceof Event && source.type === 'touchcancel';
}

function dropTouches(gestures: Set<Gesture>): void {
  for (const gesture of gestures) {
    if (gesture !== 'mouse') {
      gestures.delete(gesture);
    }
  }
}

function ownBox({ position, size }: CanvasNode): NodeBox {
  return { position, size };
}

const verticalKeys = resizeKeys.filter(
  (key) => key === 'ArrowUp' || key === 'ArrowDown',
);

const horizontalKeys = resizeKeys.filter(
  (key) => key === 'ArrowLeft' || key === 'ArrowRight',
);

const resizeControlKeys = {
  top: verticalKeys,
  right: horizontalKeys,
  bottom: verticalKeys,
  left: horizontalKeys,
  'top-left': resizeKeys,
  'top-right': resizeKeys,
  'bottom-right': resizeKeys,
  'bottom-left': resizeKeys,
} as const satisfies Record<ResizeControlPosition, readonly string[]>;

const sideControls = new Set<ResizeControlPosition>(handleSides);

function controlStyle(
  node: CanvasNode,
  position: ResizeControlPosition,
  visible: boolean,
): CSSProperties | undefined {
  const hidden: CSSProperties | undefined = visible
    ? undefined
    : { visibility: 'hidden' };
  return node.kind === 'boundary-curve' && !sideControls.has(position)
    ? { ...hidden, ...outsideCorner(position) }
    : hidden;
}

function outsideCorner(position: ResizeControlPosition): CSSProperties {
  const gap = `${svgNumber(resizeHandle.curveGap)}px`;
  const before = {
    shift: `calc(-100% - ${gap})`,
    about: `calc(100% + ${gap})`,
  };
  const after = { shift: gap, about: `-${gap}` };
  const across = position.endsWith('left') ? before : after;
  const down = position.startsWith('top') ? before : after;
  return {
    translate: `${across.shift} ${down.shift}`,
    transformOrigin: `${across.about} ${down.about}`,
  };
}
