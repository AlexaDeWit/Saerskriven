import { negotiate } from './negotiate.js';

describe('negotiate', () => {
  it.each([
    [[], 'en-CA'],
    [['fr'], 'fr-CA'],
    [['fr-FR'], 'fr-CA'],
    [['fr-BE'], 'fr-CA'],
    [['fr-CH'], 'fr-CA'],
    [['FR-ca'], 'fr-CA'],
    [['fr-u-nu-latn'], 'fr-CA'],
    [['sv'], 'sv'],
    [['sv-SE'], 'sv'],
    [['sv-FI'], 'sv'],
    [['en'], 'en-CA'],
    [['en-US'], 'en-CA'],
    [['en-GB'], 'en-CA'],
    [['en-Latn-CA'], 'en-CA'],
    [['de-DE', 'fr-FR', 'sv'], 'fr-CA'],
    [['zh-Hant-TW', 'sv-FI', 'fr'], 'sv'],
    [['de'], 'en-CA'],
    [['nb-NO'], 'en-CA'],
    [['', 'not a tag!', 'fr_CA', 'sv'], 'sv'],
    [['und'], 'en-CA'],
    [['en-US-u-va-posix'], 'en-CA'],
  ] as const)('negotiates %j to %s', (tags, locale) => {
    expect(negotiate(tags)).toBe(locale);
  });
});
