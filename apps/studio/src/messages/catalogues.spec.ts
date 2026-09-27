import { catalogueReport, locales } from '@saerskriven/i18n';
import { studioCatalogues } from './catalogues.js';
import { inLocale } from './messages.fixtures.js';

const report = catalogueReport(studioCatalogues);

describe('the studio catalogues', () => {
  it('hold no brace outside a placeholder', () => {
    expect(report.malformed).toEqual([]);
  });

  it.each(locales)(
    'word the either-chord separator in %s between its two chords and nowhere else',
    (locale) => {
      const t = inLocale(locale);
      const separator = t('commands.either-chord', { first: '', second: '' });

      expect(t('commands.either-chord', { first: 'A', second: 'B' })).toBe(
        `A${separator}B`,
      );
    },
  );

  it('report the entries fr-CA and sv word as en-CA does', async ({
    annotate,
  }) => {
    await annotate(report.sameAsDefault.join('\n') || 'none', 'same as en-CA');
    expect(report.sameAsDefault.some((line) => line.startsWith('en-CA'))).toBe(
      false,
    );
  });
});
