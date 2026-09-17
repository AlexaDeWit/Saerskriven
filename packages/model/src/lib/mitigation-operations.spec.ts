import {
  mitigationId,
  parsedFixture,
  registerModel,
  threatId,
} from '../fixtures.js';
import { threatRegisterFixture } from './model.fixtures.js';
import {
  addMitigation,
  linkMitigation,
  removeMitigation,
  replaceMitigation,
  setMitigationStatus,
  unlinkMitigation,
} from './mitigation-operations.js';
import { mitigationSchema, type Mitigation } from './mitigations.js';
import { OperationFailure } from './operation-failures.js';
import { errorOf, modelOf, operationContract } from './operations.fixtures.js';
import type { Model } from './parse.js';

const bindSession = mitigationId('mitigation-bind-session');
const spoofShopper = threatId('threat-spoof-shopper');
const tamperPayment = threatId('threat-tamper-payment');
const floodCheckout = threatId('threat-flood-checkout');
const ghostThreat = threatId('threat-ghost');
const ghostMitigation = mitigationId('mitigation-ghost');

const unlinkedFromFile = parsedFixture({
  ...threatRegisterFixture,
  mitigations: [
    {
      id: 'mitigation-bind-session',
      title: 'Bind sessions to a device',
      prose: 'Reject a session cookie replayed from another device.',
      status: 'proposed',
      threats: [],
    },
  ],
});

const mitigationIds = (model: Model): string[] =>
  model.mitigations.map((mitigation) => mitigation.id);

const rateLimitInput = {
  id: 'mitigation-rate-limit',
  title: 'Rate limit the checkout',
  prose: 'Throttle basket submissions per session.',
  status: 'proposed',
  threats: ['threat-flood-checkout'],
};

const rateLimit = mitigationSchema.parse(rateLimitInput);

const editedBinding: Mitigation = mitigationSchema.parse({
  id: 'mitigation-bind-session',
  title: 'Bind sessions to a device fingerprint',
  prose: 'Reject a session cookie replayed from another device.',
  status: 'implemented',
  threats: ['threat-spoof-shopper'],
});

