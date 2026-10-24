import { layoutDiagram } from '@saerskriven/canvas';
import { saerskrivenYamlCodec } from '@saerskriven/formats';
import {
  diagramsOf,
  unplaceElement,
  type ElementId,
  type Model,
} from '@saerskriven/model';
import {
  diagramId,
  drawnAt,
  elementId,
  sharedModel,
} from '@saerskriven/model/fixtures';
import { Result } from 'effect';
import { inLocale } from '../messages/messages.fixtures.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { newProcess } from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { recordingClipboard } from './canvas.fixtures.js';
import { copySelected, pasteSelected } from './clipboard.js';
import { removeSelected, removeSelectedFromModel } from './edits.js';
import { accessibleNames } from './names.js';

const overview = diagramId('overview');
const payments = diagramId('payments');
const api = elementId('payments-api');
const customer = elementId('customer');

const onOverview = (selection: readonly ElementId[]): void => {
  modelStore.setState(
    { ...initialState(sharedModel), activeDiagram: overview, selection },
    true,
  );
  resetAnnouncements();
};

const present = (): Model => modelStore.getState().present;

const placedOn = (model: Model, id: ElementId): string[] =>
  diagramsOf(model, id).map(({ id: diagram }) => diagram);

describe('Delete on an element also on another diagram', () => {
  it('takes it off the diagram on screen and keeps it, its threats and its other placement', () => {
    onOverview([api]);

    expect(removeSelected()).toBe(true);
    expect(placedOn(present(), api)).toEqual([payments]);
    expect(present().elements).toBe(sharedModel.elements);
    expect(present().threats).toBe(sharedModel.threats);
    expect(modelStore.getState().selection).toEqual([]);
  });

  it('names the diagrams the element is still on', () => {
    onOverview([api]);

    removeSelected();
    const said = currentAnnouncement().message;
    expect(said).toContain('Payments API');
    expect(said).toContain('High level');
    expect(said.replace('Payments API', '')).toContain('Payments');
  });

  it('draws a flow end attached to it away, as one undo step', () => {
    onOverview([api]);

    removeSelected();
    expect(
      drawnAt(present(), 0).find(({ id }) => id === 'card-details'),
    ).toMatchObject({
      target: { kind: 'away', element: api },
    });
    dispatch(Action.Undo());
    expect(present()).toBe(sharedModel);
  });

  it('deletes an element on its only diagram from the model, as before, beside one it takes off', () => {
    onOverview([api, customer]);

    expect(removeSelected()).toBe(true);
    expect(present().elements.map(({ id }) => id)).not.toContain(customer);
    expect(placedOn(present(), api)).toEqual([payments]);
    expect(modelStore.getState().past).toHaveLength(1);
  });
});

describe('Delete on a selection gone stale', () => {
  it('keeps an element an undo and a redo took off the diagram on screen, with its threats', () => {
    onOverview([api]);

    removeSelected();
    dispatch(Action.Undo());
    dispatch(Action.Select({ elementIds: [api] }));
    dispatch(Action.Redo());

    expect(modelStore.getState().selection).toEqual([]);
    expect(removeSelected()).toBe(false);
    expect(placedOn(present(), api)).toEqual([payments]);
    expect(present().threats.map(({ id }) => id)).toContain('threat-card-data');
  });

  it('keeps an element an undo took out of the model selected, so the redo brings it back for Delete', () => {
    const added = newProcess('process-added', 'Added');
    onOverview([]);
    dispatch(
      Action.AddElement({ diagramId: overview, element: added, decimals: 0 }),
    );
    dispatch(Action.Select({ elementIds: [added.id] }));

    dispatch(Action.Undo());
    dispatch(Action.Redo());

    expect(modelStore.getState().selection).toEqual([added.id]);
    expect(removeSelected()).toBe(true);
    expect(present().elements.map(({ id }) => id)).not.toContain(added.id);
  });

  it('acts on no element the diagram it names does not place', () => {
    onOverview([]);

    dispatch(
      Action.DeleteFromDiagram({
        diagramId: overview,
        elementIds: [elementId('fraud-check'), api],
        decimals: undefined,
      }),
    );

    expect(placedOn(present(), elementId('fraud-check'))).toEqual([payments]);
    expect(placedOn(present(), api)).toEqual([payments]);
  });
});

describe('Delete from model', () => {
  it('leaves an element the diagram on screen does not place, and its threat, on a stale selection', () => {
    const moved = Result.getOrThrow(unplaceElement(sharedModel, overview, api));
    modelStore.setState(
      { ...initialState(moved), activeDiagram: overview, selection: [api] },
      true,
    );

    expect(removeSelectedFromModel()).toBe(false);
    expect(placedOn(present(), api)).toEqual([payments]);
    expect(present().threats.map(({ id }) => id)).toContain('threat-card-data');
  });

  it('removes a shared element from every diagram, and culls the threat it was the last reference of', () => {
    onOverview([api]);

    expect(removeSelectedFromModel()).toBe(true);
    expect(placedOn(present(), api)).toEqual([]);
    expect(present().threats.map(({ id }) => id)).toEqual([
      'threat-charge-replay',
    ]);
  });
});

describe('Cut and paste of a shared element', () => {
  it('takes it off the diagram on screen, culls nothing, and pastes a copy', async () => {
    const clipboard = recordingClipboard();
    onOverview([api]);

    await copySelected(true);
    expect(placedOn(present(), api)).toEqual([payments]);
    expect(present().threats).toBe(sharedModel.threats);
    expect(
      Result.getOrThrow(saerskrivenYamlCodec.read(clipboard.text())).model
        .diagrams,
    ).toHaveLength(1);

    await pasteSelected();
    expect(
      present().elements.filter(({ name }) => name === 'Payments API'),
    ).toHaveLength(2);
    expect(placedOn(present(), api)).toEqual([payments]);
  });
});

describe('the accessible name of a flow end drawn away from its element', () => {
  const layout = layoutDiagram(sharedModel.diagrams[0], sharedModel);

  it.each([
    ['en-CA', 'from Payments API to Card vault on another diagram'],
    ['fr-CA', 'depuis Payments API vers Card vault sur un autre diagramme'],
    ['sv', 'från Payments API till Card vault i ett annat diagram'],
  ] as const)(
    'names the element and says it is on another diagram in %s',
    (locale, ends) => {
      expect(
        accessibleNames(layout, sharedModel, inLocale(locale)).get('charge'),
      ).toContain(ends);
    },
  );
});
