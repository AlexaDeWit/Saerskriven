import { Either } from 'effect';
import {
  elementId,
  parsedFixture,
  securityModelFixture,
  validModel,
  validModelFixture,
} from '../fixtures.js';
import { setElementProperties } from './element-operations.js';
import { parseModel } from './parse.js';

const edits = parsedFixture(securityModelFixture).diagrams[0].elements.flatMap(
  (properties) =>
    properties.kind === 'text' ? [] : [{ id: properties.id, properties }],
);

describe('setElementProperties', () => {
  it.each(edits)(
    'edits $properties.kind facts without changing identity, geometry or register data',
    ({ id, properties }) => {
      const before = validModel.diagrams[0].elements.find(
        (element) => element.id === id,
      );
      const result = Either.getOrThrow(
        setElementProperties(validModel, elementId(id), properties),
      );
      const after = result.diagrams[0].elements.find(
        (element) => element.id === id,
      );
      expect(after).toMatchObject({ ...before, ...properties });
      expect(result.threats).toBe(validModel.threats);
      expect(result.lastIssuedThreatNumber).toBe(
        validModel.lastIssuedThreatNumber,
      );
      expect(Either.isRight(parseModel(result))).toBe(true);
      expect(
        Either.getOrThrow(
          setElementProperties(result, elementId(id), properties),
        ),
      ).toBe(result);
    },
  );

  it('keeps omitted fields, clears explicit undefined, and returns the original model for an unchanged patch', () => {
    const id = elementId('element-order-flow');
    const recorded = Either.getOrThrow(
      setElementProperties(validModel, id, {
        kind: 'flow',
        protocol: '',
        isEncrypted: false,
        trustBoundaryIds: [],
      }),
    );
    expect(
      Either.getOrThrow(setElementProperties(recorded, id, { kind: 'flow' })),
    ).toBe(recorded);
    expect(
      Either.getOrThrow(
        setElementProperties(recorded, id, {
          kind: 'flow',
          trustBoundaryIds: [],
        }),
      ),
    ).toBe(recorded);
    const cleared = Either.getOrThrow(
      setElementProperties(recorded, id, {
        kind: 'flow',
        isEncrypted: undefined,
      }),
    );
    const flow = cleared.diagrams[0].elements.find(
      (element) => element.id === id,
    );
    expect(flow).toMatchObject({ protocol: '', trustBoundaryIds: [] });
    expect(flow).not.toHaveProperty('isEncrypted');
    expect(
      Either.getOrThrow(
        setElementProperties(cleared, id, {
          kind: 'flow',
          isEncrypted: undefined,
        }),
      ),
    ).toBe(cleared);
  });

  it('rejects unknown elements, a mismatched kind and text the model cannot store', () => {
    expect(
      setElementProperties(validModel, elementId('missing'), { kind: 'actor' }),
    ).toMatchObject({ left: { _tag: 'UnknownElement' } });
    expect(
      setElementProperties(validModel, elementId('element-api'), {
        kind: 'actor',
        providesAuthentication: true,
      }),
    ).toMatchObject({ left: { _tag: 'InvalidElementProperties' } });
    expect(
      setElementProperties(validModel, elementId('element-api'), {
        kind: 'process',
        privilegeLevel: '\u202E',
      }),
    ).toMatchObject({
      left: {
        _tag: 'InvalidElementProperties',
        issues: [expect.objectContaining({ path: ['privilegeLevel'] })],
      },
    });
  });

  it('rejects missing, wrong-kind and self references without changing the supplied model', () => {
    for (const reference of ['missing', 'element-db', 'element-order-flow']) {
      expect(
        setElementProperties(validModel, elementId('element-order-flow'), {
          kind: 'flow',
          trustBoundaryIds: [elementId(reference)],
        }),
      ).toMatchObject({ left: { _tag: 'InvalidElementRelationship' } });
    }
    expect(
      setElementProperties(validModel, elementId('element-perimeter'), {
        kind: 'trust-boundary',
        containedElements: [elementId('element-perimeter')],
      }),
    ).toMatchObject({ left: { _tag: 'InvalidElementRelationship' } });
    expect(validModel).toStrictEqual(parsedFixture(validModelFixture));
  });

  it('preserves relationship order and repeated assertions without adding reciprocal links', () => {
    const result = Either.getOrThrow(
      setElementProperties(validModel, elementId('element-perimeter'), {
        kind: 'trust-boundary',
        crossingFlows: [
          elementId('element-order-flow'),
          elementId('element-order-flow'),
        ],
      }),
    );
    expect(
      result.diagrams[0].elements.find((element) => element.kind === 'flow'),
    ).not.toHaveProperty('trustBoundaryIds');
    expect(
      result.diagrams[0].elements.find(
        (element) => element.id === 'element-perimeter',
      ),
    ).toMatchObject({
      crossingFlows: ['element-order-flow', 'element-order-flow'],
    });
  });
});
