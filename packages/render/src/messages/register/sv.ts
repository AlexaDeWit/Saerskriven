import { catalogue } from '@saerskriven/i18n';
import { registerMessages } from './contract.js';

export const registerSv = catalogue(registerMessages)('sv')({
  untitled: 'Hotregister',
  titled: 'Hotregister för {title}',
  threat: 'Hot {number}: {title}',
  number: 'Nummer',
  title: 'Titel',
  elements: 'Objekt',
  category: 'Kategori',
  severity: 'Allvarlighet',
  status: 'Status',
  flags: 'Flaggor',
  description: 'Beskrivning',
  field: '{label}: {value}',
  none: 'Inga',
  'none-recorded': 'Inget angivet.',
  'no-threats': 'Inga hot är införda i den här modellen.',
});
