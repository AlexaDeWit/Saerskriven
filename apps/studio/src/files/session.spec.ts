import {
  ReadFailure,
  threatDragonCodec,
  type Divergence,
  type RetainedSource,
} from '@saerskriven/formats';
import { committedText } from '@saerskriven/model/fixtures';
import type { Locale } from '@saerskriven/i18n';
import { inLocale } from '../messages/messages.fixtures.js';
import { Action } from '../store/actions.js';
import { FileLifecycle } from '../store/state.js';
import {
  firstAssumption,
  foreignSource,
  nativeSource,
  recordedModel,
  sampleModel,
  sampleThreat,
} from '../store/store.fixtures.js';
import { OpenOutcome, SaveOutcome } from './bridge.js';
import {
  formatOf,
  formatOfName,
  formatsFrom,
  openedBy,
  proposedName,
  fileTitle,
  fileTitleLimit,
  proposedExportName,
  openReport,
  reportLines,
  saveReport,
  saveTarget,
  saveTypes,
  savedBy,
  type LossReport,
} from './session.js';
import { brokenThreatDragonText, sampleNativeText } from './files.fixtures.js';

type OutcomesByTag<Outcome extends { readonly _tag: string }> = {
  readonly [Tag in Outcome['_tag']]: Extract<Outcome, { readonly _tag: Tag }>;
};

const foreignText = threatDragonCodec.write(sampleModel).output;

const openOutcomes: OutcomesByTag<OpenOutcome> = {
  Chosen: OpenOutcome.Chosen({ name: 'model.yaml', text: sampleNativeText }),
  TooLarge: OpenOutcome.TooLarge({
    name: 'huge.json',
    bound: 4,
    observed: 40,
  }),
  Unreadable: OpenOutcome.Unreadable({ reason: 'The file was moved.' }),
  Cancelled: OpenOutcome.Cancelled(),
  NoPicker: OpenOutcome.NoPicker(),
};

const saveOutcomes: OutcomesByTag<SaveOutcome> = {
  Written: SaveOutcome.Written({ name: 'model.yaml' }),
  Cancelled: SaveOutcome.Cancelled(),
  Refused: SaveOutcome.Refused({ reason: 'The folder is read only.' }),
};

const openedNative = FileLifecycle.Opened({
  name: 'model.yaml',
  source: nativeSource,
});

const openedForeign = FileLifecycle.Opened({
  name: 'model.json',
  source: foreignSource,
});

const untitledFile = 'threat-model';

const untitledFileIn = (locale: Locale): string =>
  inLocale(locale)('defaults.untitled-file');

