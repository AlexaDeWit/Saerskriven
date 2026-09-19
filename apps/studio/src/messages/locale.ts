import {
  negotiate,
  pseudoTranslator,
  translator,
  type Locale,
  type Translator,
} from '@saerskriven/i18n';
import { readLanguage, writeLanguage } from '../language-preference.js';
import { localPreferenceStorage } from '../preference-storage.js';
import { externalStore } from '../ui/external-store.js';
import {
  studioCatalogues,
  studioMessages,
  type StudioMessages,
} from './catalogues.js';
import { pseudoLocaleRequested } from './pseudo-locale.js';

let chosenLocale: Locale | undefined;

const translators = new Map<Locale, Translator<StudioMessages>>();

const browserLanguages = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : navigator.languages;

const applyLocale = (locale: Locale): void => {
  chosenLocale = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
};

const translatorStore = externalStore(activeTranslator);

const choiceStore = externalStore(activeLocale);

const notifyReaders = (): void => {
  translatorStore.notify();
  choiceStore.notify();
};

/**
 * The active locale, for callers outside components, such as an export that
 * frames its document in the language of the moment it runs.
 */
export function activeLocale(): Locale {
  return (chosenLocale ??=
    readLanguage(localPreferenceStorage()) ?? negotiate(browserLanguages()));
}

/**
 * The translator for the active locale, for callers outside components. It is
 * read when the text is needed, so no text is fixed at module load.
 */
export function activeTranslator(): Translator<StudioMessages> {
  const locale = activeLocale();
  const known = translators.get(locale);
  if (known !== undefined) {
    return known;
  }
  const made =
    import.meta.env.DEV && pseudoLocaleRequested()
      ? pseudoTranslator(studioMessages, studioCatalogues)
      : translator(studioMessages, studioCatalogues, locale);
  translators.set(locale, made);
  return made;
}

/**
 * Makes `locale` the language and stores it, re-rendering every component
 * that reads a message. It changes no model state, so it neither dirties the
 * document nor reaches the undo stacks, the recovery snapshot or the tabs.
 */
export function chooseLanguage(locale: Locale): void {
  writeLanguage(localPreferenceStorage(), locale);
  applyLocale(locale);
  notifyReaders();
}

/** The active translator. A change of language re-renders the caller. */
export function useTranslator(): Translator<StudioMessages> {
  return translatorStore.use();
}

/** The active locale, and the function that chooses and stores another. */
export function useLanguage(): readonly [Locale, (locale: Locale) => void] {
  return [choiceStore.use(), chooseLanguage];
}

applyLocale(activeLocale());
