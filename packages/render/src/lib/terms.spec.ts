import { locales } from '@saerskriven/i18n';
import { severitySchema } from '@saerskriven/model';
import { translatedLocales } from '../render.fixtures.js';
import { renderTerms } from './terms.js';

const characters = new Intl.Segmenter();

const everyMark = (locale: (typeof locales)[number]): readonly string[] => {
  const { marks } = renderTerms(locale);
  return [...Object.values(marks.severity), marks.flag];
};

describe('renderTerms', () => {
  it.each(locales)(
    'gives every severity and the flag a mark of one character, no two alike, in %s',
    (locale) => {
      const marks = everyMark(locale);
      expect(new Set(marks).size).toBe(severitySchema.options.length + 1);
      expect(
        marks.filter((mark) => [...characters.segment(mark)].length !== 1),
      ).toEqual([]);
    },
  );

  it.each(translatedLocales)(
    'words every severity in %s rather than in en-CA',
    (locale) => {
      const english = renderTerms('en-CA');
      const translated = renderTerms(locale);
      expect(
        severitySchema.options.filter(
          (severity) =>
            translated.severity(severity) === english.severity(severity),
        ),
      ).toEqual([]);
    },
  );

  it('agrees a Swedish severity with the severity field, not the threat', () => {
    expect(renderTerms('sv').severity('critical')).toBe('Kritisk');
  });
});
