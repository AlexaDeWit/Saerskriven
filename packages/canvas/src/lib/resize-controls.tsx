import {
  NodeResizeControl,
  ResizeControlVariant,
  type OnResizeEnd,
} from '@xyflow/react';
import {
  useCallback,
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
 * against that render's `node`. A boundary curve's corner handles sit
 * `resizeHandle.curveGap` outside its corners, clear of a handle on a point
 * there.
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
  const press = useRef<{ readonly subject: ResizeSubject; resized: boolean }>(
    undefined,
  );
  useLayoutEffect(() => {
    rendered.current = { node, onResize, onResizeEnd };
  });

  const start = useCallback((): void => {
    press.current = { subject: rendered.current, resized: false };
  }, []);
  const resize = useCallback((): void => {
    if (press.current !== undefined) {
      press.current.resized = true;
      press.current.subject.onResize?.();
    }
  }, []);
  const end = useCallback<OnResizeEnd>(
    (_, extent) => {
      const ended = press.current;
      press.current = undefined;
      if (ended?.resized !== true) {
        return;
      }
      ended.subject.onResizeEnd?.(
        resizeBoxOnControlAxes(ended.subject.node, position, {
          position: { x: extent.x, y: extent.y },
          size: { width: extent.width, height: extent.height },
        }),
      );
    },
    [position],
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
