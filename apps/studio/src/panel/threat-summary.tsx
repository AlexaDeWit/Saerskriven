import type { ElementId, Threat } from '@saerskriven/model';
import type { StudioTranslator } from '../messages/catalogues.js';
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
 * status, category and a mark per raised flag, then the elements it is on:
 * on an element's panel (`on`) the others it names, where it names any, and
 * on the model's every one, or that it is on none.
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
  const named = threatAttachments(diagrams, threat, t)
    .filter(({ id }) => id !== on)
    .map(({ label }) => label);
  const elements = elementsLine(on, named, t);

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
        {elements !== undefined && (
          <>
            {' '}
            <span className={styles.onElements} data-on-elements="">
              {elements}
            </span>
          </>
        )}
      </span>
    </>
  );
}

function elementsLine(
  on: ElementId | undefined,
  named: readonly string[],
  t: StudioTranslator['t'],
): string | undefined {
  if (on !== undefined) {
    return named.length > 0
      ? t('panel.also-on-elements', { list: named })
      : undefined;
  }
  return named.length > 0
    ? t('panel.on-elements', { list: named })
    : t('panel.on-no-element');
}
