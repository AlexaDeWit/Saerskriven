import { plural, text } from '@saerskriven/i18n';

const identified = { id: 'text' } as const;

const bound = { bound: 'number' } as const;

/**
 * What a schema or the model's own rules refused, one message per parse
 * issue code, with the kind and referent labels a code names and the line
 * that places the detail at its path. A path, an id and a schema's own
 * vocabulary are data the parse passed through, so no message joins English
 * fragments.
 */
export const issueMessages = {
  line: text({ path: 'text', detail: 'text' }),
  'line-root': text({ detail: 'text' }),
  'kind-string': text(),
  'kind-number': text(),
  'kind-integer': text(),
  'kind-boolean': text(),
  'kind-array': text(),
  'kind-object': text(),
  'kind-date': text(),
  'kind-null': text(),
  'kind-undefined': text(),
  'kind-other': text(),
  'referent-component': text(),
  'referent-asset': text(),
  'referent-threat': text(),
  'referent-mitigation': text(),
  'referent-trust-zone': text(),
  'referent-endpoint': text(),
  'referent-data-store': text(),
  'type-mismatch': text({ expected: 'text', received: 'text' }),
  'value-unexpected': text({ values: 'list' }),
  'option-unmatched': text(),
  'too-small-characters': plural('bound'),
  'too-small-items': plural('bound'),
  'too-small-value': text(bound),
  'too-small-above': text(bound),
  'too-big-characters': plural('bound'),
  'too-big-items': plural('bound'),
  'too-big-value': text(bound),
  'too-big-below': text(bound),
  'format-mismatch': text({ format: 'text' }),
  'value-refused': text({ kind: 'text' }),
  'text-character-refused': text(),
  'element-kind-changed': text(),
  'duplicate-element-id': text(identified),
  'duplicate-diagram-id': text(identified),
  'duplicate-threat-id': text(identified),
  'duplicate-mitigation-id': text(identified),
  'duplicate-assumption-id': text(identified),
  'duplicate-identifier': text(identified),
  'duplicate-threat-number': text({ number: 'number' }),
  'threat-number-above-issued': text({ number: 'number', issued: 'number' }),
  'flow-endpoint-self': text(identified),
  'flow-endpoint-foreign': text(identified),
  'unknown-element-reference': text(identified),
  'unknown-threat-reference': text(identified),
  'related-element-unknown': text(identified),
  'related-boundary-unknown': text(identified),
  'related-flow-unknown': text(identified),
  'unknown-source-reference': text({ id: 'text', kind: 'text' }),
  'import-format-unnamed': text(),
  'issue-flood': text(),
  'schema-threw': text({ reason: 'text' }),
} as const;