describe('openedBy', () => {
  it('opens a text the native codec claims, keeping the document it read', () => {
    const action = openedBy(openOutcomes.Chosen, untitledFile);

    expect(action?._tag).toBe('Opened');
    expect(action).toMatchObject({
      name: 'model.yaml',
      source: { format: 'saerskriven-yaml' },
    });
  });

  it('opens a text the Threat Dragon codec claims as that format, retaining the document a save merges onto', () => {
    const action = openedBy(
      OpenOutcome.Chosen({ name: 'model.json', text: foreignText }),
      untitledFile,
    );

    expect(action).toMatchObject({
      _tag: 'Opened',
      source: { format: 'threat-dragon' },
    });
    expect(
      action?._tag === 'Opened' ? action.source.document : undefined,
    ).toBeDefined();
  });

  it('reports a text no format claimed, naming what was tried', () => {
    const action = openedBy(
      OpenOutcome.Chosen({ name: 'notes.txt', text: 'nothing to read here' }),
      untitledFile,
    );

    expect(action).toMatchObject({
      _tag: 'ReadFailed',
      name: 'notes.txt',
      failure: { _tag: 'NoFormatClaimed' },
    });
  });

  it('reports where a claimed file broke, with the path into it', () => {
    const action = openedBy(
      OpenOutcome.Chosen({ name: 'broken.json', text: brokenThreatDragonText }),
      untitledFile,
    );

    expect(action).toMatchObject({
      _tag: 'ReadFailed',
      failure: { _tag: 'InvalidWireDocument' },
    });
  });

  it('reports a file past the bound as the codecs report one', () => {
    expect(openedBy(openOutcomes.TooLarge, untitledFile)).toEqual(
      Action.ReadFailed({
        name: 'huge.json',
        failure: ReadFailure.ExceededReadLimit({
          limit: 'maxTextBytes',
          bound: 4,
          observed: 40,
        }),
      }),
    );
  });

  it('reports a file the platform would not hand over', () => {
    expect(openedBy(openOutcomes.Unreadable, untitledFile)).toEqual(
      Action.FileRefused({ operation: 'open', reason: 'The file was moved.' }),
    );
  });

  it('dispatches nothing where there is nothing to record', () => {
    expect(openedBy(openOutcomes.Cancelled, untitledFile)).toBeUndefined();
    expect(openedBy(openOutcomes.NoPicker, untitledFile)).toBeUndefined();
  });

  it.each(['otm', 'tmbom'] as const)(
    'opens a %s text as a new model, named as YAML under the file stem',
    (format) => {
      const action = openedBy(
        OpenOutcome.Chosen({
          name: 'example.json',
          text: committedText(`${format}/example.json`),
        }),
        untitledFile,
      );

      expect(action).toMatchObject({
        _tag: 'Imported',
        name: 'example.yaml',
        format,
      });
    },
  );

  it('names a new model whose file stem reduces to nothing, in the language given', () => {
    const action = openedBy(
      OpenOutcome.Chosen({
        name: '.json',
        text: committedText('otm/example.json'),
      }),
      'hotmodell',
    );

    expect(action).toMatchObject({ _tag: 'Imported', name: 'hotmodell.yaml' });
  });
});

describe('savedBy', () => {
  it('names the file the text reached rather than the one proposed', () => {
    expect(savedBy(saveOutcomes.Written, nativeSource)).toEqual(
      Action.Saved({ name: 'model.yaml', source: nativeSource }),
    );
  });

  it('dispatches nothing where the person dismissed the picker', () => {
    expect(savedBy(saveOutcomes.Cancelled, nativeSource)).toBeUndefined();
  });

  it('reports a write the platform refused', () => {
    expect(savedBy(saveOutcomes.Refused, nativeSource)).toEqual(
      Action.FileRefused({
        operation: 'save',
        reason: 'The folder is read only.',
      }),
    );
  });
});

describe('saveTarget', () => {
  it('proposes a file in the native format while the model is in none', () => {
    expect(
      saveTarget(FileLifecycle.NoFile(), 'saerskriven-yaml', untitledFile),
    ).toEqual({
      name: 'threat-model.yaml',
      source: nativeSource,
    });
  });

  it('writes back to the open file, merging onto what its read retained', () => {
    expect(saveTarget(openedForeign, 'threat-dragon', untitledFile)).toEqual({
      name: 'model.json',
      source: foreignSource,
    });
    expect(saveTarget(openedNative, 'saerskriven-yaml', untitledFile)).toEqual({
      name: 'model.yaml',
      source: nativeSource,
    });
  });

  it('has nothing to merge onto when the target is another format', () => {
    expect(saveTarget(openedForeign, 'saerskriven-yaml', untitledFile)).toEqual(
      {
        name: 'model.yaml',
        source: nativeSource,
      },
    );
  });

  it('proposes the stem it is given, distinct in fr-CA and sv from en-CA', () => {
    const enUntitled = untitledFileIn('en-CA');
    const frUntitled = untitledFileIn('fr-CA');
    const svUntitled = untitledFileIn('sv');

    expect(frUntitled).not.toBe(enUntitled);
    expect(svUntitled).not.toBe(enUntitled);
    expect(
      saveTarget(FileLifecycle.NoFile(), 'saerskriven-yaml', frUntitled),
    ).toEqual({ name: `${frUntitled}.yaml`, source: nativeSource });
  });

  it('keeps an opened file its own name, whatever the untitled stem given', () => {
    expect(saveTarget(openedNative, 'saerskriven-yaml', 'hotmodell')).toEqual({
      name: 'model.yaml',
      source: nativeSource,
    });
  });
});

