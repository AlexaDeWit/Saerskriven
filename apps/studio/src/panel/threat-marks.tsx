import { severityToneClass } from '@saerskriven/canvas';
import {
  threatFlags,
  type Severity,
  type Threat,
  type ThreatFlag,
  type ThreatStatus,
} from '@saerskriven/model';
import { Fragment } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  flagMessages,
  severityMessages,
  statusMessages,
} from '../messages/enum-labels.js';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import styles from './threat-panel.module.css';

const circle = 'M6 1.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z';

const flagGlyphs = {
  'mitigated-without-implemented-work': 'M6 1.5 11 10.5H1Z M6 5v2.5 M6 9v.01',
  'rests-on-invalidated-assumption': 'M1.5 1.5h9v9h-9Z M4 4l4 4 M8 4 4 8',
} as const satisfies Record<ThreatFlag, string>;

const statusGlyphs = {
  open: circle,
  'accepted-risk': 'M6 1.5 10.5 6 6 10.5 1.5 6Z',
  transferred: 'M1.5 6h8.5 M7 3l3 3-3 3',
  mitigated: 'M6 1.5 10 3v3c0 2.4-1.7 4-4 4.5C3.7 10 2 8.4 2 6V3Z',
  avoided: 'M1.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5 M6.5 7.5l2 2 2-2',
  eliminated: 'M2 6.5 4.8 9.5 10 2.5',
  'not-applicable': `${circle} M2.8 9.2 9.2 2.8`,
} as const satisfies Record<ThreatStatus, string>;

function Glyph({ path }: { readonly path: string }) {
  return (
    <svg aria-hidden="true" className={styles.tone} viewBox="0 0 12 12">
      <path className={styles.glyph} d={path} />
    </svg>
  );
}

function Spoken({
  label,
  named,
}: {
  readonly label: string;
  readonly named: string | undefined;
}) {
  return named === undefined ? (
    <span>{label}</span>
  ) : (
    <>
      <span aria-hidden="true">{label}</span>
      <VisuallyHidden>{named}</VisuallyHidden>
    </>
  );
}

/**
 * A severity in a chip: the canvas tone and the severity's label. A screen
 * reader hears the label with the field it belongs to ("Severity: High"),
 * or alone where `headed`, in a table column whose header names the field.
 */
export function SeverityChip({
  severity,
  headed = false,
}: {
  readonly severity: Severity;
  readonly headed?: boolean;
}) {
  const { t } = useTranslator();
  const label = t(severityMessages[severity]);

  return (
    <span className={styles.severity} data-severity={severity}>
      <svg aria-hidden="true" className={styles.tone} viewBox="0 0 12 12">
        <circle className={severityToneClass[severity]} cx="6" cy="6" r="5" />
      </svg>
      <Spoken
        label={label}
        named={
          headed ? undefined : t('panel.summary-severity', { severity: label })
        }
      />
    </span>
  );
}

/**
 * A status with a glyph of its own. Open is drawn as a filled pill and every
 * other status in muted text, so the threats still open stand out of a list.
 * A screen reader hears the label with its field ("Status: Open"), or alone
 * where `headed`, as {@link SeverityChip} does.
 */
export function StatusMark({
  status,
  headed = false,
}: {
  readonly status: ThreatStatus;
  readonly headed?: boolean;
}) {
  const { t } = useTranslator();
  const label = t(statusMessages[status]);

  return (
    <span className={styles.status} data-status={status}>
      <Glyph path={statusGlyphs[status]} />
      <Spoken
        label={label}
        named={
          headed ? undefined : t('panel.summary-status', { status: label })
        }
      />
    </span>
  );
}

/**
 * A mark per flag the threat raises, read from the model as it stands: a
 * glyph shape of its own, an outline and its label, all in the text colour,
 * so every mark stays distinct in forced colours.
 */
export function FlagMarks({ threat }: { readonly threat: Threat }) {
  const flags = useModelStore(
    useShallow((state) => threatFlags(state.present, threat)),
  );
  const { t } = useTranslator();

  return flags.map((flag) => (
    <Fragment key={flag}>
      {' '}
      <span className={styles.flag} data-flag={flag}>
        <Glyph path={flagGlyphs[flag]} />
        {t(flagMessages[flag])}
      </span>
    </Fragment>
  ));
}
