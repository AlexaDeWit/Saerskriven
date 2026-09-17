import {
  negotiate,
  translator,
  type Locale,
  type Translator,
} from '@saerskriven/i18n';
import { externalStore } from '../ui/external-store.js';
import {
  studioCatalogues,
  studioMessages,
  type StudioMessages,
} from './catalogues.js';

let selectedLocale: Locale | undefined;

const translators = new Map<Locale, Translator<StudioMessages>>();

const browserLanguages = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : navigator.languages;

/**
 * The translator for the active locale, for callers outside components. It
 * is read when the text is needed, so no text is fixed at module load. The
 * locale is negotiated from the browser's languages on first use.
 */
export function activeTranslator(): Translator<StudioMessages> {
  const locale = (selectedLocale ??= negotiate(browserLanguages()));
  const known = translators.get(locale);
  if (known !== undefined) {
    return known;
  }
  const made = translator(studioMessages, studioCatalogues, locale);
  translators.set(locale, made);
  return made;
}

const translatorStore = externalStore(activeTranslator);

/** Makes `locale` active, re-rendering every component that reads a message. */
export function chooseLocale(locale: Locale): void {
  selectedLocale = locale;
  translatorStore.notify();
}

/** The active translator. A change of locale re-renders the caller. */
export function useTranslator(): Translator<StudioMessages> {
  return translatorStore.use();
}
