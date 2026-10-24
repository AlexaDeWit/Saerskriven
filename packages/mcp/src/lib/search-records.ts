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

export type SearchRecordsArguments = z.infer<
  typeof searchRecordsArgumentsSchema
>;

export const searchRecordsResultSchema = readingSchema.extend({
  counts: searchCountsSchema,
  response_format: responseFormatSchema,
  records: z.array(recordRowSchema),
});

export type SearchRecordsResult = z.infer<typeof searchRecordsResultSchema>;

export const searchRecordsDescription = [
  'Find mitigations and assumptions, including unlinked records. Returns kind, id, status, linked threat ids, mitigation title or assumption prose, model applicability and derived `unlinked`.',
  defaultedFileSentence,
  'Order: mitigations, then assumptions, each in register order. An assumption linked to the model is not unlinked. Removing the last link through an edit deletes the record.',
  'Use record ids for edits, saer_get_threat for one threat and its records, or saer_inspect for model-wide assumptions.',
  'Filters combine: `kind`, `id`, `status`, `threat` and `unlinked`. `query` searches record titles and prose.',
  '`concise` omits mitigation prose. `detailed` adds it. Assumption rows are identical in both formats. Read-only.',
].join(' ');

/** Apply all filters together, including unlinked records. */
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
