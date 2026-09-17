import { catalogue } from '@saerskriven/i18n';
import { noticeMessages } from './contract.js';

export const noticeFrCA = catalogue(noticeMessages)('fr-CA')({
  dismiss: 'Masquer le problème',
  'refusal-details': {
    one: '{count} détail du refus',
    many: '{count} de détails du refus',
    other: '{count} détails du refus',
  },
});
