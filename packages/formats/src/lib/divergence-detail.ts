import { z } from 'zod';

const coded = <const C extends string>(code: C) =>
  z.object({ code: z.literal(code) });

const carrying = <const C extends string, const P extends z.ZodRawShape>(
  code: C,
  parameters: P,
) => z.object({ code: z.literal(code), parameters: z.object(parameters) });

/**
 * What one divergence is about, as a code and the data the code needs. A
 * parameter is a path, an identifier, a count, a format name or a text a
 * person wrote, carried as it stands, so a reader in any language phrases the
 * entry itself. A text parameter is unbounded where its value comes from a
 * foreign file, whose vocabulary the model does not decide.
 */
export const divergenceDetailSchema = z.discriminatedUnion('code', [
  carrying('release-restamped', { from: z.string(), written: z.string() }),
  carrying('threat-mark-raised-by-issue', {
    from: z.number(),
    raised: z.number(),
  }),
  carrying('threat-mark-raised-to-issued', {
    from: z.number(),
    raised: z.number(),
  }),
  carrying('diagram-mark-raised-by-issue', {
    from: z.number(),
    raised: z.number(),
  }),
  carrying('diagram-mark-raised-to-issued', {
    from: z.number(),
    raised: z.number(),
  }),
  coded('assumption-unrecorded'),
  carrying('diagram-discarded', { title: z.string() }),
  carrying('threat-copy-detached', { cell: z.string() }),
  carrying('threat-discarded', { title: z.string() }),
  carrying('note-name-dropped', { name: z.string() }),
  coded('scope-marking-dropped'),
  carrying('cell-reshaped', { shape: z.string(), kind: z.string() }),
  carrying('diagram-name-numbered', { number: z.number() }),
  carrying('cell-discarded', { shape: z.string() }),
  carrying('threat-attachment-stray', {
    element: z.string(),
    kind: z.string().optional(),
  }),
  coded('threat-unplaceable'),
  carrying('threat-split-across-elements', { count: z.number() }),
  carrying('threat-category-unnamed', {
    methodology: z.string(),
    category: z.string(),
  }),
  carrying('mitigation-records-merged', { count: z.number() }),
  coded('mitigation-title-merged'),
  carrying('mitigation-empty-dropped', { threat: z.string() }),
  carrying('mitigation-status-dropped', {
    status: z.string(),
    threat: z.string(),
    inferred: z.string(),
  }),
  carrying('mitigation-unlinked', { name: z.string() }),
  carrying('mitigation-split-across-threats', { count: z.number() }),
  carrying('threat-status-unmapped', { status: z.string() }),
  carrying('threat-severity-unmapped', { severity: z.string() }),
  coded('threat-category-eop-suit'),
  carrying('threat-category-unmapped', { category: z.string() }),
  carrying('key-undeclared', { path: z.string() }),
  coded('assumption-element-links-dropped'),
  carrying('otm-threat-split', { id: z.string() }),
  carrying('otm-threat-undecided', { id: z.string() }),
  carrying('otm-threat-status-unmapped', { status: z.string().optional() }),
  carrying('otm-mitigation-split', { id: z.string() }),
  carrying('otm-mitigation-status-retained', {
    id: z.string(),
    status: z.string().nullish(),
  }),
  carrying('otm-mitigation-unlinked', { id: z.string() }),
  coded('otm-assets-as-descriptions'),
  coded('otm-components-as-processes'),
  carrying('otm-geometry-generated', { id: z.string() }),
  coded('tmbom-threats-undecided'),
  carrying('tmbom-control-proposed', { name: z.string() }),
  carrying('tmbom-control-unlinked', { name: z.string() }),
  coded('tmbom-geometry-generated'),
  coded('tmbom-flow-fields-as-prose'),
  carrying('tmbom-data-set-as-prose', { name: z.string() }),
  carrying('tmbom-data-set-dropped', { name: z.string() }),
  carrying('field-not-retained', { path: z.array(z.string()) }),
]);

/** One divergence's code and the data that code carries. */
export type DivergenceDetail = z.infer<typeof divergenceDetailSchema>;

/** Every code a codec or an import records. */
export type DivergenceCode = DivergenceDetail['code'];

/**
 * One detail in English, the text `renderDivergences` reports and the CLI and
 * the MCP server print. A reader that phrases a code itself, as the studio
 * does, uses the code and its parameters instead.
 */
