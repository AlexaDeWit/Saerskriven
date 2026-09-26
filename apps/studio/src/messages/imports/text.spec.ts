import {
  importIssueDetailSchema,
  type ImportIssueDetail,
} from '@saerskriven/formats';
import { catalogueTemplates, locales, templateParts } from '@saerskriven/i18n';
import { codesOf } from '@saerskriven/model';
import { studioCatalogues } from '../catalogues.js';
import { parseIssueLine } from '../issues/text.js';
import { activeTranslator, chooseLanguage } from '../locale.js';
import { importIssueDetail } from './text.js';

const samples: readonly {
  readonly detail: ImportIssueDetail;
  readonly id: string;
}[] = [
  {
    detail: {
      code: 'import-format-unnamed',
      parameters: { otm: ['0.2.0'], tmbom: ['1.0.1', '1.0.2'] },
    },
    id: 'imports.import-format-unnamed',
  },
  {
    detail: { code: 'otm-parent-not-single' },
    id: 'imports.otm-parent-not-single',
  },
  {
    detail: {
      code: 'duplicate-identifier',
      parameters: { id: 'source-twice' },
    },
    id: 'imports.duplicate-identifier',
  },
  ...(
    [
      'component',
      'asset',
      'threat',
      'mitigation',
      'trust-zone',
      'endpoint',
      'data-store',
    ] as const
  ).map((kind) => ({
    detail: {
      code: 'unknown-source-reference' as const,
      parameters: { id: `source-${kind}`, kind },
    },
    id: `imports.source-${kind}-unknown`,
  })),
];

const declaredCodes = codesOf(importIssueDetailSchema);

const described = (detail: ImportIssueDetail): string =>
  importIssueDetail(activeTranslator().t, detail);

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

describe('the import issue mapping', () => {
  it('describes every code the schema declares', () => {
    expect(new Set(samples.map(({ detail }) => detail.code))).toEqual(
      new Set(declaredCodes),
    );
  });

  it.each(samples)('words $detail.code from $id', ({ detail, id }) => {
    expect(readsFrom(id, described(detail))).toBe(true);
  });

  it('gives each code and each referent its own message, so none reads as another', () => {
    const texts = samples.map(({ detail }) => described(detail));

    expect(new Set(texts).size).toBe(texts.length);
  });

  it.each([
    { code: 'duplicate-identifier', parameters: { id: 'source-twice' } },
    {
      code: 'unknown-source-reference',
      parameters: { id: 'source-ghost', kind: 'trust-zone' },
    },
  ] as const)('carries the id $code names', (detail) => {
    expect(described(detail)).toContain(detail.parameters.id);
  });

  it.each(locales)(
    'names OTM, TM-BOM and every release it reads, untranslated, in %s',
    (locale) => {
      chooseLanguage(locale);
      const text = described({
        code: 'import-format-unnamed',
        parameters: { otm: ['0.2.0'], tmbom: ['1.0.1', '1.0.2'] },
      });

      for (const part of ['OTM', 'TM-BOM', '0.2.0', '1.0.1', '1.0.2']) {
        expect(text).toContain(part);
      }
    },
  );

  it('places an import detail at its path as a parse issue line does', () => {
    const detail: ImportIssueDetail = { code: 'otm-parent-not-single' };
    const t = activeTranslator().t;

    expect(
      parseIssueLine(t, { path: ['components', 0, 'parent'], detail }),
    ).toBe(
      t('issues.line', {
        path: 'components.0.parent',
        detail: described(detail),
      }),
    );
  });
});
