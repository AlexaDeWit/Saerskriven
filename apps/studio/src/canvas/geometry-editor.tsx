import { boxOfPoints } from '@saerskriven/canvas';
import { pointSchema, sizeSchema } from '@saerskriven/model';
import { useId, useState, type FormEvent } from 'react';
import { useTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { resizeNode } from './edits.js';
import { currentLayout } from './layout.js';
import styles from './selection-controls.module.css';

/** The position and size form over the selected nodes, committing one move or resize on Apply. */
export function GeometryEditor({
  state,
  close,
}: {
  readonly state: State;
  readonly close: () => void;
}) {
  const nodes = currentLayout(state).nodes.filter((node) =>
    state.selection.includes(node.id),
  );
  const single =
    nodes.length === 1 && state.selection.length === 1 ? nodes[0] : undefined;
  const bounds = boxOfPoints(nodes.map((node) => node.position));
  const [position, setPosition] = useState({
    x: String(bounds?.minX ?? 0),
    y: String(bounds?.minY ?? 0),
  });
  const [size, setSize] = useState({
    width: String(single?.size.width ?? 1),
    height: String(single?.size.height ?? 1),
  });
  const [refused, setRefused] = useState(false);
  const { t } = useTranslator();
  const resizable = single !== undefined && single.kind !== 'boundary-curve';
  if (bounds === undefined) {
    return (
      <>
        <p>{t('tools.select-node-geometry')}</p>
        <button onClick={close} type="button">
          {t('tools.close')}
        </button>
      </>
    );
  }
  const commit = (event: FormEvent) => {
    event.preventDefault();
    const at = pointSchema.safeParse({
      x: numeric(position.x),
      y: numeric(position.y),
    });
    const extent = sizeSchema.safeParse({
      width: numeric(size.width),
      height: numeric(size.height),
    });
    if (!at.success || (resizable && !extent.success)) {
      setRefused(true);
      announce((speak) => speak('canvas.geometry-invalid'));
      return;
    }
    if (single !== undefined && resizable && extent.success) {
      resizeNode(single, { position: at.data, size: extent.data });
    } else {
      const offset = { x: at.data.x - bounds.minX, y: at.data.y - bounds.minY };
      if (offset.x !== 0 || offset.y !== 0) {
        dispatch(Action.MoveElements({ elementIds: state.selection, offset }));
      }
    }
    close();
    if (modelStore.getState().present !== state.present) {
      announce((speak) => speak('canvas.geometry-updated'));
    }
  };
  return (
    <form onSubmit={commit}>
      <h2>{t('commands.label-edit-geometry')}</h2>
      {(['x', 'y'] as const).map((axis) => (
        <NumberField
          key={axis}
          label={t(axis === 'x' ? 'tools.axis-x' : 'tools.axis-y')}
          value={position[axis]}
          change={(value) => {
            setPosition({ ...position, [axis]: value });
          }}
        />
      ))}
      {resizable &&
        (['width', 'height'] as const).map((axis) => (
          <NumberField
            key={axis}
            label={t(axis === 'width' ? 'tools.width' : 'tools.height')}
            value={size[axis]}
            change={(value) => {
              setSize({ ...size, [axis]: value });
            }}
          />
        ))}
      {refused && <p>{t('canvas.geometry-invalid')}</p>}
      <div className={styles.actions}>
        <button type="submit">{t('tools.apply-geometry')}</button>
        <button onClick={close} type="button">
          {t('tools.cancel')}
        </button>
      </div>
    </form>
  );
}

function numeric(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function NumberField({
  label,
  value,
  change,
}: {
  readonly label: string;
  readonly value: string;
  readonly change: (value: string) => void;
}) {
  const inputId = useId();
  const { t } = useTranslator();
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <span>
        <button
          aria-label={t('tools.decrease', { label })}
          onClick={() => {
            change(String(numeric(value) - 1));
          }}
          type="button"
        >
          −
        </button>
        <input
          id={inputId}
          aria-label={label}
          type="number"
          step="any"
          value={value}
          onChange={(event) => {
            change(event.target.value);
          }}
        />
        <button
          aria-label={t('tools.increase', { label })}
          onClick={() => {
            change(String(numeric(value) + 1));
          }}
          type="button"
        >
          +
        </button>
      </span>
    </div>
  );
}
