import {
  NodeResizeControl,
  ResizeControlVariant,
  useInternalNode,
  type OnResize,
  type OnResizeEnd,
  type OnResizeStart,
  type ResizeDragEvent,
  type ShouldResize,
} from '@xyflow/react';
import {
  createContext,
  useCallback,
  useContext,
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
  isResizeKey,
  keyboardResizeStep,
  minimumMeasuredResizeExtent,
  resizeBoxByKey,
  resizeBoxFromMeasurement,
  resizeControlsOf,
  resizeKeys,
  shiftedKeyboardResizeStep,
  type GestureInput,
  type ResizeControlPosition,
} from './resizing.js';
import { resizeHandle } from './tokens.js';

/** The accessible name of each resize control, which the mounting canvas words. */
export type ResizeLabels = Readonly<Record<ResizeControlPosition, string>>;

/** The mounting canvas subscribes cancellation callbacks and calls them before releasing a blurred mouse gesture. */
export const ResizeMouseCancellation = createContext<
  (cancel: () => void) => () => void
>(() => () => undefined);

type ResizeSubject = {
  readonly node: CanvasNode;
  readonly onResize: (() => void) | undefined;
  readonly onResizeEnd:
    | ((box: NodeBox, input: GestureInput) => void)
    | undefined;
};

type Gesture = ResizeDragEvent['identifier'];

type Settled = (
  pressed: CanvasNode,
  measured: NodeBox['size'],
  resized: NodeBox['size'],
) => NodeBox;

type Press = {
  readonly position: ResizeControlPosition;
  readonly subject: ResizeSubject;
  readonly measured: NodeBox['size'];
  readonly gestures: Set<Gesture>;
  extent: NodeBox['size'];
  resized: boolean;
  cancelled: boolean;
};

type NodePress = {
  readonly refuses: (
    position: ResizeControlPosition,
    gestures: readonly Gesture[],
  ) => boolean;
  readonly pressed: () => boolean;
  readonly initial: () => Pick<Press, 'subject' | 'measured'> | undefined;
  readonly start: (
    position: ResizeControlPosition,
    gesture: Gesture,
    measured: NodeBox['size'],
  ) => void;
  readonly holds: (
    position: ResizeControlPosition,
    gesture: Gesture,
  ) => boolean;
  readonly resize: (
    position: ResizeControlPosition,
    extent: NodeBox['size'],
  ) => void;
  readonly end: (
    position: ResizeControlPosition,
    gesture: Gesture,
    cancelled: boolean,
    settled: Settled,
  ) => void;
  readonly unmount: (position: ResizeControlPosition) => void;
};

/**
 * Controls from {@link resizeControlsOf} resize side axes or both corner
 * axes. `onResizeEnd` receives position, size and input together. Pointer
 * resizes use the node and callbacks from the render their press began on.
 * A press with no resize sends no end, since React Flow's measured extent
 * rounds fractional sizes to whole pixels.
 *
 * Buttons claim all arrow keys, including those off their axes or blocked by
 * `minimumNodeExtent`, so React Flow cannot move the selection with them.
 *
 * One control holds the press. Fingers on it join, while other controls and
 * arrow keys wait. The last release ends the resize. Touch cancellation or
 * control unmount without a mouse restores its starting box. The mounting
 * canvas signals window blur through {@link ResizeMouseCancellation}, ending
 * a held mouse press and its joined touches with its starting box instead.
 * Later moves and releases from those inputs change nothing. A mouse press
 * outlives its control until release or blur.
 *
 * A lost release without blur leaves the press held. Its only pointer pressing
 * again restores the box and starts anew, from the extent still on screen.
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
  const subscribeCancellation = useContext(ResizeMouseCancellation);
  const rendered = useRef({ subject, subscribeCancellation });
  const press = useRef<Press>(undefined);
  const unsubscribeCancellation = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    rendered.current = { subject, subscribeCancellation };
  });

  const [nodePress] = useState((): NodePress => {
    const settle = (settled: Settled): void => {
      const held = press.current;
      if (held === undefined || held.gestures.size > 0) {
        return;
      }
      press.current = undefined;
      unsubscribeCancellation.current?.();
      unsubscribeCancellation.current = undefined;
      if (held.resized) {
        const box = held.cancelled ? ownBox : settled;
        held.subject.onResizeEnd?.(
          box(held.subject.node, held.measured, held.extent),
          'pointer',
        );
      }
    };
    return {
      refuses: (position, gestures) =>
        press.current !== undefined &&
        press.current.position !== position &&
        !gestures.some((gesture) => press.current?.gestures.has(gesture)),
      pressed: () => press.current !== undefined,
      initial: () => press.current,
      start: (position, gesture, measured) => {
        if (press.current?.gestures.delete(gesture) === true) {
          settle(ownBox);
        }
        press.current ??= {
          position,
          subject: rendered.current.subject,
          measured,
          extent: measured,
          gestures: new Set(),
          resized: false,
          cancelled: false,
        };
        if (press.current.position === position) {
          press.current.gestures.add(gesture);
          if (
            gesture === 'mouse' &&
            unsubscribeCancellation.current === undefined
          ) {
            unsubscribeCancellation.current =
              rendered.current.subscribeCancellation(() => {
                if (press.current !== undefined) {
                  press.current.cancelled = true;
                  press.current.gestures.clear();
                  settle(ownBox);
                }
              });
          }
        }
      },
      holds: (position, gesture) =>
        press.current?.position === position &&
        press.current.gestures.has(gesture),
      resize: (position, extent) => {
        if (press.current?.position === position) {
          press.current.resized = true;
          press.current.extent = extent;
          press.current.subject.onResize?.();
        }
      },
      end: (position, gesture, cancelled, settled) => {
        if (
          press.current?.position === position &&
          press.current.gestures.delete(gesture)
        ) {
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
  const internal = useInternalNode(node.id);
  const initial = press.initial();
  const size = initial?.subject.node.size ?? node.size;
  const measurement = initial?.measured ?? internal?.measured;
  const start = useCallback<OnResizeStart>(
    (event, extent) => {
      press.start(position, event.identifier, extent);
    },
    [position, press],
  );
  const holds = useCallback<ShouldResize>(
    (event): boolean => press.holds(position, event.identifier),
    [position, press],
  );
  const resize = useCallback<OnResize>(
    (_, extent): void => {
      press.resize(position, extent);
    },
    [position, press],
  );
  const end = useCallback<OnResizeEnd>(
    (event) => {
      press.end(
        position,
        event.identifier,
        cancels(event),
        (pressed, measured, extent) =>
          resizeBoxFromMeasurement(pressed, position, measured, extent),
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
    if (!isResizeKey(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const box = resizeBoxByKey(
      node,
      position,
      event.key,
      event.shiftKey ? shiftedKeyboardResizeStep : keyboardResizeStep,
    );
    if (box !== undefined && !press.pressed()) {
      onResizeEnd?.(box, 'keyboard');
    }
  };

  return (
    <span
      onMouseDownCapture={refuse}
      onTouchStartCapture={refuse}
      style={wholeControl}
    >
      <NodeResizeControl
        minHeight={minimumMeasuredResizeExtent(
          size.height,
          measurement?.height ?? 0,
        )}
        minWidth={minimumMeasuredResizeExtent(
          size.width,
          measurement?.width ?? 0,
        )}
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
