import { Cross1Icon } from '@radix-ui/react-icons';
import { useStore, useViewport } from '@xyflow/react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useTranslator } from '../messages/locale.js';
import { ControlTooltip } from '../ui/control-tooltip.js';
import { useMeasured } from '../ui/measure.js';
import { clearOfPanel } from './viewport.js';
import styles from './handles.module.css';
import local from './handle-actions.module.css';
import toolbox from './toolbox.module.css';

export type HandleAction = {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly run: () => void;
  readonly pressed?: boolean;
};

/** Focuses the first action and bounds its toolbar below the top chrome. */
export function HandleActions({
  label,
  actions,
  onClose,
  point,
  panelCover = 0,
}: {
  readonly label: string;
  readonly actions: readonly HandleAction[];
  readonly onClose: () => void;
  readonly point: { readonly x: number; readonly y: number };
  readonly panelCover?: number;
}) {
  const root = useRef<HTMLFieldSetElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const { x, y, zoom } = useViewport();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const available = clearOfPanel({ width, height }, panelCover);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { t } = useTranslator();
  useMeasured(
    root,
    (node) => {
      const bounds = node.getBoundingClientRect();
      setSize((previous) =>
        previous.width === bounds.width && previous.height === bounds.height
          ? previous
          : { width: bounds.width, height: bounds.height },
      );
    },
    () => {},
  );
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <fieldset
      aria-label={label}
      className={`${styles.toolbar} ${local.actions} nodrag nopan`}
      ref={root}
      style={{
        ...besideHandle(point, zoom),
        maxWidth: `min(28rem, 60vw, ${String(Math.max(available.width - 16, 0))}px)`,
        left: `clamp(${String((8 - x) / zoom - 20)}px, ${String(point.x)}px, ${String((available.width - size.width - 8 - x) / zoom - 20)}px)`,
        top: `clamp(calc((var(--saer-pane-block-start) + ${String(size.height + 64 + 20 * zoom - y)}px) / ${String(zoom)}), ${String(point.y)}px, ${String((available.height - 8 + 20 * zoom - y) / zoom)}px)`,
      }}
    >
      {actions.map((action, index) => (
        <ControlTooltip content={action.label} key={action.label} side="bottom">
          <button
            aria-label={action.label}
            aria-pressed={action.pressed}
            className={`${toolbox.control} ${action.icon === undefined ? local.text : ''}`}
            onClick={action.run}
            ref={index === 0 ? first : undefined}
            type="button"
          >
            {action.icon ?? action.label}
          </button>
        </ControlTooltip>
      ))}
      <ControlTooltip content={t('tools.close')} side="bottom">
        <button
          aria-label={t('tools.close')}
          className={toolbox.control}
          onClick={onClose}
          type="button"
        >
          <Cross1Icon aria-hidden="true" />
        </button>
      </ControlTooltip>
    </fieldset>
  );
}

/** Places controls above the handle while preserving their size through zoom changes. */
export function besideHandle(
  point: { readonly x: number; readonly y: number },
  zoom: number,
): CSSProperties {
  return {
    left: point.x,
    top: point.y,
    transform: `translate(20px, -20px) scale(${String(1 / zoom)}) translateY(-100%)`,
  };
}

/** Keeps the handle at screen size through zoom changes. */
export function onHandle(
  point: { readonly x: number; readonly y: number },
  zoom: number,
): CSSProperties {
  return {
    left: point.x,
    top: point.y,
    transform: `translate(-50%, -50%) scale(${String(1 / zoom)})`,
  };
}
