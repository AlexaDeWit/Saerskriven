import { catalogue } from '@saerskriven/i18n';
import { panelMessages } from './contract.js';

export const panelSv = catalogue(panelMessages)('sv')({
  threats: 'Hot',
  'unlabelled-flow': 'Flöde {ends}',
  details: 'Detaljer',
  'close-threats': 'Stäng hoten',
  'widen-pane': 'Bredda panelen',
  'restore-pane-width': 'Återställ panelens bredd',
  'several-selected': {
    one: '{count} objekt är markerat. Markera ett av dem för att föra in ett hot på det.',
    other:
      '{count} objekt är markerade. Markera ett av dem för att föra in ett hot på det.',
  },
  'add-threat': 'Lägg till ett hot',
  'no-threats': 'Inga hot är införda på det här objektet.',
  'delete-threat': 'Ta bort hot {number}',
  'threat-spread': {
    one: 'Det här hotet nämner {count} objekt. Tas det bort försvinner det från alla.',
    other:
      'Det här hotet nämner {count} objekt. Tas det bort försvinner det från alla.',
  },
  'attached-elements': 'Kopplade objekt',
  'summary-severity': 'Allvarlighetsgrad: {severity}',
  'summary-status': 'Status: {status}',
  'summary-category': 'Kategori: {category}',
  'also-on-elements': 'Även på {list}',
  'security-properties': 'Säkerhetsegenskaper',
  'not-recorded-hint':
    'Ej angivet betyder att inget säkerhetspåstående är sparat.',
  'no-relationships': 'Inga relationer.',
  'no-valid-targets': 'Inga giltiga mål i det här diagrammet.',
  'add-relationship': 'Lägg till relation',
  remove: 'Ta bort',
  add: 'Lägg till',
  link: 'Länka',
  discard: 'Kasta',
  unlink: 'Ta bort länken',
  attach: 'Koppla',
  'also-applies-to-model': 'Gäller även modellen.',
  'also-on-threats': {
    one: 'Även på hot {list}.',
    other: 'Även på hoten {list}.',
  },
  'also-on-other-threats': {
    one: 'Även på {count} annat hot.',
    other: 'Även på {count} andra hot.',
  },
  'mitigation-added': 'Tillagd',
  'assumption-added': 'Tillagt',
  'more-threats': '{count} till',
  'detail-threats': {
    one: 'hot {list}',
    other: 'hoten {list}',
  },
  'detail-applies-to-model': 'gäller modellen',
  'detail-no-elements': 'kopplat till inget objekt',
});
