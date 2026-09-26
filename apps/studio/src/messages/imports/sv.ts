import { catalogue } from '@saerskriven/i18n';
import { importMessages } from './contract.js';

export const importsSv = catalogue(importMessages)('sv')({
  'import-format-unnamed':
    'en import kräver en OTM-version eller en TM-BOM-schemaadress (versioner som stöds: OTM {otm}, TM-BOM {tmbom})',
  'otm-parent-not-single':
    'ett överordnat element namnger exakt en förtroendezon eller en komponent',
  'duplicate-identifier': 'identifieraren ”{id}” används två gånger',
  'source-component-unknown':
    'källdokumentet deklarerar ingen komponent ”{id}”',
  'source-asset-unknown': 'källdokumentet deklarerar ingen tillgång ”{id}”',
  'source-threat-unknown': 'källdokumentet deklarerar inget hot ”{id}”',
  'source-mitigation-unknown': 'källdokumentet deklarerar ingen åtgärd ”{id}”',
  'source-trust-zone-unknown':
    'källdokumentet deklarerar ingen förtroendezon ”{id}”',
  'source-endpoint-unknown': 'källdokumentet deklarerar ingen ändpunkt ”{id}”',
  'source-data-store-unknown':
    'källdokumentet deklarerar inget datalager ”{id}”',
});
