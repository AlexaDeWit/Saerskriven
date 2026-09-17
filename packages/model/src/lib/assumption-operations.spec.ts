import { Either } from 'effect';
import {
  assumptionId,
  parsedFixture,
  registerModel,
  threatId,
} from '../fixtures.js';
import {
  addAssumption,
  linkAssumption,
  linkAssumptionToModel,
  removeAssumption,
  replaceAssumption,
  setAssumptionStatus,
  unlinkAssumption,
  unlinkAssumptionFromModel,
} from './assumption-operations.js';
import { assumptionSchema, type Assumption } from './assumptions.js';
import { threatRegisterFixture } from './model.fixtures.js';
import { OperationFailure } from './operation-failures.js';
import { errorOf, modelOf, operationContract } from './operations.fixtures.js';
import type { Model } from './parse.js';
import { droppedRecords } from './records.js';

const pciScope = assumptionId('assumption-pci-scope');
const spoofShopper = threatId('threat-spoof-shopper');
const tamperPayment = threatId('threat-tamper-payment');
const ghostThreat = threatId('threat-ghost');
const ghostAssumption = assumptionId('assumption-ghost');

const unlinkedFromFile = parsedFixture({
  ...threatRegisterFixture,
  assumptions: [
    {
      id: 'assumption-pci-scope',
      prose: 'The card vault is audited under PCI DSS every year.',
      status: 'valid',
      threats: [],
      appliesToModel: false,
    },
  ],
});

const assumptionIds = (model: Model): string[] =>
  model.assumptions.map((assumption) => assumption.id);

const tlsInput = {
  id: 'assumption-tls-everywhere',
  prose: 'Every hop between the shopper and checkout runs over TLS.',
  status: 'valid',
  threats: ['threat-tamper-payment'],
  appliesToModel: false,
};

const tlsEverywhere = assumptionSchema.parse(tlsInput);

const modelScoped = modelOf(linkAssumptionToModel(registerModel, pciScope));

const invalidatedScope: Assumption = assumptionSchema.parse({
  id: 'assumption-pci-scope',
  prose: 'The card vault is audited under PCI DSS every year.',
  status: 'invalidated',
  threats: ['threat-spoof-shopper'],
  appliesToModel: false,
});

