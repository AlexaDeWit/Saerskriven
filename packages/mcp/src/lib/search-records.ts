import {
  assumptionStatusSchema,
  mitigationStatusSchema,
  recordsLinkedTo,
  type Model,
  type RecordReference,
  type ThreatId,
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
  linkedToNothing,
  recordRow,
  recordRowSchema,
  renderRecord,
  type KindedRecord,
} from './record-rows.js';
import {
  limitedRows,
  matchesQuery,
  renderCounts,
  responseFormatSchema,
  searchArgumentsSchema,
  searchCountsSchema,
} from './search.js';
import { threatNamed } from './threat-rows.js';
import type { ModelWorkspace } from './workspace.js';

const recordKinds = [
  'mitigation',
  'assumption',
] as const satisfies readonly RecordReference['kind'][];

/** What `saer_search_records` takes. */
export const searchRecordsArgumentsSchema = searchArgumentsSchema.extend({
  kind: z
    .enum(recordKinds)
    .optional()
    .describe(
      'Keep only records of this kind. Left out, mitigations and assumptions are both matched.',
    ),
  id: z
    .string()
    .optional()
    .describe(
      'Keep only the records carrying this exact id. A mitigation and an assumption can share an id, so pass `kind` as well to keep one of them. An id no record carries matches nothing rather than being refused.',
    ),
  status: z
    .enum([
      ...mitigationStatusSchema.options,
      ...assumptionStatusSchema.options,
    ])
    .optional()
    .describe(
      'Keep only records in this status. A mitigation is `proposed`, `implemented` or `verified`, and an assumption `unconfirmed`, `valid` or `invalidated`, so a status keeps records of its own kind alone.',
    ),
  threat: z
    .string()
    .optional()
    .describe(
      'Keep only the records linked to this threat, named by its id or its number as digits, an id tried first. A threat the model does not hold is refused.',
    ),
  unlinked: z
    .boolean()
    .optional()
    .describe(
      '`true` keeps only the records linked to nothing: a mitigation linking no threat, or an assumption linking no threat that does not apply to the model. `false` keeps only the records linked to something. Left out, both are matched.',
    ),
});

/** What `saer_search_records` takes. */
export type SearchRecordsArguments = z.infer<
  typeof searchRecordsArgumentsSchema
>;

/** What `saer_search_records` answers with. */
export const searchRecordsResultSchema = readingSchema.extend({
  counts: searchCountsSchema,
  response_format: responseFormatSchema,
  records: z.array(recordRowSchema),
});

/** What `saer_search_records` answers with. */
export type SearchRecordsResult = z.infer<typeof searchRecordsResultSchema>;

/** What `saer_search_records` tells a client it is for. */
export const searchRecordsDescription = [
  'Find the mitigation and assumption records of one Saerskriven threat model, a record linked to nothing included. Each match carries the record kind and id, its status, the ids of the threats it links, the title of a mitigation or the prose of an assumption, whether an assumption applies to the model (`appliesToModel`), and `unlinked`, derived on every read and true where the record is linked to nothing. The order is every mitigation in register order, then every assumption.',
  "A mitigation's links are its threat links. An assumption's are its threat links and, where `appliesToModel` is true, its model link. A record linked to nothing has none of these. A file can hold one, and no other tool shows one. An edit that takes a record's last link away removes the record rather than leaving it linked to nothing.",
  'Use this to find the records of one threat, of one status or of one kind, to find the records linked to nothing, and to get the id of a record you mean to edit. Use saer_get_threat for one threat with its records, and saer_inspect for the assumptions that apply to the model beside its metadata.',
  defaultedFileSentence,
  '`kind`, `id`, `status`, `threat` and `unlinked` each keep only the records matching them. `query` is text looked for, without case, in the title and the prose of each record.',
  '`response_format` is `concise` by default and carries no mitigation prose. `detailed` adds the prose of each mitigation, and an assumption row is the same in both.',
  '`offset` skips that many matches, for the next page of a listing cut at its limit, which names the offset to pass.',
  'This tool never writes.',
].join(' ');

/**
 * The records matching a search, or the lines saying why there are none to
 * search. Every filter is a conjunction, so a call naming a threat and a
 * status matches the records linked to that threat in that status.
 */
export function searchRecords(
  workspace: ModelWorkspace,
  args: SearchRecordsArguments,
): Either.Either<SearchRecordsResult, readonly string[]> {
  return Either.flatMap(readNamed(workspace, args.file), (reading) =>
    Either.map(candidatesFor(reading.model, args.threat), (candidates) =>
      found(reading, candidates, args),
    ),
  );
}

/** The matching records as the lines its text result carries. */
export function renderRecordSearch(
  result: SearchRecordsResult,
): readonly string[] {
  return [
    ...renderReading(result),
    ...renderCounts(result.counts, result.response_format, narrowing),
    'records:',
    ...result.records.flatMap(renderRecord),
  ];
}

const narrowing = [
  '`kind`',
  '`id`',
  '`status`',
  '`threat`',
  '`unlinked`',
  '`query`',
];

function candidatesFor(
  model: Model,
  threat: string | undefined,
): Either.Either<readonly KindedRecord[], readonly string[]> {
  return threat === undefined
    ? Either.right(kinded(model.mitigations, model.assumptions))
    : Either.map(threatNamed(model, threat), ({ id }) => linkedTo(model, id));
}

function linkedTo(model: Model, threat: ThreatId): readonly KindedRecord[] {
  return kinded(
    recordsLinkedTo(model.mitigations, threat),
    recordsLinkedTo(model.assumptions, threat),
  );
}

function kinded(
  mitigations: Model['mitigations'],
  assumptions: Model['assumptions'],
): readonly KindedRecord[] {
  return [
    ...mitigations.map((mitigation): KindedRecord => ({
      kind: 'mitigation',
      ...mitigation,
    })),
    ...assumptions.map((assumption): KindedRecord => ({
      kind: 'assumption',
      ...assumption,
    })),
  ];
}

function found(
  reading: ModelReading,
  candidates: readonly KindedRecord[],
  args: SearchRecordsArguments,
): SearchRecordsResult {
  const limited = limitedRows(
    candidates.filter((record) => keeps(record, args)),
    args,
  );
  return {
    ...reportedReading(reading),
    counts: limited.counts,
    response_format: args.response_format,
    records: limited.rows.map((record) =>
      recordRow(record, args.response_format),
    ),
  };
}

function keeps(record: KindedRecord, args: SearchRecordsArguments): boolean {
  return (
    (args.kind === undefined || record.kind === args.kind) &&
    (args.id === undefined || record.id === args.id) &&
    (args.status === undefined || record.status === args.status) &&
    (args.unlinked === undefined ||
      linkedToNothing(record) === args.unlinked) &&
    matchesQuery(args.query, [
      record.kind === 'mitigation' ? record.title : '',
      record.prose,
    ])
  );
}
