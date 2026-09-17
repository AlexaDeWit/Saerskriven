import { categoryTranslations } from './threat-dragon-locales.js';
import { localeCategories } from './corpus.fixtures.js';

const english = localeCategories['en'] ?? {};

const translated = (
  section: string,
  categories?: readonly string[],
): Record<string, string> =>
  Object.fromEntries(
    Object.values(localeCategories).flatMap((sections) =>
      Object.entries(sections[section] ?? {}).flatMap(([key, label]) => {
        const target = english[section]?.[key];
        return key === 'header' ||
          target === undefined ||
          label === target ||
          (categories !== undefined && !categories.includes(key))
          ? []
          : [[label, target] as const];
      }),
    ),
  );

describe('the vendored locale tables', () => {
  it('are every language and every methodology Threat Dragon ships', () => {
    expect(new Set(Object.keys(localeCategories))).toEqual(
      new Set([
        'ar',
        'de',
        'el',
        'en',
        'es',
        'fi',
        'fr',
        'hi',
        'id',
        'ja',
        'ms',
        'pt',
        'pt-br',
        'ru',
        'uk',
        'zh',
      ]),
    );
    expect(new Set(Object.keys(english))).toEqual(
      new Set(['cia', 'ciadie', 'eop', 'linddun', 'plot4ai', 'stride']),
    );
  });

  it('still give PLOT4ai two categories one word, which keeps it out', () => {
    expect(localeCategories['hi']?.['plot4ai']?.['security']).toBe(
      localeCategories['hi']?.['plot4ai']?.['safety'],
    );
    expect(localeCategories['ms']?.['plot4ai']?.['security']).toBe(
      localeCategories['ms']?.['plot4ai']?.['safety'],
    );
  });
});

describe('categoryTranslations', () => {
  it('recovers the four methodologies the model enumerates, and no others', () => {
    expect(Object.keys(categoryTranslations)).toEqual([
      'stride',
      'linddun',
      'cia',
      'die',
    ]);
  });

  it.each([
    { named: 'STRIDE', methodology: 'stride', section: 'stride' },
    { named: 'LINDDUN', methodology: 'linddun', section: 'linddun' },
    { named: 'CIA', methodology: 'cia', section: 'cia' },
    {
      named: 'DIE',
      methodology: 'die',
      section: 'ciadie',
      categories: ['distributed', 'immutable', 'ephemeral'],
    },
  ] as const)(
    'holds every translated $named label and nothing else',
    ({ methodology, section, categories }) => {
      expect(categoryTranslations[methodology]).toEqual(
        translated(section, categories),
      );
    },
  );

  it('keeps the trailing space Threat Dragon wrote into a Spanish label', () => {
    expect(
      categoryTranslations.linddun[
        'Disclosure of information / Brecha de información '
      ],
    ).toBe('Disclosure of information');
  });
});
