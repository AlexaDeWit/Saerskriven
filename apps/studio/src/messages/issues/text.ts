import type {
  ParseIssue,
  ParseIssueDetail,
  SourceReferent,
  StringFormat,
  ValueKind,
} from '@saerskriven/model';
import type { Speaker } from '../said.js';

/**
 * One parse issue as a line in the reader's language: where in the input it
 * sits, then what the code says, with the whole document named where the
 * issue points at no path.
 */
export function parseIssueLine(t: Speaker, issue: ParseIssue): string {
  const detail = parseIssueDetail(t, issue.detail);
  return issue.path.length > 0
    ? t('issues.line', { path: issue.path.join('.'), detail })
    : t('issues.line-root', { detail });
}

/** What one parse issue code says, with the data the parse passed through. */
export function parseIssueDetail(t: Speaker, detail: ParseIssueDetail): string {
  switch (detail.code) {
    case 'type-mismatch':
      return t('issues.type-mismatch', {
        expected: kindText(t, detail.parameters.expected),
        received: kindText(t, detail.parameters.received),
      });
    case 'value-unexpected':
      return t('issues.value-unexpected', detail.parameters);
    case 'option-unmatched':
      return t('issues.option-unmatched');
    case 'too-small':
      return smallBound(t, detail.parameters);
    case 'too-big':
      return bigBound(t, detail.parameters);
    case 'format-mismatch':
      return t(formatIds[detail.parameters.format]);
    case 'value-refused':
      return t('issues.value-refused');
    case 'operation-unknown':
      return t('issues.operation-unknown');
    case 'text-character-refused':
      return t('issues.text-character-refused');
    case 'element-kind-changed':
      return t('issues.element-kind-changed');
    case 'duplicate-element-id':
      return t('issues.duplicate-element-id', detail.parameters);
    case 'duplicate-diagram-id':
      return t('issues.duplicate-diagram-id', detail.parameters);
    case 'duplicate-threat-id':
      return t('issues.duplicate-threat-id', detail.parameters);
    case 'duplicate-mitigation-id':
      return t('issues.duplicate-mitigation-id', detail.parameters);
    case 'duplicate-assumption-id':
      return t('issues.duplicate-assumption-id', detail.parameters);
    case 'duplicate-identifier':
      return t('issues.duplicate-identifier', detail.parameters);
    case 'duplicate-threat-number':
      return t('issues.duplicate-threat-number', detail.parameters);
    case 'threat-number-above-issued':
      return t('issues.threat-number-above-issued', detail.parameters);
    case 'flow-endpoint-self':
      return t('issues.flow-endpoint-self', detail.parameters);
    case 'flow-endpoint-foreign':
      return t('issues.flow-endpoint-foreign', detail.parameters);
    case 'unknown-element-reference':
      return t('issues.unknown-element-reference', detail.parameters);
    case 'unknown-threat-reference':
      return t('issues.unknown-threat-reference', detail.parameters);
    case 'related-element-unknown':
      return t('issues.related-element-unknown', detail.parameters);
    case 'related-boundary-unknown':
      return t('issues.related-boundary-unknown', detail.parameters);
    case 'related-flow-unknown':
      return t('issues.related-flow-unknown', detail.parameters);
    case 'unknown-source-reference':
      return t(sourceIds[detail.parameters.kind], {
        id: detail.parameters.id,
      });
    case 'import-format-unnamed':
      return t('issues.import-format-unnamed');
    case 'issue-flood':
      return t('issues.issue-flood');
    case 'schema-threw':
      return t('issues.schema-threw');
    default:
      return undescribed(detail);
  }
}

type Bound = {
  readonly bound: number;
  readonly kind: ValueKind;
  readonly inclusive: boolean;
};

const kindIds = {
  string: 'issues.kind-string',
  number: 'issues.kind-number',
  integer: 'issues.kind-integer',
  boolean: 'issues.kind-boolean',
  array: 'issues.kind-array',
  object: 'issues.kind-object',
  date: 'issues.kind-date',
  null: 'issues.kind-null',
  undefined: 'issues.kind-undefined',
  other: 'issues.kind-other',
} as const satisfies Record<ValueKind, string>;

const sourceIds = {
  component: 'issues.source-component-unknown',
  asset: 'issues.source-asset-unknown',
  threat: 'issues.source-threat-unknown',
  mitigation: 'issues.source-mitigation-unknown',
  'trust-zone': 'issues.source-trust-zone-unknown',
  endpoint: 'issues.source-endpoint-unknown',
  'data-store': 'issues.source-data-store-unknown',
} as const satisfies Record<SourceReferent, string>;

const formatIds = {
  regex: 'issues.format-regex',
  url: 'issues.format-url',
  date: 'issues.format-date',
  datetime: 'issues.format-datetime',
  other: 'issues.format-other',
} as const satisfies Record<StringFormat, string>;

function undescribed(_detail: never): string {
  return '';
}

function kindText(t: Speaker, kind: ValueKind): string {
  return t(kindIds[kind]);
}

function smallBound(t: Speaker, parameters: Bound): string {
  if (!parameters.inclusive) {
    return t('issues.too-small-above', parameters);
  }
  if (parameters.kind === 'string') {
    return t('issues.too-small-characters', parameters);
  }
  return parameters.kind === 'array'
    ? t('issues.too-small-items', parameters)
    : t('issues.too-small-value', parameters);
}

function bigBound(t: Speaker, parameters: Bound): string {
  if (!parameters.inclusive) {
    return t('issues.too-big-below', parameters);
  }
  if (parameters.kind === 'string') {
    return t('issues.too-big-characters', parameters);
  }
  return parameters.kind === 'array'
    ? t('issues.too-big-items', parameters)
    : t('issues.too-big-value', parameters);
}
