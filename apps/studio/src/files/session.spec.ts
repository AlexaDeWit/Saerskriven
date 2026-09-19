import {
  ReadFailure,
  hasDiverged,
  threatDragonCodec,
  type Divergence,
} from '@saerskriven/formats';
import { mitigationIdSchema } from '@saerskriven/model';
import { committedText } from '@saerskriven/model/fixtures';
import { translator, type Locale } from '@saerskriven/i18n';
import { activeTranslator, chooseLanguage } from '../messages/locale.js';
import { studioCatalogues, studioMessages } from '../messages/catalogues.js';
import { Action } from '../store/actions.js';
import { FileLifecycle, type RetainedSource } from '../store/state.js';
import {
  foreignSource,
  nativeSource,
  sampleModel,
} from '../store/store.fixtures.js';
import { OpenOutcome, SaveOutcome } from './bridge.js';
import {
  formatOf,
  formatOfName,
  formatsFrom,
  openedBy,
  proposedName,
  proposedExportName,
  reportLines,
  saveTarget,
  saveTypes,
  savedBy,
  writeThrough,
} from './session.js';
import { brokenThreatDragonText, sampleNativeText } from './files.fixtures.js';

type OutcomesByTag<Outcome extends { readonly _tag: string }> = {
  readonly [Tag in Outcome['_tag']]: Extract<Outcome, { readonly _tag: Tag }>;
};

const foreignText = threatDragonCodec.write(sampleModel).output;

const projectedForeign: RetainedSource = {
  format: 'threat-dragon',
  document: undefined,
};

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
  translator(studioMessages, studioCatalogues, locale).t(
    'defaults.untitled-file',
  );

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

  it('names an import whose own stem reduces to nothing, in the language given', () => {
    const action = openedBy(
      OpenOutcome.Chosen({
        name: '.json',
        text: committedText('otm/example.json'),
      }),
      'hotmodell',
      'import',
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

describe('writeThrough', () => {
  it('writes the format the source names', () => {
    expect(writeThrough(sampleModel, nativeSource).output).toBe(
      sampleNativeText,
    );
    expect(writeThrough(sampleModel, projectedForeign).output).toBe(
      foreignText,
    );
  });

  it('merges onto the document the source carries rather than projecting', () => {
    expect(writeThrough(sampleModel, foreignSource).output).not.toBe(
      foreignText,
    );
  });

  it('reports what a format with no place for the model could not hold', () => {
    expect(
      hasDiverged(writeThrough(sampleModel, nativeSource).divergences),
    ).toBe(false);
    expect(
      hasDiverged(writeThrough(sampleModel, projectedForeign).divergences),
    ).toBe(true);
  });
});

const speaker = () => activeTranslator().t;

describe('reportLines', () => {
  const divergences: readonly Divergence[] = [
    {
      subject: { kind: 'mitigation', id: mitigationIdSchema.parse('m-1') },
      detail: { code: 'assumption-unrecorded' },
      reason: 'unrepresentable',
    },
    {
      subject: { kind: 'model' },
      detail: { code: 'key-undeclared', parameters: { path: 'notes' } },
      reason: 'undeclared',
    },
  ];

  afterEach(() => {
    chooseLanguage('en-CA');
    globalThis.localStorage.clear();
  });

  it('says nothing at all where nothing diverged', () => {
    expect(reportLines(speaker(), [])).toEqual([]);
  });

  it.each(['open', 'import'] as const)(
    'describes one entry per line on %s, carrying the data its code names',
    (occasion) => {
      const lines = reportLines(speaker(), divergences, occasion);

      expect(lines).toHaveLength(divergences.length);
      expect(lines[1]).toContain('notes');
    },
  );

  it('names the subject and the reason on an open, and neither on an import', () => {
    const [opened] = reportLines(speaker(), divergences, 'open');
    const [imported] = reportLines(speaker(), divergences, 'import');

    expect(opened).toContain('m-1');
    expect(opened).toContain(imported);
    expect(imported).not.toContain('m-1');
  });

  it('phrases every line in the translator it is handed', () => {
    const english = reportLines(speaker(), divergences, 'open');
    chooseLanguage('sv');

    expect(reportLines(speaker(), divergences, 'open')).not.toEqual(english);
  });
});
