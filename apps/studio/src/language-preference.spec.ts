import {
  languageStorageKey,
  parseLanguage,
  readLanguage,
  writeLanguage,
} from './language-preference.js';

describe('language preference', () => {
  it('accepts only a supported locale, and follows the browser otherwise', () => {
    expect(parseLanguage('sv')).toBe('sv');
    expect(parseLanguage('fr-CA')).toBe('fr-CA');
    expect(parseLanguage('fr-FR')).toBe('browser');
    expect(parseLanguage('browser')).toBe('browser');
    expect(parseLanguage('')).toBe('browser');
    expect(parseLanguage(null)).toBe('browser');
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

  it('falls back when storage refuses access', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readLanguage(storage)).toBe('browser');
    expect(readLanguage(undefined)).toBe('browser');
    expect(() => {
      writeLanguage(storage, 'sv');
    }).not.toThrow();
  });
});
