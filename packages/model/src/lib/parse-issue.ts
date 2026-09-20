import { z } from 'zod';
import { carrying, coded } from './coded.js';

const valueKindSchema = z.enum([
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
  'date',
  'null',
  'undefined',
  'other',
]);

/**
 * The kinds a structural issue names, a closed set a reader labels in its own
 * language. A kind a schema or a value does not fall into is `other`.
 */
export type ValueKind = z.infer<typeof valueKindSchema>;

const sourceReferentSchema = z.enum([
  'component',
  'asset',
  'threat',
  'mitigation',
  'trust-zone',
  'endpoint',
  'data-store',
]);

/** What an entry of a source document names when a mapping cannot resolve it. */
export type SourceReferent = z.infer<typeof sourceReferentSchema>;

const stringFormatSchema = z.enum([
  'regex',
  'url',
  'date',
  'datetime',
  'other',
]);

/** The string formats this tree's schemas declare, and `other` for any later one. */
export type StringFormat = z.infer<typeof stringFormatSchema>;

const refusalKindSchema = z.enum([
  'custom',
  'not-multiple-of',
  'unrecognized-keys',
  'invalid-key',
  'invalid-element',
  'other',
]);

/** What a refusal no other code covers was about, as a closed set. */
export type RefusalKind = z.infer<typeof refusalKindSchema>;

const identified = { id: z.string() };

/**
 * What one parse issue is about, as a code and the data that code needs,
 * rather than a sentence, so a reader phrases the entry in its own language.
 * The first group is what a schema refused, the second what the model's own
 * rules refused, and the last two what stopped a parse from reporting at all.
 * `value-refused` is the catch-all, and `kind` names the shape of refusal it
 * stands for. Every parameter is closed data: a text a reader could not
 * phrase, such as a throw's own reason, is carried for a log rather than for
 * a line on screen.
 */
export const parseIssueDetailSchema = z.discriminatedUnion('code', [
  carrying('type-mismatch', {
    expected: valueKindSchema,
    received: valueKindSchema,
  }),
  carrying('value-unexpected', { values: z.array(z.string()) }),
  coded('option-unmatched'),
  carrying('too-small', {
    bound: z.number(),
    kind: valueKindSchema,
    inclusive: z.boolean(),
  }),
  carrying('too-big', {
    bound: z.number(),
    kind: valueKindSchema,
    inclusive: z.boolean(),
  }),
  carrying('format-mismatch', { format: stringFormatSchema }),
  carrying('value-refused', { kind: refusalKindSchema }),
  coded('text-character-refused'),
  coded('element-kind-changed'),
  coded('operation-unknown'),
  carrying('duplicate-element-id', identified),
  carrying('duplicate-diagram-id', identified),
  carrying('duplicate-threat-id', identified),
  carrying('duplicate-mitigation-id', identified),
  carrying('duplicate-assumption-id', identified),
  carrying('duplicate-identifier', identified),
  carrying('unknown-source-reference', {
    id: z.string(),
    kind: sourceReferentSchema,
  }),
  coded('import-format-unnamed'),
  carrying('duplicate-threat-number', { number: z.number() }),
  carrying('threat-number-above-issued', {
    number: z.number(),
    issued: z.number(),
  }),
  carrying('flow-endpoint-self', identified),
  carrying('flow-endpoint-foreign', identified),
  carrying('unknown-element-reference', identified),
  carrying('unknown-threat-reference', identified),
  carrying('related-element-unknown', identified),
  carrying('related-boundary-unknown', identified),
  carrying('related-flow-unknown', identified),
  coded('issue-flood'),
  carrying('schema-threw', { reason: z.string() }),
]);

/** One issue's code and the data that code carries. */
export type ParseIssueDetail = z.infer<typeof parseIssueDetailSchema>;

/** Every code a parse reports. */
export type ParseIssueCode = ParseIssueDetail['code'];

