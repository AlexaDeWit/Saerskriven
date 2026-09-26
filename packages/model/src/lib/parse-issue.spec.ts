import { z } from 'zod';
import { codesOf } from './coded.js';
import { parseIssueSamples } from './parse-issue.fixtures.js';
import {
  issueLine,
  parseIssueDetailSchema,
  parseIssueText,
  toParseIssues,
  type ParseIssueDetail,
  type SchemaIssue,
  type SchemaParser,
} from './parse-issue.js';
import { acceptedTextSchema } from './text.js';

type Mapping = {
  readonly named: string;
  readonly schema: SchemaParser<unknown>;
  readonly given: unknown;
  readonly detail: ParseIssueDetail;
};

const detailsOf = (
  schema: SchemaParser<unknown>,
  given: unknown,
): readonly ParseIssueDetail[] => {
  const parsed = schema.safeParse(given);
  return parsed.success
    ? []
    : toParseIssues(parsed.error.issues, given).map((issue) => issue.detail);
};

const declaredCodes = codesOf(parseIssueDetailSchema);

describe('a schema issue as a code and its parameters', () => {
  it.each<Mapping>([
    {
      named: 'a value of the wrong type',
      schema: z.string(),
      given: 1,
      detail: {
        code: 'type-mismatch',
        parameters: { expected: 'string', received: 'number' },
      },
    },
    {
      named: 'a literal the schema does not hold',
      schema: z.literal('actor'),
      given: 'flow',
      detail: { code: 'value-unexpected', parameters: { values: ['"actor"'] } },
    },
    {
      named: 'a required field the input leaves out',
      schema: z.object({ title: z.string().optional().nonoptional() }),
      given: {},
      detail: {
        code: 'type-mismatch',
        parameters: { expected: 'other', received: 'undefined' },
      },
    },
    {
      named: 'a number the schema does not hold',
      schema: z.literal(1),
      given: 2,
      detail: { code: 'value-unexpected', parameters: { values: ['1'] } },
    },
    {
      named: 'a discriminator naming no option',
      schema: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('actor') }),
        z.object({ kind: z.literal('flow') }),
      ]),
      given: { kind: 'store' },
      detail: {
        code: 'value-unexpected',
        parameters: { values: ['"actor"', '"flow"'] },
      },
    },
    {
      named: 'a union no member accepts',
      schema: z.union([z.string(), z.number()]),
      given: true,
      detail: { code: 'option-unmatched' },
    },
    {
      named: 'a text below its length floor',
      schema: z.string().min(2),
      given: 'a',
      detail: {
        code: 'too-small',
        parameters: { bound: 2, kind: 'string', inclusive: true },
      },
    },
    {
      named: 'a number at an exclusive floor',
      schema: z.number().positive(),
      given: 0,
      detail: {
        code: 'too-small',
        parameters: { bound: 0, kind: 'number', inclusive: false },
      },
    },
    {
      named: 'a list above its ceiling',
      schema: z.array(z.string()).max(1),
      given: ['one', 'two'],
      detail: {
        code: 'too-big',
        parameters: { bound: 1, kind: 'array', inclusive: true },
      },
    },
    {
      named: 'a text of the wrong format',
      schema: z.url(),
      given: 'not a URL',
      detail: { code: 'format-mismatch', parameters: { format: 'url' } },
    },
    {
      named: 'a refusal no other code covers',
      schema: z.string().refine(() => false),
      given: 'refused',
      detail: { code: 'value-refused', parameters: { kind: 'custom' } },
    },
  ])('reports $named', ({ schema, given, detail }) => {
    expect(detailsOf(schema, given)).toContainEqual(detail);
  });

  it.each([
    ['a list', ['a', 'b'], 'array'],
    ['null', null, 'null'],
    ['a date', new Date(0), 'date'],
    ['a number that is not one', Number.NaN, 'other'],
    ['a function', () => 'title', 'other'],
  ])(
    'names the kind the input held at the path, %s here, not only the expected one',
    (_named, title, received) => {
      expect(detailsOf(z.object({ title: z.string() }), { title })).toEqual([
        { code: 'type-mismatch', parameters: { expected: 'string', received } },
      ]);
    },
  );

  it.each<readonly [SchemaIssue, unknown, ParseIssueDetail]>([
    [
      { path: [], code: 'too_small' },
      'short',
      {
        code: 'too-small',
        parameters: { bound: 0, kind: 'other', inclusive: false },
      },
    ],
    [
      { path: [], code: 'too_big' },
      'long',
      {
        code: 'too-big',
        parameters: { bound: 0, kind: 'other', inclusive: false },
      },
    ],
    [
      { path: [], code: 'invalid_format', format: 'email' },
      'someone',
      { code: 'format-mismatch', parameters: { format: 'other' } },
    ],
    [
      { path: [], code: 'invalid_format' },
      'someone',
      { code: 'format-mismatch', parameters: { format: 'other' } },
    ],
    [
      { path: [], code: 'invalid_value' },
      'store',
      { code: 'value-unexpected', parameters: { values: [] } },
    ],
    [
      { path: [], code: 'invalid_type' },
      1,
      {
        code: 'type-mismatch',
        parameters: { expected: 'other', received: 'number' },
      },
    ],
    [
      { path: [], code: 'invalid_type', expected: 'symbol' },
      1,
      {
        code: 'type-mismatch',
        parameters: { expected: 'other', received: 'number' },
      },
    ],
    [
      { path: ['title', 'text'], code: 'invalid_type', expected: 'string' },
      { title: 1 },
      {
        code: 'type-mismatch',
        parameters: { expected: 'string', received: 'undefined' },
      },
    ],
    [
      { path: [], code: 'an_issue_kind_to_come' },
      'value',
      { code: 'value-refused', parameters: { kind: 'other' } },
    ],
  ])(
    'reads %j, which omits what its kind reports, with the fallback each parameter names',
    (issue, given, detail) => {
      expect(toParseIssues([issue], given)).toEqual([
        { path: issue.path, detail },
      ]);
    },
  );

  it('keeps the detail a schema names for itself', () => {
    expect(detailsOf(acceptedTextSchema, 'Order\u0000service')).toEqual([
      { code: 'text-character-refused' },
    ]);
  });
});

