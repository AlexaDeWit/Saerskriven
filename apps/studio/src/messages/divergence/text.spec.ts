import {
  divergenceDetailSchema,
  importedId,
  type Divergence,
  type DivergenceCode,
  type DivergenceDetail,
} from '@saerskriven/formats';
import { catalogueTemplates, templateParts } from '@saerskriven/i18n';
import { codesOf, type Model } from '@saerskriven/model';
import {
  assumptionId,
  assumptionOf,
  boxAt,
  curveBoundary,
  diagramId,
  elementId,
  mitigationId,
  mitigationOf,
  modelWith,
  threatId,
  threatOf,
} from '@saerskriven/model/fixtures';
import { studioCatalogues } from '../catalogues.js';
import { inLocale } from '../messages.fixtures.js';
import { lossLines, reportedDivergence, type Loss } from './text.js';

const confirmed = 'A booking changes after it is confirmed';

const model = modelWith({
  elements: [
    boxAt('archive', 0, 0, 'store', undefined, 'Paper archive'),
    { ...boxAt('note', 400, 0, 'text', undefined, 'Reminder'), text: 'Hi' },
    curveBoundary(
      'perimeter',
      [
        { x: 0, y: 0 },
        { x: 90, y: 90 },
      ],
      'Perimeter',
    ),
    curveBoundary('zone', [
      { x: 0, y: 0 },
      { x: 90, y: 90 },
    ]),
  ],
  threats: [
    threatOf({ number: 9, title: confirmed, elements: ['archive'] }),
    threatOf({ number: 4, title: '', elements: ['archive'] }),
  ],
  mitigations: [
    mitigationOf({ id: 'titled', title: 'Rate limit', threats: ['threat-9'] }),
    mitigationOf({ id: 'untitled', threats: ['threat-9', 'threat-4'] }),
    mitigationOf({ id: 'unlinked', threats: [] }),
    mitigationOf({
      id: 'shared',
      title: 'Read-only share links',
      threats: ['threat-9', 'threat-4'],
    }),
  ],
  assumptions: [
    assumptionOf({ id: 'on-threats', threats: ['threat-9', 'threat-4'] }),
    assumptionOf({ id: 'on-model', threats: [], appliesToModel: true }),
    assumptionOf({ id: 'on-nothing', threats: [] }),
    assumptionOf({ id: 'also-on-threats', threats: ['threat-4'] }),
  ],
});

const t = inLocale('en-CA');

const statusDropped = (
  status: string,
  inferred: string,
  threat = 'threat-9',
): DivergenceDetail => ({
  code: 'mitigation-status-dropped',
  parameters: { status, threat, inferred },
});

