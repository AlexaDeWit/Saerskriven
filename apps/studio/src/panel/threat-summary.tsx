import type { ElementId, Threat } from '@saerskriven/model';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import { categoryLabel } from '../ui/category-field.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { FlagMarks, SeverityChip, StatusMark } from './threat-marks.js';
import styles from './threat-panel.module.css';
import { threatAttachments } from './threats.js';

/**
 * A collapsed threat's summary, which is also its accordion trigger's
 * accessible name, in drawn order. Its number and title, then its severity,
 * status, category and a mark per raised flag, then where the threat names
 * an element besides `on` (the element whose panel shows it), those
 * elements.
 */
export function ThreatSummary({
  threat,
  on,
}: {
  readonly threat: Threat;
  readonly on: ElementId | undefined;
}) {
  const diagrams = useModelStore((state) => state.present.diagrams);
  const { t } = useTranslator();
  const category = categoryLabel(threat.category, t);
  const others = threatAttachments(diagrams, threat, t)
    .filter(({ id }) => id !== on)
    .map(({ label }) => label);

  return (
    <>
      <span className={styles.number}>{threat.number}</span>{' '}
      <span className={styles.summary}>
        <span>{threat.title}</span>{' '}
        <span className={styles.metadata}>
          <SeverityChip severity={threat.severity} />{' '}
          <StatusMark status={threat.status} />{' '}
          <span className={styles.category}>
            <span aria-hidden="true">{category}</span>
            <VisuallyHidden>
              {t('panel.summary-category', { category })}
            </VisuallyHidden>
          </span>
          <FlagMarks threat={threat} />
        </span>
        {others.length > 0 && (
          <>
            {' '}
            <span className={styles.alsoOn} data-also-on="">
              {t('panel.also-on-elements', { list: others })}
            </span>
          </>
        )}
      </span>
    </>
  );
}
