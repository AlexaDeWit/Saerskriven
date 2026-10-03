import { NodeResizeControl, ResizeControlVariant } from '@xyflow/react';
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
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

/**
 * The resize controls of a selected node: a line control on each side, which
 * resizes one axis, and a handle at each corner, which resizes both, less
 * those {@link resizeControlsOf} leaves off a boundary curve. Each
 * holds a button named from `labels` that resizes by arrow key in
 * model-space steps. Both routes hand `onResizeEnd` the settled position and
 * size together, so a resize from the top or left is one edit. A boundary
 * curve's corner handles sit `resizeHandle.curveGap` outside its corners,
 * clear of a handle on a point there.
 */
export function ResizeControls({
  labels,
  node,
  onResize,
  onResizeEnd,
  visible,
}: {
  readonly labels: ResizeLabels;
  readonly node: CanvasNode;
  readonly onResize: (() => void) | undefined;
  readonly onResizeEnd: ((box: NodeBox) => void) | undefined;
  readonly visible: boolean;
}): ReactElement {
  const keyDown = (
    control: ResizeControlPosition,
    event: KeyboardEvent<HTMLButtonElement>,
  ): void => {
    const resized = resizeBoxByKey(
      { position: node.position, size: node.size },
      control,
      event.key,
      event.shiftKey ? shiftedKeyboardResizeStep : keyboardResizeStep,
    );
    if (resized === undefined || onResizeEnd === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onResizeEnd(resized);
  };

  return (
    <>
      {resizeControlsOf(node).map((position) => (
        <NodeResizeControl
          key={position}
          minHeight={minimumNodeExtent}
          minWidth={minimumNodeExtent}
          onResize={onResize}
          onResizeEnd={(_, resized) => {
            onResizeEnd?.(
              resizeBoxOnControlAxes(
                { position: node.position, size: node.size },
                position,
                {
                  position: { x: resized.x, y: resized.y },
                  size: { width: resized.width, height: resized.height },
                },
              ),
            );
          }}
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
            aria-label={labels[position]}
            onKeyDown={(event) => {
              keyDown(position, event);
            }}
            type="button"
          />
        </NodeResizeControl>
      ))}
    </>
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
