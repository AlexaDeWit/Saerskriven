import {
  mitigationIdSchema,
  threatStatusSchema,
  type ThreatStatus,
} from '@saerskriven/model';
import * as fc from 'fast-check';
import {
  inferredMitigationStatus,
  mitigationsFromText,
  type ThreatWithText,
} from './mitigation-text.js';

const open = (id: string, text = 'Text.', number = 1): ThreatWithText => ({
  id,
  number,
  status: 'open',
  text,
});

const idsOf = (threats: readonly ThreatWithText[], taken: string[] = []) =>
  mitigationsFromText(threats, taken).map(({ id }) => id);

describe('the status a mitigation text reads as', () => {
  it.each(threatStatusSchema.options)('on a %s threat', (status) => {
    expect(inferredMitigationStatus(status)).toBe(
      status === 'mitigated' ? 'implemented' : 'proposed',
    );
  });
});

describe('the records a threat text makes', () => {
  it('makes none of an empty text', () => {
    expect(mitigationsFromText([open('threat-1', '')], [])).toEqual([]);
  });

  it('names a record after its threat where nothing holds that name', () => {
    expect(idsOf([open('threat-1'), open('threat-2')])).toEqual([
      'threat-1-mitigation',
      'threat-2-mitigation',
    ]);
  });

  it('makes its records in threat number order, whatever order the threats come in', () => {
    expect(
      idsOf([open('threat-9', 'Text.', 9), open('threat-2', 'Text.', 2)]),
    ).toEqual(['threat-2-mitigation', 'threat-9-mitigation']);
  });

  it('counts past a name the model already holds, and past each one it chose', () => {
    expect(
      idsOf(
        [open('threat-1'), open('threat-1')],
        ['threat-1-mitigation', 'threat-1-mitigation-3'],
      ),
    ).toEqual(['threat-1-mitigation-2', 'threat-1-mitigation-4']);
  });

  it('keeps a threat whose own id carries the suffix apart from the threat it extends', () => {
    expect(idsOf([open('threat-1-mitigation'), open('threat-1')])).toEqual([
      'threat-1-mitigation-mitigation',
      'threat-1-mitigation',
    ]);
  });

  it('chooses ids that repeat no held id and no other chosen id, the same on every call', () => {
    const statuses = fc.constantFrom<ThreatStatus>(
      ...threatStatusSchema.options,
    );
    const threatId = fc.oneof(
      fc.constantFrom('ab', 'ab-mitigation', 'ab-mitigation-2'),
      fc.string({ minLength: 2 }),
    );
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: threatId,
            number: fc.nat(),
            status: statuses,
            text: fc.string({ minLength: 1 }),
          }),
        ),
        fc.array(
          fc.oneof(
            threatId,
            threatId.map((held) => `${held}-mitigation`),
            threatId.map((held) => `${held}-mitigation-2`),
          ),
        ),
        (threats, taken) => {
          const ids = idsOf(threats, taken);
          expect(new Set(ids).size).toBe(threats.length);
          expect(ids.filter((id) => taken.includes(id))).toEqual([]);
          expect(
            ids.filter((id) => !mitigationIdSchema.safeParse(id).success),
          ).toEqual([]);
          expect(idsOf(threats, taken)).toEqual(ids);
        },
      ),
    );
  });
});
