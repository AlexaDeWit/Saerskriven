import { text } from '@saerskriven/i18n';

const identified = { id: 'text' } as const;

/**
 * What an import refused beside the parse issue codes, one message per
 * import issue code, with a message of its own for each source referent so
 * no locale composes a determiner or an agreeing participle onto a noun. OTM
 * and TM-BOM are proper names, and a release number is data the import
 * passed through.
 */
export const importMessages = {
  'import-format-unnamed': text({ otm: 'list', tmbom: 'list' }),
  'otm-parent-not-single': text(),
  'duplicate-identifier': text(identified),
  'source-component-unknown': text(identified),
  'source-asset-unknown': text(identified),
  'source-threat-unknown': text(identified),
  'source-mitigation-unknown': text(identified),
  'source-trust-zone-unknown': text(identified),
  'source-endpoint-unknown': text(identified),
  'source-data-store-unknown': text(identified),
} as const;
