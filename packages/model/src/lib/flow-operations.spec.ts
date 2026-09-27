import { Either } from 'effect';
import {
  attached,
  boxAt,
  elementId,
  flowBetween,
  flowIn,
  modelWith,
  validModel,
} from '../fixtures.js';
import { addElement } from './element-operations.js';
import { elementSchema } from './elements.js';
import {
  reconnectFlow,
  reverseFlow,
  setFlowDirection,
  setFlowEndPosition,
  setFlowWaypoints,
} from './flow-operations.js';
import { OperationFailure } from './operation-failures.js';
import {
  errorOf,
  flowInput,
  mainDiagram,
  modelOf,
  note,
  operationContract,
  withNote,
  writeFlow,
} from './operations.fixtures.js';

const orderFlow = elementId('element-order-flow');
const customer = elementId('element-customer');

describe('setFlowWaypoints', () => {
  const before = modelOf(addElement(validModel, mainDiagram, writeFlow));
  it('preserves the flow metadata and model while changing ordered route points', () => {
    const snapshot = structuredClone(before);
    const waypoints = [
      { x: -10.5, y: 30 },
      { x: 400, y: 100 },
    ];
    const next = modelOf(setFlowWaypoints(before, writeFlow.id, waypoints));
    expect(flowIn(next, writeFlow.id)).toEqual({ ...writeFlow, waypoints });
    expect(before).toEqual(snapshot);
    expect(next.threats).toBe(before.threats);
    waypoints[0].x = 999;
    expect(flowIn(next, writeFlow.id).waypoints[0].x).toBe(-10.5);
    expect(
      modelOf(
        setFlowWaypoints(
          next,
          writeFlow.id,
          flowIn(next, writeFlow.id).waypoints,
        ),
      ),
    ).toBe(next);
    expect(
      flowIn(modelOf(setFlowWaypoints(next, writeFlow.id, [])), writeFlow.id)
        .waypoints,
    ).toEqual([]);
  });
  it('refuses missing elements and other element kinds', () => {
    expect(errorOf(setFlowWaypoints(before, elementId('missing'), []))).toEqual(
      OperationFailure.UnknownElement({ elementId: elementId('missing') }),
    );
    expect(errorOf(setFlowWaypoints(withNote, note.id, []))).toEqual(
      OperationFailure.NotFlowElement({ elementId: note.id }),
    );
  });
});

describe('reconnectFlow', () => {
  it('changes one endpoint and retains identity, metadata, bends, and threat links', () => {
    const id = elementId('element-order-flow');
    const before = flowIn(validModel, id);
    const after = modelOf(
      reconnectFlow(validModel, id, 'target', elementId('element-db')),
    );
    expect(flowIn(after, id)).toEqual({
      ...before,
      target: { kind: 'attached', element: elementId('element-db') },
    });
    expect(after.threats).toBe(validModel.threats);
    expect(reconnectFlow(after, id, 'target', elementId('element-db'))).toEqual(
      Either.right(after),
    );
  });

  it.each([
    ['element-order-flow', 'target', 'element-customer', 'InvalidFlowEndpoint'],
    ['element-order-flow', 'target', 'missing', 'InvalidFlowEndpoint'],
    ['element-api', 'source', 'element-db', 'NotFlowElement'],
    ['missing', 'source', 'element-db', 'UnknownElement'],
  ] as const)(
    'refuses to reconnect %s at its %s to %s with %s',
    (id, side, reference, tag) => {
      expect(
        errorOf(
          reconnectFlow(validModel, elementId(id), side, elementId(reference)),
        )?._tag,
      ).toBe(tag);
    },
  );

  it('takes a target exactly where addElement takes a new flow ending there', () => {
    const drawn = modelOf(addElement(withNote, mainDiagram, writeFlow));
    const ends = [
      ...drawn.diagrams[0].elements.map(({ id }) => id),
      elementId('missing'),
    ];
    const reconnects = (end: string) =>
      Either.isRight(
        reconnectFlow(drawn, writeFlow.id, 'target', elementId(end)),
      );
    const adds = (end: string) =>
      Either.isRight(
        addElement(
          drawn,
          mainDiagram,
          elementSchema.parse({
            ...flowInput,
            id: 'element-probe-flow',
            target: { kind: 'attached', element: end },
          }),
        ),
      );
    expect(ends.filter(reconnects)).toEqual(['element-customer', 'element-db']);
    expect(ends.filter(adds)).toEqual(ends.filter(reconnects));
  });

  it('pins an end to a side of the element it already names, and releases it', () => {
    const id = elementId('element-order-flow');
    const before = flowIn(validModel, id);
    const element =
      before.source.kind === 'attached' ? before.source.element : undefined;
    if (element === undefined) {
      throw new Error('The fixture flow starts attached');
    }
    const pinned = modelOf(
      reconnectFlow(validModel, id, 'source', element, 'bottom'),
    );
    expect(flowIn(pinned, id)).toEqual({
      ...before,
      source: { kind: 'attached', element, side: 'bottom' },
    });
    expect(
      modelOf(reconnectFlow(pinned, id, 'source', element, 'bottom')),
    ).toBe(pinned);
    const released = modelOf(reconnectFlow(pinned, id, 'source', element));
    expect(flowIn(released, id).source).toEqual({ kind: 'attached', element });
    expect(
      modelOf(
        reconnectFlow(pinned, id, 'source', elementId('element-db')),
      ).diagrams[0].elements.find((candidate) => candidate.id === id),
    ).toMatchObject({
      source: { kind: 'attached', element: elementId('element-db') },
    });
  });
});

