import { plural, text } from '@saerskriven/i18n';

/** The failure notice. */
export const noticeMessages = {
  dismiss: text(),
  'refusal-details': plural('count'),
} as const;
