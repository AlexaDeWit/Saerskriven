import {
  recordsLinkedTo,
  severitySchema,
  threatStatusSchema,
  threatsOnDiagrams,
  type Model,
  type Threat,
} from '@saerskriven/model';
import { Result } from 'effect';
import { z } from 'zod';
import { defaultedFileSentence } from './path-arguments.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import {
  diagramsOf,
  limitedRows,
  matchesQuery,
  renderCounts,
  responseFormatSchema,
  searchArgumentsSchema,
  searchCountsSchema,
} from './search.js';
import {
  categoryName,
  flagsDescription,
  renderThreat,
  threatDetail,
  threatDetailSchema,
  threatRow,
} from './threat-rows.js';
import type { ModelWorkspace } from './workspace.js';

export const searchThreatsArgumentsSchema = searchArgumentsSchema.extend({
  status: threatStatusSchema
    .optional()
    .describe(
      'Keep only threats in this status. `open` is the threat nobody has dispositioned yet. Left out, threats in every status are matched.',
    ),
  severity: severitySchema
    .optional()
    .describe(
      'Keep only threats of this severity. `undecided` is a state of its own rather than a missing value, so it has to be asked for by name.',
    ),
  category: z
    .string()
    .optional()
    .describe(
      'Keep only threats of this category, written as a result names it: the methodology and the category joined by a slash, such as `STRIDE/tampering`, or the methodology name and category of a custom one. Compared without case against the whole pair.',
    ),
  diagram: z
    .string()
    .optional()
    .describe(
      'Keep only threats that reference an element drawn on this diagram, named by its id or its exact title. A threat attached to no element is on no diagram, whether or not it applies to the model. A name no diagram carries is refused.',
    ),
  element: z
    .string()
    .optional()
    .describe(
      'Keep only threats that reference this element id. Find an id with saer_search_elements. An id no element carries matches nothing rather than being refused.',
    ),
});

export type SearchThreatsArguments = z.infer<
  typeof searchThreatsArgumentsSchema
>;

export const searchThreatsResultSchema = readingSchema.extend({
  counts: searchCountsSchema,
  response_format: responseFormatSchema,
  threats: z.array(threatDetailSchema),
});

export type SearchThreatsResult = z.infer<typeof searchThreatsResultSchema>;

export const searchThreatsDescription = [
  'Find recorded threats in register order: number, id, title, status, severity, category, element ids, model-wide applicability and flags.',
  defaultedFileSentence,
  flagsDescription,
  'Use saer_get_threat for a complete threat with linked records, or saer_coverage for analysis gaps.',
  'Filters combine: `status`, `severity`, `category`, `diagram` and `element`. `query` searches threat title and description plus linked mitigation titles and prose.',
  '`concise` omits record prose. `detailed` adds threat descriptions and linked mitigations and assumptions. Filter before requesting details.',
  'Read-only. Threat numbers remain unique and stable while their threats exist.',
].join(' ');

/** Apply all filters together without changing register order. */
export function searchThreats(
  workspace: ModelWorkspace,
  args: SearchThreatsArguments,
): Result.Result<SearchThreatsResult, readonly string[]> {
  return Result.flatMap(readNamed(workspace, args.file), (reading) =>
    Result.map(threatsDrawnOn(reading.model, args.diagram), (candidates) =>
      found(reading, candidates, args),
    ),
  );
}

/** The matching threats as the lines its text result carries. */
export function renderThreatSearch(
  result: SearchThreatsResult,
): readonly string[] {
  return [
    ...renderReading(result),
    ...renderCounts(result.counts, result.response_format, narrowing),
    'threats:',
    ...result.threats.flatMap(renderThreat),
  ];
}

const narrowing = [
  '`status`',
  '`severity`',
  '`category`',
  '`diagram`',
  '`element`',
  '`query`',
];

function threatsDrawnOn(
  model: Model,
  diagram: string | undefined,
): Result.Result<readonly Threat[], readonly string[]> {
  return diagram === undefined
    ? Result.succeed(model.threats)
    : Result.map(diagramsOf(model, diagram), (diagrams) =>
        threatsOnDiagrams(model, diagrams),
      );
}

function found(
  reading: ModelReading,
  candidates: readonly Threat[],
  args: SearchThreatsArguments,
): SearchThreatsResult {
  const limited = limitedRows(
    candidates.filter((threat) => keeps(threat, reading.model, args)),
    args,
  );
  return {
    ...reportedReading(reading),
    counts: limited.counts,
    response_format: args.response_format,
    threats: limited.rows.map((threat) =>
      args.response_format === 'detailed'
        ? threatDetail(threat, reading.model)
        : threatRow(threat, reading.model),
    ),
  };
}

function keeps(
  threat: Threat,
  model: Model,
  args: SearchThreatsArguments,
): boolean {
  return (
    (args.status === undefined || threat.status === args.status) &&
    (args.severity === undefined || threat.severity === args.severity) &&
    (args.category === undefined ||
      categoryName(threat.category).toLowerCase() ===
        args.category.toLowerCase()) &&
    (args.element === undefined ||
      threat.elements.some((element) => element === args.element)) &&
    matchesQuery(args.query, [
      threat.title,
      threat.description,
      ...recordsLinkedTo(model.mitigations, threat.id).flatMap(
        ({ title, prose }) => [title, prose],
      ),
    ])
  );
}
