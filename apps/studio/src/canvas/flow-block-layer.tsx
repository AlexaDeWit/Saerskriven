import { canvasInteractionClassNames } from '@saerskriven/canvas';
import { ViewportPortal } from '@xyflow/react';
import {
  createContext,
  useCallback,
  useContext,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';

/** Undefined preserves the standalone canvas adapter's default portal. */
export const FlowBlockTarget = createContext<SVGSVGElement | null | undefined>(
  undefined,
);

/** All flow names share one viewport SVG without changing their coordinates. */
export function FlowBlockSurface({
  onReady,
}: {
  readonly onReady: (surface: SVGSVGElement | null) => void;
}): ReactElement {
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className={canvasInteractionClassNames.flowBlockSurface}
        width={1}
        height={1}
        overflow="visible"
        pointerEvents="none"
        ref={onReady}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
    </ViewportPortal>
  );
}

/** Portaled names keep React events in their original edge wrapper. */
export function useFlowBlockPortal() {
  const target = useContext(FlowBlockTarget);
  const render = useCallback(
    (block: ReactElement) =>
      target === null || target === undefined
        ? null
        : createPortal(block, target),
    [target],
  );
  return target === undefined ? undefined : render;
}
