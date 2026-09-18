import {
  languageStorageKey,
  parseLanguage,
  readLanguage,
  writeLanguage,
} from './language-preference.js';

describe('language preference', () => {
  it('accepts only a supported locale, and leaves the rest unset', () => {
    expect(parseLanguage('sv')).toBe('sv');
    expect(parseLanguage('fr-CA')).toBe('fr-CA');
    expect(parseLanguage('fr-FR')).toBeUndefined();
    expect(parseLanguage('browser')).toBeUndefined();
    expect(parseLanguage('')).toBeUndefined();
    expect(parseLanguage(null)).toBeUndefined();
  });

  it('reads and writes the local storage choice', () => {
    const storage = new Map<string, string>();
    const store = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    writeLanguage(store, 'fr-CA');

    expect(storage.get(languageStorageKey)).toBe('fr-CA');
    expect(readLanguage(store)).toBe('fr-CA');
  });

  it('is unset when storage refuses access', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readLanguage(storage)).toBeUndefined();
    expect(readLanguage(undefined)).toBeUndefined();
    expect(() => {
      writeLanguage(storage, 'sv');
    }).not.toThrow();
  });
});
