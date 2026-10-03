import { translator } from '@saerskriven/i18n';
import { studioCatalogues, studioMessages } from '../messages/catalogues.js';
import { Action } from '../store/actions.js';
import { reduce } from '../store/reducer.js';
import { initialState } from '../store/state.js';
import { actorElement } from '../store/store.fixtures.js';
import { canvasModel } from './canvas.fixtures.js';
import {
  coordinateText,
  freshLiveText,
  movedSelectionMessage,
} from './move-message.js';

const french = translator(studioMessages, studioCatalogues, 'fr-CA');

describe('coordinateText', () => {
  it('writes the stored number as Position and size does, neither rounded nor grouped', () => {
    for (const value of [28.5, -2.75, 1234.5, 0.1 + 0.2]) {
      expect(coordinateText('en-CA', value)).toBe(String(value));
    }
  });

  it("writes the locale's decimal sign", () => {
    expect(coordinateText('fr-CA', 28.5)).toBe('28,5');
    expect(coordinateText('sv', 1234.5)).toBe('1234,5');
  });
});

describe('freshLiveText', () => {
  it('changes the text of a repeated message, and changes it back on the repeat after that', () => {
    const once = freshLiveText('', 'Moved.');
    const twice = freshLiveText(once, 'Moved.');

    expect(once).toBe('Moved.');
    expect(twice).not.toBe(once);
    expect(twice.trim()).toBe(once);
    expect(freshLiveText(twice, 'Moved.')).toBe(once);
  });
});

describe('movedSelectionMessage', () => {
  it("says where Position and size places the selection, in the locale's figures", () => {
    const selected = reduce(
      initialState(canvasModel),
      Action.Select({ elementIds: [actorElement] }),
    );
    const moved = reduce(
      selected,
      Action.MoveElement({
        elementId: actorElement,
        offset: { x: 28.5, y: 0 },
        decimals: undefined,
      }),
    );

    expect(movedSelectionMessage(moved, french)).toBe(
      french.t('canvas.node-moved', { x: '28,5', y: '0' }),
    );
  });

  it('says nothing while no element is selected', () => {
    expect(
      movedSelectionMessage(initialState(canvasModel), french),
    ).toBeUndefined();
  });
});
