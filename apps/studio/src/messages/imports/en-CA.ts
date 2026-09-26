import { catalogue } from '@saerskriven/i18n';
import { importMessages } from './contract.js';

export const importsEnCA = catalogue(importMessages)('en-CA')({
  'import-format-unnamed':
    'an import needs an OTM version stamp or a TM-BOM schema URI (supported versions: OTM {otm}, TM-BOM {tmbom})',
  'otm-parent-not-single': 'a parent names exactly one trust zone or component',
  'duplicate-identifier': 'the identifier "{id}" is used twice',
  'source-component-unknown':
    'the source document declares no component "{id}"',
  'source-asset-unknown': 'the source document declares no asset "{id}"',
  'source-threat-unknown': 'the source document declares no threat "{id}"',
  'source-mitigation-unknown':
    'the source document declares no mitigation "{id}"',
  'source-trust-zone-unknown':
    'the source document declares no trust zone "{id}"',
  'source-endpoint-unknown': 'the source document declares no endpoint "{id}"',
  'source-data-store-unknown':
    'the source document declares no data store "{id}"',
});
