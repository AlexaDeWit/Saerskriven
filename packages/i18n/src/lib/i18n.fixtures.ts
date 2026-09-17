import { catalogue } from './catalogue.js';
import { plural, text } from './contract.js';
import { translator } from './translator.js';

export const shelf = {
  opened: text(),
  named: text({ title: 'text' }),
  tried: text({ name: 'text', formats: 'list' }),
  threats: plural('count'),
  owned: plural('count', { name: 'text' }),
  help: text({ link: 'node' }),
} as const;

export const sections = { shelf } as const;

export const shelfCatalogues = {
  'en-CA': {
    shelf: catalogue(shelf)('en-CA')({
      opened: 'Opened.',
      named: 'Showing {title}.',
      tried: 'No format read {name}. Tried {formats}.',
      threats: { one: 'One threat', other: '{count} threats' },
      owned: {
        one: '{name} has one threat',
        other: '{name} has {count} threats',
      },
      help: 'Read {link} for the keyboard.',
    }),
  },
  'fr-CA': {
    shelf: catalogue(shelf)('fr-CA')({
      opened: 'Ouvert.',
      named: 'Affichage de {title}.',
      tried: 'Aucun format n’a lu {name}. Essayé : {formats}.',
      threats: {
        one: '{count} menace',
        many: '{count} de menaces',
        other: '{count} menaces',
      },
      owned: {
        one: '{name} a {count} menace',
        many: '{name} a {count} de menaces',
        other: '{name} a {count} menaces',
      },
      help: 'Consultez {link} pour le clavier.',
    }),
  },
  sv: {
    shelf: catalogue(shelf)('sv')({
      opened: 'Öppnad.',
      named: 'Visar {title}.',
      tried: 'Inget format läste {name}. Försökte med {formats}.',
      threats: { one: 'Ett hot', other: '{count} hot' },
      owned: { one: '{name} har ett hot', other: '{name} har {count} hot' },
      help: 'Läs {link} om tangentbordet.',
    }),
  },
} as const;

export const shelfTranslator = (locale: 'en-CA' | 'fr-CA' | 'sv') =>
  translator(sections, shelfCatalogues, locale);
