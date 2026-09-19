import { text } from '@saerskriven/i18n';

const endpoint = { flow: 'text', element: 'text' } as const;

/**
 * The warning a caller writes beside a drawing that left a flow out: its
 * headline, then one line per endpoint naming an element drawn as no box.
 */
export const warningMessages = {
  unplaced: text(),
  'unplaced-source': text(endpoint),
  'unplaced-target': text(endpoint),
} as const;
