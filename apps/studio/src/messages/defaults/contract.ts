import { text } from '@saerskriven/i18n';

/**
 * The names newly created things are given. Most are written in the active
 * language at creation and are model content from then on, so a later
 * change of language never rewrites one. `untitled-model` and
 * `untitled-file` are the exceptions: they propose a document title or a
 * save or export file name afresh each time one is needed, since neither is
 * model content.
 */
export const defaultMessages = {
  'untitled-model': text(),
  'untitled-diagram': text(),
  'untitled-file': text(),
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
