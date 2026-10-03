import type { GestureInput } from '@saerskriven/canvas';
import type { Element, Point } from '@saerskriven/model';
import {
  attached,
  boxAt,
  curveBoundary,
  elementId,
  elementIn,
  flowBetween,
  modelWith,
} from '@saerskriven/model/fixtures';
import { Action, type GestureEdit } from './actions.js';
import { modelAtGesturePrecision } from './gesture-precision.js';
import { reduce } from './reducer.js';
import { initialState } from './state.js';

const actor = elementId('actor');
const store = elementId('store');
const flow = elementId('flow');
const curve = elementId('curve');
const stored = { x: 123.63636363636364, y: 12.25 };
const bend = { x: 250.123456, y: 99.98765 };
const freeEnd = { x: 500.55555, y: 200.4444 };
const curvePoints = [
  { x: -20.3333, y: 80.6666 },
  { x: 200.1111, y: -20.2222 },
  { x: 440.9999, y: 80.5558 },
];

const model = modelWith({
  elements: [
    boxAt('actor', stored.x, stored.y, 'actor', {
      width: 120.123456,
      height: 60,
    }),
    boxAt('process', 300.0004, 0.04, 'process'),
    boxAt('store', 5.1, 5.04, 'store'),
    {
      ...flowBetween(attached('process'), { kind: 'free', position: freeEnd }, [
        bend,
      ]),
      id: 'flow',
    },
    curveBoundary('curve', curvePoints, 'Curve'),
  ],
});

const start = initialState(model);

const after = (input: GestureInput, edit: GestureEdit) =>
  reduce(start, Action.Gesture({ input, edit })).present;

const routeOf = (element: Element): readonly Point[] =>
  element.kind === 'flow' ? element.waypoints : [];

const pointsOf = (element: Element): readonly Point[] =>
  element.kind === 'trust-boundary' && element.shape.kind === 'curve'
    ? element.shape.waypoints
    : [];

