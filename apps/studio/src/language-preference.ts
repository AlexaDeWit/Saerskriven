import { locales, type Locale } from '@saerskriven/i18n';
import {
  readPreference,
  writePreference,
  type PreferenceStorage,
} from './preference-storage.js';

/** The choice that leaves the language to the browser's preferences. */
export const followBrowser = 'browser';

/** A language choice: one supported locale, or the browser's preferences. */
export type LanguageChoice = Locale | typeof followBrowser;

/** What the language control offers, the browser's preferences first. */
export const languageChoices = [followBrowser, ...locales] as const;

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

/**
 * The stored language, or the browser's preferences for a missing value or
 * one outside the supported locales.
 */
export function parseLanguage(value: string | null): LanguageChoice {
  return value !== null && isLocale(value) ? value : followBrowser;
}

/**
 * The stored language, or the browser's preferences where storage is absent
 * or throws.
 */
export function readLanguage(
  storage: PreferenceStorage | undefined,
): LanguageChoice {
  return readPreference(storage, languageStorageKey, parseLanguage);
}

/** Stores the language choice, ignoring storage that is absent or throws. */
export function writeLanguage(
  storage: PreferenceStorage | undefined,
  choice: LanguageChoice,
): void {
  writePreference(storage, languageStorageKey, choice);
}
