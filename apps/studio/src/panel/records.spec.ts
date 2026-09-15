import { recordsLinkedTo } from '@saerskriven/model';
import { mitigationId } from '@saerskriven/model/fixtures';
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
  otherThreats,
  recordFieldIn,
  recordFieldName,
  modelTarget,
  recordLabel,
  threatTarget,
} from './records.js';

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
      linkableRecords(records, threatTarget(mitigationKind, secondThreat)).map(
        ({ record }) => record,
      ),
    ).toEqual([mitigation]);
  });

  it('labels a record with no text by its id', () => {
    const blank = { ...mitigation, title: '', prose: '\n' };
    expect(
      linkableRecords([blank], threatTarget(mitigationKind, secondThreat))[0]
        .label,
    ).toContain(mitigation.id);
  });

  it('counts the other threats a record is on', () => {
    expect(otherThreats(shared, firstThreat)).toBe(1);
    expect(otherThreats(mitigation, firstThreat)).toBe(0);
  });
});

describe('the model as a record target', () => {
  const [assumption] = recordedModel.assumptions;
  const applying = { ...assumption, appliesToModel: true };

  it('offers to link only the assumptions that do not apply to the model', () => {
    expect(
      linkableRecords([assumption, applying], modelTarget).map(
        ({ record }) => record,
      ),
    ).toEqual([assumption]);
  });

  it('describes a row by where else its record is referenced', () => {
    expect(modelTarget.elsewhere(applying)).toContain('1');
    expect(
      modelTarget.elsewhere({
        ...applying,
        threats: [firstThreat, secondThreat],
      }),
    ).toMatch(/2 threats/u);
    expect(modelTarget.elsewhere({ ...applying, threats: [] })).toBeUndefined();
    expect(
      threatTarget(assumptionKind, firstThreat).elsewhere(applying),
    ).toBeDefined();
    expect(
      threatTarget(assumptionKind, firstThreat).elsewhere(assumption),
    ).toBeUndefined();
  });
});

describe('inShownOrder', () => {
  it('keeps shown rows in their shown order, drops the gone, and puts new rows after them', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

    expect(inShownOrder(rows, ['c', 'gone', 'a'])).toEqual(
      ['c', 'a', 'b', 'd'].map((id) => ({ id })),
    );
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