describe('addAssumption', () => {
  it('appends the assumption to the register', () => {
    const next = modelOf(addAssumption(registerModel, tlsEverywhere));
    expect(assumptionIds(next)).toEqual([
      ...assumptionIds(registerModel),
      tlsEverywhere.id,
    ]);
  });

  it('refuses an assumption that links no threat and does not apply to the model', () => {
    const unlinked = assumptionSchema.parse({ ...tlsInput, threats: [] });
    expect(addAssumption(registerModel, unlinked)).toEqual(
      Either.left(
        OperationFailure.AssumptionWithoutReference({
          assumptionId: unlinked.id,
        }),
      ),
    );
  });

  it('appends an assumption that applies to the model and links no threat', () => {
    const modelWide = assumptionSchema.parse({
      ...tlsInput,
      threats: [],
      appliesToModel: true,
    });
    expect(
      modelOf(addAssumption(registerModel, modelWide)).assumptions,
    ).toContainEqual(modelWide);
  });

  it('fails on an id the register already holds', () => {
    const clash = assumptionSchema.parse({
      ...tlsInput,
      id: 'assumption-pci-scope',
    });
    expect(errorOf(addAssumption(registerModel, clash))).toEqual(
      OperationFailure.DuplicateAssumptionId({ assumptionId: pciScope }),
    );
  });

  it('fails on a link to an unknown threat', () => {
    const dangling = assumptionSchema.parse({
      ...tlsInput,
      threats: ['threat-ghost'],
    });
    expect(errorOf(addAssumption(registerModel, dangling))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('replaceAssumption', () => {
  it('swaps the whole record in, keeping its place in the register', () => {
    const next = modelOf(replaceAssumption(registerModel, invalidatedScope));
    expect(next.assumptions[0]).toEqual(invalidatedScope);
    expect(assumptionIds(next)).toEqual(assumptionIds(registerModel));
  });

  it('returns the model it was given for the record it already holds', () => {
    expect(
      modelOf(replaceAssumption(registerModel, registerModel.assumptions[0])),
    ).toBe(registerModel);
  });

  it('fails on an id the register does not hold', () => {
    expect(errorOf(replaceAssumption(registerModel, tlsEverywhere))).toEqual(
      OperationFailure.UnknownAssumption({
        assumptionId: assumptionId('assumption-tls-everywhere'),
      }),
    );
  });

  it('fails on a link to an unknown threat', () => {
    const dangling = assumptionSchema.parse({
      ...invalidatedScope,
      threats: ['threat-ghost'],
    });
    expect(errorOf(replaceAssumption(registerModel, dangling))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('replaceAssumption and the last reference', () => {
  it('culls an assumption the replacement takes to no threat link', () => {
    const unlinked = assumptionSchema.parse({
      ...invalidatedScope,
      threats: [],
    });
    expect(
      assumptionIds(modelOf(replaceAssumption(registerModel, unlinked))),
    ).toEqual([]);
  });

  it('keeps an assumption the replacement leaves applying to the model', () => {
    const modelWide = assumptionSchema.parse({
      ...invalidatedScope,
      threats: [],
      appliesToModel: true,
    });
    expect(
      modelOf(replaceAssumption(registerModel, modelWide)).assumptions,
    ).toEqual([modelWide]);
  });

  it('culls a model-scoped assumption the replacement takes to no reference', () => {
    const unreferenced = assumptionSchema.parse({
      ...invalidatedScope,
      threats: [],
    });
    expect(
      assumptionIds(modelOf(replaceAssumption(modelScoped, unreferenced))),
    ).toEqual([]);
  });

  it('keeps an assumption that had no threat link before the replacement', () => {
    const reworded = assumptionSchema.parse({
      ...unlinkedFromFile.assumptions[0],
      prose: 'Reworded.',
    });
    expect(
      modelOf(replaceAssumption(unlinkedFromFile, reworded)).assumptions,
    ).toEqual([reworded]);
  });
});

describe('removeAssumption', () => {
  it('drops the assumption from the register', () => {
    expect(
      assumptionIds(modelOf(removeAssumption(registerModel, pciScope))),
    ).toEqual([]);
  });

  it('leaves the threats it rested on untouched', () => {
    const next = modelOf(removeAssumption(registerModel, pciScope));
    expect(next.diagrams).toEqual(registerModel.diagrams);
    expect(next.threats).toEqual(registerModel.threats);
  });

  it('fails on an assumption the register does not hold', () => {
    const ghost = assumptionId('assumption-ghost');
    expect(errorOf(removeAssumption(registerModel, ghost))).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghost }),
    );
  });
});

describe('linkAssumption', () => {
  it('adds the threat to the assumption links', () => {
    const next = modelOf(
      linkAssumption(registerModel, pciScope, tamperPayment),
    );
    expect(next.assumptions[0].threats).toEqual([spoofShopper, tamperPayment]);
  });

  it('returns the model it was given for a threat already linked', () => {
    expect(modelOf(linkAssumption(registerModel, pciScope, spoofShopper))).toBe(
      registerModel,
    );
  });

  it('refuses an unknown threat or an unknown assumption', () => {
    expect(
      errorOf(linkAssumption(registerModel, pciScope, ghostThreat)),
    ).toEqual(OperationFailure.UnknownThreat({ threatId: ghostThreat }));
    expect(
      errorOf(linkAssumption(registerModel, ghostAssumption, spoofShopper)),
    ).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghostAssumption }),
    );
  });
});

describe('unlinkAssumption', () => {
  it('keeps an assumption that still links another threat', () => {
    const linked = modelOf(
      linkAssumption(registerModel, pciScope, tamperPayment),
    );
    const next = modelOf(unlinkAssumption(linked, pciScope, spoofShopper));
    expect(next.assumptions[0].threats).toEqual([tamperPayment]);
  });

  it('culls the assumption when the threat was its last link', () => {
    expect(
      assumptionIds(
        modelOf(unlinkAssumption(registerModel, pciScope, spoofShopper)),
      ),
    ).toEqual([]);
  });

  it('keeps an assumption that applies to the model when its last threat link goes', () => {
    const next = modelOf(unlinkAssumption(modelScoped, pciScope, spoofShopper));
    expect(next.assumptions).toEqual([
      { ...modelScoped.assumptions[0], threats: [] },
    ]);
  });

  it('returns the model it was given for a threat not linked', () => {
    expect(
      modelOf(unlinkAssumption(registerModel, pciScope, tamperPayment)),
    ).toBe(registerModel);
  });

  it('refuses an unknown threat or an unknown assumption', () => {
    expect(
      errorOf(unlinkAssumption(registerModel, pciScope, ghostThreat)),
    ).toEqual(OperationFailure.UnknownThreat({ threatId: ghostThreat }));
    expect(
      errorOf(unlinkAssumption(registerModel, ghostAssumption, spoofShopper)),
    ).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghostAssumption }),
    );
  });
});

describe('linkAssumptionToModel', () => {
  it('applies the assumption to the model and keeps its threat links', () => {
    expect(modelScoped.assumptions).toEqual([
      { ...registerModel.assumptions[0], appliesToModel: true },
    ]);
  });

  it('returns the model it was given for an assumption that already applies', () => {
    expect(modelOf(linkAssumptionToModel(modelScoped, pciScope))).toBe(
      modelScoped,
    );
  });

  it('refuses an unknown assumption', () => {
    expect(
      errorOf(linkAssumptionToModel(registerModel, ghostAssumption)),
    ).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghostAssumption }),
    );
  });
});

