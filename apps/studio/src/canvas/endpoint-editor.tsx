import { sides, type ElementId, type Side } from '@saerskriven/model';
import { useState } from 'react';
import { Action } from '../store/actions.js';
import { selectedElementRecord } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { announce } from './announcements.js';
import { flowEnds } from './elements.js';
import { currentLayout } from './layout.js';
import { sideLabels } from './side-labels.js';
import styles from './selection-controls.module.css';

/** The form reconnecting one end of the selected flow to another element and side. */
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
  const options = flowEnds(currentLayout(state)).filter(
    (node) => other?.kind !== 'attached' || node.id !== other.element,
  );
  const previous = flow?.[side];
  const [target, setTarget] = useState<ElementId | undefined>(
    previous?.kind === 'attached' ? previous.element : options[0]?.id,
  );
  const [anchor, setAnchor] = useState<Side | undefined>(
    previous?.kind === 'attached' ? previous.side : undefined,
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (flow !== undefined && target !== undefined) {
          dispatch(
            Action.ReconnectFlow({
              elementId: flow.id,
              side,
              endpointId: target,
              anchor,
            }),
          );
          close();
          if (modelStore.getState().present !== state.present) {
            announce(`Changed flow ${side}.`);
          }
        }
      }}
    >
      <h2>Flow endpoint</h2>
      {flow === undefined ? (
        <p>Select one flow to reconnect it.</p>
      ) : (
        <label className={styles.field}>
          {side === 'source' ? 'Source' : 'Target'}
          <select
            aria-label={side === 'source' ? 'Source' : 'Target'}
            value={target ?? ''}
            onChange={(event) => {
              setTarget(
                options.find((node) => node.id === event.target.value)?.id,
              );
            }}
          >
            {options.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name || node.id}
              </option>
            ))}
          </select>
        </label>
      )}
      {flow !== undefined && (
        <label className={styles.field}>
          Side
          <select
            aria-label="Side"
            value={anchor ?? ''}
            onChange={(event) => {
              setAnchor(
                sides.find((candidate) => candidate === event.target.value),
              );
            }}
          >
            <option value="">Automatic</option>
            {sides.map((candidate) => (
              <option key={candidate} value={candidate}>
                {sideLabels[candidate]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={styles.actions}>
        <button
          disabled={flow === undefined || target === undefined}
          type="submit"
        >
          Apply endpoint
        </button>
        <button onClick={close} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
