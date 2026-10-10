import { catalogue } from '@saerskriven/i18n';
import { divergenceMessages } from './contract.js';

export const divergenceEnCA = catalogue(divergenceMessages)('en-CA')({
  line: '{subject}: {detail}',
  repeated: { one: '{line}', other: '{line}, {count} times' },
  kept: '{line}. Saving back keeps it.',
  threat: 'threat {number} "{title}"',
  'threat-untitled': 'threat {number}',
  'subject-threat': 'Threat {number} "{title}"',
  'subject-threat-untitled': 'Threat {number}',
  'subject-actor': 'Actor',
  'subject-actor-named': 'Actor "{name}"',
  'subject-process': 'Process',
  'subject-process-named': 'Process "{name}"',
  'subject-store': 'Store',
  'subject-store-named': 'Store "{name}"',
  'subject-flow': 'Flow',
  'subject-flow-named': 'Flow "{name}"',
  'subject-text': 'Text',
  'subject-text-named': 'Text "{name}"',
  'subject-trust-boundary': 'Trust boundary',
  'subject-trust-boundary-named': 'Trust boundary "{name}"',
  'subject-mitigation': 'Mitigation "{title}"',
  'subject-mitigation-titled-on': 'Mitigation "{title}" on {threat}',
  'subject-mitigation-on': 'Mitigation on {threat}',
  'subject-mitigation-untitled': 'Mitigation',
  'subject-assumption-on': 'Assumption on {threat}',
  'subject-assumption-on-model': 'Assumption on the model',
  'subject-assumption': 'Assumption',
  'whole-threat': 'the whole threat',
  'whole-mitigation': 'the whole mitigation',
  'whole-assumption': 'the whole assumption',
  'split-into-copies': {
    one: 'one record, now {count} copy',
    other: 'one record, now {count} copies',
  },
  'note-name-dropped': 'its name',
  'scope-marking-dropped': 'its out-of-scope marking',
  'accents-dropped': {
    one: 'The accent on {count} element',
    other: 'The accents on {count} elements',
  },
  'accent-unknown': 'its accent "{accent}"',
  'size-raised':
    'its size {width} × {height}, now {writtenWidth} × {writtenHeight}',
  'threat-attachment-stray-text': 'its attachment to the text',
  'threat-attachment-stray-text-named': 'its attachment to the text "{name}"',
  'threat-attachment-stray-trust-boundary':
    'its attachment to the trust boundary',
  'threat-attachment-stray-trust-boundary-named':
    'its attachment to the trust boundary "{name}"',
  'threat-attachment-stray-unknown': 'its attachment to a missing element',
  'threat-model-link-dropped': 'its attachment to the whole model',
  'threat-category-unnamed': 'its category, which reopens as a custom one',
  'mitigation-records-merged': {
    one: 'its {count} mitigation, now one without a title',
    other: 'its {count} mitigations, now one without a title',
  },
  'mitigation-title-merged': 'its mitigation title, now part of the text',
  'mitigation-status-dropped': '{status}, reopens as {inferred}',
  'threat-status-unmapped': 'its status "{status}"',
  'threat-severity-unmapped': 'its severity "{severity}"',
  'threat-category-eop-suit': 'its Elevation of Privilege card',
  'threat-category-unmapped':
    'its category "{category}", read as a custom category',
  'key-undeclared': 'Key {path}: not read',
  'assumption-element-links-dropped': 'its links to elements',
  'otm-threat-split': 'copied for another occurrence',
  'otm-threat-status-unmapped':
    'its status "{status}", read as open and kept in its description',
  'otm-mitigation-split': 'copied for another occurrence',
  'otm-mitigation-status-retained':
    'its status "{status}", read as proposed and kept in its description',
  'otm-mitigation-unlinked':
    'Mitigation "{id}": on no threat, now a line of the model description',
  'otm-assets-as-descriptions':
    'Assets: now descriptions on flows and components, no longer shared',
  'otm-components-as-processes':
    'Component types: now processes, kept in the descriptions',
  'tmbom-control-proposed':
    'its status, read as proposed and kept in its description',
  'tmbom-control-unlinked':
    'Control "{name}": on no threat, now a line of the model description',
  'tmbom-flow-fields-as-prose':
    'Flow encryption and sensitivity: now description text',
  'tmbom-data-set-as-prose':
    'Data set "{name}": now text on its stores, no longer shared',
  'tmbom-data-set-dropped': 'Data set "{name}": on no store, not read',
  'field-not-retained': 'Field {path}: not read',
});
