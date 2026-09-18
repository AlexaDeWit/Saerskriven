import {
  divergenceDetailSchema,
  type Divergence,
  type DivergenceDetail,
} from '@saerskriven/formats';
import { catalogueTemplates, templateParts } from '@saerskriven/i18n';
import { studioCatalogues } from '../catalogues.js';
import { activeTranslator, chooseLanguage } from '../locale.js';
import { divergenceDetail, divergenceLine } from './text.js';

const samples: readonly DivergenceDetail[] = [
  {
    code: 'release-restamped',
    parameters: { from: 'release-from', written: 'release-written' },
  },
  { code: 'threat-mark-raised-by-issue', parameters: { from: 11, raised: 12 } },
  {
    code: 'threat-mark-raised-to-issued',
    parameters: { from: 13, raised: 14 },
  },
  {
    code: 'diagram-mark-raised-by-issue',
    parameters: { from: 15, raised: 16 },
  },
  {
    code: 'diagram-mark-raised-to-issued',
    parameters: { from: 17, raised: 18 },
  },
  { code: 'assumption-unrecorded' },
  { code: 'diagram-discarded', parameters: { title: 'discarded-diagram' } },
  { code: 'threat-copy-detached', parameters: { cell: 'detached-cell' } },
  { code: 'threat-discarded', parameters: { title: 'discarded-threat' } },
  { code: 'note-name-dropped', parameters: { name: 'dropped-note-name' } },
  { code: 'scope-marking-dropped' },
  {
    code: 'cell-reshaped',
    parameters: { shape: 'reshaped-from', kind: 'reshaped-to' },
  },
  { code: 'diagram-name-numbered', parameters: { number: 19 } },
  { code: 'cell-discarded', parameters: { shape: 'discarded-cell-shape' } },
  {
    code: 'threat-attachment-stray',
    parameters: { element: 'stray-element', kind: 'stray-kind' },
  },
  { code: 'threat-unplaceable' },
  { code: 'threat-split-across-elements', parameters: { count: 21 } },
  {
    code: 'threat-category-unnamed',
    parameters: { methodology: 'unnamed-method', category: 'unnamed-category' },
  },
  { code: 'mitigation-records-merged', parameters: { count: 22 } },
  { code: 'mitigation-title-merged' },
  { code: 'mitigation-empty-dropped', parameters: { threat: 'empty-threat' } },
  {
    code: 'mitigation-status-dropped',
    parameters: {
      status: 'dropped-status',
      threat: 'dropped-threat',
      inferred: 'dropped-inferred',
    },
  },
  { code: 'mitigation-unlinked', parameters: { name: 'unlinked-mitigation' } },
  { code: 'mitigation-split-across-threats', parameters: { count: 23 } },
  { code: 'threat-status-unmapped', parameters: { status: 'unmapped-status' } },
  {
    code: 'threat-severity-unmapped',
    parameters: { severity: 'unmapped-severity' },
  },
  { code: 'threat-category-eop-suit' },
  {
    code: 'threat-category-unmapped',
    parameters: { category: 'unmapped-category' },
  },
  { code: 'key-undeclared', parameters: { path: 'undeclared.path' } },
  { code: 'assumption-element-links-dropped' },
  { code: 'otm-threat-split', parameters: { id: 'otm-split-threat' } },
  { code: 'otm-threat-undecided', parameters: { id: 'otm-undecided-threat' } },
  {
    code: 'otm-threat-status-unmapped',
    parameters: { status: 'otm-threat-status' },
  },
  { code: 'otm-mitigation-split', parameters: { id: 'otm-split-mitigation' } },
  {
    code: 'otm-mitigation-status-retained',
    parameters: { id: 'otm-retained-mitigation', status: 'otm-source-status' },
  },
  {
    code: 'otm-mitigation-unlinked',
    parameters: { id: 'otm-unlinked-mitigation' },
  },
  { code: 'otm-assets-as-descriptions' },
  { code: 'otm-components-as-processes' },
  { code: 'otm-geometry-generated', parameters: { id: 'otm-placed-element' } },
  { code: 'tmbom-threats-undecided' },
  {
    code: 'tmbom-control-proposed',
    parameters: { name: 'tmbom-proposed-control' },
  },
  {
    code: 'tmbom-control-unlinked',
    parameters: { name: 'tmbom-unlinked-control' },
  },
  { code: 'tmbom-geometry-generated' },
  { code: 'tmbom-flow-fields-as-prose' },
  { code: 'tmbom-data-set-as-prose', parameters: { name: 'tmbom-prose-data' } },
  {
    code: 'tmbom-data-set-dropped',
    parameters: { name: 'tmbom-dropped-data' },
  },
  { code: 'field-not-retained', parameters: { path: ['kept', 'nowhere'] } },
];

