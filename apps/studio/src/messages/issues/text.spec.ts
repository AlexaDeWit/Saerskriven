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

const bounds: readonly {
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
];

const declaredCodes = parseIssueDetailSchema.options.map(
  (option) => option.shape.code.value,
);

const described = (detail: ParseIssueDetail): string =>
  parseIssueDetail(activeTranslator().t, detail);

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
    const id =
      detail.code === 'too-small'
        ? 'issues.too-small-characters'
        : detail.code === 'too-big'
          ? 'issues.too-big-value'
          : `issues.${detail.code}`;

    expect(readsFrom(id, described(detail))).toBe(true);
  });

  it.each(bounds)('words $detail.code from $id', ({ detail, id }) => {
    expect(readsFrom(id, described(detail))).toBe(true);
  });

  it('gives each code its own message, so none reads as another', () => {
    const texts = [...samples, ...bounds.map(({ detail }) => detail)].map(
      described,
    );

    expect(new Set(texts).size).toBe(texts.length);
  });

  it.each([
    ['unknown-element-reference', 'element-ghost'],
    ['duplicate-identifier', 'source-twice'],
    ['unknown-source-reference', 'source-ghost'],
    ['schema-threw', 'TypeError: defect'],
    ['format-mismatch', 'url'],
  ])('carries the data %s names', (code, value) => {
    const detail = samples.find((sample) => sample.code === code);
    if (detail === undefined) {
      throw new Error('the sample table covers every code');
    }

    expect(described(detail)).toContain(value);
  });

  it('writes a bound and a threat number as the parse reported them', () => {
    chooseLanguage('fr-CA');
    const number = samples.find(
      ({ code }) => code === 'duplicate-threat-number',
    );
    if (number === undefined) {
      throw new Error('the sample table covers every code');
    }

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
