import { plural, text } from '@saerskriven/i18n';

const id = { id: 'text' } as const;

const name = { name: 'text' } as const;

const mark = { from: 'text', raised: 'text' } as const;

/**
 * What a codec or an import reports it could not carry, one message per
 * divergence code, with the subject and the reason each line names. A
 * parameter is data the codec passed through, so no message joins English
 * fragments.
 */
export const divergenceMessages = {
  line: text({ subject: 'text', detail: 'text', reason: 'text' }),
  'subject-model': text(),
  'subject-diagram': text(id),
  'subject-element': text(id),
  'subject-threat': text(id),
  'subject-mitigation': text(id),
  'subject-assumption': text(id),
  'reason-unrepresentable': text(),
  'reason-undeclared': text(),
  'reason-narrowed': text(),
  'reason-split': text(),
  'reason-overridden': text(),
  'reason-discarded-by-edit': text(),
  'release-restamped': text({ from: 'text', written: 'text' }),
  'threat-mark-raised-by-issue': text(mark),
  'threat-mark-raised-to-issued': text(mark),
  'diagram-mark-raised-by-issue': text(mark),
  'diagram-mark-raised-to-issued': text(mark),
  'assumption-unrecorded': text(),
  'diagram-discarded': text({ title: 'text' }),
  'threat-copy-detached': text({ cell: 'text' }),
  'threat-discarded': text({ title: 'text' }),
  'note-name-dropped': text(name),
  'scope-marking-dropped': text(),
  'cell-reshaped': text({ shape: 'text', kind: 'text' }),
  'diagram-name-numbered': text({ number: 'text' }),
  'cell-discarded': text({ shape: 'text' }),
  'threat-attachment-stray': text({ element: 'text', kind: 'text' }),
  'threat-attachment-stray-unknown': text({ element: 'text' }),
  'threat-unplaceable': text(),
  'threat-split-across-elements': plural('count'),
  'threat-category-unnamed': text({
    methodology: 'text',
    category: 'text',
  }),
  'mitigation-records-merged': plural('count'),
  'mitigation-title-merged': text(),
  'mitigation-empty-dropped': text({ threat: 'text' }),
  'mitigation-status-dropped': text({
    status: 'text',
    threat: 'text',
    inferred: 'text',
  }),
  'mitigation-unlinked': text(name),
  'mitigation-split-across-threats': plural('count'),
  'threat-status-unmapped': text({ status: 'text' }),
  'threat-severity-unmapped': text({ severity: 'text' }),
  'threat-category-eop-suit': text(),
  'threat-category-unmapped': text({ category: 'text' }),
  'key-undeclared': text({ path: 'text' }),
  'assumption-element-links-dropped': text(),
  'otm-threat-split': text(id),
  'otm-threat-undecided': text(id),
  'otm-threat-status-unmapped': text({ status: 'text' }),
  'otm-threat-status-absent': text(),
  'otm-mitigation-split': text(id),
  'otm-mitigation-status-retained': text({ id: 'text', status: 'text' }),
  'otm-mitigation-status-absent': text(id),
  'otm-mitigation-unlinked': text(id),
  'otm-assets-as-descriptions': text(),
  'otm-components-as-processes': text(),
  'otm-geometry-generated': text(id),
  'tmbom-threats-undecided': text(),
  'tmbom-control-proposed': text(name),
  'tmbom-control-unlinked': text(name),
  'tmbom-geometry-generated': text(),
  'tmbom-flow-fields-as-prose': text(),
  'tmbom-data-set-as-prose': text(name),
  'tmbom-data-set-dropped': text(name),
  'field-not-retained': text({ path: 'text' }),
} as const;
