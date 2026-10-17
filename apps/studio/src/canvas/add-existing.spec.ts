import {
  addDiagram,
  diagramsOf,
  setBoundaryShape,
  type ElementId,
  type Model,
  type Placement,
} from '@saerskriven/model';
import {
  diagramId,
  drawnAt,
  elementId,
  sharedModel,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { mainDiagram, sampleModel } from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  addExisting,
  existingEntries,
  existingPlacements,
  offersExisting,
  openAddExisting,
} from './add-existing.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';

const overview = diagramId('overview');
const payments = diagramId('payments');
const third = diagramId('third');
const customer = elementId('customer');
const cardVault = elementId('card-vault');
const fraudCheck = elementId('fraud-check');
const score = elementId('score');
const zone = elementId('payments-zone');

const withThird: Model = Either.getOrThrow(
  addDiagram(sharedModel, { id: third, title: 'Third' }),
);

const ids = (entries: readonly { element: { id: string } }[]): string[] =>
  entries.map(({ element }) => element.id);

const placementOf = (
  placements: readonly Placement[],
  id: ElementId,
): Placement | undefined => placements.find(({ element }) => element === id);

const show = (model: Model, diagram = overview): void => {
  modelStore.setState({ ...initialState(model), activeDiagram: diagram }, true);
  resetAnnouncements();
};

describe('what Add existing element offers', () => {
  it('lists the elements the diagram does not place, with the diagrams that do, and no flow', () => {
    const offered = existingEntries(sharedModel, overview);
    expect(ids(offered)).toEqual([cardVault, fraudCheck]);
    expect(offered.map(({ diagrams }) => diagrams.map(({ id }) => id))).toEqual(
      [[payments], [payments]],
    );
  });

  it('offers every element but the flows on an empty diagram, and nothing on a diagram the model lacks', () => {
    expect(existingEntries(withThird, third)).toHaveLength(7);
    expect(existingEntries(sharedModel, diagramId('missing'))).toEqual([]);
  });
});

describe('where Add existing element places what is picked', () => {
  const centre = { x: 500, y: 500 };

  it('keeps the layout and the sizes the picks have on their first diagram, centred on the view', () => {
    const placed = existingPlacements(
      sharedModel,
      overview,
      [fraudCheck, cardVault],
      centre,
    );
    expect(placed.map(({ element }) => element)).toEqual([
      cardVault,
      fraudCheck,
    ]);
    expect(placementOf(placed, fraudCheck)).toMatchObject({
      position: { x: 230, y: 470 },
      size: { width: 140, height: 60 },
    });
    expect(placementOf(placed, cardVault)).toMatchObject({
      position: { x: 650, y: 470 },
      size: { width: 120, height: 60 },
    });
  });

  it('sets the picks of each diagram side by side, clear of one another', () => {
    const placed = existingPlacements(
      withThird,
      third,
      [fraudCheck, customer],
      centre,
    );
    expect(placementOf(placed, customer)).toMatchObject({
      position: { x: 345, y: 470 },
      size: { width: 120, height: 60 },
    });
    expect(placementOf(placed, fraudCheck)).toMatchObject({
      position: { x: 515, y: 470 },
    });
  });

  it('takes a trust boundary at the shape of its first placement', () => {
    expect(
      placementOf(existingPlacements(withThird, third, [zone], centre), zone),
    ).toEqual({
      element: zone,
      shape: {
        kind: 'box',
        position: { x: 380, y: 430 },
        size: { width: 240, height: 140 },
      },
    });
  });

  it('takes a trust boundary curve whole, every point moved by the one offset that centres it', () => {
    const arch = [
      { x: 380, y: 280 },
      { x: 500, y: 140 },
      { x: 620, y: 280 },
    ];
    const curved = Either.getOrThrow(
      setBoundaryShape(withThird, overview, zone, {
        kind: 'curve',
        waypoints: arch,
      }),
    );

    expect(
      placementOf(existingPlacements(curved, third, [zone], centre), zone),
    ).toEqual({
      element: zone,
      shape: {
        kind: 'curve',
        waypoints: arch.map(({ x, y }) => ({ x, y: y + 290 })),
      },
    });
  });

  it('leaves out a flow, which the picker does not offer', () => {
    expect(
      existingPlacements(
        sharedModel,
        overview,
        [score, fraudCheck],
        centre,
      ).map(({ element }) => element),
    ).toEqual([fraudCheck]);
  });

  it('leaves out a pick the diagram already places', () => {
    expect(
      existingPlacements(sharedModel, overview, [customer], centre),
    ).toEqual([]);
  });
});

describe('Add existing element', () => {
  it('places the picks as one undo step and selects them', () => {
    show(sharedModel);

    expect(addExisting([cardVault, fraudCheck], { x: 0, y: 0 })).toBe(true);
    const present = modelStore.getState().present;
    expect(diagramsOf(present, cardVault).map(({ id }) => id)).toEqual([
      overview,
      payments,
    ]);
    expect(present.elements).toBe(sharedModel.elements);
    expect(present.threats).toBe(sharedModel.threats);
    expect(modelStore.getState().past).toHaveLength(1);
    expect(modelStore.getState().selection).toEqual([cardVault, fraudCheck]);
    expect(currentAnnouncement().message).toContain('High level');

    dispatch(Action.Undo());
    expect(modelStore.getState().present).toBe(sharedModel);
  });

  it('attaches a flow on the diagram whose end was drawn away from an added element, and places no flow nobody picked', () => {
    show(sharedModel);

    addExisting([cardVault], { x: 0, y: 0 });
    const present = modelStore.getState().present;
    expect(drawnAt(present, 0).find(({ id }) => id === 'charge')).toMatchObject(
      { target: { kind: 'attached', element: cardVault } },
    );
    expect(diagramsOf(present, score).map(({ id }) => id)).toEqual([payments]);
  });

  it('opens nothing and says so where the diagram places every element', () => {
    show(sampleModel, mainDiagram);

    openAddExisting();

    expect(offersExisting(modelStore.getState())).toBe(false);
    expect(currentAnnouncement().message).toContain('Main');
  });

  it('opens nothing and says so where the diagram leaves only a flow off', () => {
    show(sharedModel);
    addExisting([cardVault, fraudCheck], { x: 0, y: 0 });
    resetAnnouncements();

    openAddExisting();

    expect(
      diagramsOf(modelStore.getState().present, score).map(({ id }) => id),
    ).toEqual([payments]);
    expect(offersExisting(modelStore.getState())).toBe(false);
    expect(currentAnnouncement().message).toContain('High level');
  });
});