describe('setFlowDirection', () => {
  it('makes a flow bidirectional and one-way again, keeping the model where nothing changes', () => {
    const id = elementId('element-order-flow');
    const before = flowIn(validModel, id);
    expect(before.bidirectional).toBe(false);
    expect(modelOf(setFlowDirection(validModel, id, false))).toBe(validModel);
    const both = modelOf(setFlowDirection(validModel, id, true));
    expect(flowIn(both, id)).toEqual({ ...before, bidirectional: true });
    expect(flowIn(modelOf(setFlowDirection(both, id, false)), id)).toEqual(
      before,
    );
  });

  it('refuses missing elements and other element kinds', () => {
    expect(
      errorOf(setFlowDirection(validModel, elementId('element-api'), true))
        ?._tag,
    ).toBe('NotFlowElement');
    expect(
      errorOf(setFlowDirection(validModel, elementId('missing'), true))?._tag,
    ).toBe('UnknownElement');
  });
});

describe('setFlowEndPosition', () => {
  it('frees an attached end at the position though the other end is free, keeping the bends and the threat links', () => {
    const before = flowIn(validModel, orderFlow);
    const position = { x: 10, y: 20 };
    const next = modelOf(
      setFlowEndPosition(validModel, orderFlow, 'source', position),
    );
    expect(flowIn(next, orderFlow)).toEqual({
      ...before,
      source: { kind: 'free', position: { x: 10, y: 20 } },
    });
    expect(next.threats).toBe(validModel.threats);
    position.x = 999;
    expect(flowIn(next, orderFlow).source).toEqual({
      kind: 'free',
      position: { x: 10, y: 20 },
    });
  });

  it('frees a pinned end, leaving no side behind', () => {
    const pinned = modelOf(
      reconnectFlow(validModel, orderFlow, 'source', customer, 'bottom'),
    );
    expect(
      flowIn(
        modelOf(
          setFlowEndPosition(pinned, orderFlow, 'source', { x: 0, y: 0 }),
        ),
        orderFlow,
      ).source,
    ).toEqual({ kind: 'free', position: { x: 0, y: 0 } });
  });

  it('moves an end already free, and keeps the model where the end already is', () => {
    const before = flowIn(validModel, orderFlow);
    expect(before.target).toEqual({
      kind: 'free',
      position: { x: 280, y: 160 },
    });
    expect(
      modelOf(
        setFlowEndPosition(validModel, orderFlow, 'target', {
          x: 280,
          y: 160,
        }),
      ),
    ).toBe(validModel);
    expect(
      flowIn(
        modelOf(
          setFlowEndPosition(validModel, orderFlow, 'target', {
            x: 300,
            y: 180,
          }),
        ),
        orderFlow,
      ),
    ).toEqual({
      ...before,
      target: { kind: 'free', position: { x: 300, y: 180 } },
    });
  });

  it('refuses missing elements and other element kinds', () => {
    expect(
      errorOf(
        setFlowEndPosition(validModel, elementId('element-api'), 'source', {
          x: 0,
          y: 0,
        }),
      ),
    ).toEqual(
      OperationFailure.NotFlowElement({ elementId: elementId('element-api') }),
    );
    expect(
      errorOf(
        setFlowEndPosition(validModel, elementId('missing'), 'target', {
          x: 0,
          y: 0,
        }),
      )?._tag,
    ).toBe('UnknownElement');
  });
});

