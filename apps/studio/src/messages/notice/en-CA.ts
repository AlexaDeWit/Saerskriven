import { catalogue } from '@saerskriven/i18n';
import { noticeMessages } from './contract.js';

export const noticeEnCA = catalogue(noticeMessages)('en-CA')({
  problems: 'Problems',
  dismiss: 'Dismiss problem',
  'refusal-details': {
    one: '{count} refusal detail',
    other: '{count} refusal details',
  },
  'operation-refused': 'The model refused the edit.',
  'file-unreachable': 'Saerskriven could not reach the file.',
  'recovery-rejected': 'Saerskriven rejected the stored recovery snapshot.',
  'recovery-unavailable': 'Local recovery is unavailable.',
  'no-format-claimed': 'No format claimed {name}.',
  'formats-tried': 'Saerskriven tried {formats}.',
  'read-limit': '{name} is past a read bound, so nothing read it.',
  'read-limit-detail':
    '{limit}: the bound is {bound}, the file reached {observed}.',
  'malformed-text': '{name} is not valid text of the format that claimed it.',
  'invalid-document':
    '{name} is not a valid document of the format that claimed it.',
  'invalid-model':
    '{name} is a valid document, and the model it maps to is not.',
  'snapshot-limit-detail':
    '{limit}: the bound is {bound}, the snapshot reached {observed}.',
  'snapshot-unsupported': 'The stored snapshot is malformed or unsupported.',
  'snapshot-earlier-release':
    'An earlier release of Saerskriven stored this session, in a form this release cannot restore.',
  'snapshot-release':
    'Saerskriven {release} stored this session, in a form this release cannot restore.',
  'field-not-saved': '{field} was not saved.',
  'refused-character': 'Character {position} is one the model does not accept.',
  'empty-name': 'A name cannot be empty.',
  'op-element-properties': 'The element properties were refused.',
  'op-element-relationships': 'The element has invalid boundary relationships.',
  'op-fragment': 'The copied graph was refused.',
  'op-unknown-diagram': 'The model holds no diagram {id}.',
  'op-duplicate-diagram': 'The model already holds a diagram {id}.',
  'op-empty-title': 'Diagram {id} cannot be left without a title.',
  'op-title-character':
    'The title for diagram {id} carries a character the model does not accept.',
  'op-diagram-not-empty': {
    one: 'Diagram {id} cannot be removed while it holds elements, and it holds {count}.',
    other:
      'Diagram {id} cannot be removed while it holds elements, and it holds {count}.',
  },
  'op-unknown-element': 'The model holds no element {id}.',
  'op-unknown-threat': 'The model holds no threat {id}.',
  'op-unknown-mitigation': 'The model holds no mitigation {id}.',
  'op-unknown-assumption': 'The model holds no assumption {id}.',
  'op-duplicate-element': 'The model already holds an element {id}.',
  'op-duplicate-threat': 'The model already holds a threat {id}.',
  'op-duplicate-mitigation': 'The model already holds a mitigation {id}.',
  'op-duplicate-assumption': 'The model already holds an assumption {id}.',
  'op-mitigation-without-threat':
    'The mitigation {id} links no threat, and a mitigation is added on a threat.',
  'op-assumption-without-threat':
    'The assumption {id} links no threat, and an assumption is added on a threat.',
  'op-assumption-without-reference':
    'The assumption {id} links no threat and does not apply to the model.',
  'op-reused-number': 'Threat number {number} was issued already.',
  'op-changed-number':
    'Threat {id} cannot take number {number}, a number being issued once.',
  'op-source-endpoint': 'The flow’s source names {id}, which cannot be one.',
  'op-target-endpoint': 'The flow’s target names {id}, which cannot be one.',
  'op-not-resizable': 'Element {id} has no size to set.',
  'op-not-note': 'Element {id} is not a canvas note.',
  'op-not-flow': 'Element {id} is not a flow.',
  'op-empty-name': 'Element {id} cannot be left without a name.',
  'op-element-character':
    'The text for element {id} carries a character the model does not accept.',
  'op-model-title-character':
    'The model title carries a character the model does not accept.',
  'op-model-owner-character':
    'The model owner carries a character the model does not accept.',
  'op-model-description-character':
    'The model description carries a character the model does not accept.',
  'op-contributor-character':
    'Entry {entry} of the contributors carries a character the model does not accept.',
});
