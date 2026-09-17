import { catalogue } from './catalogue.js';
import { plural, text } from './contract.js';
import {
  sections,
  shelf,
  shelfCatalogues,
  shelfTranslator,
} from './i18n.fixtures.js';
import { translator } from './translator.js';

const counted = { threats: plural('count') } as const;
const titled = { named: text({ title: 'text' }) } as const;
const pair = { opened: text(), closed: text() } as const;

describe('catalogue declarations the typecheck refuses', () => {
  it('refuses a message missing from a locale', () => {
    // @ts-expect-error fr-CA declares no `closed`
    const declared = catalogue(pair)('fr-CA')({
      opened: 'Ouvert.',
    });
    expect(declared.messages).toEqual({ opened: 'Ouvert.' });
  });

  it('refuses a message outside the contract', () => {
    const declared = catalogue(pair)('sv')({
      opened: 'Öppnad.',
      closed: 'Stängd.',
      // @ts-expect-error the contract declares no `renamed`
      renamed: 'Omdöpt.',
    });
    expect(declared.messages).toHaveProperty('renamed');
  });

  it('refuses a placeholder the message does not declare', () => {
    const declared = catalogue(titled)('fr-CA')({
      // @ts-expect-error `{titre}` is not the declared `title`
      named: 'Affichage de {titre}.',
    });
    expect(declared.messages).toHaveProperty('named');
  });

  it('refuses a template that drops a declared parameter', () => {
    const declared = catalogue(titled)('en-CA')({
      // @ts-expect-error the template leaves out `{title}`
      named: 'Showing the diagram.',
    });
    expect(declared.messages).toHaveProperty('named');
  });

  it('refuses a plural form naming an undeclared parameter', () => {
    const declared = catalogue(counted)('sv')({
      threats: {
        one: 'Ett hot',
        // @ts-expect-error `{antal}` is not the declared `count`
        other: '{antal} hot',
      },
    });
    expect(declared.messages).toHaveProperty('threats');
  });

  it('refuses a French plural without its many form', () => {
    const declared = catalogue(counted)('fr-CA')({
      // @ts-expect-error fr-CA requires `one`, `many` and `other`
      threats: {
        one: '{count} menace',
        other: '{count} menaces',
      },
    });
    expect(declared.messages).toHaveProperty('threats');
  });

  it('refuses a plural form the locale does not have', () => {
    const declared = catalogue(counted)('en-CA')({
      threats: {
        one: 'One threat',
        // @ts-expect-error en-CA has no `many` category
        many: '{count} threats',
        other: '{count} threats',
      },
    });
    expect(declared.messages).toHaveProperty('threats');
  });

  it('refuses a brace outside a placeholder', () => {
    const declared = catalogue(titled)('en-CA')({
      // @ts-expect-error the brace before `title` is never closed
      named: 'Showing {{title}.',
    });
    expect(declared.messages).toHaveProperty('named');
  });

  it('refuses a template that is not a string literal', () => {
    const widened: string = 'Showing {title}.';
    const declared = catalogue(titled)('en-CA')({
      // @ts-expect-error the placeholders of a `string` cannot be checked
      named: widened,
    });
    expect(declared.messages).toHaveProperty('named');
  });

  it('refuses a plural form that drops a parameter other than the count', () => {
    const declared = catalogue({ owned: shelf.owned })('fr-CA')({
      owned: {
        one: '{name} a une menace',
        // @ts-expect-error only the count may be left out, and `{name}` is missing
        many: 'Beaucoup de menaces',
        other: '{name} a {count} menaces',
      },
    });
    expect(declared.messages).toHaveProperty('owned');
  });

  it('refuses a catalogue written without catalogue()', () => {
    const written = translator(
      sections,
      {
        ...shelfCatalogues,
        sv: {
          // @ts-expect-error only catalogue() marks a catalogue as checked
          shelf: {
            locale: 'sv',
            messages: {
              ...shelfCatalogues.sv.shelf.messages,
              named: 'Visar {titel} <b>x</b>',
            },
          },
        },
      },
      'sv',
    );
    expect(written.locale).toBe('sv');
  });

  it('refuses a section name holding a dot', () => {
    const dotted = translator(
      {
        // @ts-expect-error a message id splits at the first dot
        'shelf.v2': shelf,
      },
      {
        'en-CA': { 'shelf.v2': shelfCatalogues['en-CA'].shelf },
        'fr-CA': { 'shelf.v2': shelfCatalogues['fr-CA'].shelf },
        sv: { 'shelf.v2': shelfCatalogues.sv.shelf },
      },
      'en-CA',
    );
    expect(dotted.locale).toBe('en-CA');
  });

  it("refuses one locale's catalogue in place of another's", () => {
    const swapped = translator(
      sections,
      {
        ...shelfCatalogues,
        // @ts-expect-error sv's catalogue is not en-CA's, though its forms match
        'en-CA': shelfCatalogues.sv,
      },
      'en-CA',
    );
    expect(swapped.locale).toBe('en-CA');
  });
});

describe('message calls the typecheck refuses', () => {
  const { t } = shelfTranslator('sv');

  it('refuses a wrong parameter name', () => {
    // @ts-expect-error `titel` is not the declared `title`
    expect(t('shelf.named', { titel: 'Huvud' })).toBeTypeOf('string');
  });

  it('refuses a wrong parameter type', () => {
    // @ts-expect-error a count is a number
    expect(t('shelf.threats', { count: '3' })).toBe('3 hot');
  });

  it('refuses a missing parameter record', () => {
    // @ts-expect-error `shelf.named` takes a title
    expect(t('shelf.named')).toBeTypeOf('string');
  });

  it('refuses parameters on a message without any', () => {
    // @ts-expect-error `shelf.opened` takes no parameters
    expect(t('shelf.opened', { title: 'Huvud' })).toBe('Öppnad.');
  });

  it('refuses an id outside the contract', () => {
    // @ts-expect-error `shelf.opne` is not a message
    const call = () => t('shelf.opne');
    expect(call).toBeTypeOf('function');
  });

  it('refuses a message with a node parameter as text', () => {
    // @ts-expect-error `shelf.help` renders its link as a node
    expect(t('shelf.help', { link: 'docs' })).toBe(
      'Läs docs om tangentbordet.',
    );
  });

  it('resolves a message to a string', () => {
    expectTypeOf(t('shelf.opened')).toEqualTypeOf<string>();
    // @ts-expect-error a resolved message is never undefined
    const absent: undefined = t('shelf.opened');
    expect(absent).toBe('Öppnad.');
  });
});
