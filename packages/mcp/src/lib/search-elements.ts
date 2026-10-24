import {
  elementIdSchema,
  elementKindSchema,
  threatCountByElement,
  type Model,
} from '@saerskriven/model';
import { Result } from 'effect';
import { z } from 'zod';
import {
  elementDetail,
  elementResultSchema,
  elementRow,
  elementsOnDiagrams,
  renderElement,
  type ElementOnDiagram,
} from './element-rows.js';
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
  type ResponseFormat,
} from './search.js';
import type { ModelWorkspace } from './workspace.js';

export const searchElementsArgumentsSchema = searchArgumentsSchema.extend({
  element: elementIdSchema
    .optional()
    .describe(
      'Keep only this exact element id, including when other elements refer to it.',
    ),
  diagram: z
    .string()
    .optional()
    .describe(
      'Keep only elements of this diagram, named by its id or its exact title. Left out, every diagram of the model is searched.',
    ),
  kind: elementKindSchema
    .optional()
    .describe(
      'Keep only elements of this kind. `flow` is data in motion, `trust-boundary` a line across which trust changes, and `text` a note on the canvas that carries no threats.',
    ),
});

export type SearchElementsArguments = z.infer<
  typeof searchElementsArgumentsSchema
>;

export const searchElementsResultSchema = readingSchema.extend({
  counts: searchCountsSchema,
  response_format: responseFormatSchema,
  elements: z.array(elementResultSchema),
});

export type SearchElementsResult = z.infer<typeof searchElementsResultSchema>;

export const searchElementsDescription = [
  'Find actors, processes, stores, flows, trust boundaries and canvas notes. Returns ids, diagram membership, kind, name, scope, optional accent and recorded threat counts.',
  defaultedFileSentence,
  'Use element ids to search threats or attach new threats. Use saer_coverage for analysis gaps.',
  'An element shared by diagrams appears once, using the first searched diagram. Select `diagram` by id or exact title for its geometry and accent.',
  '`query` searches ids, names, descriptions, note text, protocol, privilege level and declared relationship ids.',
  '`concise` returns identifying fields. `detailed` adds the complete element, geometry, flow direction, scope reason, security facts and boundary relationships. Absent optional fields mean unrecorded, distinct from false, empty text and empty lists. Use `element` for an exact id.',
  'Read-only. Threat counts include all recorded threats, regardless of status.',
].join(' ');

/** Return matching elements, including those with no threats. */
export function searchElements(
  workspace: ModelWorkspace,
  args: SearchElementsArguments,
): Result.Result<SearchElementsResult, readonly string[]> {
  return Result.flatMap(readNamed(workspace, args.file), (reading) =>
    found(reading, args),
  );
}

/** The matching elements as the lines its text result carries. */
export function renderElementSearch(
  result: SearchElementsResult,
): readonly string[] {
  return [
    ...renderReading(result),
    ...renderCounts(result.counts, result.response_format, narrowing),
    'elements:',
    ...result.elements.flatMap(renderElement),
  ];
}

const narrowing = ['`element`', '`diagram`', '`kind`', '`query`'];

function found(
  reading: ModelReading,
  args: SearchElementsArguments,
): Result.Result<SearchElementsResult, readonly string[]> {
  return Result.map(
    searched(reading.model, args),
    (placed): SearchElementsResult => {
      const limited = limitedRows(placed, args);
      const counts = threatCountByElement(reading.model);
      return {
        ...reportedReading(reading),
        counts: limited.counts,
        response_format: args.response_format,
        elements: limited.rows.map((one) =>
          rowOf(one, counts, args.response_format),
        ),
      };
    },
  );
}

function searched(
  model: Model,
  args: SearchElementsArguments,
): Result.Result<readonly ElementOnDiagram[], readonly string[]> {
  return Result.map(diagramsOf(model, args.diagram), (diagrams) =>
    elementsOnDiagrams(model, diagrams).filter((placed) => keeps(placed, args)),
  );
}

function keeps(
  { element }: ElementOnDiagram,
  args: SearchElementsArguments,
): boolean {
  return (
    (args.element === undefined || element.id === args.element) &&
    (args.kind === undefined || element.kind === args.kind) &&
    matchesQuery(args.query, [
      element.id,
      element.name,
      element.description,
      element.kind === 'text' ? element.text : '',
      element.kind === 'process' ? (element.privilegeLevel ?? '') : '',
      element.kind === 'flow' ? (element.protocol ?? '') : '',
      ...(element.kind === 'flow' ? (element.trustBoundaryIds ?? []) : []),
      ...(element.kind === 'trust-boundary'
        ? [
            ...(element.containedElements ?? []),
            ...(element.crossingFlows ?? []),
          ]
        : []),
    ])
  );
}

function rowOf(
  placed: ElementOnDiagram,
  counts: ReadonlyMap<string, number>,
  format: ResponseFormat,
): z.infer<typeof elementResultSchema> {
  return format === 'detailed'
    ? elementDetail(placed, counts)
    : elementRow(placed, counts);
}
