import { text } from '@saerskriven/i18n';

/**
 * The register's headings, column and field names, and the lines it writes
 * in place of absent content. `field` joins a field's name to its value,
 * both as nodes, so each language places its own punctuation between them.
 * `flow-from-to` and `flow-between` name a flow left unlabelled by its ends,
 * and `free-point` is an end attached to nothing. `whole-model` stands among
 * a threat's elements where the threat applies to the model.
 */
export const registerMessages = {
  untitled: text(),
  titled: text({ title: 'text' }),
  threat: text({ number: 'text', title: 'text' }),
  number: text(),
  title: text(),
  elements: text(),
  'whole-model': text(),
  category: text(),
  severity: text(),
  status: text(),
  flags: text(),
  description: text(),
  field: text({ label: 'node', value: 'node' }),
  none: text(),
  'none-recorded': text(),
  'no-threats': text(),
  'flow-from-to': text({ source: 'text', target: 'text' }),
  'flow-between': text({ source: 'text', target: 'text' }),
  'free-point': text(),
  diagrams: text(),
  'diagram-empty': text(),
  'diagram-free-endpoint': text(),
  'diagram-note': text(),
  'diagram-reference': text({ label: 'text' }),
  'diagram-out-of-scope': text({ label: 'text' }),
  'diagram-omitted-boundaries': text({ names: 'text' }),
  'diagram-substituted-references': text({ names: 'text' }),
} as const;
