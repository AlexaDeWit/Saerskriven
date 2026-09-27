import { useEffect, useRef, type CSSProperties } from 'react';
import { useTranslator } from '../messages/locale.js';
import styles from './handles.module.css';

/** One action a canvas handle offers. */
export type HandleAction = {
  readonly label: string;
  readonly run: () => void;
  readonly pressed?: boolean;
};

/** The actions a clicked handle offers beside it, and Close, with focus on the first as they open. */
export function HandleActions({
  label,
  actions,
  onClose,
  style,
}: {
  readonly label: string;
  readonly actions: readonly HandleAction[];
  readonly onClose: () => void;
  readonly style: CSSProperties;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const { t } = useTranslator();
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <fieldset
      aria-label={label}
      className={`${styles.actions} nodrag nopan`}
      style={style}
    >
      {actions.map((action, index) => (
        <button
          aria-pressed={action.pressed}
          key={action.label}
          onClick={action.run}
          ref={index === 0 ? first : undefined}
          type="button"
        >
          {action.label}
        </button>
      ))}
      <button onClick={onClose} type="button">
        {t('tools.close')}
      </button>
    </fieldset>
  );
}

/** Where a handle's actions open: below and right of `point`, at the screen size whatever the zoom. */
export function besideHandle(
  point: { readonly x: number; readonly y: number },
  zoom: number,
): CSSProperties {
  return {
    left: point.x,
    top: point.y,
    transform: `translate(20px, 20px) scale(${String(1 / zoom)})`,
  };
}

/** Where a handle sits: centred on `point`, at the screen size whatever the zoom. */
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