export function divergenceDetailText(detail: DivergenceDetail): string {
  switch (detail.code) {
    case 'release-restamped':
      return `the release "${detail.parameters.from}" the source was written by, for the ${detail.parameters.written} this codec writes`;
    case 'threat-mark-raised-by-issue':
      return `the threat high-water mark ${detail.parameters.from}, raised to ${detail.parameters.raised} to cover a number this write issued`;
    case 'threat-mark-raised-to-issued':
      return `the threat high-water mark ${detail.parameters.from}, raised to ${detail.parameters.raised}, the highest number the model has issued and no number in the file reaches`;
    case 'diagram-mark-raised-by-issue':
      return `the diagram high-water mark ${detail.parameters.from}, raised to ${detail.parameters.raised} to cover a number this write issued`;
    case 'diagram-mark-raised-to-issued':
      return `the diagram high-water mark ${detail.parameters.from}, raised to ${detail.parameters.raised}, the highest number the model has issued and no number in the file reaches`;
    case 'assumption-unrecorded':
      return 'the assumption, which the format keeps no record of';
    case 'diagram-discarded':
      return `the diagram "${detail.parameters.title}" the source document held`;
    case 'threat-copy-detached':
      return `the copy the source document nested under the cell "${detail.parameters.cell}", which the model no longer attaches it to`;
    case 'threat-discarded':
      return `the threat "${detail.parameters.title}" the source document nested under a cell the model kept`;
    case 'note-name-dropped':
      return `the name "${detail.parameters.name}", which the format has one text for a note and no name beside it`;
    case 'scope-marking-dropped':
      return 'the out-of-scope marking, which the format records on the elements a threat attaches to alone';
    case 'cell-reshaped':
      return `what the source held on the ${detail.parameters.shape} cell of this id, which now draws a ${detail.parameters.kind}`;
    case 'diagram-name-numbered':
      return `the name, which the format numbers a diagram rather than naming one, written as ${detail.parameters.number}`;
    case 'cell-discarded':
      return `the ${detail.parameters.shape} cell the source document held`;
    case 'threat-attachment-stray':
      return `the attachment to the ${detail.parameters.kind ?? 'unknown'} "${detail.parameters.element}", which the format nests a threat under an actor, a process, a store, or a flow alone`;
    case 'threat-unplaceable':
      return 'the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under';
    case 'threat-split-across-elements':
      return `the one record, written once under each of the ${detail.parameters.count} elements it names`;
    case 'threat-category-unnamed':
      return `the ${detail.parameters.methodology} category "${detail.parameters.category}", which Threat Dragon's own labels do not name`;
    case 'mitigation-records-merged':
      return `the ${detail.parameters.count} records merged into its one mitigation text, which reads back as one record with no title`;
    case 'mitigation-title-merged':
      return 'the mitigation title written into its one mitigation text, which reads back as one record with no title';
    case 'mitigation-empty-dropped':
      return `the mitigation with no title and no text, which writes nothing into the text of the threat "${detail.parameters.threat}"`;
    case 'mitigation-status-dropped':
      return `the status "${detail.parameters.status}" in the text of the threat "${detail.parameters.threat}", which reads back as "${detail.parameters.inferred}"`;
    case 'mitigation-unlinked':
      return `the mitigation "${detail.parameters.name}", which is linked to no threat the format holds`;
    case 'mitigation-split-across-threats':
      return `the one record, written into the mitigation text of each of the ${detail.parameters.count} threats it is linked to`;
    case 'threat-status-unmapped':
      return `the status "${detail.parameters.status}", which the model has no state for`;
    case 'threat-severity-unmapped':
      return `the severity "${detail.parameters.severity}", which the model has no level for`;
    case 'threat-category-eop-suit':
      return 'the Elevation of Privilege card, of which the model holds the suit alone';
    case 'threat-category-unmapped':
      return `the category "${detail.parameters.category}", which no language of Threat Dragon's names`;
    case 'key-undeclared':
      return `the key ${detail.parameters.path}`;
    case 'assumption-element-links-dropped':
      return 'its element links, which an assumption does not hold';
    case 'otm-threat-split':
      return `Threat ${quoted(detail.parameters.id)} becomes separate records for its occurrences.`;
    case 'otm-threat-undecided':
      return `Threat ${quoted(detail.parameters.id)} imports with undecided severity and an unspecified category.`;
    case 'otm-threat-status-unmapped':
      return `Threat status ${quoted(detail.parameters.status) ?? 'absent'} imports as open. Supplied status text remains in the description.`;
    case 'otm-mitigation-split':
      return `Mitigation ${quoted(detail.parameters.id)} becomes separate records for its occurrences.`;
    case 'otm-mitigation-status-retained':
      return `Mitigation ${quoted(detail.parameters.id)} has source status ${quoted(detail.parameters.status)}, retained in its description and imported as proposed.`;
    case 'otm-mitigation-unlinked':
      return `Mitigation ${quoted(detail.parameters.id)} names no threat and becomes a line of the model description.`;
    case 'otm-assets-as-descriptions':
      return 'Referenced asset names become descriptions on flows and components. Shared data identity is not retained.';
    case 'otm-components-as-processes':
      return 'OTM component types become process nodes. Their original types remain in the descriptions.';
    case 'otm-geometry-generated':
      return `Element ${quoted(detail.parameters.id)} receives generated geometry where the source has none.`;
    case 'tmbom-threats-undecided':
      return 'Threats import as open with undecided severity and an unspecified category. Separate risk assessments are not converted into threat severity.';
    case 'tmbom-control-proposed':
      return `Control ${quoted(detail.parameters.name)} imports as proposed. Its original status remains in the description.`;
    case 'tmbom-control-unlinked':
      return `Control ${quoted(detail.parameters.name)} names no threat and becomes a line of the model description.`;
    case 'tmbom-geometry-generated':
      return 'The diagram receives generated geometry grouped by source trust zone. Membership becomes visual.';
    case 'tmbom-flow-fields-as-prose':
      return 'Flow encryption and sensitivity fields remain prose in the flow descriptions.';
    case 'tmbom-data-set-as-prose':
      return `Data set ${quoted(detail.parameters.name)} becomes prose on its stores. Shared data identity is not retained.`;
    case 'tmbom-data-set-dropped':
      return `Data set ${quoted(detail.parameters.name)} has no store placement and is not retained.`;
    case 'field-not-retained':
      return `The source field ${quoted(detail.parameters.path)} is not retained by import.`;
    default:
      return unworded(detail);
  }
}

function unworded(_detail: never): string {
  return '';
}

function quoted(
  value: string | readonly string[] | null | undefined,
): string | undefined {
  return JSON.stringify(value);
}
