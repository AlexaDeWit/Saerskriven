import {
  catalogueTemplates,
  sameAsDefault,
  wellFormedTemplate,
} from '@saerskriven/i18n';
import { studioCatalogues } from './catalogues.js';

describe('the studio catalogues', () => {
  it('hold no brace outside a placeholder', () => {
    expect(
      catalogueTemplates(studioCatalogues).filter(
        ({ template }) => !wellFormedTemplate(template),
      ),
    ).toEqual([]);
  });

  it('report the entries fr-CA and sv word as en-CA does', async ({
    annotate,
  }) => {
    const same = sameAsDefault(studioCatalogues);
    await annotate(
      same
        .map(({ locale, id, form, template }) =>
          [locale, id, form ?? '', JSON.stringify(template)].join(' '),
        )
        .join('\n') || 'none',
      'same as en-CA',
    );
    expect(same.every(({ locale }) => locale !== 'en-CA')).toBe(true);
  });
});
