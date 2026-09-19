import { catalogue } from '@saerskriven/i18n';
import { warningMessages } from './contract.js';

export const warningSv = catalogue(warningMessages)('sv')({
  unplaced:
    'varning: en flödesände anger ett objekt som arbetsytan inte ritar som en ruta, så flödet finns inte med i ritningen.',
  'unplaced-source': 'källan för flöde {flow} anger {element}',
  'unplaced-target': 'målet för flöde {flow} anger {element}',
});
