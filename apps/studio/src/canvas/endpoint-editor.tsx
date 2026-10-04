import {
  isEmptyName,
  pointSchema,
  sides,
  storedNumber,
  type ElementId,
  type Side,
} from '@saerskriven/model';
import { useState, type FormEvent } from 'react';
import { Action } from '../store/actions.js';
import { selectedElementRecord } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { changedModel } from '../store/store.js';
import { announce } from './announcements.js';
import { flowEnds } from './elements.js';
import { freeEndSaid } from './flow-bends.js';
import { coordinateRange, NumberField, numeric } from './geometry-editor.js';
import { currentLayout } from './layout.js';
import { sideMessages } from '../messages/enum-labels.js';
import { commandDecimals, mostTypedDecimals } from './stored-decimals.js';
import { useTranslator } from '../messages/locale.js';
import styles from './selection-controls.module.css';

const freePoint = '';

/**
 * The form moving one end of the selected flow: to another element and side,
 * or free at a typed position, which is stored as typed up to
 * `mostTypedDecimals`. The position starts where the end is drawn: a free
 * end's own stored position, or an attached end's anchor, which is worked out
 * and so written at `commandDecimals`.
 */
export function EndpointEditor({
  state,
  side,
  close,
}: {
  readonly state: State;
  readonly side: 'source' | 'target';
  readonly close: () => void;
}) {
  const element = selectedElementRecord(state);
  const flow = element?.kind === 'flow' ? element : undefined;
  const other = side === 'source' ? flow?.target : flow?.source;
  const layout = currentLayout(state);
  const options = flowEnds(layout).filter(
    (node) => other?.kind !== 'attached' || node.id !== other.element,
  );
  const previous = flow?.[side];
  const [target, setTarget] = useState<
    ElementId | typeof freePoint | undefined
  >(
    previous?.kind === 'attached'
      ? previous.element
      : previous?.kind === 'free'
        ? freePoint
        : options[0]?.id,
  );
  const [anchor, setAnchor] = useState<Side | undefined>(
    previous?.kind === 'attached' ? previous.side : undefined,
  );
  const edge = layout.edges.find((candidate) => candidate.id === flow?.id);
  const drawn = side === 'source' ? edge?.source : edge?.target;
  const drawnAt = previous?.kind === 'free' ? undefined : commandDecimals;
  const [position, setPosition] = useState({
    x: String(storedNumber(drawn?.x ?? 0, drawnAt)),
    y: String(storedNumber(drawn?.y ?? 0, drawnAt)),
  });
  const [refused, setRefused] = useState(false);
  const { t } = useTranslator();
  const end = t(side === 'source' ? 'tools.source' : 'tools.target');
  const commit = (event: FormEvent) => {
    event.preventDefault();
    if (flow === undefined || target === undefined) {
      return;
    }
    if (target === freePoint) {
      const at = pointSchema.safeParse({
        x: numeric(position.x),
        y: numeric(position.y),
      });
      if (!at.success) {
        setRefused(true);
        announce((speak) => speak('canvas.position-invalid', coordinateRange));
        return;
      }
      const moved = changedModel(
        Action.SetFlowEndPosition({
          elementId: flow.id,
          side,
          position: at.data,
          decimals: mostTypedDecimals,
        }),
      );
      close();
      if (moved) {
        announce(freeEndSaid(flow, side));
      }
      return;
    }
    const reconnected = changedModel(
      Action.ReconnectFlow({
        elementId: flow.id,
        side,
        endpointId: target,
        anchor,
      }),
    );
    close();
    if (reconnected) {
      announce((speak) =>
        speak(
          side === 'source' ? 'canvas.source-changed' : 'canvas.target-changed',
        ),
      );
    }
  };
  return (
    <form onSubmit={commit}>
      <h2>{t('tools.flow-endpoint')}</h2>
      {flow === undefined ? (
        <p>{t('tools.select-one-flow')}</p>
      ) : (
        <label className={styles.field}>
          {end}
          <select
            aria-label={end}
            value={target ?? freePoint}
            onChange={(event) => {
              setTarget(
                event.target.value === freePoint
                  ? freePoint
                  : options.find((node) => node.id === event.target.value)?.id,
              );
            }}
          >
            <option value={freePoint}>{t('tools.free-position')}</option>
            {options.map((node) => (
              <option key={node.id} value={node.id}>
                {isEmptyName(node.name) ? node.id : node.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {flow !== undefined && target !== freePoint && (
        <label className={styles.field}>
          {t('tools.side')}
          <select
            aria-label={t('tools.side')}
            value={anchor ?? ''}
            onChange={(event) => {
              setAnchor(
                sides.find((candidate) => candidate === event.target.value),
              );
            }}
          >
            <option value="">{t('tools.automatic')}</option>
            {sides.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(sideMessages[candidate])}
              </option>
            ))}
          </select>
        </label>
      )}
      {flow !== undefined &&
        target === freePoint &&
        (['x', 'y'] as const).map((axis) => (
          <NumberField
            key={axis}
            quantity={`axis-${axis}`}
            value={position[axis]}
            change={(value) => {
              setPosition({ ...position, [axis]: value });
            }}
          />
        ))}
      {refused && target === freePoint && (
        <p>{t('canvas.position-invalid', coordinateRange)}</p>
      )}
      <div className={styles.actions}>
        <button
          disabled={flow === undefined || target === undefined}
          type="submit"
        >
          {t('tools.apply-endpoint')}
        </button>
        <button onClick={close} type="button">
          {t('tools.cancel')}
        </button>
      </div>
    </form>
  );
}
