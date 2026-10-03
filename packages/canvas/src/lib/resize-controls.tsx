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
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
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
  type ResizeControlPosition,
} from './resizing.js';
import { resizeHandle } from './tokens.js';

/** The accessible name of each resize control, which the mounting canvas words. */
export type ResizeLabels = Readonly<Record<ResizeControlPosition, string>>;

type ResizeSubject = {
  readonly node: CanvasNode;
  readonly onResize: (() => void) | undefined;
  readonly onResizeEnd: ((box: NodeBox) => void) | undefined;
};

type Gesture = ResizeDragEvent['identifier'];

type Press = {
  readonly subject: ResizeSubject;
  readonly gestures: Set<Gesture>;
  resized: boolean;
};

/**
 * The resize controls of a selected node: a line control on each side, which
 * resizes one axis, and a handle at each corner, which resizes both, less
 * those {@link resizeControlsOf} leaves off a boundary curve. Each
 * holds a button named from `labels` that resizes by arrow key in
 * model-space steps. Both routes hand `onResizeEnd` the settled position and
 * size together, so a resize from the top or left is one edit. A pointer
 * press that never resized the node does not reach `onResizeEnd`: React Flow
 * ends it with the extent it measured, a fractional size rounded to whole
 * pixels. `onResize` and `onResizeEnd` may be new functions on every render:
 * a pointer resize calls those of the render its press began on, and settles
 * against that render's `node`. A resize that called `onResize` gets one
 * `onResizeEnd`: once every finger and the mouse on its control has lifted,
 * with the box it finished on, or once its controls unmount under a touch,
 * whose lift React Flow then never reports, with the node's own box, so that
 * nothing is resized. A mouse press outlives its control and ends on its
 * release. A boundary curve's corner handles sit `resizeHandle.curveGap`
 * outside its corners, clear of a handle on a point there.
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
  return (
    <>
      {resizeControlsOf(node).map((position) => (
        <ResizeControl
          key={position}
          label={labels[position]}
          node={node}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
          position={position}
          visible={visible}
        />
      ))}
    </>
  );
}

function ResizeControl({
  label,
  node,
  onResize,
  onResizeEnd,
  position,
  visible,
}: ResizeSubject & {
  readonly label: string;
  readonly position: ResizeControlPosition;
  readonly visible: boolean;
}): ReactElement {
  const rendered = useRef<ResizeSubject>({ node, onResize, onResizeEnd });
  const press = useRef<Press>(undefined);
  useLayoutEffect(() => {
    rendered.current = { node, onResize, onResizeEnd };
  });

  const start = useCallback<OnResizeStart>((event) => {
    press.current ??= {
      subject: rendered.current,
      gestures: new Set(),
      resized: false,
    };
    press.current.gestures.add(event.identifier);
  }, []);
  const resize = useCallback((): void => {
    if (press.current !== undefined) {
      press.current.resized = true;
      press.current.subject.onResize?.();
    }
  }, []);
  const settle = useCallback((box: (pressed: CanvasNode) => NodeBox): void => {
    const held = press.current;
    if (held === undefined || held.gestures.size > 0) {
      return;
    }
    press.current = undefined;
    if (held.resized) {
      held.subject.onResizeEnd?.(box(held.subject.node));
    }
  }, []);
  const end = useCallback<OnResizeEnd>(
    (event, extent) => {
      press.current?.gestures.delete(event.identifier);
      settle((pressed) =>
        resizeBoxOnControlAxes(pressed, position, {
          position: { x: extent.x, y: extent.y },
          size: { width: extent.width, height: extent.height },
        }),
      );
    },
    [position, settle],
  );
  useEffect(
    () => () => {
      if (press.current !== undefined) {
        dropTouches(press.current.gestures);
        settle(ownBox);
      }
    },
    [settle],
  );
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
    onResizeEnd(box);
  };

  return (
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
  );
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
