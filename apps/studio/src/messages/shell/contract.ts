import { text } from '@saerskriven/i18n';

/**
 * The studio shell: the language control, the browser tab's name, and the
 * page shown when the studio stops.
 */
export const shellMessages = {
  language: text(),
  'follow-browser': text(),
  'landing-title': text(),
  'development-version': text({ version: 'text' }),
  stopped: text(),
  'stopped-explanation': text(),
  reload: text(),
} as const;
