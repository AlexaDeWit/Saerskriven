import { layoutDiagram } from '@saerskriven/canvas';
import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { diagramsOf, type ElementId, type Model } from '@saerskriven/model';
import {
  diagramId,
  drawnAt,
  elementId,
  sharedModel,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { inLocale } from '../messages/messages.fixtures.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
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
    expect(currentAnnouncement().message).toContain('Payments API');
    expect(currentAnnouncement().message).toContain('Payments.');
    expect(currentAnnouncement().message).toContain('High level');
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

describe('Delete from model', () => {
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
      Either.getOrThrow(saerskrivenYamlCodec.read(clipboard.text())).model
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
