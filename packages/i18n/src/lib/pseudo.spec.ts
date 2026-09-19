import { shelfCatalogues, sections } from './i18n.fixtures.js';
import { pseudoMarkers, pseudoText, pseudoTranslator } from './pseudo.js';

const { t, parts } = pseudoTranslator(sections, shelfCatalogues);

const unmarked = (text: string): string => text.replaceAll(/⟦[^⟧]*⟧/gu, '');

describe('the pseudo-locale', () => {
  it('marks, accents and lengthens a literal', () => {
    const marked = pseudoText('Opened.');

    expect(marked.startsWith(pseudoMarkers.open)).toBe(true);
    expect(marked.endsWith(pseudoMarkers.close)).toBe(true);
    expect(marked).not.toContain('Opened');
    expect(marked.length).toBeGreaterThan('Opened.'.length * 1.4);
  });

  it('leaves an empty literal empty', () => {
    expect(pseudoText('')).toBe('');
  });

  it('reads the en-CA template and leaves a parameter value unmarked', () => {
    const title = 'Kafé {title}';

    expect(unmarked(t('shelf.named', { title }))).toBe(title);
    expect(unmarked(t('shelf.opened'))).toBe('');
  });

  it('chooses the en-CA plural form by count', () => {
    expect(t('shelf.threats', { count: 1 })).toBe(pseudoText('One threat'));
    expect(unmarked(t('shelf.threats', { count: 3 }))).toBe('3');
  });

  it('keeps a node parameter as given', () => {
    const link = { element: 'a' };

    expect(parts('shelf.help', { link })).toContain(link);
  });
});