describe('naming', () => {
  it('carries the extension of the format it targets', () => {
    expect(proposedName('model.json', 'saerskriven-yaml', untitledFile)).toBe(
      'model.yaml',
    );
    expect(proposedName('model.yaml', 'threat-dragon', untitledFile)).toBe(
      'model.json',
    );
  });

  it('names a file that would otherwise be all extension', () => {
    expect(proposedName('.yaml', 'saerskriven-yaml', untitledFile)).toBe(
      'threat-model.yaml',
    );
  });

  it('derives an export name from the open file, or from the untitled stem it is given', () => {
    expect(proposedExportName(openedForeign, '.svg', 'Namnlös')).toBe(
      'model.svg',
    );
    expect(proposedExportName(FileLifecycle.NoFile(), '.pdf', 'Namnlös')).toBe(
      'Namnlös.pdf',
    );
  });

  it('adds a cleaned diagram title to an export name after the stem', () => {
    expect(proposedExportName(openedForeign, '.png', 'Namnlös', 'Pay')).toBe(
      'model - Pay.png',
    );
    expect(
      proposedExportName(FileLifecycle.NoFile(), '.svg', 'Namnlös', 'Pay'),
    ).toBe('Namnlös - Pay.svg');
  });

  it.each([
    ['a/b\\c:d*e?f"g<h>i|j', 'a_b_c_d_e_f_g_h_i_j'],
    ['one\ntwo\ttab\u0007bell', 'one_two_tab_bell'],
    ['  many   spaces\u00a0here ', 'many spaces here'],
    ['a\u2028b\u2029c\u0085d\u009fe\u007ff', 'a_b_c_d_e_f'],
    ['..hidden. .', 'hidden'],
    ['Översikt Schéma', 'Översikt Schéma'],
    ['', 'Namnlöst'],
    ['  . ', 'Namnlöst'],
  ])('cleans the title %j to %j', (title, expected) => {
    expect(fileTitle(title, 'Namnlöst')).toBe(expected);
  });

  it('cuts a long title at the limit and trims what the cut leaves at the end', () => {
    const cut = fileTitle('\u{1d504}'.repeat(fileTitleLimit + 20), 'x');
    expect(Array.from(cut)).toHaveLength(fileTitleLimit);
    expect(fileTitle(`${'a'.repeat(fileTitleLimit - 1)} b`, 'x')).toBe(
      'a'.repeat(fileTitleLimit - 1),
    );
  });

  it('offers every registered format, the one the file is in first', () => {
    expect(formatsFrom('saerskriven-yaml')).toEqual([
      'saerskriven-yaml',
      'threat-dragon',
    ]);
    expect(formatsFrom('threat-dragon')).toEqual([
      'threat-dragon',
      'saerskriven-yaml',
    ]);
  });

  it('offers the same formats to a picker, described and with their extensions', () => {
    expect(saveTypes(formatsFrom('saerskriven-yaml'))).toEqual([
      {
        description: 'Saerskriven YAML',
        accept: { 'application/yaml': ['.yaml', '.yml'] },
      },
      {
        description: 'Threat Dragon JSON',
        accept: { 'application/json': ['.json'] },
      },
    ]);
  });

  it('reads back the format a picker answered with off the name it named', () => {
    expect(formatOfName('model.json')).toBe('threat-dragon');
    expect(formatOfName('model.yaml')).toBe('saerskriven-yaml');
    expect(formatOfName('model.yml')).toBe('saerskriven-yaml');
    expect(formatOfName('MODEL.YAML')).toBe('saerskriven-yaml');
    expect(formatOfName('notes.txt')).toBeUndefined();
  });

  it('reads the format of the file the model lives in', () => {
    expect(formatOf(FileLifecycle.NoFile())).toBe('saerskriven-yaml');
    expect(formatOf(openedForeign)).toBe('threat-dragon');
  });
});

const t = inLocale('en-CA');

