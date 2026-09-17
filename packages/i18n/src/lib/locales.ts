/** The locales the catalogues cover. */
export const locales = ['en-CA', 'fr-CA', 'sv'] as const;

export type Locale = (typeof locales)[number];

/** The locale chosen when no preferred language is supported. */
export const defaultLocale: Locale = 'en-CA';

/**
 * The CLDR cardinal plural categories of each locale, as
 * `Intl.PluralRules` reports them. A plural message declares exactly these
 * forms in that locale's catalogue.
 */
export const pluralCategories = {
  'en-CA': ['one', 'other'],
  'fr-CA': ['one', 'many', 'other'],
  sv: ['one', 'other'],
} as const satisfies Record<Locale, readonly Intl.LDMLPluralRule[]>;

export type PluralCategory<L extends Locale> =
  (typeof pluralCategories)[L][number];