describe('addMitigation', () => {
  it('appends the mitigation to the register', () => {
    const next = modelOf(addMitigation(registerModel, rateLimit));
    expect(mitigationIds(next)).toEqual([
      ...mitigationIds(registerModel),
      rateLimit.id,
    ]);
  });

  it('refuses a mitigation linked to no threat and leaves the model alone', () => {
    const pristine = structuredClone(registerModel);
    const unlinked = mitigationSchema.parse({ ...rateLimitInput, threats: [] });
    expect(errorOf(addMitigation(registerModel, unlinked))).toEqual(
      OperationFailure.RecordWithoutThreat({
        record: { kind: 'mitigation', id: unlinked.id },
      }),
    );
    expect(registerModel).toEqual(pristine);
  });

  it('fails on an id the register already holds', () => {
    const clash = mitigationSchema.parse({
      ...rateLimitInput,
      id: 'mitigation-bind-session',
    });
    expect(errorOf(addMitigation(registerModel, clash))).toEqual(
      OperationFailure.DuplicateMitigationId({ mitigationId: bindSession }),
    );
  });

  it('fails on a link to an unknown threat', () => {
    const dangling = mitigationSchema.parse({
      ...rateLimitInput,
      threats: ['threat-ghost'],
    });
    expect(errorOf(addMitigation(registerModel, dangling))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('replaceMitigation', () => {
  it('swaps the whole record in, keeping its place in the register', () => {
    const next = modelOf(replaceMitigation(registerModel, editedBinding));
    expect(next.mitigations[0]).toEqual(editedBinding);
    expect(mitigationIds(next)).toEqual(mitigationIds(registerModel));
  });

  it('returns the model it was given for the record it already holds', () => {
    expect(
      modelOf(replaceMitigation(registerModel, registerModel.mitigations[0])),
    ).toBe(registerModel);
  });

  it('fails on an id the register does not hold', () => {
    expect(errorOf(replaceMitigation(registerModel, rateLimit))).toEqual(
      OperationFailure.UnknownMitigation({
        mitigationId: mitigationId('mitigation-rate-limit'),
      }),
    );
  });

  it('fails on a link to an unknown threat', () => {
    const dangling = mitigationSchema.parse({
      ...editedBinding,
      threats: ['threat-ghost'],
    });
    expect(errorOf(replaceMitigation(registerModel, dangling))).toEqual(
      OperationFailure.UnknownThreat({ threatId: threatId('threat-ghost') }),
    );
  });
});

describe('replaceMitigation and the last threat link', () => {
  it('culls a mitigation the replacement takes to no threat link', () => {
    const unlinked = mitigationSchema.parse({ ...editedBinding, threats: [] });
    expect(
      mitigationIds(modelOf(replaceMitigation(registerModel, unlinked))),
    ).toEqual([]);
  });

  it('keeps a mitigation that had no threat link before the replacement', () => {
    const retitled = mitigationSchema.parse({
      ...unlinkedFromFile.mitigations[0],
      title: 'Retitled',
    });
    expect(
      modelOf(replaceMitigation(unlinkedFromFile, retitled)).mitigations,
    ).toEqual([retitled]);
  });
});

describe('removeMitigation', () => {
  it('drops the mitigation from the register', () => {
    expect(
      mitigationIds(modelOf(removeMitigation(registerModel, bindSession))),
    ).toEqual([]);
  });

  it('leaves the threats it addressed untouched', () => {
    const next = modelOf(removeMitigation(registerModel, bindSession));
    expect(next.threats).toEqual(registerModel.threats);
    expect(next.lastIssuedThreatNumber).toBe(
      registerModel.lastIssuedThreatNumber,
    );
  });

  it('fails on a mitigation the register does not hold', () => {
    const ghost = mitigationId('mitigation-ghost');
    expect(errorOf(removeMitigation(registerModel, ghost))).toEqual(
      OperationFailure.UnknownMitigation({ mitigationId: ghost }),
    );
  });
});

describe('linkMitigation', () => {
  it('adds the threat to the mitigation links', () => {
    const next = modelOf(
      linkMitigation(registerModel, bindSession, floodCheckout),
    );
    expect(next.mitigations[0].threats).toEqual([
      spoofShopper,
      tamperPayment,
      floodCheckout,
    ]);
  });

  it('returns the model it was given for a threat already linked', () => {
    expect(
      modelOf(linkMitigation(registerModel, bindSession, spoofShopper)),
    ).toBe(registerModel);
  });

  it('refuses an unknown threat or an unknown mitigation', () => {
    expect(
      errorOf(linkMitigation(registerModel, bindSession, ghostThreat)),
    ).toEqual(OperationFailure.UnknownThreat({ threatId: ghostThreat }));
    expect(
      errorOf(linkMitigation(registerModel, ghostMitigation, spoofShopper)),
    ).toEqual(
      OperationFailure.UnknownMitigation({ mitigationId: ghostMitigation }),
    );
  });
});

describe('unlinkMitigation', () => {
  it('keeps a mitigation that still links another threat', () => {
    const next = modelOf(
      unlinkMitigation(registerModel, bindSession, spoofShopper),
    );
    expect(next.mitigations[0].threats).toEqual([tamperPayment]);
  });

  it('culls the mitigation from the model when the threat was its last link', () => {
    const once = modelOf(
      unlinkMitigation(registerModel, bindSession, spoofShopper),
    );
    expect(
      mitigationIds(
        modelOf(unlinkMitigation(once, bindSession, tamperPayment)),
      ),
    ).toEqual([]);
  });

  it('returns the model it was given for a threat not linked', () => {
    expect(
      modelOf(unlinkMitigation(registerModel, bindSession, floodCheckout)),
    ).toBe(registerModel);
  });

  it('refuses an unknown threat or an unknown mitigation', () => {
    expect(
      errorOf(unlinkMitigation(registerModel, bindSession, ghostThreat)),
    ).toEqual(OperationFailure.UnknownThreat({ threatId: ghostThreat }));
    expect(
      errorOf(unlinkMitigation(registerModel, ghostMitigation, spoofShopper)),
    ).toEqual(
      OperationFailure.UnknownMitigation({ mitigationId: ghostMitigation }),
    );
  });
});

describe('setMitigationStatus', () => {
  it('changes only the status of that mitigation', () => {
    const next = modelOf(
      setMitigationStatus(registerModel, bindSession, 'verified'),
    );
    expect(next).toEqual({
      ...registerModel,
      mitigations: [{ ...registerModel.mitigations[0], status: 'verified' }],
    });
  });

  it('keeps a mitigation that has no threat link', () => {
    const next = modelOf(
      setMitigationStatus(unlinkedFromFile, bindSession, 'implemented'),
    );
    expect(next.mitigations).toEqual([
      { ...unlinkedFromFile.mitigations[0], status: 'implemented' },
    ]);
  });

  it('refuses an unknown mitigation', () => {
    expect(
      errorOf(setMitigationStatus(registerModel, ghostMitigation, 'verified')),
    ).toEqual(
      OperationFailure.UnknownMitigation({ mitigationId: ghostMitigation }),
    );
  });
});

describe('mitigation operations', () => {
  operationContract({
    addMitigation: {
      input: registerModel,
      run: (model) => addMitigation(model, rateLimit),
    },
    replaceMitigation: {
      input: registerModel,
      run: (model) => replaceMitigation(model, editedBinding),
    },
    removeMitigation: {
      input: registerModel,
      run: (model) => removeMitigation(model, bindSession),
    },
    linkMitigation: {
      input: registerModel,
      run: (model) => linkMitigation(model, bindSession, floodCheckout),
    },
    unlinkMitigation: {
      input: registerModel,
      run: (model) => unlinkMitigation(model, bindSession, spoofShopper),
    },
    setMitigationStatus: {
      input: registerModel,
      run: (model) => setMitigationStatus(model, bindSession, 'verified'),
    },
  });
});
