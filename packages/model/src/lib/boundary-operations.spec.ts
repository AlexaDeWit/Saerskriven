import {
  elementId,
  elementIn,
  parsedFixture,
  securityModelFixture,
  validModel,
} from '../fixtures.js';
import { setBoundaryShape } from './boundary-operations.js';
import type { BoundaryShape } from './elements.js';
import type { ElementId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import { errorOf, modelOf, operationContract } from './operations.fixtures.js';

const perimeter = elementId('element-perimeter');
const billingZone = elementId('element-billing-zone');

const curve: BoundaryShape = {
  kind: 'curve',
  waypoints: [
    { x: 260, y: 40 },
    { x: 540, y: 20 },
    { x: 820, y: 60 },
  ],
};

const box: BoundaryShape = {
  kind: 'box',
  position: { x: 20, y: 300 },
  size: { width: 780, height: 120 },
};

describe('setBoundaryShape', () => {
  it('turns a box boundary into a curve and back, keeping its declared relationships', () => {
    const secured = parsedFixture(securityModelFixture);
    const before = elementIn(secured, perimeter);
    const curved = modelOf(setBoundaryShape(secured, perimeter, curve));
    expect(elementIn(curved, perimeter)).toEqual({ ...before, shape: curve });
    expect(curved.threats).toBe(secured.threats);
    const boxed = modelOf(setBoundaryShape(curved, perimeter, box));
    expect(elementIn(boxed, perimeter)).toEqual({ ...before, shape: box });
  });

  it.each<[string, ElementId, BoundaryShape]>([
    ['a curve through new points', billingZone, curve],
    ['a box to a new place and size', perimeter, box],
    [
      'a box to a new place alone',
      perimeter,
      {
        kind: 'box',
        position: { x: 300, y: 80 },
        size: { width: 520, height: 220 },
      },
    ],
    [
      'a box to a new size alone',
      perimeter,
      {
        kind: 'box',
        position: { x: 280, y: 60 },
        size: { width: 520, height: 240 },
      },
    ],
  ])('reshapes %s', (_, id, shape) => {
    expect(
      elementIn(modelOf(setBoundaryShape(validModel, id, shape)), id),
    ).toMatchObject({ shape });
  });

  it.each([perimeter, billingZone])(
    'returns the same model for the shape %s already has',
    (id) => {
      const held = elementIn(validModel, id);
      if (held.kind !== 'trust-boundary') {
        throw new Error(`The fixture element ${id} is a trust boundary`);
      }
      expect(
        modelOf(setBoundaryShape(validModel, id, structuredClone(held.shape))),
      ).toBe(validModel);
    },
  );

  it.each<[string, BoundaryShape, readonly string[]]>([
    [
      'a curve through one point',
      { kind: 'curve', waypoints: [{ x: 0, y: 0 }] },
      ['shape', 'waypoints'],
    ],
    [
      'a box with no width',
      { kind: 'box', position: { x: 0, y: 0 }, size: { width: 0, height: 40 } },
      ['shape', 'size', 'width'],
    ],
  ])('refuses %s, naming the path under shape', (_, shape, path) => {
    expect(errorOf(setBoundaryShape(validModel, perimeter, shape))).toEqual(
      OperationFailure.InvalidElementProperties({
        elementId: perimeter,
        issues: [expect.objectContaining({ path })],
      }),
    );
  });

  it.each(['element-api', 'element-order-flow'])(
    'refuses %s, which is not a trust boundary',
    (id) => {
      expect(errorOf(setBoundaryShape(validModel, elementId(id), box))).toEqual(
        OperationFailure.NotTrustBoundaryElement({ elementId: elementId(id) }),
      );
    },
  );

  it('refuses an element the model does not hold', () => {
    expect(
      errorOf(setBoundaryShape(validModel, elementId('element-ghost'), box)),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });

  operationContract({
    'setBoundaryShape to a curve': {
      input: validModel,
      run: (model) => setBoundaryShape(model, perimeter, curve),
    },
    'setBoundaryShape to a box': {
      input: validModel,
      run: (model) => setBoundaryShape(model, billingZone, box),
    },
  });
});
