import type { ElementId, Threat } from '@saerskriven/model';
import type { StudioTranslator } from '../messages/catalogues.js';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import { categoryLabel } from '../ui/category-field.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { FlagMarks, SeverityChip, StatusMark } from './threat-marks.js';
import styles from './threat-panel.module.css';
import { threatSummaryElements } from './threats.js';

/** The accordion trigger names every element on the model panel and only other elements on an element panel. */
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
  const named = threatSummaryElements(diagrams, threat, t)
    .filter(({ id }) => id !== on)
    .map(({ label }) => label);
  const elements = elementsLine(on, named, threat.appliesToModel, t);

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
        {threat.appliesToModel && (
          <>
            {' '}
            <span className={styles.onElements} data-on-model="">
              {t('fields.applies-to-whole-model')}
            </span>
          </>
        )}
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
  appliesToModel: boolean,
  t: StudioTranslator['t'],
): string | undefined {
  if (named.length > 0) {
    return t(
      on === undefined ? 'panel.on-elements' : 'panel.also-on-elements',
      {
        list: named,
      },
    );
  }
  return on === undefined && !appliesToModel
    ? t('panel.on-no-element')
    : undefined;
}
