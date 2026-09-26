import { codesOf, parseIssueDetailSchema } from '@saerskriven/model';
import {
  importIssueDetailSchema,
  importIssueText,
  isImportIssueDetail,
  wireIssueLine,
  type ImportIssueDetail,
} from './import-issue-detail.js';

const samples: readonly (readonly [ImportIssueDetail, string])[] = [
  [
    {
      code: 'import-format-unnamed',
      parameters: { otm: ['0.2.0'], tmbom: ['1.0.1', '1.0.2'] },
    },
    'import requires an OTM 0.2.0 version stamp or a TM-BOM 1.0.1 or 1.0.2 schema URI',
  ],
  [
    { code: 'otm-parent-not-single' },
    'a parent names exactly one trust zone or component',
  ],
  [
    { code: 'duplicate-identifier', parameters: { id: 'web-client' } },
    'duplicate identifier "web-client"',
  ],
  [
    {
      code: 'unknown-source-reference',
      parameters: { id: 'public-internet', kind: 'trust-zone' },
    },
    'names unknown trust zone "public-internet"',
  ],
];

const declaredCodes = codesOf(importIssueDetailSchema);

const parseIssueCodes: readonly string[] = codesOf(parseIssueDetailSchema);

describe('import issue codes', () => {
  it('words every code the schema declares', () => {
    expect(new Set(samples.map(([detail]) => detail.code))).toEqual(
      new Set(declaredCodes),
    );
  });

  it.each(samples)('words %j', (detail, text) => {
    expect(importIssueText(detail)).toBe(text);
  });

  it('shares no code with the parse issue codes, so a wire issue names one union', () => {
    expect(
      declaredCodes.filter((code) => parseIssueCodes.includes(code)),
    ).toEqual([]);
  });

  it('tells an import detail from a parse issue detail by its code', () => {
    expect(samples.every(([detail]) => isImportIssueDetail(detail))).toBe(true);
    expect(isImportIssueDetail({ code: 'issue-flood' })).toBe(false);
  });

  it('words a wire issue of either union as its line', () => {
    expect(
      wireIssueLine({
        path: ['components', 0, 'parent'],
        detail: { code: 'otm-parent-not-single' },
      }),
    ).toBe(
      'components.0.parent: a parent names exactly one trust zone or component',
    );
    expect(wireIssueLine({ path: [], detail: { code: 'issue-flood' } })).toBe(
      '(root): the input has more problems than a parse can list',
    );
  });
});
