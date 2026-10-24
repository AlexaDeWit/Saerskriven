import { diagramsOf, placeElement, type Model } from '@saerskriven/model';
import { copiesModel, diagramId, elementId } from '@saerskriven/model/fixtures';
import { Result } from 'effect';
import { initialState, type State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { mergeEntries, mergeInto, mergeable } from './merge-into.js';

const storefront = diagramId('storefront');
const shopper = elementId('shopper');
const webShop = elementId('web-shop');
const api = elementId('orders-api');
const apiCopy = elementId('orders-api-copy');

const selecting = (
  selection: readonly string[],
  model: Model = copiesModel,
): State => ({
  ...initialState(model),
  activeDiagram: storefront,
  selection: selection.map(elementId),
});

const show = (state: State): void => {
  modelStore.setState(state, true);
  resetAnnouncements();
};

describe('when Merge an element into this one is available', () => {
  it.each([
    { named: 'nothing selected', selection: [], available: false },
    {
      named: 'two elements selected',
      selection: ['orders-api', 'web-shop'],
      available: false,
    },
    {
      named: 'the only element of its kind selected',
      selection: ['shopper'],
      available: false,
    },
    {
      named: 'one element selected with another of its kind',
      selection: ['orders-api'],
      available: true,
    },
  ])('is $available with $named', ({ selection, available }) => {
    expect(mergeable(selecting(selection))).toBe(available);
  });

  it('offers every other element of the kind kept, each with the diagrams it is on', () => {
    const entries = mergeEntries(copiesModel, api);
    expect(
      entries.map(({ element, diagrams }) => [
        element.id,
        diagrams.map(({ id }) => id),
      ]),
    ).toEqual([
      [webShop, ['storefront']],
      [apiCopy, ['fulfilment']],
    ]);
    expect(mergeEntries(copiesModel, shopper)).toEqual([]);
  });
});

describe('merging from the studio', () => {
  it('keeps the element selected, and names the diagram where a placement was dropped', () => {
    const both = Result.getOrThrow(
      placeElement(copiesModel, storefront, {
        element: apiCopy,
        position: { x: 420, y: 300 },
        size: { width: 140, height: 60 },
      }),
    );
    show(selecting(['orders-api'], both));

    expect(mergeInto(apiCopy, api)).toBe(true);

    const state = modelStore.getState();
    expect(state.selection).toEqual([api]);
    expect(diagramsOf(state.present, api).map(({ id }) => id)).toEqual([
      'storefront',
      'fulfilment',
    ]);
    expect(state.past).toEqual([both]);
    expect(currentAnnouncement().message).toContain('Storefront');
  });

  it('says nothing of a dropped placement where every placement moved', () => {
    show(selecting(['orders-api']));

    expect(mergeInto(apiCopy, api)).toBe(true);

    expect(currentAnnouncement().message).not.toBe('');
    expect(currentAnnouncement().message).not.toContain('Storefront');
  });

  it('leaves a refusal to the failure notice and merges nothing', () => {
    show(selecting(['orders-api']));

    expect(mergeInto(webShop, api)).toBe(false);

    const state = modelStore.getState();
    expect(state.present).toBe(copiesModel);
    expect(state.lastFailure).toMatchObject({
      failure: { _tag: 'MergeJoinedByFlow', flowId: 'order' },
    });
    expect(currentAnnouncement().message).toBe('');
  });
});
