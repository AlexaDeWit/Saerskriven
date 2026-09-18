import { languageStorageKey } from '../language-preference.js';
import { initialState, placeholderModel } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { chooseLanguage } from './locale.js';

type LocaleModule = typeof import('./locale.js');

const blockedStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

const speaking = (...languages: readonly string[]): void => {
  vi.stubGlobal('navigator', { languages });
};

const freshLocale = async (stored?: string): Promise<LocaleModule> => {
  globalThis.localStorage.clear();
  if (stored !== undefined) {
    globalThis.localStorage.setItem(languageStorageKey, stored);
  }
  vi.resetModules();
  return import('./locale.js');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  globalThis.localStorage.clear();
  chooseLanguage('en-CA');
});

describe('the language on first use', () => {
  it('follows a supported browser preference', async () => {
    speaking('de-DE', 'fr-FR');

    const locale = await freshLocale();

    expect(locale.activeTranslator().locale).toBe('fr-CA');
    expect(document.documentElement.lang).toBe('fr-CA');
  });

  it('falls back to en-CA where no browser preference is supported', async () => {
    speaking('nb-NO', 'de-DE');

    const locale = await freshLocale();

    expect(locale.activeTranslator().locale).toBe('en-CA');
  });

  it('prefers a stored choice over the browser', async () => {
    speaking('fr-FR');

    const locale = await freshLocale('sv');

    expect(locale.activeTranslator().locale).toBe('sv');
  });

  it('follows the browser for a stored value that names no supported locale', async () => {
    speaking('sv-SE');

    const locale = await freshLocale('kl-GL');

    expect(locale.activeTranslator().locale).toBe('sv');
  });

  it('follows the browser where storage throws', async () => {
    speaking('fr-CH');
    vi.stubGlobal('localStorage', blockedStorage);
    vi.resetModules();

    const locale: LocaleModule = await import('./locale.js');

    expect(locale.activeTranslator().locale).toBe('fr-CA');
  });
});

describe('choosing a language', () => {
  it('stores the choice and names the document', async () => {
    speaking('en-CA');
    const locale = await freshLocale();

    locale.chooseLanguage('sv');

    expect(locale.activeTranslator().locale).toBe('sv');
    expect(document.documentElement.lang).toBe('sv');
    expect(globalThis.localStorage.getItem(languageStorageKey)).toBe('sv');
  });

  it('returns to the browser preference, storing no locale', async () => {
    speaking('fr-BE');
    const locale = await freshLocale('sv');

    locale.chooseLanguage('browser');

    expect(locale.activeTranslator().locale).toBe('fr-CA');
    expect(globalThis.localStorage.getItem(languageStorageKey)).toBe('browser');
  });
});

describe('a change of browser preferences', () => {
  it('is negotiated again while the browser is being followed', async () => {
    speaking('fr-FR');
    const locale = await freshLocale();

    speaking('sv-FI');
    globalThis.dispatchEvent(new Event('languagechange'));

    expect(locale.activeTranslator().locale).toBe('sv');
  });

  it('leaves an explicit choice alone', async () => {
    speaking('fr-FR');
    const locale = await freshLocale('sv');

    speaking('en-GB');
    globalThis.dispatchEvent(new Event('languagechange'));

    expect(locale.activeTranslator().locale).toBe('sv');
  });
});

describe('the model the studio holds', () => {
  it('is untouched by a change of language', () => {
    modelStore.setState(initialState(placeholderModel), true);
    const before = modelStore.getState();

    chooseLanguage('fr-CA');

    expect(modelStore.getState()).toBe(before);
  });
});
