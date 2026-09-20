import { catalogue } from '@saerskriven/i18n';
import { issueMessages } from './contract.js';

export const issuesSv = catalogue(issueMessages)('sv')({
  line: '{path}: {detail}',
  'line-root': 'hela dokumentet: {detail}',
  'kind-string': 'en text',
  'kind-number': 'ett tal',
  'kind-integer': 'ett heltal',
  'kind-boolean': 'ett sant eller falskt värde',
  'kind-array': 'en lista',
  'kind-object': 'ett objekt',
  'kind-date': 'ett datum',
  'kind-null': 'nullvärdet',
  'kind-undefined': 'ett värde som saknas',
  'kind-other': 'ett värde av annat slag',
  'format-regex': 'texten följer inte mönstret som schemat deklarerar',
  'format-url': 'texten är inte en webbadress',
  'format-date': 'texten är inte ett ISO-datum',
  'format-datetime': 'texten är inte ett ISO-datum med tid',
  'format-other': 'texten följer inte formatet som schemat deklarerar',
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
  'type-mismatch': 'ska vara {expected} men är {received}',
  'value-unexpected': 'ett värde bland {values} väntades',
  'option-unmatched': 'inget deklarerat alternativ tar emot detta värde',
  'too-small-characters': {
    one: 'minst {bound} tecken väntades',
    other: 'minst {bound} tecken väntades',
  },
  'too-small-items': {
    one: 'minst {bound} värde väntades',
    other: 'minst {bound} värden väntades',
  },
  'too-small-value': 'ett värde på minst {bound} väntades',
  'too-small-above': 'ett värde över {bound} väntades',
  'too-big-characters': {
    one: 'högst {bound} tecken väntades',
    other: 'högst {bound} tecken väntades',
  },
  'too-big-items': {
    one: 'högst {bound} värde väntades',
    other: 'högst {bound} värden väntades',
  },
  'too-big-value': 'ett värde på högst {bound} väntades',
  'too-big-below': 'ett värde under {bound} väntades',
  'value-refused': 'värdet tas inte emot här',
  'operation-unknown': 'ingen operation i den här servern utför den',
  'text-character-refused': 'texten bär ett tecken som modellen avvisar',
  'element-kind-changed': 'egenskaperna måste stämma med elementets slag',
  'duplicate-element-id':
    'element-id:t ”{id}” är redan taget, och element-id är unika i hela modellen',
  'duplicate-diagram-id':
    'diagram-id:t ”{id}” är redan taget, och diagram-id är unika i hela modellen',
  'duplicate-threat-id':
    'hot-id:t ”{id}” är redan taget, och hot-id är unika bland hoten',
  'duplicate-mitigation-id':
    'åtgärds-id:t ”{id}” är redan taget, och åtgärds-id är unika bland åtgärderna',
  'duplicate-assumption-id':
    'antagande-id:t ”{id}” är redan taget, och antagande-id är unika bland antagandena',
  'duplicate-identifier': 'identifieraren ”{id}” används två gånger',
  'duplicate-threat-number':
    'hotnumret {number} är redan taget, och hotnummer är unika i hela modellen',
  'threat-number-above-issued':
    'hotnumret {number} ligger över det senast utdelade numret {issued}',
  'flow-endpoint-self':
    'flödet namnger sitt eget id ”{id}”, och ett flöde kan inte fästa vid sig självt',
  'flow-endpoint-foreign': 'elementet ”{id}” finns inte i flödets eget diagram',
  'unknown-element-reference': 'inget element i modellen bär id:t ”{id}”',
  'unknown-threat-reference': 'inget hot i modellen bär id:t ”{id}”',
  'related-element-unknown':
    '”{id}” namnger inget annat element i elementets eget diagram',
  'related-boundary-unknown':
    '”{id}” namnger ingen förtroendegräns i elementets eget diagram',
  'related-flow-unknown':
    '”{id}” namnger inget flöde i elementets eget diagram',
  'import-format-unnamed':
    'en import kräver en OTM-version eller en TM-BOM-schemaadress',
  'issue-flood': 'filen bär fler problem än en tolkning kan räkna upp',
  'schema-threw': 'tolkningen stannade innan den kunde säga vad som är fel',
});