const reported: readonly DivergenceDetail[] = [
  { code: 'assumption-unrecorded' },
  { code: 'note-name-dropped', parameters: { name: 'dropped-note-name' } },
  { code: 'scope-marking-dropped' },
  {
    code: 'threat-attachment-stray',
    parameters: { element: 'stray-element', kind: 'trust-boundary' },
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
  statusDropped('verified', 'implemented'),
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
  {
    code: 'tmbom-control-proposed',
    parameters: { name: 'tmbom-proposed-control' },
  },
  {
    code: 'tmbom-control-unlinked',
    parameters: { name: 'tmbom-unlinked-control' },
  },
  { code: 'tmbom-flow-fields-as-prose' },
  { code: 'tmbom-data-set-as-prose', parameters: { name: 'tmbom-prose-data' } },
  {
    code: 'tmbom-data-set-dropped',
    parameters: { name: 'tmbom-dropped-data' },
  },
  { code: 'field-not-retained', parameters: { path: ['kept', 'nowhere'] } },
];

const leftOut: readonly DivergenceDetail[] = [
  {
    code: 'release-restamped',
    parameters: { from: 'release-from', written: 'release-written' },
  },
  { code: 'threat-mark-raised-by-issue', parameters: { from: 30, raised: 41 } },
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
  { code: 'diagram-name-numbered', parameters: { number: 19 } },
  { code: 'diagram-discarded', parameters: { title: 'discarded-diagram' } },
  { code: 'threat-copy-detached', parameters: { cell: 'detached-cell' } },
  { code: 'threat-discarded', parameters: { title: 'discarded-threat' } },
  {
    code: 'cell-reshaped',
    parameters: { shape: 'reshaped-from', kind: 'process' },
  },
  { code: 'cell-discarded', parameters: { shape: 'discarded-cell-shape' } },
  { code: 'otm-threat-undecided', parameters: { id: 'otm-undecided-threat' } },
  { code: 'otm-threat-status-unmapped', parameters: {} },
  {
    code: 'otm-mitigation-status-retained',
    parameters: { id: 'otm-stateless-mitigation', status: null },
  },
  { code: 'otm-geometry-generated', parameters: { id: 'otm-placed-element' } },
  { code: 'tmbom-threats-undecided' },
  { code: 'tmbom-geometry-generated' },
];

const sharedEntries: Partial<Record<DivergenceCode, string>> = {
  'assumption-unrecorded': 'divergence.whole-assumption',
  'threat-unplaceable': 'divergence.whole-threat',
  'mitigation-empty-dropped': 'divergence.whole-mitigation',
  'mitigation-unlinked': 'divergence.whole-mitigation',
  'threat-split-across-elements': 'divergence.split-into-copies',
  'mitigation-split-across-threats': 'divergence.split-into-copies',
  'threat-attachment-stray':
    'divergence.threat-attachment-stray-trust-boundary',
};

const entryOf = ({ code }: DivergenceDetail): string =>
  sharedEntries[code] ?? `divergence.${code}`;

const englishTemplates = catalogueTemplates(studioCatalogues).filter(
  (entry) => entry.locale === 'en-CA',
);

const readsFrom = (id: string, text: string): boolean =>
  englishTemplates
    .filter((entry) => entry.id === id)
    .some(({ template }) =>
      templateParts(template)
        .filter((part, index) => index % 2 === 0 && part !== '')
        .every((part) => text.includes(part)),
    );

const divergenceOn = (
  subject: Divergence['subject'],
  detail: DivergenceDetail,
): Divergence => ({ subject, detail, reason: 'unrepresentable' });

const lossOf = (divergence: Divergence, kept = false): Loss => {
  const shown = reportedDivergence(divergence);
  if (shown === undefined) {
    throw new Error(`${divergence.detail.code} is left out of every report`);
  }
  return { divergence: shown, kept };
};

const linesOf = (
  divergences: readonly Divergence[],
  within: Model = model,
): readonly string[] =>
  lossLines(
    t,
    within,
    divergences.map((divergence) => lossOf(divergence)),
  );

const lineOf = (divergence: Divergence, speaker = t, kept = false): string => {
  const [line] = lossLines(speaker, model, [lossOf(divergence, kept)]);
  return line;
};

const modelLine = (detail: DivergenceDetail, speaker = t): string =>
  lineOf(divergenceOn({ kind: 'model' }, detail), speaker);

describe('the divergences a studio report shows', () => {
  it('words or leaves out every code the schema declares', () => {
    expect(new Set([...reported, ...leftOut].map(({ code }) => code))).toEqual(
      new Set(codesOf(divergenceDetailSchema)),
    );
  });

  it.each(leftOut)(
    'leaves out %j, which loses nothing a person reads',
    (detail) => {
      expect(
        reportedDivergence(divergenceOn({ kind: 'model' }, detail)),
      ).toBeUndefined();
    },
  );

  it.each(reported)('reads %j from the entry its own code names', (detail) => {
    expect(readsFrom(entryOf(detail), modelLine(detail))).toBe(true);
  });

  it.each([
    ['key-undeclared', 'undeclared.path'],
    ['field-not-retained', 'kept.nowhere'],
    ['otm-mitigation-unlinked', 'otm-unlinked-mitigation'],
    ['otm-mitigation-status-retained', 'otm-source-status'],
    ['threat-status-unmapped', 'unmapped-status'],
    ['tmbom-data-set-dropped', 'tmbom-dropped-data'],
  ] as const)('carries the data %s names from the file', (code, value) => {
    const detail = reported.find((sample) => sample.code === code);
    if (detail === undefined) {
      throw new Error('the sample table covers every reported code');
    }
    expect(modelLine(detail)).toContain(value);
  });
});

const eopCard: DivergenceDetail = { code: 'threat-category-eop-suit' };

const eopDetail = t('divergence.threat-category-eop-suit');

const threatNine = t('divergence.subject-threat', {
  number: 9,
  title: confirmed,
});

describe('the subject a line names', () => {
  it.each([
    [
      'a threat by its number and its title',
      { kind: 'threat', id: threatId('threat-9') },
      threatNine,
    ],
    [
      'an untitled threat by its number',
      { kind: 'threat', id: threatId('threat-4') },
      t('divergence.subject-threat-untitled', { number: 4 }),
    ],
    [
      'a named element by its kind and name',
      { kind: 'element', id: elementId('note') },
      t('divergence.subject-text-named', { name: 'Reminder' }),
    ],
    [
      'an unnamed element by its kind',
      { kind: 'element', id: elementId('zone') },
      t('divergence.subject-trust-boundary'),
    ],
    [
      'a titled mitigation by its title',
      { kind: 'mitigation', id: mitigationId('titled') },
      t('divergence.subject-mitigation', { title: 'Rate limit' }),
    ],
    [
      'an untitled mitigation by the lowest-numbered threat it is on',
      { kind: 'mitigation', id: mitigationId('untitled') },
      t('divergence.subject-mitigation-on', {
        threat: t('divergence.threat-untitled', { number: 4 }),
      }),
    ],
    [
      'an untitled mitigation on no threat by its kind',
      { kind: 'mitigation', id: mitigationId('unlinked') },
      t('divergence.subject-mitigation-untitled'),
    ],
    [
      'an assumption by the lowest-numbered threat it is on',
      { kind: 'assumption', id: assumptionId('on-threats') },
      t('divergence.subject-assumption-on', {
        threat: t('divergence.threat-untitled', { number: 4 }),
      }),
    ],
    [
      'an assumption that applies to the model',
      { kind: 'assumption', id: assumptionId('on-model') },
      t('divergence.subject-assumption-on-model'),
    ],
    [
      'an assumption on nothing by its kind',
      { kind: 'assumption', id: assumptionId('on-nothing') },
      t('divergence.subject-assumption'),
    ],
  ] as const)('names %s', (_, subject, words) => {
    expect(lineOf(divergenceOn(subject, eopCard))).toBe(
      t('divergence.line', { subject: words, detail: eopDetail }),
    );
  });

  it('names an untitled mitigation by the threat whose text the divergence is about', () => {
    const subject = {
      kind: 'mitigation',
      id: mitigationId('untitled'),
    } as const;
    const detail = statusDropped('verified', 'proposed', 'threat-9');

    expect(lineOf(divergenceOn(subject, detail))).toBe(
      t('divergence.line', {
        subject: t('divergence.subject-mitigation-on', {
          threat: t('divergence.threat', { number: 9, title: confirmed }),
        }),
        detail: modelLine(detail),
      }),
    );
  });

  it('names a titled mitigation by the threat whose text the divergence is about, so a status lost on two threats reads as two lines', () => {
    const subject = { kind: 'mitigation', id: mitigationId('shared') } as const;
    const onThreat = (threat: string) =>
      t('divergence.subject-mitigation-titled-on', {
        title: 'Read-only share links',
        threat,
      });
    const detail = modelLine(statusDropped('verified', 'proposed'));

    expect(
      linesOf([
        divergenceOn(
          subject,
          statusDropped('verified', 'proposed', 'threat-9'),
        ),
        divergenceOn(
          subject,
          statusDropped('verified', 'proposed', 'threat-4'),
        ),
      ]),
    ).toEqual([
      t('divergence.line', {
        subject: onThreat(
          t('divergence.threat', { number: 9, title: confirmed }),
        ),
        detail,
      }),
      t('divergence.line', {
        subject: onThreat(t('divergence.threat-untitled', { number: 4 })),
        detail,
      }),
    ]);
  });

  it('makes losses that read the same one line with their count', () => {
    const unrecorded: DivergenceDetail = { code: 'assumption-unrecorded' };
    const line = t('divergence.line', {
      subject: t('divergence.subject-assumption-on', {
        threat: t('divergence.threat-untitled', { number: 4 }),
      }),
      detail: t('divergence.whole-assumption'),
    });

    expect(
      linesOf([
        divergenceOn(
          { kind: 'assumption', id: assumptionId('on-threats') },
          unrecorded,
        ),
        divergenceOn({ kind: 'model' }, eopCard),
        divergenceOn(
          { kind: 'assumption', id: assumptionId('also-on-threats') },
          unrecorded,
        ),
      ]),
    ).toEqual([t('divergence.repeated', { count: 2, line }), eopDetail]);
  });

  it.each([
    ['the model', { kind: 'model' }],
    [
      'a threat the model no longer holds',
      { kind: 'threat', id: threatId('gone') },
    ],
    [
      'a diagram, which no report names',
      { kind: 'diagram', id: diagramId('d') },
    ],
    [
      'an element of a kind no report names',
      { kind: 'element', id: elementId('archive') },
    ],
  ] as const)('leaves %s to the detail, naming no id', (_, subject) => {
    expect(lineOf(divergenceOn(subject, eopCard))).toBe(eopDetail);
  });

  it('says where saving back to the same file keeps a loss', () => {
    const subject = { kind: 'threat', id: threatId('threat-9') } as const;

    expect(lineOf(divergenceOn(subject, eopCard), t, true)).toBe(
      t('divergence.kept', {
        line: t('divergence.line', { subject: threatNine, detail: eopDetail }),
      }),
    );
  });

  it('words every line again in the translator it is handed', () => {
    const divergence = divergenceOn(
      { kind: 'threat', id: threatId('threat-9') },
      eopCard,
    );

    expect(lineOf(divergence, inLocale('sv'))).not.toBe(lineOf(divergence));
  });
});

describe('a dropped mitigation status', () => {
  it.each(['en-CA', 'fr-CA', 'sv'] as const)(
    'words both statuses in %s through the terms render shows them under',
    (locale) => {
      const speaker = inLocale(locale);

      expect(modelLine(statusDropped('verified', 'implemented'), speaker)).toBe(
        speaker('divergence.mitigation-status-dropped', {
          status: speaker('terms.mitigation-verified'),
          inferred: speaker('terms.mitigation-implemented'),
        }),
      );
    },
  );

  it('passes a status the model does not store through as the codec gave it', () => {
    expect(modelLine(statusDropped('foreign', 'proposed'))).toBe(
      t('divergence.mitigation-status-dropped', {
        status: 'foreign',
        inferred: t('terms.mitigation-proposed'),
      }),
    );
  });
});

const stray = (
  element: string,
  kind?: 'text' | 'trust-boundary',
): DivergenceDetail => ({
  code: 'threat-attachment-stray',
  parameters: kind === undefined ? { element } : { element, kind },
});

describe('the element a stray attachment names', () => {
  it.each([
    ['fr-CA', 'perimeter', 'trust-boundary', 'Perimeter'],
    ['sv', 'note', 'text', 'Reminder'],
    ['en-CA', 'perimeter', 'trust-boundary', 'Perimeter'],
  ] as const)(
    'words in %s the element %s by its kind and the name the model holds',
    (locale, element, kind, name) => {
      const speaker = inLocale(locale);

      expect(modelLine(stray(element, kind), speaker)).toBe(
        speaker(`divergence.threat-attachment-stray-${kind}-named`, { name }),
      );
    },
  );

  it.each([
    [
      'an unnamed element by its kind',
      stray('zone', 'trust-boundary'),
      'divergence.threat-attachment-stray-trust-boundary',
    ],
    [
      'an element of no kind the format names',
      stray('zone'),
      'divergence.threat-attachment-stray-unknown',
    ],
  ] as const)('words %s', (_, detail, id) => {
    expect(modelLine(detail)).toBe(t(id));
  });
});

const spoofedOne = importedId('otm-threat', ['threat-spoofing', 'c1', '0']);

const spoofedTwo = importedId('otm-threat', ['threat-spoofing', 'c2', '1']);

const imported = modelWith({
  threats: [
    threatOf({ number: 2, title: 'Spoofed patient', id: spoofedTwo }),
    threatOf({ number: 1, title: 'Spoofed patient', id: spoofedOne }),
  ],
  mitigations: [
    mitigationOf({
      id: importedId('otm-mitigation', ['mitigation-signing', spoofedOne, '0']),
      title: 'Sign the booking',
      threats: [spoofedOne],
    }),
    mitigationOf({
      id: importedId('tmbom-control', ['control-review']),
      threats: [spoofedTwo],
    }),
  ],
});

const fromSource = (detail: DivergenceDetail): Divergence =>
  divergenceOn({ kind: 'model' }, detail);

const spoofedPatient = t('divergence.subject-threat', {
  number: 1,
  title: 'Spoofed patient',
});

describe('the record an import made from the source record a line names', () => {
  it('names an OTM threat by the lowest-numbered threat its occurrences became, once with the count', () => {
    const split: DivergenceDetail = {
      code: 'otm-threat-split',
      parameters: { id: 'threat-spoofing' },
    };

    expect(linesOf([fromSource(split), fromSource(split)], imported)).toEqual([
      t('divergence.repeated', {
        count: 2,
        line: t('divergence.line', {
          subject: spoofedPatient,
          detail: t('divergence.otm-threat-split'),
        }),
      }),
    ]);
  });

  it('names the threat whose OTM status it could not map by the source id the divergence carries', () => {
    expect(
      linesOf(
        [
          fromSource({
            code: 'otm-threat-status-unmapped',
            parameters: { status: 'under-review', id: 'threat-spoofing' },
          }),
        ],
        imported,
      ),
    ).toEqual([
      t('divergence.line', {
        subject: spoofedPatient,
        detail: t('divergence.otm-threat-status-unmapped', {
          status: 'under-review',
        }),
      }),
    ]);
  });

  it.each([
    [
      'an OTM mitigation by its title',
      {
        code: 'otm-mitigation-status-retained',
        parameters: { id: 'mitigation-signing', status: 'rejected' },
      },
      t('divergence.subject-mitigation', { title: 'Sign the booking' }),
    ],
    [
      'the untitled mitigation a TM-BOM control became by the threat it is on',
      {
        code: 'tmbom-control-proposed',
        parameters: { name: 'control-review' },
      },
      t('divergence.subject-mitigation-on', {
        threat: t('divergence.threat', {
          number: 2,
          title: 'Spoofed patient',
        }),
      }),
    ],
  ] as const)('names %s', (_, detail, subject) => {
    const [line] = linesOf([fromSource(detail)], imported);

    expect(line).toBe(
      t('divergence.line', {
        subject,
        detail: modelLine(detail),
      }),
    );
  });
});
