import { catalogue, catalogueTemplates, sameAsDefault } from './catalogue.js';
import { plural, text } from './contract.js';
import { shelfCatalogues, shelfTranslator } from './i18n.fixtures.js';
import { wellFormedTemplate } from './template.js';

describe('translator', () => {
  it('inserts parameter values as literal text', () => {
    const { t } = shelfTranslator('en-CA');
    expect(t('shelf.named', { title: '{title} <b>bold</b> {count}' })).toBe(
      'Showing {title} <b>bold</b> {count}.',
    );
  });

  it('formats number and list parameters for the locale', () => {
    const { t } = shelfTranslator('fr-CA');
    expect(t('shelf.threats', { count: 1_000_000 })).toBe(
      `${new Intl.NumberFormat('fr-CA').format(1_000_000)} de menaces`,
    );
    expect(
      t('shelf.tried', { name: 'a.yaml', formats: ['JSON', 'YAML'] }),
    ).toContain(new Intl.ListFormat('fr-CA').format(['JSON', 'YAML']));
  });

  it.each([
    ['en-CA', 0, 'API has 0 threats'],
    ['en-CA', 1, 'API has one threat'],
    ['fr-CA', 0, 'API a 0 menace'],
    ['fr-CA', 2, 'API a 2 menaces'],
    [
      'fr-CA',
      1_000_000,
      `API a ${new Intl.NumberFormat('fr-CA').format(1_000_000)} de menaces`,
    ],
    ['sv', 1, 'API har ett hot'],
    ['sv', 5, 'API har 5 hot'],
  ] as const)(
    'chooses the %s plural form for %d',
    (locale, count, expected) => {
      expect(
        shelfTranslator(locale).t('shelf.owned', { name: 'API', count }),
      ).toBe(expected);
    },
  );

  it('keeps a node parameter as the value given', () => {
    const link = { element: 'a' };
    expect(shelfTranslator('sv').parts('shelf.help', { link })).toEqual([
      'Läs ',
      link,
      ' om tangentbordet.',
    ]);
  });

  it.each([[['a', { element: 'b' }, 3]], [7]])(
    'passes the node parameter %j through as given, never formatted',
    (link) => {
      const [, given] = shelfTranslator('fr-CA').parts('shelf.help', { link });
      expect(given).toBe(link);
    },
  );

  it('lists every template with its locale, id and plural form', () => {
    const templates = catalogueTemplates(shelfCatalogues);
    expect(templates).toContainEqual({
      locale: 'fr-CA',
      id: 'shelf.threats',
      form: 'many',
      template: '{count} de menaces',
    });
    expect(
      templates.filter(({ template }) => !wellFormedTemplate(template)),
    ).toEqual([]);
  });

  it('lists the entries a locale words as en-CA does, a form en-CA lacks read against its other', () => {
    const shared = {
      menu: text(),
      description: text(),
      items: plural('count'),
    } as const;
    const same = sameAsDefault({
      'en-CA': {
        shared: catalogue(shared)('en-CA')({
          menu: 'Menu',
          description: 'Description',
          items: { one: 'One item', other: '{count} items' },
        }),
      },
      'fr-CA': {
        shared: catalogue(shared)('fr-CA')({
          menu: 'Menu',
          description: 'Description',
          items: {
            one: '{count} élément',
            many: '{count} items',
            other: '{count} éléments',
          },
        }),
      },
      sv: {
        shared: catalogue(shared)('sv')({
          menu: 'Meny',
          description: 'Beskrivning',
          items: { one: 'En sak', other: '{count} saker' },
        }),
      },
    });

    expect(same.map(({ locale, id, form }) => [locale, id, form])).toEqual([
      ['fr-CA', 'shared.menu', undefined],
      ['fr-CA', 'shared.description', undefined],
      ['fr-CA', 'shared.items', 'many'],
    ]);
  });
});
