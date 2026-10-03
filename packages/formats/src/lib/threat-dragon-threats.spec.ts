import type { ModelInput } from '@saerskriven/model';
import { parsedFixture } from '@saerskriven/model/fixtures';
import type { ThreatDragonDocument } from '@saerskriven/wire-threat-dragon';
import { renderDivergences } from './divergence.js';
import { planThreats } from './threat-dragon-threats.js';
import {
  complementFixture,
  featureCompleteText,
  richerThanFormatFixture,
  threatDragonReading,
} from './threat-dragon.fixtures.js';

const featureComplete = threatDragonReading(featureCompleteText);

const richer = parsedFixture(richerThanFormatFixture);

const model = (
  threats: ModelInput['threats'],
  lastIssuedThreatNumber: number,
) =>
  parsedFixture({
    metadata: { title: '', owner: '', description: '', contributors: [] },
    diagrams: [
      {
        id: '0',
        title: '',
        elements: [
          {
            kind: 'process',
            id: 'cell-1',
            name: '',
            description: '',
            outOfScope: false,
            reasonOutOfScope: '',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
          },
        ],
      },
    ],
    threats,
    lastIssuedThreatNumber,
    mitigations: [],
    assumptions: [],
  } satisfies ModelInput);

const threat = (number: number): ModelInput['threats'][number] => ({
  id: `threat-${number}`,
  number,
  title: '',
  category: { methodology: 'STRIDE', category: 'tampering' },
  severity: 'low',
  status: 'open',
  description: '',
  elements: ['cell-1'],
  appliesToModel: false,
});

const emptyDocument: ThreatDragonDocument = {
  version: '2.6.2',
  summary: { title: '' },
  detail: { diagrams: [] },
};

