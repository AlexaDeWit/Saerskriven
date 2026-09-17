import { catalogue } from '@saerskriven/i18n';
import { noticeMessages } from './contract.js';

export const noticeSv = catalogue(noticeMessages)('sv')({
  dismiss: 'Dölj problemet',
  'refusal-details': {
    one: '{count} detalj om avvisningen',
    other: '{count} detaljer om avvisningen',
  },
});
