import { defaultLocale, type Locale } from './locales.js';

const catalogueLanguages: Readonly<Record<string, Locale>> = {
  en: 'en-CA',
  fr: 'fr-CA',
  sv: 'sv',
};

function languageOf(tag: string): readonly string[] {
  try {
    return Intl.getCanonicalLocales(tag).map(
      (canonical) => new Intl.Locale(canonical).language,
    );
  } catch {
    return [];
  }
}

/**
 * The catalogued locale one language tag's language subtag matches, or
 * undefined where the tag is invalid or its language is none of English,
 * French or Swedish: every French tag gets fr-CA, every Swedish tag sv, and
 * every English tag en-CA, whatever its region, script or extensions.
 */
export function supportedLocale(tag: string): Locale | undefined {
  const language = languageOf(tag).at(0);
  return language === undefined ? undefined : catalogueLanguages[language];
}

/**
 * The supported locale for language tags in preference order, each matched
 * through {@link supportedLocale}. No match gives en-CA.
 */
export function negotiate(tags: readonly string[]): Locale {
  return (
    tags.flatMap((tag) => supportedLocale(tag) ?? []).at(0) ?? defaultLocale
  );
}
