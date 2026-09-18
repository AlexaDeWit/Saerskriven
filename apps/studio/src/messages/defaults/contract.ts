import { text } from '@saerskriven/i18n';

/**
 * The names newly created things are given. They are written in the active
 * language at creation and are model content from then on, so a later change
 * of language never rewrites one.
 */
export const defaultMessages = {
  'untitled-model': text(),
  'untitled-diagram': text(),
  'new-actor': text(),
  'new-process': text(),
  'new-store': text(),
  'new-note': text(),
  'new-note-text': text(),
  'new-boundary-box': text(),
  'new-boundary-curve': text(),
  'new-flow': text(),
  'new-threat': text(),
} as const;