describe('a gesture', () => {
  it.each([
    ['pointer', { x: 128.636, y: 12.25 }],
    ['keyboard', { x: 128.6, y: 12.3 }],
  ] as const)(
    'made with the %s stores both coordinates of the position a move leaves',
    (input, position) => {
      const moved = after(
        input,
        Action.MoveElement({ elementId: actor, offset: { x: 5, y: 0 } }),
      );

      expect(elementIn(moved, actor)).toMatchObject({ position });
    },
  );

  it('lands on the number its offset cannot reach from the stored one', () => {
    const moved = after(
      'keyboard',
      Action.MoveElement({ elementId: store, offset: { x: -5, y: -5 } }),
    );

    expect(elementIn(moved, store)).toMatchObject({
      position: { x: 0.1, y: 0 },
    });
  });

  it('leaves what it did not write as stored: the size of an element it moves, and every other element', () => {
    const moved = after(
      'keyboard',
      Action.MoveElement({ elementId: actor, offset: { x: 5, y: 0 } }),
    );

    expect(elementIn(moved, actor)).toMatchObject({
      size: { width: 120.123456, height: 60 },
    });
    for (const id of ['process', 'store', 'flow', 'curve']) {
      expect(elementIn(moved, id)).toBe(elementIn(model, id));
    }
  });

  it('rounds nothing where no number differs, however the model before it was rebuilt', () => {
    expect(
      modelAtGesturePrecision(model, structuredClone(model), 'keyboard'),
    ).toEqual(model);
  });

  it.each([
    [
      'pointer',
      { x: 255.123, y: 119.988 },
      { x: 505.556, y: 220.444 },
      [
        { x: -15.333, y: 100.667 },
        { x: 205.111, y: -0.222 },
        { x: 446, y: 100.556 },
      ],
    ],
    [
      'keyboard',
      { x: 255.1, y: 120 },
      { x: 505.6, y: 220.4 },
      [
        { x: -15.3, y: 100.7 },
        { x: 205.1, y: -0.2 },
        { x: 446, y: 100.6 },
      ],
    ],
  ] as const)(
    'made with the %s stores the bends, the free end and the curve points a group move carries',
    (input, carriedBend, carriedEnd, carriedCurve) => {
      const moved = after(
        input,
        Action.MoveElements({
          elementIds: [actor, flow, curve],
          offset: { x: 5, y: 20 },
        }),
      );

      expect(elementIn(moved, flow)).toMatchObject({
        target: { kind: 'free', position: carriedEnd },
        waypoints: [carriedBend],
      });
      expect(pointsOf(elementIn(moved, curve))).toEqual(carriedCurve);
    },
  );

  it.each([
    ['pointer', { width: 125.123, height: 0.04 }],
    ['keyboard', { width: 125.1, height: 0.1 }],
  ] as const)(
    'made with the %s stores the size a resize leaves, above zero, and not the position it kept',
    (input, size) => {
      const resized = after(
        input,
        Action.ResizeElement({
          elementId: actor,
          offset: { x: 0, y: 0 },
          size: { width: 125.123456, height: 0.04 },
        }),
      );

      expect(elementIn(resized, actor)).toMatchObject({
        position: stored,
        size,
      });
    },
  );

  it('stores the whole of an element it places', () => {
    const placed = elementIn(
      modelWith({
        elements: [
          boxAt('placed', 10.123456, -20.98765, 'process', {
            width: 100.5555,
            height: 50.4444,
          }),
        ],
      }),
      'placed',
    );

    const added = after(
      'keyboard',
      Action.AddElement({ diagramId: model.diagrams[0].id, element: placed }),
    );

    expect(elementIn(added, 'placed')).toMatchObject({
      position: { x: 10.1, y: -21 },
      size: { width: 100.6, height: 50.4 },
    });
  });

  it('stores the route a bend joins, and leaves the free end beside it as stored', () => {
    const bent = after(
      'keyboard',
      Action.SetFlowWaypoints({
        elementId: flow,
        waypoints: [bend, { x: 300.55555, y: 150.44444 }],
      }),
    );

    expect(routeOf(elementIn(bent, flow))).toEqual([
      { x: 250.1, y: 100 },
      { x: 300.6, y: 150.4 },
    ]);
    expect(elementIn(bent, flow)).toMatchObject({
      target: { position: freeEnd },
    });
  });

  it('stores the free end it moves, and leaves the route beside it as stored', () => {
    const moved = after(
      'pointer',
      Action.SetFlowEndPosition({
        elementId: flow,
        side: 'target',
        position: { x: 510.55555, y: 190.4444 },
      }),
    );

    expect(elementIn(moved, flow)).toMatchObject({
      target: { position: { x: 510.556, y: 190.444 } },
      waypoints: [bend],
    });
  });

  it('stores the curve whose point it moves', () => {
    const moved = after(
      'pointer',
      Action.SetBoundaryShape({
        elementId: curve,
        shape: {
          kind: 'curve',
          waypoints: [
            curvePoints[0],
            { x: 210.1111, y: -30.2222 },
            curvePoints[2],
          ],
        },
      }),
    );

    expect(pointsOf(elementIn(moved, curve))).toEqual([
      { x: -20.333, y: 80.667 },
      { x: 210.111, y: -30.222 },
      { x: 441, y: 80.556 },
    ]);
  });

  it('is one undo step, and undo restores the model from before it', () => {
    const moved = reduce(
      start,
      Action.Gesture({
        input: 'keyboard',
        edit: Action.MoveElement({ elementId: actor, offset: { x: 5, y: 0 } }),
      }),
    );

    expect(moved.past).toEqual([model]);
    expect(reduce(moved, Action.Undo()).present).toBe(model);
  });
});

describe('an edit no gesture made', () => {
  it('stores the numbers it is given', () => {
    const typed = reduce(
      start,
      Action.ResizeElement({
        elementId: actor,
        offset: { x: 0.123456, y: 0 },
        size: { width: 10.123456, height: 60 },
      }),
    ).present;

    expect(elementIn(typed, actor)).toMatchObject({
      position: { x: stored.x + 0.123456, y: stored.y },
      size: { width: 10.123456, height: 60 },
    });
  });
});
