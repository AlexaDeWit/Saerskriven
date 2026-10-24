import {
  divergenceSchema,
  escapedForTerminal,
  quotedForTerminal,
  renderDivergences,
} from '@saerskriven/formats';
import {
  acceptedTextSchema,
  assumptionSchema,
  diagramIdSchema,
  diagramsOf,
  modelMetadataSchema,
  threatsOnDiagrams,
  type Diagram,
  type Model,
} from '@saerskriven/model';
import { Result } from 'effect';
import { z } from 'zod';
import { candidateFiles } from './candidates.js';
import { defaultedFileSentence, fileArgumentSchema } from './path-arguments.js';
import {
  quotedList,
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import { renderAssumption } from './record-rows.js';
import type { ModelWorkspace } from './workspace.js';

export const inspectDescription = [
  'Read model metadata, model-wide assumptions, diagram summaries, totals, shared-element counts and format divergences.',
  'Call first for an unread model. Quote its fresh `revision` in writes.',
  'Use saer_search_records for all mitigations and assumptions, including unlinked records.',
  defaultedFileSentence,
  'Without a default or `file`, list candidate files under the root with no revision. Read-only.',
].join(' ');

export type InspectArguments = z.infer<typeof fileArgumentSchema>;

const diagramSummarySchema = z.object({
  id: diagramIdSchema,
  title: acceptedTextSchema,
  elements: z.int().nonnegative(),
  threats: z.int().nonnegative(),
});

const totalsSchema = z.object({
  diagrams: z.int().nonnegative(),
  elements: z.int().nonnegative(),
  sharedElements: z
    .int()
    .nonnegative()
    .describe(
      'The elements on more than one diagram, which the element count of each of those diagrams includes.',
    ),
  threats: z.int().nonnegative(),
  mitigations: z.int().nonnegative(),
  assumptions: z.int().nonnegative(),
});

const inspectedSchema = z
  .object({ kind: z.literal('inspected') })
  .extend(readingSchema.shape)
  .extend({
    metadata: modelMetadataSchema,
    assumptions: z
      .array(assumptionSchema)
      .describe('The assumptions that apply to the model, in model order.'),
    diagrams: z.array(diagramSummarySchema),
    totals: totalsSchema,
    divergences: z.array(divergenceSchema),
  });

const candidatesSchema = z.object({
  kind: z.literal('candidates'),
  files: z.array(z.string()),
  truncated: z.boolean(),
});

/** Nest the result union to keep the advertised JSON Schema root an object. */
export const inspectResultSchema = z.object({
  root: z.string(),
  result: z.discriminatedUnion('kind', [inspectedSchema, candidatesSchema]),
});

export type InspectResult = z.infer<typeof inspectResultSchema>;

/**
 * What a model file holds, or the candidates to name where the call named no
 * file and the server carries no default.
 */
export function inspect(
  workspace: ModelWorkspace,
  { file }: InspectArguments,
): Result.Result<InspectResult, readonly string[]> {
  return file === undefined && workspace.defaultFile === undefined
    ? Result.succeed({ root: workspace.root, result: candidates(workspace) })
    : Result.map(readNamed(workspace, file), (reading) => ({
        root: workspace.root,
        result: inspected(reading),
      }));
}

/** The inspection as the lines its text result carries. */
export function renderInspection(inspection: InspectResult): readonly string[] {
  return inspection.result.kind === 'candidates'
    ? renderCandidates(inspection.result)
    : renderModel(inspection.result);
}

function candidates(
  workspace: ModelWorkspace,
): z.infer<typeof candidatesSchema> {
  const listing = candidateFiles(workspace);
  return {
    kind: 'candidates',
    files: [...listing.files],
    truncated: listing.truncated,
  };
}

function inspected(reading: ModelReading): z.infer<typeof inspectedSchema> {
  const { model } = reading;
  return {
    kind: 'inspected',
    ...reportedReading(reading),
    metadata: model.metadata,
    assumptions: model.assumptions.filter(
      ({ appliesToModel }) => appliesToModel,
    ),
    diagrams: model.diagrams.map((diagram) => summaryOf(diagram, model)),
    totals: totalsOf(model),
    divergences: [...reading.divergences],
  };
}

function summaryOf(
  diagram: Diagram,
  model: Model,
): z.infer<typeof diagramSummarySchema> {
  return {
    id: diagram.id,
    title: diagram.title,
    elements: diagram.placements.length,
    threats: threatsOnDiagrams(model, [diagram]).length,
  };
}

function totalsOf(model: Model): z.infer<typeof totalsSchema> {
  return {
    diagrams: model.diagrams.length,
    elements: model.elements.length,
    sharedElements: model.elements.filter(
      ({ id }) => diagramsOf(model, id).length > 1,
    ).length,
    threats: model.threats.length,
    mitigations: model.mitigations.length,
    assumptions: model.assumptions.length,
  };
}

function renderModel(
  reading: z.infer<typeof inspectedSchema>,
): readonly string[] {
  return [
    ...renderReading(reading),
    `title: ${escapedForTerminal(reading.metadata.title)}`,
    `owner: ${escapedForTerminal(reading.metadata.owner)}`,
    ...(reading.metadata.description.length === 0
      ? []
      : [`description: ${escapedForTerminal(reading.metadata.description)}`]),
    `contributors: ${quotedList(reading.metadata.contributors)}`,
    'assumptions that apply to the model:',
    ...reading.assumptions.map(
      (assumption) => `  ${renderAssumption(assumption)}`,
    ),
    `totals: ${countList(reading.totals)}`,
    'diagrams:',
    ...reading.diagrams.map(
      (diagram) =>
        `  ${quotedForTerminal(diagram.id)}: ${escapedForTerminal(diagram.title)} (elements ${String(diagram.elements)}, threats ${String(diagram.threats)})`,
    ),
    'divergences:',
    renderDivergences(reading.divergences),
  ];
}

function renderCandidates(
  listing: z.infer<typeof candidatesSchema>,
): readonly string[] {
  return [
    'No file was named and this server carries no default, so these are the model files under the root:',
    ...listing.files.map((file) => `  ${escapedForTerminal(file)}`),
    ...(listing.truncated
      ? ['The listing stopped at its limit and is not the whole root.']
      : []),
  ];
}

function countList(totals: z.infer<typeof totalsSchema>): string {
  const shared =
    totals.sharedElements === 0
      ? ''
      : ` (${String(totals.sharedElements)} on more than one diagram)`;
  return [
    `diagrams ${String(totals.diagrams)}`,
    `elements ${String(totals.elements)}${shared}`,
    `threats ${String(totals.threats)}`,
    `mitigations ${String(totals.mitigations)}`,
    `assumptions ${String(totals.assumptions)}`,
  ].join(', ');
}
