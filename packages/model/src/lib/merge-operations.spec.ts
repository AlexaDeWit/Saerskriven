import { Result } from 'effect';
import {
  copiesModel,
  diagramId,
  drawnOn,
  elementId,
  heldElement,
  threatIn,
} from '../fixtures.js';
import { addDiagram } from './diagram-operations.js';
import { diagramsOf } from './drawing.js';
import type { DrawnElement } from './drawn-elements.js';
import { addElement, setElementProperties } from './element-operations.js';
import { reverseFlow } from './flow-operations.js';
import { mergeElements, mergeOutcome } from './merge-operations.js';
import type { Model } from './parse.js';
import { errorOf, modelOf, operationContract } from './operations.fixtures.js';
import { placeElement } from './placement-operations.js';
import { attachThreat } from './threat-operations.js';

const storefront = diagramId('storefront');
const fulfilment = diagramId('fulfilment');
const api = elementId('orders-api');
const apiCopy = elementId('orders-api-copy');
const stock = elementId('stock');
const stockCopy = elementId('stock-copy');
const reserve = elementId('reserve');
const reserveCopy = elementId('reserve-copy');
const backend = elementId('backend');
const backendCopy = elementId('backend-copy');
const webShop = elementId('web-shop');

const merge = (model: Model, element: string, into: string): Model =>
  modelOf(mergeElements(model, elementId(element), elementId(into)));

const ids = (diagrams: readonly { readonly id: string }[]): string[] =>
  diagrams.map(({ id }) => id);

const copyOnStorefront: Model = modelOf(
  placeElement(copiesModel, storefront, {
    element: apiCopy,
    position: { x: 420, y: 300 },
    size: { width: 160, height: 60 },
  }),
);

const audit = (
  id: string,
  from: string,
  bidirectional: boolean,
): DrawnElement => ({
  kind: 'flow',
  id: elementId(id),
  name: 'Audit',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'attached', element: elementId(from) },
  target: { kind: 'free', position: { x: 900, y: 150 } },
  waypoints: [],
  bidirectional,
});

