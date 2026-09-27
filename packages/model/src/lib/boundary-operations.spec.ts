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

const curve = {
  kind: 'curve',
  waypoints: [
    { x: 260, y: 40 },
    { x: 540, y: 20 },
    { x: 820, y: 60 },
  ],
} satisfies BoundaryShape;

const box = {
  kind: 'box',
  position: { x: 20, y: 300 },
  size: { width: 780, height: 120 },
} satisfies BoundaryShape;

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
      'a box to a new height alone',
      perimeter,
      {
        kind: 'box',
        position: { x: 280, y: 60 },
        size: { width: 520, height: 240 },
      },
    ],
    [
      'a box to a new width alone',
      perimeter,
      {
        kind: 'box',
        position: { x: 280, y: 60 },
        size: { width: 600, height: 220 },
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

  it('holds its own copy of the shape it was given', () => {
    const givenBox = structuredClone(box);
    const givenCurve = structuredClone(curve);
    const boxed = modelOf(setBoundaryShape(validModel, billingZone, givenBox));
    const curved = modelOf(setBoundaryShape(validModel, perimeter, givenCurve));
    givenBox.position.x = 999;
    givenBox.size.width = 999;
    givenCurve.waypoints[0].x = 999;
    expect(elementIn(boxed, billingZone)).toMatchObject({ shape: box });
    expect(elementIn(curved, perimeter)).toMatchObject({ shape: curve });
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
