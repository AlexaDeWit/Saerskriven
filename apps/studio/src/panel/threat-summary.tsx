import { severityToneClass } from '@saerskriven/canvas';
import {
  recordsLinkedTo,
  threatFlags,
  type Threat,
  type ThreatFlag,
} from '@saerskriven/model';
import { flagLabel } from '@saerskriven/render';
import { useShallow } from 'zustand/react/shallow';
import { useModelStore } from '../store/store.js';
import styles from './threat-panel.module.css';

const flagGlyphs = {
  'mitigated-without-implemented-work': 'M6 1.5 11 10.5H1Z M6 5v2.5 M6 9v.01',
  'rests-on-invalidated-assumption': 'M1.5 1.5h9v9h-9Z M4 4l4 4 M8 4 4 8',
} as const satisfies Record<ThreatFlag, string>;

/**
 * What a collapsed threat says about itself: number, title, severity,
 * status, how many mitigations and assumptions it is linked to, and a mark
 * per flag it raises, in that order, which is also its accordion trigger's
 * accessible name. Each flag mark has a glyph shape of its own and its label
 * as text, so none depends on colour.
 */
export function ThreatSummary({ threat }: { readonly threat: Threat }) {
  const mitigations = useModelStore(
    (state) => recordsLinkedTo(state.present.mitigations, threat.id).length,
  );
  const assumptions = useModelStore(
    (state) => recordsLinkedTo(state.present.assumptions, threat.id).length,
  );
  const flags = useModelStore(
    useShallow((state) => threatFlags(state.present, threat)),
  );

  return (
    <>
      <span className={styles.number}>{threat.number}</span>
      <span className={styles.summary}>
        <span>{threat.title}</span>
        <span className={styles.metadata}>
          <span className={styles.severity}>
            <svg aria-hidden="true" className={styles.tone} viewBox="0 0 12 12">
              <circle
                className={severityToneClass[threat.severity]}
                cx="6"
                cy="6"
                r="5"
              />
            </svg>
            Severity: {threat.severity}
          </span>
          <span>Status: {threat.status}</span>
          <span data-count="mitigations">Mitigations: {mitigations}</span>
          <span data-count="assumptions">Assumptions: {assumptions}</span>
          {flags.map((flag) => (
            <span className={styles.flag} data-flag={flag} key={flag}>
              <svg
                aria-hidden="true"
                className={styles.tone}
                viewBox="0 0 12 12"
              >
                <path className={styles.flagGlyph} d={flagGlyphs[flag]} />
              </svg>
              {flagLabel(flag)}
            </span>
          ))}
        </span>
      </span>
    </>
  );
}
