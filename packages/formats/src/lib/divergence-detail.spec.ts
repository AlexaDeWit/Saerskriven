import {
  divergenceDetailSchema,
  divergenceDetailText,
  type DivergenceCode,
  type DivergenceDetail,
} from './divergence-detail.js';

const samples: readonly (readonly [DivergenceDetail, string])[] = [
  [
    {
      code: 'release-restamped',
      parameters: { from: '2.4.1', written: '2.6.2' },
    },
    'the release "2.4.1" the source was written by, for the 2.6.2 this codec writes',
  ],
  [
    { code: 'threat-mark-raised-by-issue', parameters: { from: 3, raised: 7 } },
    'the threat high-water mark 3, raised to 7 to cover a number this write issued',
  ],
  [
    {
      code: 'threat-mark-raised-to-issued',
      parameters: { from: 3, raised: 7 },
    },
    'the threat high-water mark 3, raised to 7, the highest number the model has issued and no number in the file reaches',
  ],
  [
    {
      code: 'diagram-mark-raised-by-issue',
      parameters: { from: 1, raised: 2 },
    },
    'the diagram high-water mark 1, raised to 2 to cover a number this write issued',
  ],
  [
    {
      code: 'diagram-mark-raised-to-issued',
      parameters: { from: 1, raised: 2 },
    },
    'the diagram high-water mark 1, raised to 2, the highest number the model has issued and no number in the file reaches',
  ],
  [
    { code: 'assumption-unrecorded' },
    'the assumption, which the format keeps no record of',
  ],
  [
    { code: 'diagram-discarded', parameters: { title: 'Level 0' } },
    'the diagram "Level 0" the source document held',
  ],
  [
    { code: 'threat-copy-detached', parameters: { cell: 'element-store' } },
    'the copy the source document nested under the cell "element-store", which the model no longer attaches it to',
  ],
  [
    { code: 'threat-discarded', parameters: { title: 'Replay' } },
    'the threat "Replay" the source document nested under a cell the model kept',
  ],
  [
    { code: 'note-name-dropped', parameters: { name: 'Caveat' } },
    'the name "Caveat", which the format has one text for a note and no name beside it',
  ],
  [
    { code: 'scope-marking-dropped' },
    'the out-of-scope marking, which the format records on the elements a threat attaches to alone',
  ],
  [
    { code: 'cell-reshaped', parameters: { shape: 'actor', kind: 'process' } },
    'what the source held on the actor cell of this id, which now draws a process',
  ],
  [
    { code: 'diagram-name-numbered', parameters: { number: 4 } },
    'the name, which the format numbers a diagram rather than naming one, written as 4',
  ],
  [
    { code: 'cell-discarded', parameters: { shape: 'flow' } },
    'the flow cell the source document held',
  ],
  [
    {
      code: 'threat-attachment-stray',
      parameters: { element: 'element-note', kind: 'text' },
    },
    'the attachment to the text "element-note", which the format nests a threat under an actor, a process, a store, or a flow alone',
  ],
  [
    {
      code: 'threat-attachment-stray',
      parameters: { element: 'element-gone' },
    },
    'the attachment to the unknown "element-gone", which the format nests a threat under an actor, a process, a store, or a flow alone',
  ],
  [
    { code: 'threat-unplaceable' },
    'the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under',
  ],
  [
    { code: 'threat-split-across-elements', parameters: { count: 3 } },
    'the one record, written once under each of the 3 elements it names',
  ],
  [
    {
      code: 'threat-category-unnamed',
      parameters: { methodology: 'LINDDUN', category: 'Linking' },
    },
    'the LINDDUN category "Linking", which Threat Dragon\'s own labels do not name',
  ],
  [
    { code: 'mitigation-records-merged', parameters: { count: 2 } },
    'the 2 records merged into its one mitigation text, which reads back as one record with no title',
  ],
  [
    { code: 'mitigation-title-merged' },
    'the mitigation title written into its one mitigation text, which reads back as one record with no title',
  ],
  [
    { code: 'mitigation-empty-dropped', parameters: { threat: 'threat-4' } },
    'the mitigation with no title and no text, which writes nothing into the text of the threat "threat-4"',
  ],
  [
    {
      code: 'mitigation-status-dropped',
      parameters: {
        status: 'verified',
        threat: 'threat-4',
        inferred: 'proposed',
      },
    },
    'the status "verified" in the text of the threat "threat-4", which reads back as "proposed"',
  ],
  [
    { code: 'mitigation-unlinked', parameters: { name: 'Rotate keys' } },
    'the mitigation "Rotate keys", which is linked to no threat the format holds',
  ],
  [
    { code: 'mitigation-split-across-threats', parameters: { count: 5 } },
    'the one record, written into the mitigation text of each of the 5 threats it is linked to',
  ],
  [
    { code: 'threat-status-unmapped', parameters: { status: 'Under review' } },
    'the status "Under review", which the model has no state for',
  ],
  [
    { code: 'threat-severity-unmapped', parameters: { severity: 'TBD' } },
    'the severity "TBD", which the model has no level for',
  ],
  [
    { code: 'threat-category-eop-suit' },
    'the Elevation of Privilege card, of which the model holds the suit alone',
  ],
  [
    {
      code: 'threat-category-unmapped',
      parameters: { category: 'Usurpation' },
    },
    'the category "Usurpation", which no language of Threat Dragon\'s names',
  ],
  [
    { code: 'key-undeclared', parameters: { path: 'threats.0.likelihood' } },
    'the key threats.0.likelihood',
  ],
  [
    { code: 'assumption-element-links-dropped' },
    'its element links, which an assumption does not hold',
  ],
  [
    { code: 'otm-threat-split', parameters: { id: 'threat-spoofing' } },
    'Threat "threat-spoofing" becomes separate records for its occurrences.',
  ],
  [
    { code: 'otm-threat-undecided', parameters: { id: 'threat-spoofing' } },
    'Threat "threat-spoofing" imports with undecided severity and an unspecified category.',
  ],
  [
    {
      code: 'otm-threat-status-unmapped',
      parameters: { status: 'under-review' },
    },
    'Threat status "under-review" imports as open. Supplied status text remains in the description.',
  ],
  [
    { code: 'otm-threat-status-unmapped', parameters: {} },
    'Threat status absent imports as open. Supplied status text remains in the description.',
  ],
  [
    { code: 'otm-mitigation-split', parameters: { id: 'mitigation-review' } },
    'Mitigation "mitigation-review" becomes separate records for its occurrences.',
  ],
  [
    {
      code: 'otm-mitigation-status-retained',
      parameters: { id: 'mitigation-review', status: 'rejected' },
    },
    'Mitigation "mitigation-review" has source status "rejected", retained in its description and imported as proposed.',
  ],
  [
    {
      code: 'otm-mitigation-unlinked',
      parameters: { id: 'mitigation-unused' },
    },
    'Mitigation "mitigation-unused" names no threat and becomes a line of the model description.',
  ],
  [
    { code: 'otm-assets-as-descriptions' },
    'Referenced asset names become descriptions on flows and components. Shared data identity is not retained.',
  ],
  [
    { code: 'otm-components-as-processes' },
    'OTM component types become process nodes. Their original types remain in the descriptions.',
  ],
  [
    { code: 'otm-geometry-generated', parameters: { id: 'appointments' } },
    'Element "appointments" receives generated geometry where the source has none.',
  ],
  [
    { code: 'tmbom-threats-undecided' },
    'Threats import as open with undecided severity and an unspecified category. Separate risk assessments are not converted into threat severity.',
  ],
  [
    {
      code: 'tmbom-control-proposed',
      parameters: { name: 'control-approved' },
    },
    'Control "control-approved" imports as proposed. Its original status remains in the description.',
  ],
  [
    {
      code: 'tmbom-control-unlinked',
      parameters: { name: 'control-scheduled' },
    },
    'Control "control-scheduled" names no threat and becomes a line of the model description.',
  ],
  [
    { code: 'tmbom-geometry-generated' },
    'The diagram receives generated geometry grouped by source trust zone. Membership becomes visual.',
  ],
  [
    { code: 'tmbom-flow-fields-as-prose' },
    'Flow encryption and sensitivity fields remain prose in the flow descriptions.',
  ],
  [
    {
      code: 'tmbom-data-set-as-prose',
      parameters: { name: 'appointment-records' },
    },
    'Data set "appointment-records" becomes prose on its stores. Shared data identity is not retained.',
  ],
  [
    { code: 'tmbom-data-set-dropped', parameters: { name: 'audit-records' } },
    'Data set "audit-records" has no store placement and is not retained.',
  ],
  [
    {
      code: 'field-not-retained',
      parameters: { path: ['assets', '0', 'risk'] },
    },
    'The source field ["assets","0","risk"] is not retained by import.',
  ],
];

const declaredCodes: readonly DivergenceCode[] =
  divergenceDetailSchema.options.map((option) => option.shape.code.value);

describe('divergence codes', () => {
  it('words every code the schema declares', () => {
    expect(new Set(samples.map(([detail]) => detail.code))).toEqual(
      new Set(declaredCodes),
    );
  });

  it.each(samples)('words %j', (detail, text) => {
    expect(divergenceDetailText(detail)).toBe(text);
  });

  it('accepts the parameters each code carries', () => {
    expect(
      samples.map(([detail]) => divergenceDetailSchema.parse(detail)),
    ).toEqual(samples.map(([detail]) => detail));
  });
});
