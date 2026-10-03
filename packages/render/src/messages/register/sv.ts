import { catalogue } from '@saerskriven/i18n';
import { registerMessages } from './contract.js';

export const registerSv = catalogue(registerMessages)('sv')({
  untitled: 'Hotregister',
  titled: 'Hotregister för {title}',
  threat: 'Hot {number}: {title}',
  number: 'Nummer',
  title: 'Titel',
  elements: 'Objekt',
  'whole-model': 'Hela modellen',
  category: 'Kategori',
  severity: 'Allvarlighetsgrad',
  status: 'Status',
  flags: 'Flaggor',
  description: 'Beskrivning',
  field: '{label}: {value}',
  none: 'Inga',
  'none-recorded': 'Inget angivet.',
  'no-threats': 'Inga hot är införda i den här modellen.',
  'flow-from-to': 'Flöde från {source} till {target}',
  'flow-between': 'Flöde mellan {source} och {target}',
  'free-point': 'en fri punkt',
});
