import { translator } from '@saerskriven/i18n';
import { studioCatalogues, studioMessages } from '../messages/catalogues.js';
import { activeTranslator } from '../messages/locale.js';
import {
  bare,
  character,
  firedBy,
  keyShortcutsAttribute,
  platformOf,
  mod,
  modShift,
  spellChord,
  spellShortcuts,
  type Chord,
} from './shortcuts.js';

const { t } = activeTranslator();

const inLocale = (locale: 'fr-CA' | 'sv') =>
  translator(studioMessages, studioCatalogues, locale).t;

const save: Chord = { modifiers: ['Mod'], key: 's' };
const saveAs: Chord = { modifiers: ['Mod', 'Shift'], key: 's' };
const clear: Chord = { modifiers: [], key: 'Escape' };

const press = (over: Partial<Parameters<typeof firedBy>[0]> = {}) => ({
  key: 's',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

describe('platformOf', () => {
  it('reads Apple hardware off either thing a browser offers', () => {
    expect(platformOf({ platform: 'MacIntel' })).toBe('apple');
    expect(platformOf({ platform: 'macOS' })).toBe('apple');
    expect(
      platformOf({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS)' }),
    ).toBe('apple');
  });

  it('writes to a machine it cannot place in words', () => {
    expect(platformOf({ platform: 'Linux x86_64' })).toBe('other');
    expect(platformOf({ platform: 'Win32' })).toBe('other');
    expect(platformOf({})).toBe('other');
  });
});

describe('spelling a chord', () => {
  it('writes each platform the way that platform writes it', () => {
    expect(spellChord(save, 'other', t)).toBe('Ctrl+S');
    expect(spellChord(save, 'apple', t)).toBe('⌘S');
    expect(spellChord(saveAs, 'other', t)).toBe('Ctrl+Shift+S');
    expect(spellChord(saveAs, 'apple', t)).toBe('⇧⌘S');
    expect(spellChord(clear, 'other', t)).toBe('Esc');
    expect(spellChord(clear, 'apple', t)).toBe('Esc');
  });

  it('offers both chords of a command that answers to two', () => {
    expect(
      spellShortcuts([saveAs, { modifiers: ['Mod'], key: 'y' }], 'other', t),
    ).toBe('Ctrl+Shift+S or Ctrl+Y');
  });

  it('names the modifiers as aria-keyshortcuts does, one entry per chord', () => {
    expect(keyShortcutsAttribute([saveAs], 'other')).toBe('Control+Shift+S');
    expect(keyShortcutsAttribute([saveAs], 'apple')).toBe('Shift+Meta+S');
    expect(keyShortcutsAttribute([save, clear], 'other')).toBe(
      'Control+S Escape',
    );
  });

  it('writes a produced character without exposing its physical Shift key', () => {
    const help = character('?');

    expect(spellChord(help, 'other', t)).toBe('?');
    expect(keyShortcutsAttribute([help], 'other')).toBe('?');
  });
});

describe('a chord in the reader’s language', () => {
  it.each([
    ['fr-CA', 'Ctrl+Maj+S', 'Échap', 'Flèche gauche'],
    ['sv', 'Ctrl+Skift+S', 'Esc', 'Vänsterpil'],
  ] as const)(
    'names the keys and modifiers in %s off Apple hardware',
    (locale, savingAs, escape, left) => {
      const spoken = inLocale(locale);
      expect(spellChord(saveAs, 'other', spoken)).toBe(savingAs);
      expect(spellChord(clear, 'other', spoken)).toBe(escape);
      expect(spellChord(bare('ArrowLeft'), 'other', spoken)).toBe(left);
    },
  );

  it('keeps Apple’s modifier symbols before a named key', () => {
    expect(spellChord(saveAs, 'apple', inLocale('fr-CA'))).toBe('⇧⌘S');
    expect(spellChord(bare('Enter'), 'apple', inLocale('sv'))).toBe('Retur');
  });

  it('keeps aria-keyshortcuts in the key values the attribute requires', () => {
    expect(keyShortcutsAttribute([saveAs, clear], 'other')).toBe(
      'Control+Shift+S Escape',
    );
  });

  it('fires on the same key whatever name the chord is shown under', () => {
    expect(firedBy(press({ key: 'Escape' }), clear, 'other')).toBe(true);
    expect(firedBy(press({ key: 'Échap' }), clear, 'other')).toBe(false);
  });
});

describe('firedBy', () => {
  it('takes the platform command modifier and not the other one', () => {
    expect(firedBy(press({ ctrlKey: true }), save, 'other')).toBe(true);
    expect(firedBy(press({ metaKey: true }), save, 'other')).toBe(false);
    expect(firedBy(press({ metaKey: true }), save, 'apple')).toBe(true);
    expect(firedBy(press({ ctrlKey: true }), save, 'apple')).toBe(false);
  });

  it('refuses a modifier the chord does not name', () => {
    expect(
      firedBy(press({ ctrlKey: true, shiftKey: true }), save, 'other'),
    ).toBe(false);
    expect(firedBy(press({ ctrlKey: true, altKey: true }), save, 'other')).toBe(
      false,
    );
    expect(firedBy(press({ key: 's' }), save, 'other')).toBe(false);
  });

  it('leaves a layout writing a character under AltGr to write it', () => {
    expect(
      firedBy(
        { ...press({ ctrlKey: true }), getModifierState: () => true },
        save,
        'other',
      ),
    ).toBe(false);
  });

  it('reads the key a shifted press reports, which is the capital', () => {
    expect(
      firedBy(
        press({ key: 'S', ctrlKey: true, shiftKey: true }),
        saveAs,
        'other',
      ),
    ).toBe(true);
  });

  it('matches a produced character with the Shift state needed to type it', () => {
    const help = character('?');

    expect(firedBy(press({ key: '?', shiftKey: true }), help, 'other')).toBe(
      true,
    );
    expect(firedBy(press({ key: '/' }), help, 'other')).toBe(false);
    expect(
      firedBy(
        press({ key: '?', shiftKey: true, ctrlKey: true }),
        help,
        'other',
      ),
    ).toBe(false);
  });

  it('limits platform-specific alternatives in matching, labels and ARIA', () => {
    const redoAlternative = mod('y', 'other');
    expect(spellShortcuts([redoAlternative], 'apple', t)).toBe('');
    expect(keyShortcutsAttribute([redoAlternative], 'apple')).toBe('');
    expect(
      firedBy(press({ key: 'y', metaKey: true }), redoAlternative, 'apple'),
    ).toBe(false);
    expect(spellShortcuts([redoAlternative], 'other', t)).toBe('Ctrl+Y');
    expect(keyShortcutsAttribute([redoAlternative], 'other')).toBe('Control+Y');
    expect(
      firedBy(press({ key: 'y', ctrlKey: true }), redoAlternative, 'other'),
    ).toBe(true);
  });

  it.each(['apple', 'other'] as const)(
    'matches shifted number-row shortcuts on %s',
    (platform) => {
      const modifiers = {
        ctrlKey: platform === 'other',
        metaKey: platform === 'apple',
        shiftKey: true,
      };
      expect(
        firedBy(
          press({ key: '!', code: 'Digit1', ...modifiers }),
          modShift('1'),
          platform,
        ),
      ).toBe(true);
      expect(
        firedBy(
          press({ key: '@', code: 'Digit2', ...modifiers }),
          modShift('2'),
          platform,
        ),
      ).toBe(true);
      expect(
        firedBy(
          press({ key: '@', code: 'Digit2', ...modifiers }),
          modShift('1'),
          platform,
        ),
      ).toBe(false);
    },
  );

  describe('a plus', () => {
    it('accepts plus from the main keyboard or keypad without taking modified zoom chords', () => {
      const plus = character('+');
      for (const shiftKey of [false, true]) {
        expect(firedBy(press({ key: '+', shiftKey }), plus, 'other')).toBe(
          true,
        );
        expect(
          firedBy(press({ key: '+', shiftKey, ctrlKey: true }), plus, 'other'),
        ).toBe(false);
      }
      expect(keyShortcutsAttribute([plus], 'other')).toBe('Plus');
    });

    it.each(['apple', 'other'] as const)(
      'accepts the produced plus character for zoom on %s',
      (platform) => {
        const zoom = character('+', ['Mod']);
        for (const shiftKey of [false, true]) {
          expect(
            firedBy(
              press({
                key: '+',
                ctrlKey: platform === 'other',
                metaKey: platform === 'apple',
                shiftKey,
              }),
              zoom,
              platform,
            ),
          ).toBe(true);
        }
        expect(
          firedBy(press({ key: '+', shiftKey: true }), zoom, platform),
        ).toBe(false);
      },
    );
  });
});
