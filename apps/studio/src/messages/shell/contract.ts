import { text } from '@saerskriven/i18n';

/** The studio shell: the language control and the browser tab's name. */
export const shellMessages = {
  language: text(),
  'follow-browser': text(),
  'landing-title': text(),
  'development-version': text({ version: 'text' }),
} as const;
