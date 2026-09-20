import { catalogue } from '@saerskriven/i18n';
import { issueMessages } from './contract.js';

export const issuesSv = catalogue(issueMessages)('sv')({
  line: '{path}: {detail}',
  'line-root': 'Dokumentet som helhet: {detail}',
  'kind-string': 'en text',
  'kind-number': 'ett tal',
  'kind-integer': 'ett heltal',
  'kind-boolean': 'ett sant eller falskt värde',
  'kind-array': 'en lista',
  'kind-object': 'en post',
  'kind-date': 'ett datum',
  'kind-null': 'null',
  'kind-undefined': 'ingenting',
  'kind-other': 'ett värde av annat slag',
  'referent-component': 'komponent',
  'referent-asset': 'tillgång',
  'referent-threat': 'hot',
  'referent-mitigation': 'åtgärd',
  'referent-trust-zone': 'tillitszon',
  'referent-endpoint': 'ändpunkt',
  'referent-data-store': 'datalager',
  'type-mismatch': '{expected} väntades och {received} hittades',
  'value-unexpected': 'ett värde bland {values} väntades',
  'option-unmatched': 'inget deklarerat alternativ tar emot detta värde',
  'too-small-characters': {
    one: 'minst {bound} tecken väntades',
    other: 'minst {bound} tecken väntades',
  },
  'too-small-items': {
    one: 'minst {bound} post väntades',
    other: 'minst {bound} poster väntades',
  },
  'too-small-value': 'ett värde på minst {bound} väntades',
  'too-small-above': 'ett värde över {bound} väntades',
  'too-big-characters': {
    one: 'högst {bound} tecken väntades',
    other: 'högst {bound} tecken väntades',
  },
  'too-big-items': {
    one: 'högst {bound} post väntades',
    other: 'högst {bound} poster väntades',
  },
  'too-big-value': 'ett värde på högst {bound} väntades',
  'too-big-below': 'ett värde under {bound} väntades',
  'format-mismatch': 'texten följer inte formatet {format}',
  'value-refused': 'värdet tas inte emot här ({kind})',
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
    '”{id}” namnger ingen tillitsgräns i elementets eget diagram',
  'related-flow-unknown':
    '”{id}” namnger inget flöde i elementets eget diagram',
  'unknown-source-reference': 'källdokumentet deklarerar ingen {kind} ”{id}”',
  'import-format-unnamed':
    'en import kräver en OTM-version eller en TM-BOM-schemaadress',
  'issue-flood': 'filen bär fler problem än en tolkning kan räkna upp',
  'schema-threw': 'tolkningen stannade: {reason}',
});