const undeclaredDocument: ThreatDragonDocument = {
  version: '2.6.2',
  summary: { title: '' },
  detail: {
    diagrams: [
      {
        id: 0,
        title: '',
        diagramType: 'STRIDE',
        cells: [
          {
            id: 'cell-1',
            shape: 'process',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
            data: {
              type: 'tm.Process',
              threats: [
                {
                  id: 'threat-4',
                  number: 4,
                  title: '',
                  modelType: 'STRIDE',
                  type: 'Tampering',
                  status: 'Open',
                  severity: 'Low',
                  description: '',
                  mitigation: '',
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

describe('placing the threats of a model under the cells that host them', () => {
  it('nests each under the cell it names, in the order the file had them', () => {
    const plan = planThreats(featureComplete.model, featureComplete.source);
    expect(
      [...plan.byCell].map(([id, threats]) => [
        id,
        threats.map((held) => held.number),
      ]),
    ).toEqual([
      ['actor-patient', [1, 2]],
      ['process-booking', [3, 4, 5]],
      ['store-appointments', [6]],
      ['flow-request', [8, 9, 10]],
      ['flow-sync', [11, 12, 13, 14, 15, 16]],
      ['process-records', [17, 18, 19, 20, 21, 22, 23]],
      ['actor-clerk', [17, 24, 40]],
    ]);
    expect(plan.divergences).toEqual([]);
  });

  it('names what the format nests a threat under nowhere', () => {
    expect(
      renderDivergences(planThreats(richer, undefined).divergences).split('\n'),
    ).toEqual([
      'threat "threat-split": the one record, written once under each of the 2 elements it names (split by the format)',
      'threat "threat-privacy": the PLOT4ai category "cybersecurity", which Threat Dragon\'s own labels do not name (reduced to fit the format)',
      'threat "threat-zone": the attachment to the trust boundary "element-zone", which the format nests a threat under an actor, a process, a store, or a flow alone (no place in the format)',
      'threat "threat-zone": the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under (no place in the format)',
      'threat "threat-unattached": the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under (no place in the format)',
      'threat "threat-split": the mitigation title written into its one mitigation text, which reads back as one record with no title (reduced to fit the format)',
    ]);
  });

  it('writes a split threat under every cell it names', () => {
    const plan = planThreats(richer, undefined);
    expect(
      [...plan.byCell].map(([id, threats]) => [
        id,
        threats.map((held) => held.id),
      ]),
    ).toEqual([
      ['element-ledger', ['threat-split']],
      ['element-vault', ['threat-split']],
      ['element-clerk', ['threat-privacy']],
    ]);
  });
});

const onModel = (
  fields: Partial<ModelInput['threats'][number]>,
): ModelInput['threats'][number] => ({
  ...threat(1),
  appliesToModel: true,
  ...fields,
});

const withNoPlace = (
  code: 'threat-unplaceable' | 'threat-model-link-dropped',
  id = 'threat-1',
) =>
  ({
    subject: { kind: 'threat', id },
    detail: { code },
    reason: 'unrepresentable',
  }) as const;

describe('a threat that applies to the model', () => {
  it('is not written where it names no element, and is reported once, as any threat on none is', () => {
    const plan = planThreats(model([onModel({ elements: [] })], 1), undefined);
    expect([...plan.byCell]).toEqual([]);
    expect(plan.divergences).toEqual([withNoPlace('threat-unplaceable')]);
  });

  it('is written under its element as a threat without the link is, and the link is reported as having no place', () => {
    const plan = planThreats(model([onModel({})], 1), undefined);
    expect(plan.byCell).toEqual(
      planThreats(model([threat(1)], 1), undefined).byCell,
    );
    expect([...plan.byCell.keys()]).toEqual(['cell-1']);
    expect(plan.divergences).toEqual([
      withNoPlace('threat-model-link-dropped'),
    ]);
  });

  it('has the link reported once for the threat, beside the split, where two cells hold a copy', () => {
    const onTwo = parsedFixture({
      ...richerThanFormatFixture,
      threats: [onModel({ elements: ['element-ledger', 'element-vault'] })],
      mitigations: [],
      assumptions: [],
    });
    const plan = planThreats(onTwo, undefined);
    expect([...plan.byCell.keys()]).toEqual([
      'element-ledger',
      'element-vault',
    ]);
    expect(plan.divergences).toEqual([
      withNoPlace('threat-model-link-dropped'),
      {
        subject: { kind: 'threat', id: 'threat-1' },
        detail: {
          code: 'threat-split-across-elements',
          parameters: { count: 2 },
        },
        reason: 'split',
      },
    ]);
  });

  it('has the link reported once, and no split, by a merge onto a file that already nests the threat under both its cells', () => {
    const read = threatDragonReading(JSON.stringify(complementFixture));
    const marked = {
      ...read.model,
      threats: read.model.threats.map((held) =>
        held.id === 'threat-linkability'
          ? { ...held, appliesToModel: true }
          : held,
      ),
    };
    expect(planThreats(read.model, read.source).divergences).toEqual([]);
    expect(planThreats(marked, read.source).divergences).toEqual([
      withNoPlace('threat-model-link-dropped', 'threat-linkability'),
    ]);
  });
});

describe('a threat on a text note', () => {
  const onNote = parsedFixture({
    ...richerThanFormatFixture,
    threats: [{ ...threat(1), elements: ['element-note', 'element-ledger'] }],
    mitigations: [],
    assumptions: [],
  });

  it('is reported as a stray attachment to a text', () => {
    expect(planThreats(onNote, undefined).divergences).toContainEqual({
      subject: { kind: 'threat', id: 'threat-1' },
      detail: {
        code: 'threat-attachment-stray',
        parameters: { element: 'element-note', kind: 'text' },
      },
      reason: 'unrepresentable',
    });
  });

  it('is nested under the cells that host threats alone', () => {
    expect([...planThreats(onNote, undefined).byCell.keys()]).toEqual([
      'element-ledger',
    ]);
  });
});

describe('the high-water mark a plan writes', () => {
  it('repeats what the file declared where every number is already in it', () => {
    expect(
      planThreats(featureComplete.model, featureComplete.source).threatTop
        .value,
    ).toBe(30);
    expect(featureComplete.model.lastIssuedThreatNumber).toBe(40);
  });

  it('covers a number this write puts in a file that lacked it', () => {
    const written = model([threat(3)], 3);
    expect(planThreats(written, emptyDocument).threatTop).toEqual({
      value: 3,
      cause: 'issued',
    });
  });

  it('covers what a file declaring no mark of its own already holds', () => {
    const written = model([threat(4)], 4);
    expect(undeclaredDocument.detail.threatTop).toBeUndefined();
    expect(planThreats(written, undeclaredDocument).threatTop).toEqual({
      value: 4,
      cause: 'issued',
    });
  });

  it('rises to the model mark where the numbers in the file cannot reach it', () => {
    const written = model([threat(3)], 40);
    expect(planThreats(written, undefined).threatTop).toEqual({
      value: 40,
      cause: 'unreachable',
    });
  });

  it('never falls below what the file declared', () => {
    const written = model([], 0);
    expect(
      planThreats(written, {
        ...emptyDocument,
        detail: { ...emptyDocument.detail, threatTop: 60 },
      }).threatTop.value,
    ).toBe(60);
  });
});

describe('a threat the source document already nests under two cells', () => {
  it('is reported where this write is the one dividing it', () => {
    const read = threatDragonReading(JSON.stringify(complementFixture));
    expect(
      renderDivergences(planThreats(read.model, undefined).divergences),
    ).toBe(
      'threat "threat-linkability": the one record, written once under each of the 2 elements it names (split by the format)',
    );
  });
});