const absences: readonly DivergenceDetail[] = [
  { code: 'threat-attachment-stray', parameters: { element: 'no-kind' } },
  { code: 'otm-threat-status-unmapped', parameters: {} },
  {
    code: 'otm-mitigation-status-retained',
    parameters: { id: 'otm-stateless-mitigation', status: null },
  },
];

const declaredCodes = divergenceDetailSchema.options.map(
  (option) => option.shape.code.value,
);

const described = (detail: DivergenceDetail): string =>
  divergenceDetail(activeTranslator().t, detail);

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

describe('the divergence mapping', () => {
  it('describes every code the schema declares', () => {
    expect(new Set(samples.map(({ code }) => code))).toEqual(
      new Set(declaredCodes),
    );
  });

  it.each(samples)('reads %j from the entry its own code names', (detail) => {
    expect(readsFrom(`divergence.${detail.code}`, described(detail))).toBe(
      true,
    );
  });

  it.each([
    [absences[0], 'divergence.threat-attachment-stray-unknown'],
    [absences[1], 'divergence.otm-threat-status-absent'],
    [absences[2], 'divergence.otm-mitigation-status-absent'],
  ])(
    'reads %j from the entry for a parameter the codec did not carry',
    (detail, id) => {
      expect(readsFrom(id, described(detail))).toBe(true);
    },
  );

  it('gives each code its own message, so none reads as another', () => {
    const texts = [...samples, ...absences].map(described);

    expect(new Set(texts).size).toBe(texts.length);
  });

  it.each([
    [
      samples.find(({ code }) => code === 'otm-threat-split'),
      'otm-split-threat',
    ],
    [
      samples.find(({ code }) => code === 'otm-mitigation-split'),
      'otm-split-mitigation',
    ],
    [samples.find(({ code }) => code === 'key-undeclared'), 'undeclared.path'],
    [samples.find(({ code }) => code === 'field-not-retained'), 'kept.nowhere'],
    [samples.find(({ code }) => code === 'cell-reshaped'), 'reshaped-from'],
    [
      samples.find(({ code }) => code === 'threat-attachment-stray'),
      'stray-kind',
    ],
    [
      samples.find(({ code }) => code === 'mitigation-status-dropped'),
      'dropped-inferred',
    ],
  ])('carries the data %j names', (detail, value) => {
    if (detail === undefined) {
      throw new Error('the sample table covers every code');
    }
    expect(described(detail)).toContain(value);
  });

  it('writes a diagram number and a high-water mark as the codec wrote them', () => {
    const numbered = samples.find(
      ({ code }) => code === 'diagram-name-numbered',
    );
    const raised = samples.find(
      ({ code }) => code === 'threat-mark-raised-by-issue',
    );
    if (numbered === undefined || raised === undefined) {
      throw new Error('the sample table covers every code');
    }
    chooseLanguage('fr-CA');

    expect(described(numbered)).toContain('19');
    expect(described(raised)).toContain('11');
  });

  it('names the subject and the reason around the detail', () => {
    const divergence: Divergence = {
      subject: { kind: 'model' },
      detail: {
        code: 'key-undeclared',
        parameters: { path: 'undeclared.path' },
      },
      reason: 'undeclared',
    };
    const line = divergenceLine(activeTranslator().t, divergence);

    expect(line).toContain(described(divergence.detail));
    expect(line).toContain(activeTranslator().t('divergence.subject-model'));
    expect(line).toContain(
      activeTranslator().t('divergence.reason-undeclared'),
    );
  });
});
