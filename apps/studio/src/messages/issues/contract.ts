import { plural, text } from '@saerskriven/i18n';

const identified = { id: 'text' } as const;

const bound = { bound: 'number' } as const;

/**
 * What a schema or the model's own rules refused, one message per parse
 * issue code, with a message of its own for each kind, each string format
 * and each source referent so no locale composes a determiner or an agreeing
 * participle onto a noun, and the line that places the detail at its path. A path and an id are data the parse passed
 * through, so no message joins English fragments.
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
  'format-regex': text(),
  'format-url': text(),
  'format-date': text(),
  'format-datetime': text(),
  'format-other': text(),
  'source-component-unknown': text(identified),
  'source-asset-unknown': text(identified),
  'source-threat-unknown': text(identified),
  'source-mitigation-unknown': text(identified),
  'source-trust-zone-unknown': text(identified),
  'source-endpoint-unknown': text(identified),
  'source-data-store-unknown': text(identified),
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
  'value-refused': text(),
  'operation-unknown': text(),
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
  'import-format-unnamed': text(),
  'issue-flood': text(),
  'schema-threw': text(),
} as const;