describe('unlinkAssumptionFromModel', () => {
  it('keeps an assumption that still links a threat, with that link', () => {
    expect(
      modelOf(unlinkAssumptionFromModel(modelScoped, pciScope)).assumptions,
    ).toEqual(registerModel.assumptions);
  });

  it('culls an assumption that links no threat, and droppedRecords names it', () => {
    const threatless = modelOf(
      unlinkAssumption(modelScoped, pciScope, spoofShopper),
    );
    const next = modelOf(unlinkAssumptionFromModel(threatless, pciScope));
    expect(assumptionIds(next)).toEqual([]);
    expect(droppedRecords(threatless, next)).toEqual([
      { kind: 'assumption', id: pciScope },
    ]);
  });

  it('returns the model it was given for an assumption that does not apply', () => {
    expect(modelOf(unlinkAssumptionFromModel(registerModel, pciScope))).toBe(
      registerModel,
    );
  });

  it('refuses an unknown assumption', () => {
    expect(
      errorOf(unlinkAssumptionFromModel(registerModel, ghostAssumption)),
    ).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghostAssumption }),
    );
  });
});

describe('setAssumptionStatus', () => {
  it('changes only the status of that assumption', () => {
    const next = modelOf(
      setAssumptionStatus(registerModel, pciScope, 'invalidated'),
    );
    expect(next).toEqual({
      ...registerModel,
      assumptions: [{ ...registerModel.assumptions[0], status: 'invalidated' }],
    });
  });

  it('keeps an assumption that has no threat link', () => {
    const next = modelOf(
      setAssumptionStatus(unlinkedFromFile, pciScope, 'invalidated'),
    );
    expect(next.assumptions).toEqual([
      { ...unlinkedFromFile.assumptions[0], status: 'invalidated' },
    ]);
  });

  it('refuses an unknown assumption', () => {
    expect(
      errorOf(
        setAssumptionStatus(registerModel, ghostAssumption, 'invalidated'),
      ),
    ).toEqual(
      OperationFailure.UnknownAssumption({ assumptionId: ghostAssumption }),
    );
  });
});

describe('assumption operations', () => {
  operationContract({
    addAssumption: {
      input: registerModel,
      run: (model) => addAssumption(model, tlsEverywhere),
    },
    replaceAssumption: {
      input: registerModel,
      run: (model) => replaceAssumption(model, invalidatedScope),
    },
    removeAssumption: {
      input: registerModel,
      run: (model) => removeAssumption(model, pciScope),
    },
    linkAssumption: {
      input: registerModel,
      run: (model) => linkAssumption(model, pciScope, tamperPayment),
    },
    unlinkAssumption: {
      input: registerModel,
      run: (model) => unlinkAssumption(model, pciScope, spoofShopper),
    },
    setAssumptionStatus: {
      input: registerModel,
      run: (model) => setAssumptionStatus(model, pciScope, 'invalidated'),
    },
    linkAssumptionToModel: {
      input: registerModel,
      run: (model) => linkAssumptionToModel(model, pciScope),
    },
    unlinkAssumptionFromModel: {
      input: modelScoped,
      run: (model) => unlinkAssumptionFromModel(model, pciScope),
    },
  });
});
