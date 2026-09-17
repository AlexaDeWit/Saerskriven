import { locales, pluralCategories } from './locales.js';

describe('plural categories', () => {
  it.each(locales)(
    'declares the categories Intl.PluralRules reports for %s',
    (locale) => {
      expect(
        new Set(
          new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
        ),
      ).toEqual(new Set(pluralCategories[locale]));
    },
  );
});
