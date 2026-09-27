import { plural, text } from '@saerskriven/i18n';

const name = { name: 'text' } as const;

const id = { id: 'text' } as const;

const bound = { limit: 'text', bound: 'number', observed: 'number' } as const;

/**
 * The failure notice and the refusals a text field shows: the headline of
 * each failure and the sentence of each refused operation, with the ids,
 * names and limits the failure carries passed through as parameters.
 */
export const noticeMessages = {
  problems: text(),
  dismiss: text(),
  'refusal-details': plural('count'),
  'operation-refused': text(),
  'file-unreachable': text(),
  'recovery-rejected': text(),
  'recovery-unavailable': text(),
  'no-format-claimed': text(name),
  'formats-tried': text({ formats: 'list' }),
  'read-limit': text(name),
  'read-limit-detail': text(bound),
  'malformed-text': text(name),
  'invalid-document': text(name),
  'invalid-model': text(name),
  'snapshot-limit-detail': text(bound),
  'snapshot-unsupported': text(),
  'snapshot-earlier-release': text(),
  'snapshot-release': text({ release: 'text' }),
  'field-not-saved': text({ field: 'text' }),
  'refused-character': text({ position: 'number' }),
  'empty-name': text(),
  'op-element-properties': text(),
  'op-element-relationships': text(),
  'op-fragment': text(),
  'op-unknown-diagram': text(id),
  'op-duplicate-diagram': text(id),
  'op-empty-title': text(id),
  'op-title-character': text(id),
  'op-diagram-not-empty': plural('count', id),
  'op-unknown-element': text(id),
  'op-unknown-threat': text(id),
  'op-unknown-mitigation': text(id),
  'op-unknown-assumption': text(id),
  'op-duplicate-element': text(id),
  'op-duplicate-threat': text(id),
  'op-duplicate-mitigation': text(id),
  'op-duplicate-assumption': text(id),
  'op-mitigation-without-threat': text(id),
  'op-assumption-without-threat': text(id),
  'op-assumption-without-reference': text(id),
  'op-reused-number': text({ number: 'number' }),
  'op-changed-number': text({ id: 'text', number: 'number' }),
  'op-source-endpoint': text(id),
  'op-target-endpoint': text(id),
  'op-not-resizable': text(id),
  'op-not-note': text(id),
  'op-not-flow': text(id),
  'op-empty-name': text(id),
  'op-element-character': text(id),
  'op-model-title-character': text(),
  'op-model-owner-character': text(),
  'op-model-description-character': text(),
  'op-contributor-character': text({ entry: 'number' }),
} as const;
