import { text } from '@saerskriven/i18n';

/**
 * The register's headings, column and field names, and the lines it writes
 * in place of absent content. `field` joins a field's name to its value,
 * both as nodes, so each language places its own punctuation between them.
 */
export const registerMessages = {
  untitled: text(),
  titled: text({ title: 'text' }),
  threat: text({ number: 'text', title: 'text' }),
  'model-assumptions': text(),
  number: text(),
  title: text(),
  elements: text(),
  category: text(),
  severity: text(),
  status: text(),
  flags: text(),
  description: text(),
  mitigations: text(),
  assumptions: text(),
  field: text({ label: 'node', value: 'node' }),
  none: text(),
  'none-recorded': text(),
  'no-threats': text(),
} as const;