/**
 * One violation a parse found: where in the input it sits, and what it is, as
 * a code and its parameters. The detail holds no sentence, so an app words it
 * in the reader's language and this package needs none.
 */
export type ParseIssue = {
  readonly path: readonly (string | number)[];
  readonly detail: ParseIssueDetail;
};

/** The code of the one root issue that stands for a flood of issues. */
export const issueFloodCode = 'issue-flood';

const refusedCharacterCode = 'text-character-refused';

/** The detail `acceptedTextSchema` names for itself when it refuses a text. */
export const refusedCharacterDetail: ParseIssueDetail = {
  code: refusedCharacterCode,
};

/**
 * One issue as a schema reports it. Declared structurally rather than as a
 * zod type, so a caller behind its own parse boundary can hand its schema's
 * issues over without a zod type crossing the package boundary. Every field
 * but the path and the code is one kind of issue's own.
 */
export type SchemaIssue = {
  readonly path: readonly PropertyKey[];
  readonly code: string;
  readonly expected?: string | undefined;
  readonly origin?: string | undefined;
  readonly minimum?: number | bigint | undefined;
  readonly maximum?: number | bigint | undefined;
  readonly inclusive?: boolean | undefined;
  readonly format?: string | undefined;
  readonly values?: readonly unknown[] | undefined;
  readonly options?: readonly unknown[] | undefined;
  readonly params?: Readonly<Record<string, unknown>> | undefined;
};

/**
 * Schema issues as the plain {@link ParseIssue} data this package reports. A
 * schema that names its own detail carries it in the issue's `params`, and
 * every other issue is mapped by its kind. `given` is the value the schema
 * read: a type mismatch walks it along the issue's path for the kind it
 * received, since a schema reports what it expected alone. A symbol path
 * segment, which a key of that kind produces and JSON has no spelling for,
 * becomes its string form.
 */
export function toParseIssues(
  issues: readonly SchemaIssue[],
  given: unknown,
): readonly ParseIssue[] {
  return issues.map((issue) => ({
    path: issue.path.map((key) =>
      typeof key === 'symbol' ? String(key) : key,
    ),
    detail: detailOf(issue, given),
  }));
}

/** One issue as a line of text: its dotted path, `(root)` for an empty one, then what it says. */
export function issueLine(issue: ParseIssue): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return `${path}: ${parseIssueText(issue.detail)}`;
}

/**
 * One detail in English, the text the CLI and the MCP server print. A reader
 * that phrases a code itself, as the studio does, uses the code and its
 * parameters instead.
 */
