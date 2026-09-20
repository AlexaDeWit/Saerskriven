import { catalogue } from '@saerskriven/i18n';
import { issueMessages } from './contract.js';

export const issuesEnCA = catalogue(issueMessages)('en-CA')({
  line: '{path}: {detail}',
  'line-root': 'the whole document: {detail}',
  'kind-string': 'a text',
  'kind-number': 'a number',
  'kind-integer': 'a whole number',
  'kind-boolean': 'a true or false value',
  'kind-array': 'a list',
  'kind-object': 'an object',
  'kind-date': 'a date',
  'kind-null': 'the null value',
  'kind-undefined': 'a missing value',
  'kind-other': 'a value of another kind',
  'format-regex': 'the text does not match the pattern the schema declares',
  'format-url': 'the text is not a web address',
  'format-date': 'the text is not an ISO date',
  'format-datetime': 'the text is not an ISO date and time',
  'format-other': 'the text does not match the format the schema declares',
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
  'type-mismatch': 'should be {expected} but is {received}',
  'value-unexpected': 'expected one of {values}',
  'option-unmatched': 'no declared option accepts this value',
  'too-small-characters': {
    one: 'expected at least {bound} character',
    other: 'expected at least {bound} characters',
  },
  'too-small-items': {
    one: 'expected at least {bound} entry',
    other: 'expected at least {bound} entries',
  },
  'too-small-value': 'expected at least {bound}',
  'too-small-above': 'expected more than {bound}',
  'too-big-characters': {
    one: 'expected at most {bound} character',
    other: 'expected at most {bound} characters',
  },
  'too-big-items': {
    one: 'expected at most {bound} entry',
    other: 'expected at most {bound} entries',
  },
  'too-big-value': 'expected at most {bound}',
  'too-big-below': 'expected less than {bound}',
  'value-refused': 'the value is not accepted here',
  'operation-unknown': 'no operation of this server applies it',
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
  'import-format-unnamed':
    'an import needs an OTM version stamp or a TM-BOM schema URI',
  'issue-flood': 'the file has more problems than a parse can list',
  'schema-threw': 'the parse stopped before it could report what is wrong',
});
