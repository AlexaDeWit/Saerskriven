import type { CanvasFlowNode } from '@saerskriven/canvas';
import type { NodeProps } from '@xyflow/react';
import { useEffectEvent, useLayoutEffect, useRef, type RefObject } from 'react';

type Position = Pick<
  NodeProps<CanvasFlowNode>,
  'positionAbsoluteX' | 'positionAbsoluteY' | 'zIndex'
>;

const resizeButton = '.react-flow__resize-control > button';

/** Writes live offsets while a node's resize button holds focus. */
export function useResizeLayerPosition(
  drawing: RefObject<SVGSVGElement | null>,
  position: Position,
): void {
  const focused = useRef(false);
  const update = useEffectEvent((next: Position = position) => {
    const frame = drawing.current?.parentElement;
    const active = document.activeElement;
    if (
      frame === undefined ||
      frame === null ||
      !(active instanceof Element) ||
      !frame.contains(active) ||
      !active.matches(resizeButton)
    ) {
      focused.current = false;
      clearOffsets(frame);
      return;
    }
    frame.style.setProperty(
      '--saer-node-x',
      `${String(next.positionAbsoluteX)}px`,
    );
    frame.style.setProperty(
      '--saer-node-y',
      `${String(next.positionAbsoluteY)}px`,
    );
    frame.style.setProperty('--saer-node-z', String(next.zIndex));
  });

  useLayoutEffect(() => {
    if (focused.current) {
      update({
        positionAbsoluteX: position.positionAbsoluteX,
        positionAbsoluteY: position.positionAbsoluteY,
        zIndex: position.zIndex,
      });
    }
  }, [position.positionAbsoluteX, position.positionAbsoluteY, position.zIndex]);

  useLayoutEffect(() => {
    const frame = drawing.current?.parentElement;
    if (frame === undefined || frame === null) {
      return undefined;
    }
    const landed = ({ target }: FocusEvent): void => {
      if (target instanceof Element && target.matches(resizeButton)) {
        focused.current = true;
        update();
      }
    };
    const left = (): void => {
      if (focused.current) {
        focused.current = false;
        clearOffsets(frame);
      }
    };
    frame.addEventListener('focusin', landed);
    frame.addEventListener('focusout', left);
    return () => {
      left();
      frame.removeEventListener('focusin', landed);
      frame.removeEventListener('focusout', left);
    };
  }, [drawing]);
}

function clearOffsets(frame: HTMLElement | null | undefined): void {
  frame?.style.removeProperty('--saer-node-x');
  frame?.style.removeProperty('--saer-node-y');
  frame?.style.removeProperty('--saer-node-z');
}