export function parseIssueText(detail: ParseIssueDetail): string {
  switch (detail.code) {
    case 'type-mismatch':
      return `expected ${kindNoun(detail.parameters.expected)}, received ${kindNoun(detail.parameters.received)}`;
    case 'value-unexpected':
      return `expected one of ${detail.parameters.values.join(', ')}`;
    case 'option-unmatched':
      return 'no declared option accepts this value';
    case 'too-small':
      return `expected ${boundPhrase(detail.parameters, 'at least', 'more than')}`;
    case 'too-big':
      return `expected ${boundPhrase(detail.parameters, 'at most', 'less than')}`;
    case 'format-mismatch':
      return formatSentences[detail.parameters.format];
    case 'value-refused':
      return `the value is not accepted here (${refusalNouns[detail.parameters.kind]})`;
    case 'operation-unknown':
      return 'no operation of this server applies it';
    case 'text-character-refused':
      return 'text carries a character the model does not accept';
    case 'element-kind-changed':
      return 'properties must match the existing element kind';
    case 'duplicate-element-id':
      return `duplicate element id "${detail.parameters.id}": element ids must be unique across the model`;
    case 'duplicate-diagram-id':
      return `duplicate diagram id "${detail.parameters.id}": diagram ids must be unique across the model`;
    case 'duplicate-threat-id':
      return `duplicate threat id "${detail.parameters.id}": threat ids must be unique among threats`;
    case 'duplicate-mitigation-id':
      return `duplicate mitigation id "${detail.parameters.id}": mitigation ids must be unique among mitigations`;
    case 'duplicate-assumption-id':
      return `duplicate assumption id "${detail.parameters.id}": assumption ids must be unique among assumptions`;
    case 'duplicate-identifier':
      return `duplicate identifier "${detail.parameters.id}"`;
    case 'unknown-source-reference':
      return `names unknown ${referentNouns[detail.parameters.kind]} "${detail.parameters.id}"`;
    case 'import-format-unnamed':
      return 'import requires an OTM version stamp or a TM-BOM schema URI';
    case 'duplicate-threat-number':
      return `duplicate threat number ${String(detail.parameters.number)}: threat numbers must be unique across the model`;
    case 'threat-number-above-issued':
      return `threat number ${String(detail.parameters.number)} exceeds lastIssuedThreatNumber ${String(detail.parameters.issued)}: no threat carries a number above the last issued`;
    case 'flow-endpoint-self':
      return `references the flow's own id "${detail.parameters.id}": a flow cannot anchor to itself`;
    case 'flow-endpoint-foreign':
      return `references element id "${detail.parameters.id}", which is not in the flow's own diagram`;
    case 'unknown-element-reference':
      return `names unknown element id "${detail.parameters.id}"`;
    case 'unknown-threat-reference':
      return `names unknown threat id "${detail.parameters.id}"`;
    case 'related-element-unknown':
      return `references "${detail.parameters.id}", which must name another element in the element's own diagram`;
    case 'related-boundary-unknown':
      return `references "${detail.parameters.id}", which must name a trust boundary in the element's own diagram`;
    case 'related-flow-unknown':
      return `references "${detail.parameters.id}", which must name a flow in the element's own diagram`;
    case 'issue-flood':
      return 'the input has more problems than a parse can list';
    case 'schema-threw':
      return `the parse stopped: ${detail.parameters.reason}`;
    default:
      return unworded(detail);
  }
}

const kindNouns: Record<ValueKind, string> = {
  string: 'a string',
  number: 'a number',
  integer: 'an integer',
  boolean: 'a boolean',
  array: 'an array',
  object: 'an object',
  date: 'a date',
  null: 'null',
  undefined: 'nothing',
  other: 'another kind',
};

const formatSentences: Record<StringFormat, string> = {
  regex: 'the text does not match the pattern the schema declares',
  url: 'the text is not a web address',
  date: 'the text is not an ISO date',
  datetime: 'the text is not an ISO date and time',
  other: 'the text does not match the format the schema declares',
};

const refusalNouns: Record<RefusalKind, string> = {
  custom: 'a rule the schema declares',
  'not-multiple-of': 'a step the schema declares',
  'unrecognized-keys': 'a key the schema does not declare',
  'invalid-key': 'a key of an entry the schema declares',
  'invalid-element': 'an entry of a collection the schema declares',
  other: 'a rule no code of this package covers',
};

const refusalKinds: Readonly<Record<string, RefusalKind>> = {
  custom: 'custom',
  not_multiple_of: 'not-multiple-of',
  unrecognized_keys: 'unrecognized-keys',
  invalid_key: 'invalid-key',
  invalid_element: 'invalid-element',
};

const stringFormats: Readonly<Record<string, StringFormat>> = {
  regex: 'regex',
  url: 'url',
  date: 'date',
  datetime: 'datetime',
};

const heldKinds: Readonly<Record<string, ValueKind>> = {
  string: 'string',
  bigint: 'number',
  boolean: 'boolean',
  undefined: 'undefined',
  object: 'object',
};

const referentNouns: Record<SourceReferent, string> = {
  component: 'component',
  asset: 'asset',
  threat: 'threat',
  mitigation: 'mitigation',
  'trust-zone': 'trust zone',
  endpoint: 'endpoint',
  'data-store': 'data store',
};

