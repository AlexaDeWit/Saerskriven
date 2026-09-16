import {
  elementId,
  emptyRegisterModel,
  parsedFixture,
  registerModel,
  threatId,
  threatIn,
} from '../fixtures.js';
import { threatRegisterFixture } from './fixtures.js';
import { OperationFailure } from './operation-failures.js';
import { errorOf, modelOf, operationContract } from './operations.fixtures.js';
import type { Model } from './parse.js';
import {
  addThreat,
  attachThreat,
  detachThreat,
  nextThreatNumber,
  removeThreat,
  replaceThreat,
} from './threat-operations.js';
import { threatSchema } from './threats.js';

const shopper = elementId('element-shopper');
const ledger = elementId('element-ledger');
const spoofShopper = threatId('threat-spoof-shopper');
const floodCheckout = threatId('threat-flood-checkout');

const threatIds = (model: Model): string[] =>
  model.threats.map((threat) => threat.id);

const threatNumbers = (model: Model): number[] =>
  model.threats.map((threat) => threat.number);

const replayInput = {
  id: 'threat-replay-payment',
  number: 13,
  title: 'Payment replay',
  category: { methodology: 'STRIDE', category: 'repudiation' },
  severity: 'medium',
  status: 'open',
  description: 'A captured payment request is submitted a second time.',
  elements: ['element-pay-flow'],
};

const replay = threatSchema.parse(replayInput);

const editedFlood = threatSchema.parse({
  ...threatIn(registerModel, 'threat-flood-checkout'),
  title: 'Checkout flooding from a botnet',
  severity: 'high',
  status: 'mitigated',
  elements: ['element-checkout', 'element-ledger'],
});

