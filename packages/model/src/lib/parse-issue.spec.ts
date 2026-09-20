import { z } from 'zod';
import { parseIssueSamples } from './parse-issue.fixtures.js';
import {
  issueLine,
  parseIssueDetailSchema,
  parseIssueText,
  toParseIssues,
  type ParseIssueDetail,
} from './parse-issue.js';
import type { SchemaParser } from './parse.js';
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

const declaredCodes = parseIssueDetailSchema.options.map(
  (option) => option.shape.code.value,
);

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

  it('names the kind the input held at the path, not only the expected one', () => {
    expect(
      detailsOf(z.object({ title: z.string() }), { title: ['a', 'b'] }),
    ).toEqual([
      {
        code: 'type-mismatch',
        parameters: { expected: 'string', received: 'array' },
      },
    ]);
  });

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
});

describe('toParseIssues', () => {
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

    expect(issueLine({ path: ['diagrams', 0, 'id'], detail })).toBe(
      'diagrams.0.id: duplicate diagram id "diagram-main": diagram ids must be unique across the model',
    );
    expect(issueLine({ path: [], detail })).toBe(
      '(root): duplicate diagram id "diagram-main": diagram ids must be unique across the model',
    );
  });
});