const eopCard: Divergence = {
  subject: { kind: 'threat', id: sampleThreat.id },
  detail: { code: 'threat-category-eop-suit' },
  reason: 'narrowed',
};

const undeclaredKey: Divergence = {
  subject: { kind: 'model' },
  detail: { code: 'key-undeclared', parameters: { path: 'notes' } },
  reason: 'undeclared',
};

const raisedMark: Divergence = {
  subject: { kind: 'model' },
  detail: {
    code: 'threat-mark-raised-by-issue',
    parameters: { from: 30, raised: 41 },
  },
  reason: 'overridden',
};

const unrecorded: Divergence = {
  subject: { kind: 'assumption', id: firstAssumption },
  detail: { code: 'assumption-unrecorded' },
  reason: 'unrepresentable',
};

const opened = (source: RetainedSource, divergences: readonly Divergence[]) =>
  Action.Opened({
    model: sampleModel,
    name: 'model.json',
    source,
    divergences,
  });

const imported = (divergences: readonly Divergence[]) =>
  Action.Imported({
    model: sampleModel,
    name: 'example.yaml',
    format: 'otm',
    divergences,
  });

const keptOf = (report: LossReport | undefined): readonly boolean[] =>
  report?.losses.map(({ kept }) => kept) ?? [];

describe('openReport', () => {
  it('says which losses saving back to the Threat Dragon file keeps', () => {
    const report = openReport(opened(foreignSource, [eopCard, undeclaredKey]));

    expect(report?.occasion).toBe('open');
    expect(keptOf(report)).toEqual([true, false]);
  });

  it('keeps nothing a native read narrowed, since the native codec projects', () => {
    expect(keptOf(openReport(opened(nativeSource, [eopCard])))).toEqual([
      false,
    ]);
  });

  it('keeps nothing a file Saerskriven only reads lost, which holds no source to save back to', () => {
    const report = openReport(imported([eopCard]));

    expect(report).toMatchObject({ occasion: 'open', readOnlyFormat: 'otm' });
    expect(keptOf(report)).toEqual([false]);
  });

  it('reports a file Saerskriven only reads even where it lost nothing, for its notice', () => {
    expect(openReport(imported([raisedMark]))).toEqual({
      occasion: 'open',
      model: sampleModel,
      losses: [],
      readOnlyFormat: 'otm',
    });
  });

  it('reports nothing for an open of a format Saerskriven writes that lost nothing', () => {
    expect(openReport(opened(foreignSource, [raisedMark]))).toBeUndefined();
  });

  it('names each subject from the model the read produced', () => {
    const report = openReport(opened(foreignSource, [eopCard]));

    expect(report && reportLines(t, report)).toEqual([
      t('divergence.kept', {
        line: t('divergence.line', {
          subject: t('divergence.subject-threat', {
            number: sampleThreat.number,
            title: sampleThreat.title,
          }),
          detail: t('divergence.threat-category-eop-suit'),
        }),
      }),
    ]);
  });
});

describe('saveReport', () => {
  it('reports nothing for a save whose divergences lose nothing', () => {
    expect(saveReport(recordedModel, [raisedMark])).toBeUndefined();
  });

  it('leaves out what loses nothing, and keeps nothing it reports', () => {
    expect(saveReport(recordedModel, [raisedMark, unrecorded])?.losses).toEqual(
      [{ divergence: unrecorded, kept: false }],
    );
  });

  it('names each subject from the model it saved', () => {
    const report = saveReport(recordedModel, [unrecorded]);

    expect(report && reportLines(t, report)).toEqual([
      t('divergence.line', {
        subject: t('divergence.subject-assumption-on', {
          threat: t('divergence.threat', {
            number: sampleThreat.number,
            title: sampleThreat.title,
          }),
        }),
        detail: t('divergence.whole-assumption'),
      }),
    ]);
  });

  it('words a standing report again in the translator it is handed', () => {
    const report = saveReport(recordedModel, [unrecorded]);

    expect(report && reportLines(inLocale('sv'), report)).not.toEqual(
      report && reportLines(t, report),
    );
  });
});
