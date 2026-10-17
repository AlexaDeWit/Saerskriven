import { diagramId, elementId, placementIn, sharedModel } from '../fixtures.js';
import { drawnElementOn, placementOn } from './drawing.js';
import {
  removeElement,
  renameElement,
  setAccent,
  setElementProperties,
} from './element-operations.js';
import { selectionFragment } from './fragment.js';
import { reconnectFlow, setFlowEndPosition } from './flow-operations.js';
import type { Model } from './parse.js';
import { errorOf, modelOf, operationContract } from './operations.fixtures.js';
import { placeElement, unplaceElement } from './placement-operations.js';

const overview = diagramId('overview');
const payments = diagramId('payments');
const api = elementId('payments-api');
const vault = elementId('card-vault');
const charge = elementId('charge');
const fraud = elementId('fraud-check');

const vaultBox = {
  element: vault,
  position: { x: 660.04, y: 180 },
  size: { width: 120, height: 60 },
};

const flowFacts = (model: Model, id: string) => {
  const held = model.elements.find((element) => element.id === id);
  return held?.kind === 'flow' ? held : undefined;
};

const drawnOn = (model: Model, diagram: string, id: string) => {
  const held = model.diagrams.find(({ id: own }) => own === diagram);
  return held === undefined
    ? undefined
    : drawnElementOn(model, held, elementId(id));
};

describe('placeElement', () => {
  it('draws the element it places on a second diagram, as the same element', () => {
    const placed = modelOf(placeElement(sharedModel, overview, vaultBox, 1));
    expect(placed.elements).toBe(sharedModel.elements);
    expect(drawnOn(placed, 'overview', 'card-vault')).toMatchObject({
      name: 'Card vault',
      position: { x: 660, y: 180 },
    });
    expect(placed.threats).toBe(sharedModel.threats);
  });

  it('attaches a flow end drawn away from the element it places there', () => {
    expect(flowFacts(sharedModel, 'charge')?.target).toMatchObject({
      kind: 'attached',
    });
    expect(drawnOn(sharedModel, 'overview', 'charge')).toMatchObject({
      target: { kind: 'away', element: 'card-vault' },
    });
    const placed = modelOf(placeElement(sharedModel, overview, vaultBox));
    expect(drawnOn(placed, 'overview', 'charge')).toMatchObject({
      target: { kind: 'attached', element: 'card-vault' },
    });
  });

  it('refuses an element its diagram already places', () => {
    expect(
      errorOf(placeElement(sharedModel, payments, { ...vaultBox })),
    ).toMatchObject({
      _tag: 'ElementAlreadyOnDiagram',
      elementId: vault,
      diagramId: payments,
    });
  });

  it.each([
    {
      named: 'geometry of another kind',
      placement: { element: vault, waypoints: [], source: {}, target: {} },
    },
    {
      named: 'a flow end attached to an element its diagram does not place',
      placement: {
        element: elementId('score'),
        waypoints: [],
        source: {},
        target: {},
      },
    },
    {
      named: 'a flow end drawn away from an element its diagram places',
      placement: {
        element: elementId('score'),
        waypoints: [],
        source: { position: { x: 0, y: 0 } },
        target: { position: { x: 40, y: 0 } },
      },
    },
  ])('refuses $named', ({ placement }) => {
    expect(
      errorOf(placeElement(sharedModel, overview, placement)),
    ).toMatchObject({ _tag: 'InvalidPlacement', diagramId: overview });
  });

  it('refuses an element the model does not hold, and a diagram it does not hold', () => {
    expect(
      errorOf(
        placeElement(sharedModel, overview, {
          ...vaultBox,
          element: elementId('ghost'),
        }),
      ),
    ).toMatchObject({ _tag: 'UnknownElement' });
    expect(
      errorOf(placeElement(sharedModel, diagramId('ghost'), vaultBox)),
    ).toMatchObject({ _tag: 'UnknownDiagram' });
  });
});

describe('unplaceElement', () => {
  it('takes one placement off and keeps the element, its threats and its other placements', () => {
    const unplaced = modelOf(unplaceElement(sharedModel, overview, api));
    expect(drawnOn(unplaced, 'overview', 'payments-api')).toBeUndefined();
    expect(drawnOn(unplaced, 'payments', 'payments-api')).toBeDefined();
    expect(unplaced.elements).toBe(sharedModel.elements);
    expect(unplaced.threats).toBe(sharedModel.threats);
  });

  it("draws a flow end away at the element's anchor there, and keeps it attached", () => {
    const unplaced = modelOf(unplaceElement(sharedModel, overview, api, 0));
    expect(drawnOn(unplaced, 'overview', 'card-details')).toMatchObject({
      target: {
        kind: 'away',
        element: 'payments-api',
        position: { x: 490, y: 210 },
      },
    });
    expect(flowFacts(unplaced, 'card-details')?.target).toEqual({
      kind: 'attached',
      element: 'payments-api',
    });
  });

  it('puts the element back as it was, its flows attached again', () => {
    const placement = placementIn(sharedModel, 'payments-api');
    const overviewPlacement = sharedModel.diagrams[0].placements.find(
      ({ element }) => element === api,
    );
    const back = modelOf(
      placeElement(
        modelOf(unplaceElement(sharedModel, overview, api)),
        overview,
        overviewPlacement ?? placement,
      ),
    );
    expect(drawnOn(back, 'overview', 'card-details')).toEqual(
      drawnOn(sharedModel, 'overview', 'card-details'),
    );
  });

  it('refuses the last placement, which only removing the element takes away', () => {
    expect(errorOf(unplaceElement(sharedModel, payments, fraud))).toEqual(
      expect.objectContaining({
        _tag: 'LastPlacement',
        elementId: fraud,
        diagramId: payments,
      }),
    );
  });

  it('refuses an element its diagram does not place', () => {
    expect(errorOf(unplaceElement(sharedModel, overview, fraud))).toMatchObject(
      { _tag: 'ElementNotOnDiagram' },
    );
  });
});

