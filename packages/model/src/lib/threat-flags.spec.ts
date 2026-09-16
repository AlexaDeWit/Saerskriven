import * as fc from 'fast-check';
import { modelInputArbitrary, parsedFixture } from '../fixtures.js';
import { threatRegisterFixture } from './fixtures.js';
import type { MitigationStatus } from './mitigations.js';
import type { AssumptionStatus } from './assumptions.js';
import type { Model } from './parse.js';
import {
  flagsByElement,
  threatFlags,
  threatFlagSchema,
  type ThreatFlag,
} from './threat-flags.js';
import type { ThreatStatus } from './threats.js';

const generatedModel = modelInputArbitrary.map(parsedFixture);

const threatsLinkedBy = (
  records: readonly { readonly threats: readonly string[] }[],
): ReadonlySet<string> => new Set(records.flatMap(({ threats }) => threats));

const flagsOf = (
  status: ThreatStatus,
  mitigations: readonly MitigationStatus[],
  assumptions: readonly AssumptionStatus[],
): ThreatFlag[] => {
  const [threat] = threatRegisterFixture.threats;
  const model = parsedFixture({
    ...threatRegisterFixture,
    threats: [{ ...threat, status }],
    mitigations: mitigations.map((mitigationStatus, index) => ({
      id: `mitigation-${String(index)}`,
      title: '',
      prose: '',
      status: mitigationStatus,
      threats: [threat.id],
    })),
    assumptions: assumptions.map((assumptionStatus, index) => ({
      id: `assumption-${String(index)}`,
      prose: '',
      status: assumptionStatus,
      threats: [threat.id],
      appliesToModel: false,
    })),
  });
  return threatFlags(model, model.threats[0]);
};

describe('threatFlags on each boundary', () => {
  const cases: readonly [
    string,
    ThreatStatus,
    readonly MitigationStatus[],
    readonly AssumptionStatus[],
    readonly ThreatFlag[],
  ][] = [
    [
      'mitigated with no mitigation',
      'mitigated',
      [],
      [],
      ['mitigated-without-implemented-work'],
    ],
    [
      'mitigated with only proposed work',
      'mitigated',
      ['proposed', 'proposed'],
      [],
      ['mitigated-without-implemented-work'],
    ],
    [
      'mitigated with implemented work',
      'mitigated',
      ['proposed', 'implemented'],
      [],
      [],
    ],
    ['mitigated with verified work', 'mitigated', ['verified'], [], []],
    ['open with only proposed work', 'open', ['proposed'], [], []],
    [
      'resting on an invalidated assumption',
      'open',
      [],
      ['valid', 'invalidated'],
      ['rests-on-invalidated-assumption'],
    ],
    ['resting only on valid assumptions', 'open', [], ['valid', 'valid'], []],
    [
      'resting only on unconfirmed assumptions',
      'open',
      [],
      ['unconfirmed', 'unconfirmed'],
      [],
    ],
    [
      'mitigated with no work and an invalidated assumption',
      'mitigated',
      ['proposed'],
      ['invalidated'],
      ['mitigated-without-implemented-work', 'rests-on-invalidated-assumption'],
    ],
  ];

  for (const [name, status, mitigations, assumptions, flags] of cases) {
    it(`flags a threat ${name} with ${flags.length === 0 ? 'nothing' : flags.join(' and ')}`, () => {
      expect(flagsOf(status, mitigations, assumptions)).toEqual(flags);
    });
  }
});

const flaggedByModelWideAssumption = (threats: readonly string[]): string[] => {
  const model = parsedFixture({
    ...threatRegisterFixture,
    assumptions: [
      {
        id: 'assumption-model-wide',
        prose: '',
        status: 'invalidated',
        threats: [...threats],
        appliesToModel: true,
      },
    ],
  });
  return model.threats
    .filter((threat) =>
      threatFlags(model, threat).includes('rests-on-invalidated-assumption'),
    )
    .map(({ id }) => id);
};

describe('threatFlags and an assumption that applies to the model', () => {
  const [linked] = threatRegisterFixture.threats;

  it('flags no threat when the invalidated assumption links none', () => {
    expect(flaggedByModelWideAssumption([])).toEqual([]);
  });

  it('flags only the threat the invalidated assumption also links', () => {
    expect(flaggedByModelWideAssumption([linked.id])).toEqual([linked.id]);
  });
});

describe('threatFlags over generated models', () => {
  it('flags a mitigated threat exactly when no linked mitigation is implemented or verified', () => {
    fc.assert(
      fc.property(generatedModel, (model) => {
        const backed = threatsLinkedBy(
          model.mitigations.filter(
            ({ status }) => status === 'implemented' || status === 'verified',
          ),
        );
        for (const threat of model.threats) {
          expect(
            threatFlags(model, threat).includes(
              'mitigated-without-implemented-work',
            ),
          ).toBe(threat.status === 'mitigated' && !backed.has(threat.id));
        }
      }),
    );
  });

  it('flags a threat exactly when a linked assumption is invalidated', () => {
    fc.assert(
      fc.property(generatedModel, (model) => {
        const invalidated = threatsLinkedBy(
          model.assumptions.filter(({ status }) => status === 'invalidated'),
        );
        for (const threat of model.threats) {
          expect(
            threatFlags(model, threat).includes(
              'rests-on-invalidated-assumption',
            ),
          ).toBe(invalidated.has(threat.id));
        }
      }),
    );
  });

  it('changes no threat status, nor anything else of the model', () => {
    fc.assert(
      fc.property(generatedModel, (model: Model) => {
        const before = structuredClone(model);
        for (const threat of model.threats) {
          threatFlags(model, threat);
        }
        expect(model).toEqual(before);
      }),
    );
  });
});

describe('flagsByElement', () => {
  it('holds, per element, each flag a threat naming it raises, once and in schema order', () => {
    fc.assert(
      fc.property(generatedModel, (model) => {
        const expected = new Map(
          [...new Set(model.threats.flatMap(({ elements }) => elements))]
            .map((element) => {
              const raised = new Set(
                model.threats
                  .filter(({ elements }) => elements.includes(element))
                  .flatMap((threat) => threatFlags(model, threat)),
              );
              return [
                element,
                threatFlagSchema.options.filter((flag) => raised.has(flag)),
              ] as const;
            })
            .filter(([, flags]) => flags.length > 0),
        );
        expect(flagsByElement(model)).toEqual(expected);
      }),
    );
  });
});
