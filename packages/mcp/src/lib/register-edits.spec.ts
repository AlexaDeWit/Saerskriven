import { OperationFailure, linkAssumptionToModel } from '@saerskriven/model';
import {
  assumptionId,
  mitigationId,
  parsedFixture,
  registerModel,
  softHyphen,
  threatId,
  validModelFixture,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { applyEdits, modelEditSchema } from './edits.js';
import type { RegisterEdit } from './register-edits.js';

const reworded = 'Reworded on review.';

type Held = {
  readonly key: 'threats' | 'mitigations' | 'assumptions';
  readonly op: Extract<RegisterEdit['op'], `set_${string}_details`>;
  readonly field: 'threat' | 'mitigation' | 'assumption';
  readonly id: string;
  readonly texts: readonly string[];
};

type Change = Readonly<Record<string, string>>;

const heldThreat: Held = {
  key: 'threats',
  op: 'set_threat_details',
  field: 'threat',
  id: 'threat-tamper-payment',
  texts: ['title', 'description'],
};

const heldMitigation: Held = {
  key: 'mitigations',
  op: 'set_mitigation_details',
  field: 'mitigation',
  id: 'mitigation-bind-session',
  texts: ['title', 'prose'],
};

const heldAssumption: Held = {
  key: 'assumptions',
  op: 'set_assumption_details',
  field: 'assumption',
  id: 'assumption-pci-scope',
  texts: ['prose'],
};

const detailsInput = (held: Held, change: Change) => ({
  op: held.op,
  [held.field]: held.id,
  ...change,
});

const applyDetails = (held: Held, change: Change) =>
  applyEdits(registerModel, [
    modelEditSchema.parse(detailsInput(held, change)),
  ]);

describe('the details edits', () => {
  it.each(
    (
      [
        [heldThreat, { title: reworded }],
        [heldThreat, { description: reworded }],
        [heldMitigation, { prose: reworded }],
        [heldMitigation, { title: reworded, prose: reworded }],
        [heldAssumption, { prose: reworded }],
      ] as const
    ).map(([held, change]) => ({
      held,
      change,
      fields: Object.keys(change).join(' and '),
    })),
  )(
    '$held.op changes the $fields of its record and keeps the rest of the model',
    ({ held, change }) => {
      expect(applyDetails(held, change)).toEqual(
        Either.right({
          model: {
            ...registerModel,
            [held.key]: registerModel[held.key].map((record) =>
              record.id === held.id ? { ...record, ...change } : record,
            ),
          },
          culled: [],
          culledThreats: [],
        }),
      );
    },
  );

  it.each<{
    readonly held: Held;
    readonly change: Change;
    readonly failure: OperationFailure;
  }>([
    {
      held: { ...heldThreat, id: 'threat-absent' },
      change: { title: reworded },
      failure: OperationFailure.UnknownThreat({
        threatId: threatId('threat-absent'),
      }),
    },
    {
      held: { ...heldMitigation, id: 'mitigation-absent' },
      change: { prose: reworded },
      failure: OperationFailure.UnknownMitigation({
        mitigationId: mitigationId('mitigation-absent'),
      }),
    },
    {
      held: { ...heldAssumption, id: 'assumption-absent' },
      change: { prose: reworded },
      failure: OperationFailure.UnknownAssumption({
        assumptionId: assumptionId('assumption-absent'),
      }),
    },
  ])(
    'refuses $held.op on a record the model does not hold',
    ({ held, change, failure }) => {
      expect(applyDetails(held, change)).toEqual(
        Either.left({ index: 0, failure }),
      );
    },
  );

  it.each(
    [heldThreat, heldMitigation, heldAssumption].flatMap((held) =>
      held.texts.map((text) => ({ held, text })),
    ),
  )(
    'refuses a refused character in the $text of $held.op',
    ({ held, text }) => {
      expect(
        modelEditSchema.safeParse(
          detailsInput(held, { [text]: `Re${softHyphen}worded` }),
        ).success,
      ).toBe(false);
    },
  );

  it.each([
    {
      held: heldThreat,
      replace: {
        op: 'replace_threat',
        threat: registerModel.threats.find(({ id }) => id === heldThreat.id),
      },
    },
    {
      held: heldMitigation,
      replace: {
        op: 'replace_mitigation',
        mitigation: registerModel.mitigations.find(
          ({ id }) => id === heldMitigation.id,
        ),
      },
    },
    {
      held: heldAssumption,
      replace: {
        op: 'replace_assumption',
        assumption: registerModel.assumptions.find(
          ({ id }) => id === heldAssumption.id,
        ),
      },
    },
  ])(
    '$held.op naming no field applies as a replace with the held record does',
    ({ held, replace }) => {
      const replaced = applyEdits(registerModel, [
        modelEditSchema.parse(replace),
      ]);
      expect(applyDetails(held, {})).toEqual(replaced);
      expect(Either.getOrUndefined(replaced)?.model).toEqual(registerModel);
    },
  );
});

describe('replace_assumption', () => {
  const managedDb = assumptionId('assumption-managed-db');
  const modelWide = Either.getOrThrow(
    linkAssumptionToModel(
      parsedFixture({
        ...validModelFixture,
        assumptions: validModelFixture.assumptions.map((assumption) => ({
          ...assumption,
          threats: [],
        })),
      }),
      managedDb,
    ),
  );
  const replacing = (appliesToModel: boolean) =>
    Either.getOrThrow(
      applyEdits(modelWide, [
        {
          op: 'replace_assumption',
          assumption: {
            id: managedDb,
            prose: 'Reworded.',
            status: 'valid',
            threats: [],
            appliesToModel,
          },
        },
      ]),
    );

  it('keeps the model link a replacement states', () => {
    const applied = replacing(true);
    expect(applied.model.assumptions).toEqual([
      { ...modelWide.assumptions[0], prose: 'Reworded.' },
    ]);
    expect(applied.culled).toEqual([]);
  });

  it('culls an assumption whose replacement takes away its model link and links no threat', () => {
    const applied = replacing(false);
    expect(applied.model.assumptions).toEqual([]);
    expect(applied.culled).toEqual([{ kind: 'assumption', id: managedDb }]);
  });

  it('is refused where it leaves the model link unstated', () => {
    expect(
      modelEditSchema.safeParse({
        op: 'replace_assumption',
        assumption: {
          id: managedDb,
          prose: 'Reworded.',
          status: 'valid',
          threats: [],
        },
      }).success,
    ).toBe(false);
  });
});
