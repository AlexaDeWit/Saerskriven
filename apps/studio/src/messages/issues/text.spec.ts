import {
  parseIssueDetailSchema,
  type ParseIssueDetail,
} from '@saerskriven/model';
import { parseIssueSamples } from '@saerskriven/model/fixtures';
import { catalogueTemplates, templateParts } from '@saerskriven/i18n';
import { studioCatalogues } from '../catalogues.js';
import { activeTranslator, chooseLanguage } from '../locale.js';
import { parseIssueDetail, parseIssueLine } from './text.js';

const samples = parseIssueSamples;

const branches: readonly {
  readonly detail: ParseIssueDetail;
  readonly id: string;
}[] = [
  {
    detail: {
      code: 'too-small',
      parameters: { bound: 2, kind: 'array', inclusive: true },
    },
    id: 'issues.too-small-items',
  },
  {
    detail: {
      code: 'too-small',
      parameters: { bound: 0, kind: 'number', inclusive: false },
    },
    id: 'issues.too-small-above',
  },
  {
    detail: {
      code: 'too-big',
      parameters: { bound: 3, kind: 'string', inclusive: true },
    },
    id: 'issues.too-big-characters',
  },
  {
    detail: {
      code: 'too-big',
      parameters: { bound: 4, kind: 'array', inclusive: true },
    },
    id: 'issues.too-big-items',
  },
  {
    detail: {
      code: 'too-big',
      parameters: { bound: 5, kind: 'integer', inclusive: false },
    },
    id: 'issues.too-big-below',
  },
  {
    detail: { code: 'format-mismatch', parameters: { format: 'regex' } },
    id: 'issues.format-regex',
  },
  {
    detail: { code: 'format-mismatch', parameters: { format: 'date' } },
    id: 'issues.format-date',
  },
  {
    detail: { code: 'format-mismatch', parameters: { format: 'datetime' } },
    id: 'issues.format-datetime',
  },
  {
    detail: { code: 'format-mismatch', parameters: { format: 'other' } },
    id: 'issues.format-other',
  },
  {
    detail: {
      code: 'unknown-source-reference',
      parameters: { id: 'source-component', kind: 'component' },
    },
    id: 'issues.source-component-unknown',
  },
  {
    detail: {
      code: 'unknown-source-reference',
      parameters: { id: 'source-asset', kind: 'asset' },
    },
    id: 'issues.source-asset-unknown',
  },
  {
    detail: {
      code: 'unknown-source-reference',
      parameters: { id: 'source-threat', kind: 'threat' },
    },
    id: 'issues.source-threat-unknown',
  },
  {
    detail: {
      code: 'unknown-source-reference',
      parameters: { id: 'source-mitigation', kind: 'mitigation' },
    },
    id: 'issues.source-mitigation-unknown',
  },
  {
    detail: {
      code: 'unknown-source-reference',
      parameters: { id: 'source-endpoint', kind: 'endpoint' },
    },
    id: 'issues.source-endpoint-unknown',
  },
  {
    detail: {
      code: 'unknown-source-reference',
      parameters: { id: 'source-data-store', kind: 'data-store' },
    },
    id: 'issues.source-data-store-unknown',
  },
];

const declaredCodes = parseIssueDetailSchema.options.map(
  (option) => option.shape.code.value,
);

const described = (detail: ParseIssueDetail): string =>
  parseIssueDetail(activeTranslator().t, detail);

const sampleOf = (code: string): ParseIssueDetail | undefined =>
  samples.find((sample) => sample.code === code);

const entryOf = (detail: ParseIssueDetail): string =>
  detail.code === 'too-small'
    ? 'issues.too-small-characters'
    : detail.code === 'too-big'
      ? 'issues.too-big-value'
      : detail.code === 'format-mismatch'
        ? 'issues.format-url'
        : detail.code === 'unknown-source-reference'
          ? 'issues.source-trust-zone-unknown'
          : `issues.${detail.code}`;

const englishTemplates = catalogueTemplates(studioCatalogues).filter(
  (entry) => entry.locale === 'en-CA',
);

const literalsOf = (template: string): readonly string[] =>
  templateParts(template).filter(
    (part, index) => index % 2 === 0 && part !== '',
  );

const readsFrom = (id: string, text: string): boolean =>
  englishTemplates
    .filter((entry) => entry.id === id)
    .some(({ template }) =>
      literalsOf(template).every((part) => text.includes(part)),
    );

afterEach(() => {
  chooseLanguage('en-CA');
  globalThis.localStorage.clear();
});

describe('the parse issue mapping', () => {
  it('describes every code the schema declares', () => {
    expect(new Set(samples.map(({ code }) => code))).toEqual(
      new Set(declaredCodes),
    );
  });

  it.each(samples)('reads %j from the entry its own code names', (detail) => {
    expect(readsFrom(entryOf(detail), described(detail))).toBe(true);
  });

  it.each(branches)('words $detail.code from $id', ({ detail, id }) => {
    expect(readsFrom(id, described(detail))).toBe(true);
  });

  it('gives each code its own message, so none reads as another', () => {
    const texts = [...samples, ...branches.map(({ detail }) => detail)].map(
      described,
    );

    expect(new Set(texts).size).toBe(texts.length);
  });

  it.each([
    ['unknown-element-reference', 'element-ghost'],
    ['duplicate-identifier', 'source-twice'],
    ['unknown-source-reference', 'source-ghost'],
    ['duplicate-threat-number', '11'],
  ])('carries the data %s names', (code, value) => {
    const detail = sampleOf(code);
    expect(detail).toBeDefined();
    if (detail === undefined) return;

    expect(described(detail)).toContain(value);
  });

  it('leaves a throw and a schema kind out of what the reader is shown', () => {
    const threw = sampleOf('schema-threw');
    const refused = sampleOf('value-refused');
    expect(threw).toBeDefined();
    expect(refused).toBeDefined();
    if (threw === undefined || refused === undefined) return;

    expect(described(threw)).not.toContain('TypeError');
    expect(described(refused)).not.toContain('unrecognized');
  });

  it('writes a threat number as the parse reported it', () => {
    chooseLanguage('fr-CA');
    const number = sampleOf('duplicate-threat-number');
    expect(number).toBeDefined();
    if (number === undefined) return;

    expect(described(number)).toContain('11');
  });

  it('places the detail at its path, and names the document without one', () => {
    const detail: ParseIssueDetail = { code: 'issue-flood' };
    const t = activeTranslator().t;

    expect(parseIssueLine(t, { path: ['diagrams', 0, 'id'], detail })).toBe(
      t('issues.line', { path: 'diagrams.0.id', detail: described(detail) }),
    );
    expect(parseIssueLine(t, { path: [], detail })).toBe(
      t('issues.line-root', { detail: described(detail) }),
    );
  });
});
