import { catalogue } from '@saerskriven/i18n';
import { noticeMessages } from './contract.js';

export const noticeEnCA = catalogue(noticeMessages)('en-CA')({
  dismiss: 'Dismiss problem',
  'refusal-details': {
    one: '{count} refusal detail',
    other: '{count} refusal details',
  },
});
