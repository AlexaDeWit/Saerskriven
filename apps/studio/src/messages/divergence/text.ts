import type { Divergence, DivergenceDetail } from '@saerskriven/formats';
import type { Translator } from '@saerskriven/i18n';
import type { StudioMessages } from '../catalogues.js';

type Speaker = Translator<StudioMessages>['t'];

/**
 * One divergence as a sentence in the reader's language: its subject, what
 * the code says, and why, assembled by the `line` message so each locale
 * owns the order and the punctuation.
 */
export function divergenceLine(t: Speaker, divergence: Divergence): string {
  return t('divergence.line', {
    subject: subjectText(t, divergence.subject),
    detail: divergenceDetail(t, divergence.detail),
    reason: t(`divergence.reason-${divergence.reason}`),
  });
}

/** What one divergence code says, with the data the codec passed through. */
export function divergenceDetail(t: Speaker, detail: DivergenceDetail): string {
  switch (detail.code) {
    case 'release-restamped':
      return t('divergence.release-restamped', detail.parameters);
    case 'threat-mark-raised-by-issue':
      return t('divergence.threat-mark-raised-by-issue', detail.parameters);
    case 'threat-mark-raised-to-issued':
      return t('divergence.threat-mark-raised-to-issued', detail.parameters);
    case 'diagram-mark-raised-by-issue':
      return t('divergence.diagram-mark-raised-by-issue', detail.parameters);
    case 'diagram-mark-raised-to-issued':
      return t('divergence.diagram-mark-raised-to-issued', detail.parameters);
    case 'assumption-unrecorded':
      return t('divergence.assumption-unrecorded');
    case 'diagram-discarded':
      return t('divergence.diagram-discarded', detail.parameters);
    case 'threat-copy-detached':
      return t('divergence.threat-copy-detached', detail.parameters);
    case 'threat-discarded':
      return t('divergence.threat-discarded', detail.parameters);
    case 'note-name-dropped':
      return t('divergence.note-name-dropped', detail.parameters);
    case 'scope-marking-dropped':
      return t('divergence.scope-marking-dropped');
    case 'cell-reshaped':
      return t('divergence.cell-reshaped', detail.parameters);
    case 'diagram-name-numbered':
      return t('divergence.diagram-name-numbered', detail.parameters);
    case 'cell-discarded':
      return t('divergence.cell-discarded', detail.parameters);
    case 'threat-attachment-stray':
      return detail.parameters.kind === undefined
        ? t('divergence.threat-attachment-stray-unknown', {
            element: detail.parameters.element,
          })
        : t('divergence.threat-attachment-stray', {
            element: detail.parameters.element,
            kind: detail.parameters.kind,
          });
    case 'threat-unplaceable':
      return t('divergence.threat-unplaceable');
    case 'threat-split-across-elements':
      return t('divergence.threat-split-across-elements', detail.parameters);
    case 'threat-category-unnamed':
      return t('divergence.threat-category-unnamed', detail.parameters);
    case 'mitigation-records-merged':
      return t('divergence.mitigation-records-merged', detail.parameters);
    case 'mitigation-title-merged':
      return t('divergence.mitigation-title-merged');
    case 'mitigation-empty-dropped':
      return t('divergence.mitigation-empty-dropped', detail.parameters);
    case 'mitigation-status-dropped':
      return t('divergence.mitigation-status-dropped', detail.parameters);
    case 'mitigation-unlinked':
      return t('divergence.mitigation-unlinked', detail.parameters);
    case 'mitigation-split-across-threats':
      return t('divergence.mitigation-split-across-threats', detail.parameters);
    case 'threat-status-unmapped':
      return t('divergence.threat-status-unmapped', detail.parameters);
    case 'threat-severity-unmapped':
      return t('divergence.threat-severity-unmapped', detail.parameters);
    case 'threat-category-eop-suit':
      return t('divergence.threat-category-eop-suit');
    case 'threat-category-unmapped':
      return t('divergence.threat-category-unmapped', detail.parameters);
    case 'key-undeclared':
      return t('divergence.key-undeclared', detail.parameters);
    case 'assumption-element-links-dropped':
      return t('divergence.assumption-element-links-dropped');
    case 'otm-threat-split':
      return t('divergence.otm-threat-split', detail.parameters);
    case 'otm-threat-undecided':
      return t('divergence.otm-threat-undecided', detail.parameters);
    case 'otm-threat-status-unmapped':
      return detail.parameters.status === undefined
        ? t('divergence.otm-threat-status-absent')
        : t('divergence.otm-threat-status-unmapped', {
            status: detail.parameters.status,
          });
    case 'otm-mitigation-split':
      return t('divergence.otm-mitigation-split', detail.parameters);
    case 'otm-mitigation-status-retained':
      return detail.parameters.status == null
        ? t('divergence.otm-mitigation-status-absent', {
            id: detail.parameters.id,
          })
        : t('divergence.otm-mitigation-status-retained', {
            id: detail.parameters.id,
            status: detail.parameters.status,
          });
    case 'otm-mitigation-unlinked':
      return t('divergence.otm-mitigation-unlinked', detail.parameters);
    case 'otm-assets-as-descriptions':
      return t('divergence.otm-assets-as-descriptions');
    case 'otm-components-as-processes':
      return t('divergence.otm-components-as-processes');
    case 'otm-geometry-generated':
      return t('divergence.otm-geometry-generated', detail.parameters);
    case 'tmbom-threats-undecided':
      return t('divergence.tmbom-threats-undecided');
    case 'tmbom-control-proposed':
      return t('divergence.tmbom-control-proposed', detail.parameters);
    case 'tmbom-control-unlinked':
      return t('divergence.tmbom-control-unlinked', detail.parameters);
    case 'tmbom-geometry-generated':
      return t('divergence.tmbom-geometry-generated');
    case 'tmbom-flow-fields-as-prose':
      return t('divergence.tmbom-flow-fields-as-prose');
    case 'tmbom-data-set-as-prose':
      return t('divergence.tmbom-data-set-as-prose', detail.parameters);
    case 'tmbom-data-set-dropped':
      return t('divergence.tmbom-data-set-dropped', detail.parameters);
    case 'field-not-retained':
      return t('divergence.field-not-retained', {
        path: detail.parameters.path.join('.'),
      });
    default:
      return undescribed(detail);
  }
}

function undescribed(_detail: never): string {
  return '';
}

function subjectText(t: Speaker, subject: Divergence['subject']): string {
  return subject.kind === 'model'
    ? t('divergence.subject-model')
    : t(`divergence.subject-${subject.kind}`, { id: subject.id });
}