describe('reverseFlow', () => {
  const bends = [
    { x: 200, y: 140 },
    { x: 240, y: 200 },
    { x: 260, y: 150 },
  ];
  const pinnedWithBends = modelOf(
    setFlowWaypoints(
      modelOf(
        reconnectFlow(validModel, orderFlow, 'source', customer, 'bottom'),
      ),
      orderFlow,
      bends,
    ),
  );

  it('swaps the ends with their pinned side and position and reverses the bends, keeping the threat links', () => {
    const before = flowIn(pinnedWithBends, orderFlow);
    const reversed = modelOf(reverseFlow(pinnedWithBends, orderFlow));
    expect(flowIn(reversed, orderFlow)).toEqual({
      ...before,
      source: { kind: 'free', position: { x: 280, y: 160 } },
      target: { kind: 'attached', element: customer, side: 'bottom' },
      waypoints: [
        { x: 260, y: 150 },
        { x: 240, y: 200 },
        { x: 200, y: 140 },
      ],
    });
    expect(reversed.threats).toBe(pinnedWithBends.threats);
    const back = modelOf(reverseFlow(reversed, orderFlow));
    expect(back).not.toBe(reversed);
    expect(back).toEqual(pinnedWithBends);
  });

  it.each([
    ['whose one bend reads the same both ways', validModel, orderFlow],
    [
      'between two elements, with no bends',
      modelWith({
        elements: [
          boxAt('element-a', 0, 0),
          boxAt('element-b', 300, 0),
          flowBetween(attached('element-a'), attached('element-b'), []),
        ],
      }),
      elementId('el-flow'),
    ],
    [
      'looped on one element from two sides',
      modelWith({
        elements: [
          boxAt('element-a', 0, 0),
          flowBetween(
            { ...attached('element-a'), side: 'top' },
            { ...attached('element-a'), side: 'bottom' },
            [],
          ),
        ],
      }),
      elementId('el-flow'),
    ],
  ])('swaps the ends of a flow %s', (_, model, id) => {
    const before = flowIn(model, id);
    expect(flowIn(modelOf(reverseFlow(model, id)), id)).toEqual({
      ...before,
      source: before.target,
      target: before.source,
    });
  });

  it.each([
    [
      'attached to one element at both ends',
      attached('element-a'),
      [
        { x: 10, y: 10 },
        { x: 40, y: 60 },
        { x: 10, y: 10 },
      ],
    ],
    [
      'free at one point at both ends',
      { kind: 'free', position: { x: 5, y: 5 } },
      [],
    ],
  ])(
    'returns the same model for a flow %s, with bends that read the same both ways',
    (_, end, waypoints) => {
      const looped = modelWith({
        elements: [boxAt('element-a', 0, 0), flowBetween(end, end, waypoints)],
      });
      expect(modelOf(reverseFlow(looped, elementId('el-flow')))).toBe(looped);
    },
  );

  it('refuses missing elements and other element kinds', () => {
    expect(
      errorOf(reverseFlow(validModel, elementId('element-api')))?._tag,
    ).toBe('NotFlowElement');
    expect(errorOf(reverseFlow(validModel, elementId('missing')))?._tag).toBe(
      'UnknownElement',
    );
  });
});

operationContract({
  reverseFlow: {
    input: validModel,
    run: (model) => reverseFlow(model, orderFlow),
  },
  'setFlowEndPosition freeing the second end': {
    input: validModel,
    run: (model) =>
      setFlowEndPosition(model, orderFlow, 'source', { x: 10, y: 20 }),
  },
});
