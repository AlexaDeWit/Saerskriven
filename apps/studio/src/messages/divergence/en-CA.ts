import { catalogue } from '@saerskriven/i18n';
import { divergenceMessages } from './contract.js';

export const divergenceEnCA = catalogue(divergenceMessages)('en-CA')({
  line: '{subject}: {detail} ({reason})',
  'subject-model': 'model',
  'subject-diagram': 'diagram "{id}"',
  'subject-element': 'element "{id}"',
  'subject-threat': 'threat "{id}"',
  'subject-mitigation': 'mitigation "{id}"',
  'subject-assumption': 'assumption "{id}"',
  'reason-unrepresentable': 'no place in the format',
  'reason-undeclared': 'not declared by the wire schema',
  'reason-narrowed': 'reduced to fit the format',
  'reason-split': 'split by the format',
  'reason-overridden': 'not repeated by the codec',
  'reason-discarded-by-edit': 'removed by an edit',
  'release-restamped':
    'the release "{from}" the source was written by, for the {written} this codec writes',
  'threat-mark-raised-by-issue':
    'the threat high-water mark {from}, raised to {raised} to cover a number this write issued',
  'threat-mark-raised-to-issued':
    'the threat high-water mark {from}, raised to {raised}, the highest number the model has issued and no number in the file reaches',
  'diagram-mark-raised-by-issue':
    'the diagram high-water mark {from}, raised to {raised} to cover a number this write issued',
  'diagram-mark-raised-to-issued':
    'the diagram high-water mark {from}, raised to {raised}, the highest number the model has issued and no number in the file reaches',
  'assumption-unrecorded':
    'the assumption, which the format keeps no record of',
  'diagram-discarded': 'the diagram "{title}" the source document held',
  'threat-copy-detached':
    'the copy the source document nested under the cell "{cell}", which the model no longer attaches it to',
  'threat-discarded':
    'the threat "{title}" the source document nested under a cell the model kept',
  'note-name-dropped':
    'the name "{name}", which the format has one text for a note and no name beside it',
  'scope-marking-dropped':
    'the out-of-scope marking, which the format records on the elements a threat attaches to alone',
  'cell-reshaped':
    'what the source held on the {shape} cell of this id, which now draws a {kind}',
  'diagram-name-numbered':
    'the name, which the format numbers a diagram rather than naming one, written as {number}',
  'cell-discarded': 'the {shape} cell the source document held',
  'threat-attachment-stray':
    'the attachment to the {kind} "{element}", which the format nests a threat under an actor, a process, a store, or a flow alone',
  'threat-attachment-stray-unknown':
    'the attachment to the unknown "{element}", which the format nests a threat under an actor, a process, a store, or a flow alone',
  'threat-unplaceable':
    'the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under',
  'threat-split-across-elements': {
    one: 'the one record, written once under the {count} element it names',
    other:
      'the one record, written once under each of the {count} elements it names',
  },
  'threat-category-unnamed':
    'the {methodology} category "{category}", which Threat Dragon\'s own labels do not name',
  'mitigation-records-merged': {
    one: 'the {count} record merged into its one mitigation text, which reads back as one record with no title',
    other:
      'the {count} records merged into its one mitigation text, which reads back as one record with no title',
  },
  'mitigation-title-merged':
    'the mitigation title written into its one mitigation text, which reads back as one record with no title',
  'mitigation-empty-dropped':
    'the mitigation with no title and no text, which writes nothing into the text of the threat "{threat}"',
  'mitigation-status-dropped':
    'the status "{status}" in the text of the threat "{threat}", which reads back as "{inferred}"',
  'mitigation-unlinked':
    'the mitigation "{name}", which is linked to no threat the format holds',
  'mitigation-split-across-threats': {
    one: 'the one record, written into the mitigation text of the {count} threat it is linked to',
    other:
      'the one record, written into the mitigation text of each of the {count} threats it is linked to',
  },
  'threat-status-unmapped':
    'the status "{status}", which the model has no state for',
  'threat-severity-unmapped':
    'the severity "{severity}", which the model has no level for',
  'threat-category-eop-suit':
    'the Elevation of Privilege card, of which the model holds the suit alone',
  'threat-category-unmapped':
    'the category "{category}", which no language of Threat Dragon\'s names',
  'key-undeclared': 'the key {path}',
  'assumption-element-links-dropped':
    'its element links, which an assumption does not hold',
  'otm-threat-split':
    'Threat "{id}" becomes separate records for its occurrences.',
  'otm-threat-undecided':
    'Threat "{id}" imports with undecided severity and an unspecified category.',
  'otm-threat-status-unmapped':
    'Threat status "{status}" imports as open. Supplied status text remains in the description.',
  'otm-threat-status-absent':
    'An absent threat status imports as open. Supplied status text remains in the description.',
  'otm-mitigation-split':
    'Mitigation "{id}" becomes separate records for its occurrences.',
  'otm-mitigation-status-retained':
    'Mitigation "{id}" has source status "{status}", retained in its description and imported as proposed.',
  'otm-mitigation-status-absent':
    'Mitigation "{id}" has no source status and imports as proposed.',
  'otm-mitigation-unlinked':
    'Mitigation "{id}" names no threat and becomes a line of the model description.',
  'otm-assets-as-descriptions':
    'Referenced asset names become descriptions on flows and components. Shared data identity is not retained.',
  'otm-components-as-processes':
    'OTM component types become process nodes. Their original types remain in the descriptions.',
  'otm-geometry-generated':
    'Element "{id}" receives generated geometry where the source has none.',
  'tmbom-threats-undecided':
    'Threats import as open with undecided severity and an unspecified category. Separate risk assessments are not converted into threat severity.',
  'tmbom-control-proposed':
    'Control "{name}" imports as proposed. Its original status remains in the description.',
  'tmbom-control-unlinked':
    'Control "{name}" names no threat and becomes a line of the model description.',
  'tmbom-geometry-generated':
    'The diagram receives generated geometry grouped by source trust zone. Membership becomes visual.',
  'tmbom-flow-fields-as-prose':
    'Flow encryption and sensitivity fields remain prose in the flow descriptions.',
  'tmbom-data-set-as-prose':
    'Data set "{name}" becomes prose on its stores. Shared data identity is not retained.',
  'tmbom-data-set-dropped':
    'Data set "{name}" has no store placement and is not retained.',
  'field-not-retained': 'The source field {path} is not retained by import.',
});
