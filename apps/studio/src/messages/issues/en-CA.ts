import { catalogue } from '@saerskriven/i18n';
import { issueMessages } from './contract.js';

export const issuesEnCA = catalogue(issueMessages)('en-CA')({
  line: '{path}: {detail}',
  'line-root': 'The document as a whole: {detail}',
  'kind-string': 'a text',
  'kind-number': 'a number',
  'kind-integer': 'a whole number',
  'kind-boolean': 'a true or false value',
  'kind-array': 'a list',
  'kind-object': 'a record',
  'kind-date': 'a date',
  'kind-null': 'null',
  'kind-undefined': 'nothing',
  'kind-other': 'another kind of value',
  'referent-component': 'component',
  'referent-asset': 'asset',
  'referent-threat': 'threat',
  'referent-mitigation': 'mitigation',
  'referent-trust-zone': 'trust zone',
  'referent-endpoint': 'endpoint',
  'referent-data-store': 'data store',
  'type-mismatch': 'expected {expected} and found {received}',
  'value-unexpected': 'expected one of {values}',
  'option-unmatched': 'no declared option accepts this value',
  'too-small-characters': {
    one: 'expected at least {bound} character',
    other: 'expected at least {bound} characters',
  },
  'too-small-items': {
    one: 'expected at least {bound} item',
    other: 'expected at least {bound} items',
  },
  'too-small-value': 'expected at least {bound}',
  'too-small-above': 'expected more than {bound}',
  'too-big-characters': {
    one: 'expected at most {bound} character',
    other: 'expected at most {bound} characters',
  },
  'too-big-items': {
    one: 'expected at most {bound} item',
    other: 'expected at most {bound} items',
  },
  'too-big-value': 'expected at most {bound}',
  'too-big-below': 'expected less than {bound}',
  'format-mismatch': 'the text does not match the {format} format',
  'value-refused': 'the value is not accepted here ({kind})',
  'text-character-refused': 'the text carries a character the model refuses',
  'element-kind-changed': 'the properties must match the element kind',
  'duplicate-element-id':
    'the element id "{id}" is already used, and element ids are unique across the model',
  'duplicate-diagram-id':
    'the diagram id "{id}" is already used, and diagram ids are unique across the model',
  'duplicate-threat-id':
    'the threat id "{id}" is already used, and threat ids are unique among threats',
  'duplicate-mitigation-id':
    'the mitigation id "{id}" is already used, and mitigation ids are unique among mitigations',
  'duplicate-assumption-id':
    'the assumption id "{id}" is already used, and assumption ids are unique among assumptions',
  'duplicate-identifier': 'the identifier "{id}" is used twice',
  'duplicate-threat-number':
    'the threat number {number} is already used, and threat numbers are unique across the model',
  'threat-number-above-issued':
    'the threat number {number} is above the last issued number {issued}',
  'flow-endpoint-self':
    'the flow names its own id "{id}", and a flow cannot anchor to itself',
  'flow-endpoint-foreign':
    'the element "{id}" is not in the flow’s own diagram',
  'unknown-element-reference': 'no element of the model has the id "{id}"',
  'unknown-threat-reference': 'no threat of the model has the id "{id}"',
  'related-element-unknown':
    '"{id}" names no other element of the element’s own diagram',
  'related-boundary-unknown':
    '"{id}" names no trust boundary of the element’s own diagram',
  'related-flow-unknown': '"{id}" names no flow of the element’s own diagram',
  'unknown-source-reference': 'the source document declares no {kind} "{id}"',
  'import-format-unnamed':
    'an import needs an OTM version stamp or a TM-BOM schema URI',
  'issue-flood': 'the file has more problems than a parse can list',
  'schema-threw': 'the parse stopped: {reason}',
});
