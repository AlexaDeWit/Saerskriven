import { recordsLinkedTo } from '@saerskriven/model';
import { mitigationId, threatId } from '@saerskriven/model/fixtures';
import {
  firstThreat,
  recordedModel,
  secondThreat,
} from '../store/store.fixtures.js';
import {
  assumptionKind,
  editedRecord,
  inShownOrder,
  linkableRecords,
  mitigationKind,
  recordFieldIn,
  recordFieldName,
  modelTarget,
  recordLabel,
  threatTarget,
} from './records.js';
import { activeTranslator } from '../messages/locale.js';
import { optionName } from './distinct-labels.js';
import { numbersIn } from '../ui/ui.fixtures.js';

const translator = activeTranslator();

const [mitigation] = recordedModel.mitigations;

describe('record kinds', () => {
  it('start a mitigation proposed and an assumption unconfirmed, each on the threat alone', () => {
    expect(
      threatTarget(mitigationKind, firstThreat).attach(mitigationKind.fresh()),
    ).toMatchObject({ status: 'proposed', threats: [firstThreat] });
    expect(
      threatTarget(assumptionKind, firstThreat).attach(assumptionKind.fresh()),
    ).toMatchObject({
      status: 'unconfirmed',
      threats: [firstThreat],
      appliesToModel: false,
    });
  });

  it('start an assumption on the model unconfirmed, applying to the model and linking no threat', () => {
    expect(modelTarget.attach(assumptionKind.fresh())).toMatchObject({
      status: 'unconfirmed',
      threats: [],
      appliesToModel: true,
    });
  });
});

describe('recordsLinkedTo and linkableRecords', () => {
  const shared = {
    ...mitigation,
    id: mitigationId('mitigation-shared'),
    title: 'Read-only share links',
    threats: [firstThreat, secondThreat],
  };
  const records = [mitigation, shared];

  it('split one register into what the threat holds and what it could link', () => {
    expect(recordsLinkedTo(records, secondThreat)).toEqual([shared]);
    expect(
      linkableRecords(
        mitigationKind,
        records,
        threatTarget(mitigationKind, secondThreat),
        recordedModel.threats,
        translator,
      ).map(({ record }) => record),
    ).toEqual([mitigation]);
  });

  it('describes an offered record by its status and the numbers of the threats holding it, in number order', () => {
    const [{ text }] = linkableRecords(
      mitigationKind,
      [{ ...shared, threats: [secondThreat, firstThreat] }],
      { holds: () => false },
      recordedModel.threats,
      translator,
    );
    expect(text.detail).toContain(
      translator.t(mitigationKind.statusMessage(shared.status)),
    );
    expect(text.detail).toMatch(/1\D+2/u);
  });

  it('says where an offered assumption applies to the model, naming no threat where it holds none', () => {
    const [assumption] = recordedModel.assumptions;
    const [onModel, onNothing] = linkableRecords(
      assumptionKind,
      [
        { ...assumption, threats: [], appliesToModel: true },
        { ...assumption, threats: [], appliesToModel: false },
      ],
      { holds: () => false },
      recordedModel.threats,
      translator,
    );
    expect(onModel.text.detail).not.toBe(onNothing.text.detail);
    expect(onModel.text.detail).not.toMatch(/\d/u);
  });

  it('labels a record with no text by its id', () => {
    const blank = { ...mitigation, title: '', prose: '\n' };
    expect(
      optionName(
        linkableRecords(
          mitigationKind,
          [blank],
          threatTarget(mitigationKind, secondThreat),
          recordedModel.threats,
          translator,
        )[0].text,
      ),
    ).toContain(mitigation.id);
  });
});

describe('the model as a record target', () => {
  const [assumption] = recordedModel.assumptions;
  const applying = { ...assumption, appliesToModel: true };

  it('offers to link only the assumptions that do not apply to the model', () => {
    expect(
      linkableRecords(
        assumptionKind,
        [assumption, applying],
        modelTarget,
        recordedModel.threats,
        translator,
      ).map(({ record }) => record),
    ).toEqual([assumption]);
  });

  it('heads its group from the studio catalogue rather than the register', () => {
    expect(modelTarget.heading).toBe('terms.model-assumptions');
    expect(threatTarget(assumptionKind, firstThreat).heading).toBe(
      assumptionKind.heading,
    );
  });
});