describe('an element placed on several diagrams', () => {
  it('takes a new name on every diagram, and an accent on one', () => {
    const renamed = modelOf(renameElement(sharedModel, api, 'Gateway'));
    expect(drawnOn(renamed, 'overview', 'payments-api')?.name).toBe('Gateway');
    expect(drawnOn(renamed, 'payments', 'payments-api')?.name).toBe('Gateway');
    const accented = modelOf(setAccent(sharedModel, payments, [api], 'l3'));
    expect(drawnOn(accented, 'payments', 'payments-api')?.accent).toBe('l3');
    expect(drawnOn(accented, 'overview', 'payments-api')?.accent).toBe('s1');
  });

  it('reconnects a flow on every diagram, drawn away where the new end is not placed', () => {
    const reconnected = modelOf(
      reconnectFlow(sharedModel, payments, charge, 'source', fraud, 'top'),
    );
    expect(drawnOn(reconnected, 'payments', 'charge')).toMatchObject({
      source: { kind: 'attached', element: 'fraud-check', side: 'top' },
    });
    expect(drawnOn(reconnected, 'overview', 'charge')).toMatchObject({
      source: {
        kind: 'away',
        element: 'fraud-check',
        position: { x: 490, y: 210 },
      },
    });
  });

  it('frees a flow end on every diagram, each where it was drawn', () => {
    const freed = modelOf(
      setFlowEndPosition(sharedModel, payments, charge, 'target', {
        x: 700,
        y: 130,
      }),
    );
    expect(drawnOn(freed, 'payments', 'charge')).toMatchObject({
      target: { kind: 'free', position: { x: 700, y: 130 } },
    });
    expect(drawnOn(freed, 'overview', 'charge')).toMatchObject({
      target: { kind: 'free', position: { x: 680, y: 210 } },
    });
  });

  it('moves an end drawn away and keeps it attached', () => {
    const moved = modelOf(
      setFlowEndPosition(sharedModel, overview, charge, 'target', {
        x: 700,
        y: 260,
      }),
    );
    expect(drawnOn(moved, 'overview', 'charge')).toMatchObject({
      target: {
        kind: 'away',
        element: 'card-vault',
        position: { x: 700, y: 260 },
      },
    });
    expect(flowFacts(moved, 'charge')?.target).toEqual(
      flowFacts(sharedModel, 'charge')?.target,
    );
  });

  it('goes from every diagram when removed, each flow freed at its anchor there', () => {
    const removed = modelOf(removeElement(sharedModel, api));
    expect(
      removed.diagrams.flatMap(({ placements }) => placements),
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ element: api })]),
    );
    expect(drawnOn(removed, 'overview', 'charge')).toMatchObject({
      source: { kind: 'free', position: { x: 490, y: 210 } },
    });
    expect(drawnOn(removed, 'payments', 'charge')).toMatchObject({
      source: { kind: 'free', position: { x: 310, y: 130 } },
    });
    expect(removed.threats.map(({ id }) => id)).toEqual([
      'threat-charge-replay',
    ]);
  });

  it('relates a boundary to an element only another diagram places', () => {
    const related = modelOf(
      setElementProperties(sharedModel, elementId('payments-zone'), {
        kind: 'trust-boundary',
        containedElements: [api, vault, fraud],
      }),
    );
    expect(
      related.elements.find(({ id }) => id === 'payments-zone'),
    ).toMatchObject({ containedElements: [api, vault, fraud] });
  });

  it('copies a flow end drawn away as a free end, where it was drawn', () => {
    const fragment = modelOf(
      selectionFragment(sharedModel, overview, [charge]),
    );
    expect(flowFacts(fragment, 'charge')?.target).toEqual({ kind: 'free' });
    expect(drawnOn(fragment, 'overview', 'charge')).toMatchObject({
      target: { kind: 'free', position: { x: 680, y: 210 } },
    });
  });

  it('keeps its placement on a diagram it was not edited on', () => {
    const renamed = modelOf(renameElement(sharedModel, api, 'Gateway'));
    expect(placementOn(renamed.diagrams[1], api)).toBe(
      placementOn(sharedModel.diagrams[1], api),
    );
  });
});

operationContract({
  placeElement: {
    input: sharedModel,
    run: (model) => placeElement(model, overview, vaultBox),
  },
  unplaceElement: {
    input: sharedModel,
    run: (model) => unplaceElement(model, overview, api),
  },
  'reconnectFlow across diagrams': {
    input: sharedModel,
    run: (model) => reconnectFlow(model, payments, charge, 'source', fraud),
  },
  'removeElement of a shared element': {
    input: sharedModel,
    run: (model) => removeElement(model, api),
  },
});