const expectedKinds: Readonly<Record<string, ValueKind>> = {
  string: 'string',
  number: 'number',
  nan: 'number',
  bigint: 'number',
  int: 'integer',
  boolean: 'boolean',
  array: 'array',
  tuple: 'array',
  object: 'object',
  record: 'object',
  map: 'object',
  set: 'object',
  date: 'date',
  null: 'null',
  undefined: 'undefined',
  void: 'undefined',
  nonoptional: 'undefined',
};

function unworded(_detail: never): string {
  return '';
}

function kindNoun(kind: ValueKind): string {
  return kindNouns[kind];
}

function boundPhrase(
  parameters: {
    readonly bound: number;
    readonly kind: ValueKind;
    readonly inclusive: boolean;
  },
  inclusive: string,
  exclusive: string,
): string {
  const bound = `${parameters.inclusive ? inclusive : exclusive} ${String(parameters.bound)}`;
  if (!parameters.inclusive) {
    return bound;
  }
  if (parameters.kind === 'string') {
    return `${bound} ${counted(parameters.bound, 'character', 'characters')}`;
  }
  return parameters.kind === 'array'
    ? `${bound} ${counted(parameters.bound, 'entry', 'entries')}`
    : bound;
}

function counted(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function detailOf(issue: SchemaIssue, given: unknown): ParseIssueDetail {
  const named = issue.code === 'custom' ? namedDetail(issue.params) : undefined;
  if (named !== undefined) {
    return named;
  }
  switch (issue.code) {
    case 'invalid_type':
      return {
        code: 'type-mismatch',
        parameters: {
          expected: namedKind(issue.expected),
          received: kindOf(valueAt(given, issue.path)),
        },
      };
    case 'invalid_value':
      return {
        code: 'value-unexpected',
        parameters: { values: primitiveTexts(issue.values) },
      };
    case 'invalid_union':
      return issue.options === undefined || issue.options.length === 0
        ? { code: 'option-unmatched' }
        : {
            code: 'value-unexpected',
            parameters: { values: primitiveTexts(issue.options) },
          };
    case 'too_small':
      return {
        code: 'too-small',
        parameters: {
          bound: Number(issue.minimum ?? 0),
          kind: namedKind(issue.origin),
          inclusive: issue.inclusive ?? false,
        },
      };
    case 'too_big':
      return {
        code: 'too-big',
        parameters: {
          bound: Number(issue.maximum ?? 0),
          kind: namedKind(issue.origin),
          inclusive: issue.inclusive ?? false,
        },
      };
    case 'invalid_format':
      return {
        code: 'format-mismatch',
        parameters: { format: stringFormats[issue.format ?? ''] ?? 'other' },
      };
    default:
      return {
        code: 'value-refused',
        parameters: { kind: refusalKinds[issue.code] ?? 'other' },
      };
  }
}

function namedDetail(
  params: SchemaIssue['params'],
): ParseIssueDetail | undefined {
  if (params === undefined) {
    return undefined;
  }
  const parsed = parseIssueDetailSchema.safeParse(params);
  return parsed.success ? parsed.data : undefined;
}

function namedKind(expected: string | undefined): ValueKind {
  return expected === undefined
    ? 'other'
    : (expectedKinds[expected] ?? 'other');
}

function primitiveTexts(values: readonly unknown[] | undefined): string[] {
  return (values ?? []).map((value) =>
    typeof value === 'string' ? `"${value}"` : String(value),
  );
}

function keyed(
  value: unknown,
): value is Readonly<Record<PropertyKey, unknown>> {
  return typeof value === 'object' && value !== null;
}

function valueAt(given: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (value, key) => (keyed(value) ? value[key] : undefined),
    given,
  );
}

function kindOf(value: unknown): ValueKind {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value instanceof Date) {
    return 'date';
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? 'other' : 'number';
  }
  return heldKinds[typeof value] ?? 'other';
}