describe('addThreat', () => {
  it('appends the threat to the register', () => {
    const next = modelOf(addThreat(registerModel, replay));
    expect(threatIds(next)).toEqual([...threatIds(registerModel), replay.id]);
  });

  it('accepts a threat linked to no element', () => {
    const unlinked = threatSchema.parse({ ...replayInput, elements: [] });
    expect(
      threatIn(modelOf(addThreat(registerModel, unlinked)), replay.id).elements,
    ).toEqual([]);
  });

  it('fails on an id the register already holds', () => {
    const clash = threatSchema.parse({
      ...replayInput,
      id: 'threat-spoof-shopper',
    });
    expect(errorOf(addThreat(registerModel, clash))).toEqual(
      OperationFailure.DuplicateThreatId({ threatId: spoofShopper }),
    );
  });

  it('advances the last issued number to the added threat', () => {
    expect(
      modelOf(addThreat(registerModel, replay)).lastIssuedThreatNumber,
    ).toBe(13);
  });

  it('fails on the number last issued', () => {
    const spent = threatSchema.parse({ ...replayInput, number: 12 });
    expect(errorOf(addThreat(registerModel, spent))).toEqual(
      OperationFailure.ReusedThreatNumber({ number: 12 }),
    );
  });

  it('fails on a number below the last issued, held or not', () => {
    const held = threatSchema.parse({ ...replayInput, number: 5 });
    expect(errorOf(addThreat(registerModel, held))).toEqual(
      OperationFailure.ReusedThreatNumber({ number: 5 }),
    );
    const gap = threatSchema.parse({ ...replayInput, number: 11 });
    expect(errorOf(addThreat(registerModel, gap))).toEqual(
      OperationFailure.ReusedThreatNumber({ number: 11 }),
    );
  });

  it('fails on a link to an unknown element', () => {
    const dangling = threatSchema.parse({
      ...replayInput,
      elements: ['element-ghost'],
    });
    expect(errorOf(addThreat(registerModel, dangling))).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('removeThreat', () => {
  it('removes the threat from the register', () => {
    const next = modelOf(removeThreat(registerModel, spoofShopper));
    expect(threatIds(next)).not.toContain('threat-spoof-shopper');
  });

  it('unlinks the removed threat from a record that still links another', () => {
    const next = modelOf(removeThreat(registerModel, spoofShopper));
    expect(next.mitigations).toEqual([
      {
        ...registerModel.mitigations[0],
        threats: [threatId('threat-tamper-payment')],
      },
    ]);
  });

  it('culls every record whose only reference it was', () => {
    const next = modelOf(removeThreat(registerModel, spoofShopper));
    expect(next.assumptions).toEqual([]);
    const again = modelOf(
      removeThreat(next, threatId('threat-tamper-payment')),
    );
    expect(again.mitigations).toEqual([]);
  });

  it('keeps an assumption that applies to the model when its only threat goes', () => {
    const modelWide = parsedFixture({
      ...threatRegisterFixture,
      assumptions: [
        { ...threatRegisterFixture.assumptions[0], appliesToModel: true },
      ],
    });
    expect(modelOf(removeThreat(modelWide, spoofShopper)).assumptions).toEqual([
      { ...modelWide.assumptions[0], threats: [] },
    ]);
  });

  it('keeps a record that had no threat link before the removal', () => {
    const unlinked = parsedFixture({
      ...threatRegisterFixture,
      assumptions: [{ ...threatRegisterFixture.assumptions[0], threats: [] }],
    });
    expect(modelOf(removeThreat(unlinked, spoofShopper)).assumptions).toEqual(
      unlinked.assumptions,
    );
  });

  it('leaves the surviving numbers and the last issued number alone', () => {
    const next = modelOf(removeThreat(registerModel, spoofShopper));
    expect(threatNumbers(next)).toEqual([5, 9, 4, 7]);
    expect(next.lastIssuedThreatNumber).toBe(
      registerModel.lastIssuedThreatNumber,
    );
  });

  it('never lets the removed number be issued again', () => {
    const issued = modelOf(addThreat(registerModel, replay));
    const removed = modelOf(removeThreat(issued, replay.id));
    expect(threatIds(removed)).toEqual(threatIds(registerModel));
    expect(nextThreatNumber(issued)).toBe(14);
    expect(nextThreatNumber(removed)).toBe(14);
  });

  it('fails on a threat the register does not hold', () => {
    expect(
      errorOf(removeThreat(registerModel, threatId('threat-ghost'))),
    ).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('replaceThreat', () => {
  it('swaps the whole record in, keeping its place in the register', () => {
    const next = modelOf(replaceThreat(registerModel, editedFlood));
    expect(next.threats[3]).toEqual(editedFlood);
    expect(threatIds(next)).toEqual(threatIds(registerModel));
  });

  it('leaves the last issued number where it was', () => {
    expect(
      modelOf(replaceThreat(registerModel, editedFlood)).lastIssuedThreatNumber,
    ).toBe(registerModel.lastIssuedThreatNumber);
  });

  it('fails on an id the register does not hold', () => {
    expect(errorOf(replaceThreat(registerModel, replay))).toEqual(
      OperationFailure.UnknownThreat({ threatId: replay.id }),
    );
  });

  it('fails on a changed number', () => {
    const renumbered = threatSchema.parse({ ...editedFlood, number: 13 });
    expect(errorOf(replaceThreat(registerModel, renumbered))).toEqual(
      OperationFailure.ChangedThreatNumber({
        threatId: floodCheckout,
        number: 13,
      }),
    );
  });

  it('fails on a link to an unknown element', () => {
    const dangling = threatSchema.parse({
      ...editedFlood,
      elements: ['element-ghost'],
    });
    expect(errorOf(replaceThreat(registerModel, dangling))).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('attachThreat', () => {
  it('links an element of any diagram to the threat', () => {
    const next = modelOf(attachThreat(registerModel, floodCheckout, ledger));
    expect(threatIn(next, 'threat-flood-checkout').elements).toEqual([
      'element-checkout',
      'element-ledger',
    ]);
  });

  it('changes nothing when the element is already linked', () => {
    expect(modelOf(attachThreat(registerModel, spoofShopper, shopper))).toEqual(
      registerModel,
    );
  });

  it('fails on an unknown threat', () => {
    expect(
      errorOf(attachThreat(registerModel, threatId('threat-ghost'), shopper)),
    ).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(
        attachThreat(registerModel, spoofShopper, elementId('element-ghost')),
      ),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('detachThreat', () => {
  it('unlinks the element from the threat', () => {
    const next = modelOf(detachThreat(registerModel, spoofShopper, shopper));
    expect(threatIn(next, 'threat-spoof-shopper').elements).toEqual([]);
  });

  it('changes nothing when the element is not linked', () => {
    expect(modelOf(detachThreat(registerModel, spoofShopper, ledger))).toEqual(
      registerModel,
    );
  });

  it('fails on an unknown threat', () => {
    expect(
      errorOf(detachThreat(registerModel, threatId('threat-ghost'), shopper)),
    ).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(
        detachThreat(registerModel, spoofShopper, elementId('element-ghost')),
      ),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('nextThreatNumber', () => {
  it('is one above the number last issued, not one above the highest held', () => {
    expect(threatNumbers(registerModel)).toEqual([2, 5, 9, 4, 7]);
    expect(nextThreatNumber(registerModel)).toBe(13);
  });

  it('is 1 for a register that has issued nothing', () => {
    expect(nextThreatNumber(emptyRegisterModel)).toBe(1);
  });
});

describe('threat operations', () => {
  operationContract({
    addThreat: {
      input: registerModel,
      run: (model) => addThreat(model, replay),
    },
    removeThreat: {
      input: registerModel,
      run: (model) => removeThreat(model, spoofShopper),
    },
    replaceThreat: {
      input: registerModel,
      run: (model) => replaceThreat(model, editedFlood),
    },
    attachThreat: {
      input: registerModel,
      run: (model) => attachThreat(model, floodCheckout, ledger),
    },
    detachThreat: {
      input: registerModel,
      run: (model) => detachThreat(model, spoofShopper, shopper),
    },
  });
});
