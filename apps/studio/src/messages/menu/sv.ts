import { catalogue } from '@saerskriven/i18n';
import { menuMessages } from './contract.js';

export const menuSv = catalogue(menuMessages)('sv')({
  menu: 'Meny',
  'menu-unsaved': 'Meny, osparade ändringar',
  project: 'Projekt',
  'view-source': 'Visa källkoden på GitHub',
  cancel: 'Avbryt',
  'discard-and-open': 'Kasta ändringarna och öppna',
  'discard-and-import': 'Kasta ändringarna och importera',
  'discard-and-new': 'Kasta ändringarna och skapa en ny modell',
  'save-as-format': 'Spara som {format}',
  'file-state-dirty': '{name}, {format}, osparade ändringar',
  'file-state-clean': '{name}, {format}, inga osparade ändringar',
  arrange: 'Ordna',
  export: 'Exportera',
  appearance: 'Utseende',
  'appearance-chosen': 'Utseende {mode}',
  'snap-on': 'Fäst mot rutnätet: på',
  'snap-off': 'Fäst mot rutnätet: av',
  diagram: 'Diagram',
  'no-diagram': 'Inget diagram',
  'diagram-named': 'Diagram: {title}',
});
