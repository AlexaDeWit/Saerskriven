import {
  negotiate,
  translator,
  type Locale,
  type Translator,
} from '@saerskriven/i18n';
import {
  followBrowser,
  readLanguage,
  writeLanguage,
  type LanguageChoice,
} from '../language-preference.js';
import { localPreferenceStorage } from '../preference-storage.js';
import { externalStore } from '../ui/external-store.js';
import {
  studioCatalogues,
  studioMessages,
  type StudioMessages,
} from './catalogues.js';

let chosenLanguage: LanguageChoice | undefined;

let activeLocale: Locale | undefined;

const translators = new Map<Locale, Translator<StudioMessages>>();

const browserLanguages = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : navigator.languages;

const currentChoice = (): LanguageChoice =>
  (chosenLanguage ??= readLanguage(localPreferenceStorage()));

const localeFor = (choice: LanguageChoice): Locale =>
  choice === followBrowser ? negotiate(browserLanguages()) : choice;

const currentLocale = (): Locale =>
  (activeLocale ??= localeFor(currentChoice()));

const applyLocale = (locale: Locale): void => {
  activeLocale = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
};

const translatorStore = externalStore(activeTranslator);

const choiceStore = externalStore(currentChoice);

const notifyReaders = (): void => {
  translatorStore.notify();
  choiceStore.notify();
};

const followBrowserLanguages = (): void => {
  if (currentChoice() !== followBrowser) {
    return;
  }
  const negotiated = negotiate(browserLanguages());
  if (negotiated === activeLocale) {
    return;
  }
  applyLocale(negotiated);
  notifyReaders();
};

/**
 * The translator for the active locale, for callers outside components. It is
 * read when the text is needed, so no text is fixed at module load.
 */
export function activeTranslator(): Translator<StudioMessages> {
  const locale = currentLocale();
  const known = translators.get(locale);
  if (known !== undefined) {
    return known;
  }
  const made = translator(studioMessages, studioCatalogues, locale);
  translators.set(locale, made);
  return made;
}

/**
 * Makes `choice` the language and stores it, re-rendering every component
 * that reads a message. It changes no model state, so it neither dirties the
 * document nor reaches the undo stacks, the recovery snapshot or the tabs.
 */
export function chooseLanguage(choice: LanguageChoice): void {
  chosenLanguage = choice;
  writeLanguage(localPreferenceStorage(), choice);
  applyLocale(localeFor(choice));
  notifyReaders();
}

/** The active translator. A change of language re-renders the caller. */
export function useTranslator(): Translator<StudioMessages> {
  return translatorStore.use();
}

/** The chosen language, and the function that chooses and stores another. */
export function useLanguage(): readonly [
  LanguageChoice,
  (choice: LanguageChoice) => void,
] {
  return [choiceStore.use(), chooseLanguage];
}

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('languagechange', followBrowserLanguages);
}

applyLocale(currentLocale());