describe('mergeElements', () => {
  it('makes two copies one element, drawn on each diagram where its copy was', () => {
    const merged = merge(copiesModel, 'orders-api-copy', 'orders-api');

    expect(merged.elements.map(({ id }) => id)).not.toContain(apiCopy);
    expect(heldElement(merged, 'orders-api')).toEqual(
      heldElement(copiesModel, 'orders-api'),
    );
    expect(ids(diagramsOf(merged, api))).toEqual(['storefront', 'fulfilment']);
    expect(drawnOn(merged, 'fulfilment', 'orders-api')).toMatchObject({
      name: 'Orders API',
      position: { x: 40, y: 90 },
    });
    expect(drawnOn(merged, 'fulfilment', 'orders-api')).not.toHaveProperty(
      'accent',
    );
    expect(drawnOn(merged, 'storefront', 'orders-api')?.accent).toBe('s1');
    expect(drawnOn(merged, 'fulfilment', 'reserve-copy')).toMatchObject({
      source: { kind: 'attached', element: 'orders-api' },
    });
    expect(heldElement(merged, 'backend-copy')).toMatchObject({
      containedElements: [api, stockCopy],
    });
  });

  it('brings copies of a flow together once the elements at its ends are merged', () => {
    const merged = merge(
      merge(
        merge(copiesModel, 'orders-api-copy', 'orders-api'),
        'stock-copy',
        'stock',
      ),
      'reserve-copy',
      'reserve',
    );

    expect(ids(diagramsOf(merged, reserve))).toEqual([
      'storefront',
      'fulfilment',
    ]);
    expect(drawnOn(merged, 'fulfilment', 'reserve')).toMatchObject({
      source: { kind: 'attached', element: 'orders-api' },
      target: { kind: 'attached', element: 'stock' },
    });
    expect(threatIn(merged, 'threat-reservation-replayed').elements).toEqual([
      reserve,
    ]);
    expect(threatIn(merged, 'threat-stock-read').elements).toEqual([stock]);
  });

  it('drops its placement on a diagram already placing the kept element, attaching the flows there to the kept one', () => {
    const merged = merge(copyOnStorefront, 'orders-api', 'orders-api-copy');
    const placed = merged.diagrams[0].placements.map(({ element }) => element);

    expect(placed.filter((id) => id === apiCopy)).toHaveLength(1);
    expect(placed).not.toContain(api);
    expect(drawnOn(merged, 'storefront', 'orders-api-copy')).toMatchObject({
      position: { x: 420, y: 300 },
    });
    expect(drawnOn(merged, 'storefront', 'order')).toMatchObject({
      target: { kind: 'attached', element: 'orders-api-copy', side: 'left' },
    });
    expect(drawnOn(merged, 'storefront', 'reserve')).toMatchObject({
      source: { kind: 'attached', element: 'orders-api-copy' },
    });
    expect(threatIn(merged, 'threat-order-tampered').elements).toEqual([
      apiCopy,
    ]);
  });

  it('attaches a flow end drawn away from the merged element where its diagram now places the kept one', () => {
    const away = modelOf(
      placeElement(copiesModel, fulfilment, {
        element: elementId('order'),
        waypoints: [],
        source: { position: { x: 0, y: 120 } },
        target: { position: { x: 20, y: 120 } },
      }),
    );
    expect(drawnOn(away, 'fulfilment', 'order')).toMatchObject({
      target: { kind: 'away', element: 'orders-api' },
    });

    const merged = merge(away, 'orders-api', 'orders-api-copy');

    expect(drawnOn(merged, 'fulfilment', 'order')).toMatchObject({
      source: { kind: 'away', element: 'web-shop' },
      target: { kind: 'attached', element: 'orders-api-copy' },
    });
  });

  it('attaches a threat on both elements to the kept one once', () => {
    const onBoth = modelOf(
      attachThreat(
        copiesModel,
        threatIn(copiesModel, 'threat-order-tampered').id,
        apiCopy,
      ),
    );

    const merged = merge(onBoth, 'orders-api-copy', 'orders-api');

    expect(threatIn(merged, 'threat-order-tampered').elements).toEqual([api]);
    expect(merged.threats).toHaveLength(onBoth.threats.length);
  });

  it('names the kept element once in the relationship lists of other elements', () => {
    const related = modelOf(
      setElementProperties(copiesModel, reserve, {
        kind: 'flow',
        trustBoundaryIds: [backend, backendCopy],
      }),
    );

    const merged = merge(related, 'backend-copy', 'backend');

    expect(heldElement(merged, 'reserve')).toMatchObject({
      trustBoundaryIds: [backend],
    });
    expect(heldElement(merged, 'reserve-copy')).toMatchObject({
      trustBoundaryIds: [backend],
    });
  });

  it('keeps the security facts of the element kept and drops those of the merged one', () => {
    const facts = modelOf(
      Result.flatMap(
        setElementProperties(copiesModel, stock, {
          kind: 'store',
          isEncrypted: true,
        }),
        (model) =>
          setElementProperties(model, stockCopy, {
            kind: 'store',
            isEncrypted: false,
            isSigned: true,
          }),
      ),
    );

    const kept = heldElement(merge(facts, 'stock-copy', 'stock'), 'stock');

    expect(kept).toMatchObject({ isEncrypted: true });
    expect(kept).not.toHaveProperty('isSigned');
  });

  it('keeps the kept element and every element naming neither as they were', () => {
    const merged = merge(copiesModel, 'stock-copy', 'stock');
    const untouched = copiesModel.elements.filter(
      ({ id }) => id !== stockCopy && id !== reserveCopy && id !== backendCopy,
    );
    expect(merged.elements).toEqual(expect.arrayContaining(untouched));
    expect(
      merged.elements.filter((element) => untouched.includes(element)),
    ).toHaveLength(untouched.length);
  });

  describe('the relationship lists of the element kept', () => {
    it('take the ids of the merged list after their own, and fold once its members are merged too', () => {
      const merged = merge(copiesModel, 'backend-copy', 'backend');
      expect(heldElement(merged, 'backend')).toMatchObject({
        containedElements: [api, stock, apiCopy, stockCopy],
      });

      const folded = merge(
        merge(merged, 'orders-api-copy', 'orders-api'),
        'stock-copy',
        'stock',
      );
      expect(heldElement(folded, 'backend')).toMatchObject({
        containedElements: [api, stock],
      });
    });

    it('unite the crossing flows', () => {
      const crossing = modelOf(
        setElementProperties(copiesModel, backendCopy, {
          kind: 'trust-boundary',
          crossingFlows: [reserveCopy],
        }),
      );

      expect(
        heldElement(merge(crossing, 'backend-copy', 'backend'), 'backend'),
      ).toMatchObject({ crossingFlows: [elementId('order'), reserveCopy] });
    });

    it('take the merged list where the kept element holds none', () => {
      const ended = merge(
        merge(copiesModel, 'orders-api-copy', 'orders-api'),
        'stock-copy',
        'stock',
      );
      expect(heldElement(ended, 'reserve')).not.toHaveProperty(
        'trustBoundaryIds',
      );

      expect(
        heldElement(merge(ended, 'reserve-copy', 'reserve'), 'reserve'),
      ).toMatchObject({ trustBoundaryIds: [backendCopy] });
    });

    it('stay absent where neither element holds one', () => {
      const ended = modelOf(
        setElementProperties(
          merge(
            merge(copiesModel, 'orders-api-copy', 'orders-api'),
            'stock-copy',
            'stock',
          ),
          reserveCopy,
          { kind: 'flow', trustBoundaryIds: undefined },
        ),
      );

      expect(
        heldElement(merge(ended, 'reserve-copy', 'reserve'), 'reserve'),
      ).not.toHaveProperty('trustBoundaryIds');
    });

    it('never name the kept element, though either list did', () => {
      const listing = modelOf(
        Result.flatMap(
          setElementProperties(copiesModel, backend, {
            kind: 'trust-boundary',
            containedElements: [api, stock, backendCopy],
          }),
          (model) =>
            setElementProperties(model, backendCopy, {
              kind: 'trust-boundary',
              containedElements: [apiCopy, backend],
            }),
        ),
      );

      expect(
        heldElement(merge(listing, 'backend-copy', 'backend'), 'backend'),
      ).toMatchObject({ containedElements: [api, stock, apiCopy] });
    });

    it('hold an id both lists name once, where the kept list has it', () => {
      const overlapping = modelOf(
        setElementProperties(copiesModel, backendCopy, {
          kind: 'trust-boundary',
          containedElements: [stock, apiCopy],
        }),
      );

      expect(
        heldElement(merge(overlapping, 'backend-copy', 'backend'), 'backend'),
      ).toMatchObject({ containedElements: [api, stock, apiCopy] });
    });
  });

  describe('two flows', () => {
    const audited = modelOf(
      Result.flatMap(
        addElement(
          copiesModel,
          storefront,
          audit('audit', 'orders-api', false),
        ),
        (model) =>
          Result.flatMap(
            addElement(
              model,
              fulfilment,
              audit('audit-copy', 'orders-api-copy', true),
            ),
            (both) => mergeElements(both, apiCopy, api),
          ),
      ),
    );

    it('merge where an end is free on both', () => {
      const merged = merge(audited, 'audit-copy', 'audit');
      expect(drawnOn(merged, 'fulfilment', 'audit')).toMatchObject({
        source: { kind: 'attached', element: 'orders-api' },
        target: { kind: 'free', position: { x: 900, y: 150 } },
      });
    });

    it('merge whichever way each runs, the kept flow keeping its direction', () => {
      expect(heldElement(audited, 'audit-copy')).toMatchObject({
        bidirectional: true,
      });
      expect(
        heldElement(merge(audited, 'audit-copy', 'audit'), 'audit'),
      ).toMatchObject({ bidirectional: false });
    });
  });

  it('keeps a flow end drawn away from the merged element away from the kept one, on a diagram placing neither', () => {
    const third = diagramId('audit');
    const away = modelOf(
      Result.flatMap(
        addDiagram(copiesModel, { id: third, title: 'Audit' }),
        (model) =>
          placeElement(model, third, {
            element: elementId('order'),
            waypoints: [],
            source: { position: { x: 0, y: 120 } },
            target: { position: { x: 200, y: 120 } },
          }),
      ),
    );

    const merged = merge(away, 'orders-api', 'orders-api-copy');

    expect(drawnOn(merged, 'audit', 'order')).toMatchObject({
      target: {
        kind: 'away',
        element: 'orders-api-copy',
        position: { x: 200, y: 120 },
      },
    });
  });

  it.each([
    {
      named: 'one element named twice',
      element: api,
      into: api,
      failure: { _tag: 'MergeIntoItself', elementId: api },
    },
    {
      named: 'an element the model does not hold',
      element: elementId('ghost'),
      into: api,
      failure: { _tag: 'UnknownElement', elementId: 'ghost' },
    },
    {
      named: 'an element to keep the model does not hold',
      element: api,
      into: elementId('ghost'),
      failure: { _tag: 'UnknownElement', elementId: 'ghost' },
    },
    {
      named: 'two kinds, naming both',
      element: stock,
      into: api,
      failure: {
        _tag: 'MergeKindsDiffer',
        elementId: stock,
        elementKind: 'store',
        intoId: api,
        intoKind: 'process',
      },
    },
    {
      named: 'two elements a flow joins, naming the flow',
      element: webShop,
      into: api,
      failure: {
        _tag: 'MergeJoinedByFlow',
        elementId: webShop,
        intoId: api,
        flowId: 'order',
      },
    },
    {
      named: 'two flows joining different elements, naming both',
      element: reserveCopy,
      into: reserve,
      failure: {
        _tag: 'MergeFlowEndsDiffer',
        elementId: reserveCopy,
        intoId: reserve,
      },
    },
  ])('refuses $named', ({ element, into, failure }) => {
    expect(errorOf(mergeElements(copiesModel, element, into))).toEqual(
      expect.objectContaining(failure),
    );
  });

  it('refuses two flows joining the same elements the other way round', () => {
    const ended = merge(
      merge(copiesModel, 'orders-api-copy', 'orders-api'),
      'stock-copy',
      'stock',
    );
    const reversed = modelOf(reverseFlow(ended, reserveCopy));

    expect(
      errorOf(mergeElements(reversed, reserveCopy, reserve)),
    ).toMatchObject({ _tag: 'MergeFlowEndsDiffer' });
    expect(Result.isSuccess(mergeElements(ended, reserveCopy, reserve))).toBe(
      true,
    );
  });
});

