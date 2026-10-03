import type { FormatName, ImportFormat } from '@saerskriven/formats';

/**
 * The name each format Open reads goes by on screen. A format's name is a
 * proper name, the same in every language, so a message takes it as a
 * parameter.
 */
export const formatNames = {
  'threat-dragon': 'Threat Dragon JSON',
  'saerskriven-yaml': 'Saerskriven YAML',
  otm: 'OTM',
  tmbom: 'TM-BOM',
} as const satisfies Record<FormatName | ImportFormat, string>;
