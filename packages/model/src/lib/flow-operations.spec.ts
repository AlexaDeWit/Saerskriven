import { Either } from 'effect';
import { elementId, flowIn, validModel } from '../fixtures.js';
import { addElement } from './element-operations.js';
import {
  reconnectFlow,
  setFlowDirection,
  setFlowWaypoints,
} from './flow-operations.js';
import { OperationFailure } from './operation-failures.js';
import {
  errorOf,
  mainDiagram,
  modelOf,
  note,
  withNote,
  writeFlow,
} from './operations.fixtures.js';

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
    expect(
      errorOf(
        reconnectFlow(validModel, id, 'target', elementId('element-customer')),
      )?._tag,
    ).toBe('InvalidFlowEndpoint');
    expect(
      errorOf(reconnectFlow(validModel, id, 'target', elementId('missing')))
        ?._tag,
    ).toBe('InvalidFlowEndpoint');
    expect(
      errorOf(
        reconnectFlow(
          validModel,
          elementId('element-api'),
          'source',
          elementId('element-db'),
        ),
      )?._tag,
    ).toBe('NotFlowElement');
    expect(
      errorOf(
        reconnectFlow(
          validModel,
          elementId('missing'),
          'source',
          elementId('element-db'),
        ),
      )?._tag,
    ).toBe('UnknownElement');
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