describe('mergeOutcome', () => {
  it('names the diagrams a placement moves on, the threats and the flows that move', () => {
    const outcome = mergeOutcome(copiesModel, apiCopy, api);
    expect({
      moved: ids(outcome.moved),
      dropped: ids(outcome.dropped),
      threats: outcome.threats,
      flows: outcome.flows,
    }).toEqual({
      moved: ['fulfilment'],
      dropped: [],
      threats: [],
      flows: ['reserve-copy'],
    });
  });

  it('names the diagram already placing the kept element as where a placement is dropped', () => {
    const outcome = mergeOutcome(copyOnStorefront, api, apiCopy);
    expect({
      moved: ids(outcome.moved),
      dropped: ids(outcome.dropped),
      threats: outcome.threats,
      flows: outcome.flows,
    }).toEqual({
      moved: [],
      dropped: ['storefront'],
      threats: ['threat-order-tampered'],
      flows: ['order', 'reserve'],
    });
  });
});

operationContract({
  'mergeElements of two copies': {
    input: copiesModel,
    run: (model) => mergeElements(model, apiCopy, api),
  },
  'mergeElements where both are on one diagram': {
    input: copyOnStorefront,
    run: (model) => mergeElements(model, api, apiCopy),
  },
  'mergeElements of two boundaries, uniting lists that reach another diagram': {
    input: copiesModel,
    run: (model) => mergeElements(model, backendCopy, backend),
  },
  'mergeElements refused': {
    input: copiesModel,
    run: (model) => mergeElements(model, webShop, api),
  },
});
