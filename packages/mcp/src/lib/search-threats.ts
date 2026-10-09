import {
  recordsLinkedTo,
  severitySchema,
  threatStatusSchema,
  threatsOnDiagrams,
  type Model,
  type Threat,
} from '@saerskriven/model';
import { Either } from 'effect';
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

/** What `saer_search_threats` takes. */
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

/** What `saer_search_threats` takes. */
export type SearchThreatsArguments = z.infer<
  typeof searchThreatsArgumentsSchema
>;

/** What `saer_search_threats` answers with. */
export const searchThreatsResultSchema = readingSchema.extend({
  counts: searchCountsSchema,
  response_format: responseFormatSchema,
  threats: z.array(threatDetailSchema),
});

/** What `saer_search_threats` answers with. */
export type SearchThreatsResult = z.infer<typeof searchThreatsResultSchema>;

/** What `saer_search_threats` tells a client it is for. */
export const searchThreatsDescription = [
  'Find the threats recorded in one Saerskriven threat model. Each match carries the threat number and id, its title, where it stands, how bad it is, its category, the ids of the elements it attaches to, whether it applies to the model as a whole (`appliesToModel`), and its flags. The order is the register order the model holds them in.',
  flagsDescription,
  'Use this to find the threats of one element, of one diagram, of one category, of one severity, or of one status, and to get the number of a threat you mean to read in full. Use saer_get_threat for one whole record with its mitigations and assumptions, and saer_coverage for what the model has not analyzed at all.',
  defaultedFileSentence,
  '`status`, `severity`, `category`, `diagram` and `element` each keep only the threats matching them. `query` is text looked for, without case, in the title, the description, and the title and prose of each mitigation linked to the threat.',
  '`response_format` is `concise` by default and carries no record text. `detailed` adds the description and the linked mitigation and assumption records of each threat, which is the bulk of a register, so filter before asking for it.',
  '`offset` skips that many matches, for the next page of a listing cut at its limit, which names the offset to pass.',
  'This tool never writes. No edit renumbers a threat, and no two threats hold one number, so a number read here stays the handle for that threat as long as the model holds that threat.',
].join(' ');

/**
 * The threats matching a search, or the lines saying why there are none to
 * search. Every filter is a conjunction, so a call naming a status and a
 * severity matches the threats carrying both.
 */
export function searchThreats(
  workspace: ModelWorkspace,
  args: SearchThreatsArguments,
): Either.Either<SearchThreatsResult, readonly string[]> {
  return Either.flatMap(readNamed(workspace, args.file), (reading) =>
    Either.map(threatsDrawnOn(reading.model, args.diagram), (candidates) =>
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
): Either.Either<readonly Threat[], readonly string[]> {
  return diagram === undefined
    ? Either.right(model.threats)
    : Either.map(diagramsOf(model, diagram), (diagrams) =>
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
