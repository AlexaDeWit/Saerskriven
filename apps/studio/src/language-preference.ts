import { locales, type Locale } from '@saerskriven/i18n';
import {
  readPreference,
  writePreference,
  type PreferenceStorage,
} from './preference-storage.js';

/**
 * Each locale's name in its own language, so a reader recognizes the one they
 * want whatever the active locale is.
 */
export const languageNames = {
  'en-CA': 'English (Canada)',
  'fr-CA': 'Français (Canada)',
  sv: 'Svenska',
} as const satisfies Record<Locale, string>;

export const languageStorageKey = 'saerskrivenLanguage';

const isLocale = (value: string): value is Locale =>
  locales.some((locale) => locale === value);

/** The stored locale, or `undefined` for a missing or unsupported value. */
export function parseLanguage(value: string | null): Locale | undefined {
  return value !== null && isLocale(value) ? value : undefined;
}

/**
 * The stored locale, or `undefined` where storage is absent, throws, or
 * holds a value outside the supported locales.
 */
export function readLanguage(
  storage: PreferenceStorage | undefined,
): Locale | undefined {
  return readPreference(storage, languageStorageKey, parseLanguage);
}

/** Stores the chosen locale, ignoring storage that is absent or throws. */
export function writeLanguage(
  storage: PreferenceStorage | undefined,
  locale: Locale,
): void {
  writePreference(storage, languageStorageKey, locale);
}