describe('where else a shared row says its record is referenced', () => {
  const [assumption] = recordedModel.assumptions;
  const numbered = [25, 9, 4, 7, 31, 12].map((number) => ({
    id: threatId(`threat-${String(number)}`),
    number,
  }));
  const on = (...numbers: readonly number[]) => ({
    ...assumption,
    threats: numbered
      .filter(({ number }) => numbers.includes(number))
      .map(({ id }) => id),
  });
  const onThreat = (number: number) =>
    threatTarget(
      assumptionKind,
      numbered.find((threat) => threat.number === number)?.id ?? firstThreat,
    );

  it('names the other threats by number, in number order, alike in both panels', () => {
    expect(
      numbersIn(onThreat(9).elsewhere(on(9, 25, 4), numbered, translator)),
    ).toEqual([4, 25]);
    expect(
      numbersIn(modelTarget.elsewhere(on(25, 4), numbered, translator)),
    ).toEqual([4, 25]);
    expect(onThreat(9).elsewhere(on(9, 25, 4), numbered, translator)).toBe(
      modelTarget.elsewhere(on(25, 4), numbered, translator),
    );
  });

  it('names up to four threats, and past four names three and counts the rest', () => {
    expect(
      numbersIn(modelTarget.elsewhere(on(4, 7, 9, 25), numbered, translator)),
    ).toEqual([4, 7, 9, 25]);
    expect(
      numbersIn(
        modelTarget.elsewhere(on(4, 7, 9, 12, 25), numbered, translator),
      ),
    ).toEqual([4, 7, 9, 2]);
    expect(
      numbersIn(
        modelTarget.elsewhere(on(4, 7, 9, 12, 25, 31), numbered, translator),
      ),
    ).toEqual([4, 7, 9, 3]);
  });

  it('says an assumption on a threat also applies to the model, and says nothing of a record on this target alone', () => {
    const applying = { ...on(9), appliesToModel: true };
    expect(onThreat(9).elsewhere(applying, numbered, translator)).toBeDefined();
    expect(
      numbersIn(onThreat(9).elsewhere(applying, numbered, translator)),
    ).toEqual([]);
    expect(onThreat(9).elsewhere(on(9), numbered, translator)).toBeUndefined();
    expect(modelTarget.elsewhere(on(), numbered, translator)).toBeUndefined();
  });
});

describe('inShownOrder', () => {
  it('keeps shown rows in their shown order, holds the slot of a gone row, and puts new rows after them', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

    expect(inShownOrder(rows, ['c', 'gone', 'a', 'c'])).toEqual({
      rows: ['c', 'a', 'b', 'd'].map((id) => ({ id })),
      shown: ['c', 'gone', 'a', 'b', 'd'],
    });
  });

  it('gives back the shown order itself when no row is new', () => {
    const shown = ['b', 'gone', 'a'];

    expect(inShownOrder([{ id: 'a' }, { id: 'b' }], shown).shown).toBe(shown);
  });
});

describe('editedRecord', () => {
  it('is nothing for text the record already holds', () => {
    expect(
      editedRecord(mitigationKind, mitigation, 'title', mitigation.title),
    ).toBeUndefined();
  });

  it('replaces only the part edited', () => {
    expect(
      editedRecord(mitigationKind, mitigation, 'prose', 'Links carry a scope.'),
    ).toEqual({ ...mitigation, prose: 'Links carry a scope.' });
  });
});

describe('record field names', () => {
  it('give back the record of their own kind, and whether it was a pending row', () => {
    const name = recordFieldName({
      noun: 'mitigation',
      part: 'title',
      recordId: 'mitigation/odd id',
      pending: true,
    });
    expect(recordFieldIn(name, 'mitigation')).toEqual({
      noun: 'mitigation',
      part: 'title',
      recordId: 'mitigation/odd id',
      pending: true,
    });
    expect(recordFieldIn(name, 'assumption')).toBeUndefined();
    expect(recordFieldIn('Description', 'mitigation')).toBeUndefined();
  });
});

describe('recordLabel', () => {
  it('is the title, else the first line of text, else the id', () => {
    expect(recordLabel(mitigation)).toBe(mitigation.title);
    expect(recordLabel({ ...mitigation, title: '', prose: 'One\nTwo' })).toBe(
      'One',
    );
    expect(recordLabel({ ...mitigation, title: '', prose: '' })).toBe(
      mitigation.id,
    );
  });
});
