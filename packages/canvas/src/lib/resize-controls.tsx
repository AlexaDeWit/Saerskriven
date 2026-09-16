import { NodeResizeControl, ResizeControlVariant } from '@xyflow/react';
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { badgeExtent } from './badges.js';
import { handleSides, type NodeBox } from './handles.js';
import type { CanvasNode } from './layout.js';
import { svgNumber } from './numbers.js';
import {
  keyboardResizeStep,
  minimumNodeExtent,
  resizeBoxByKey,
  resizeBoxOnControlAxes,
  resizeControlPositions,
  resizeKeys,
  shiftedKeyboardResizeStep,
  type ResizeControlPosition,
} from './resizing.js';
import { resizeHandle, strokeWidths } from './tokens.js';

/**
 * The resize controls of a selected node: a line control on each side, which
 * resizes one axis, and a handle at each corner, which resizes both. Each
 * holds a named button that resizes by arrow key in model-space steps. Both
 * routes hand `onResizeEnd` the settled position and size together, so a
 * resize from the top or left is one edit. On a node with a badge, the
 * top-right handle sits on the top edge `resizeHandle.badgeGap` screen pixels
 * left of the badge's ink at every zoom, and at full zoom it stays clear of
 * the top-left handle.
 */
export function ResizeControls({
  node,
  onResize,
  onResizeEnd,
  visible,
}: {
  readonly node: CanvasNode;
  readonly onResize: (() => void) | undefined;
  readonly onResizeEnd: ((box: NodeBox) => void) | undefined;
  readonly visible: boolean;
}): ReactElement {
  const name = node.name.trim() || node.kind.replace('-', ' ');
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
      {resizeControlPositions.map((position) => (
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
            aria-label={`Resize ${name} from ${resizeControlLabels[position]}`}
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

const resizeControlLabels = {
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
  'top-left': 'top left corner',
  'top-right': 'top right corner',
  'bottom-right': 'bottom right corner',
  'bottom-left': 'bottom left corner',
} as const satisfies Record<ResizeControlPosition, string>;

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
  const hidden: CSSProperties = visible ? {} : { visibility: 'hidden' };
  const badge = position === 'top-right' ? node.badge : undefined;
  if (badge === undefined) {
    return visible ? undefined : hidden;
  }
  const handleExtent = resizeHandle.size + 2 * resizeHandle.border;
  const gap = `${svgNumber(resizeHandle.badgeGap)}px`;
  const reach = badgeExtent(badge).radius + strokeWidths.badgeRing / 2;
  const beyondTopLeft = 2 * (handleExtent + resizeHandle.badgeGap);
  return {
    ...hidden,
    left: `max(${svgNumber(beyondTopLeft)}px, calc(100% - ${svgNumber(reach)}px))`,
    translate: `calc(-100% - ${gap}) -50%`,
    transformOrigin: `calc(100% + ${gap}) 50%`,
  };
}