describe('the English wording of a parse issue', () => {
  it('has a sample for every code the schema declares', () => {
    expect(new Set(parseIssueSamples.map(({ code }) => code))).toEqual(
      new Set(declaredCodes),
    );
  });

  it.each(parseIssueSamples)('words %j as its own sentence', (detail) => {
    expect(parseIssueText(detail)).not.toBe('');
  });

  it('gives each code its own wording, so none reads as another', () => {
    const texts = parseIssueSamples.map(parseIssueText);

    expect(new Set(texts).size).toBe(texts.length);
  });

  it.each<readonly [ParseIssueDetail, string]>([
    [
      {
        code: 'too-small',
        parameters: { bound: 2, kind: 'string', inclusive: true },
      },
      'expected at least 2 characters',
    ],
    [
      {
        code: 'too-small',
        parameters: { bound: 1, kind: 'array', inclusive: true },
      },
      'expected at least 1 entry',
    ],
    [
      {
        code: 'too-big',
        parameters: { bound: 3, kind: 'array', inclusive: true },
      },
      'expected at most 3 entries',
    ],
    [
      {
        code: 'too-small',
        parameters: { bound: 0, kind: 'number', inclusive: false },
      },
      'expected more than 0',
    ],
    [
      {
        code: 'too-big',
        parameters: { bound: 9, kind: 'string', inclusive: false },
      },
      'expected less than 9',
    ],
  ])(
    'words the bound of %j by its kind and whether it is inclusive',
    (detail, text) => {
      expect(parseIssueText(detail)).toBe(text);
    },
  );
});

const callerDetailSchema = z.union([
  z.object({
    code: z.literal('caller-rule'),
    parameters: z.object({ rule: z.string() }),
  }),
  z.object({ code: z.literal('text-character-refused') }).transform(() => ({
    code: 'caller-rule' as const,
    parameters: { rule: 'claimed by the caller' },
  })),
]);

const callerRule = { code: 'caller-rule', parameters: { rule: 'one parent' } };

const namingItself = (params: Record<string, unknown>) =>
  z.string().refine(() => false, { params });

describe('toParseIssues', () => {
  it('keeps a detail a caller declares where its schema names one for itself', () => {
    const parsed = namingItself(callerRule).safeParse('refused');

    expect(
      parsed.success
        ? []
        : toParseIssues(parsed.error.issues, 'refused', callerDetailSchema),
    ).toEqual([{ path: [], detail: callerRule }]);
  });

  it.each([
    ['declares none', undefined],
    ['declares another', callerDetailSchema],
  ])(
    'reads a detail no schema accepts as a refusal where the caller %s',
    (_declares, named) => {
      const parsed = namingItself({ code: 'unheard-of' }).safeParse('refused');

      expect(
        parsed.success
          ? []
          : toParseIssues(parsed.error.issues, 'refused', named).map(
              (issue) => issue.detail,
            ),
      ).toEqual([{ code: 'value-refused', parameters: { kind: 'custom' } }]);
    },
  );

  it("prefers this package's own detail to a caller's", () => {
    const given = 'Order\u0000service';
    const parsed = acceptedTextSchema.safeParse(given);

    expect(
      parsed.success
        ? []
        : toParseIssues(parsed.error.issues, given, callerDetailSchema).map(
            (issue) => issue.detail,
          ),
    ).toEqual([{ code: 'text-character-refused' }]);
  });

  it('renders a symbol path segment, which no JSON key spells, as text', () => {
    expect(
      toParseIssues(
        [{ path: ['diagrams', 0, Symbol('kind')], code: 'custom' }],
        {},
      ),
    ).toEqual([
      {
        path: ['diagrams', 0, 'Symbol(kind)'],
        detail: { code: 'value-refused', parameters: { kind: 'custom' } },
      },
    ]);
  });
});

describe('issueLine', () => {
  it('prints an issue as its dotted path and message, and an empty path as (root)', () => {
    const detail: ParseIssueDetail = {
      code: 'duplicate-diagram-id',
      parameters: { id: 'diagram-main' },
    };

    expect(
      issueLine({ path: ['diagrams', 0, 'id'], detail }, parseIssueText),
    ).toBe(
      'diagrams.0.id: duplicate diagram id "diagram-main": diagram ids must be unique across the model',
    );
    expect(issueLine({ path: [], detail }, parseIssueText)).toBe(
      '(root): duplicate diagram id "diagram-main": diagram ids must be unique across the model',
    );
  });
});
