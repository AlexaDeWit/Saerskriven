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
 * The supported locale for language tags in preference order. Each tag is
 * canonicalized and an invalid one skipped. The first tag whose language is
 * English, French or Swedish decides, whatever its region, script or
 * extensions: every French tag gets fr-CA, every Swedish tag sv, and every
 * English tag en-CA. No match gives en-CA.
 */
export function negotiate(tags: readonly string[]): Locale {
  return (
    tags
      .flatMap(languageOf)
      .flatMap((language) =>
        Object.hasOwn(catalogueLanguages, language)
          ? [catalogueLanguages[language]]
          : [],
      )
      .at(0) ?? defaultLocale
  );
}
