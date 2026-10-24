import { quotedForTerminal } from '@saerskriven/formats';
import { diagramsNamed, type Model } from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import { fileArgumentSchema } from './path-arguments.js';

/**
 * How much of each match a search carries back: the identifying fields, or
 * the whole record with fewer matches before the cut.
 */
export const responseFormatSchema = z.enum(['concise', 'detailed']);

/** How much of each match a search carries back. */
export type ResponseFormat = z.infer<typeof responseFormatSchema>;

/** The arguments every search takes, extended with each search's own filters. */
export const searchArgumentsSchema = fileArgumentSchema.extend({
  query: z
    .string()
    .optional()
    .describe(
      'Case-insensitive substring of the fields this tool searches. Omit to match every record kept by the other filters.',
    ),
  response_format: responseFormatSchema
    .default('concise')
    .describe(
      '`concise` returns identifying fields, at most 50 matches. `detailed` returns whole records, at most 20. Filter before requesting details.',
    ),
  offset: z
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Matches to skip, default 0. Use `nextOffset` for the next page. Compare page revisions: a changed file can skip or repeat matches.',
    ),
});

/** Which page of its matches a search carries: its response format and offset. */
export type SearchPage = Pick<
  z.infer<typeof searchArgumentsSchema>,
  'response_format' | 'offset'
>;

/** How many matches one result carries, per response format. */
export const searchLimits = { concise: 50, detailed: 20 } as const;

/** Pagination counts. `nextOffset` exists only when matches remain. */
export const searchCountsSchema = z.object({
  matched: z.int().nonnegative(),
  offset: z.int().nonnegative(),
  returned: z.int().nonnegative(),
  truncated: z.boolean(),
  nextOffset: z.int().positive().optional(),
});

/** What a search matched, and how much of that the result carries. */
export type SearchCounts = z.infer<typeof searchCountsSchema>;

/** The matches a result carries, one page of the whole listing. */
export type LimitedRows<Row> = {
  readonly rows: readonly Row[];
  readonly counts: SearchCounts;
};

/** Slice a page without changing match order. */
export function limitedRows<Row>(
  matched: readonly Row[],
  page: SearchPage,
): LimitedRows<Row> {
  const offset = page.offset ?? 0;
  const end = offset + searchLimits[page.response_format];
  const rows = matched.slice(offset, end);
  const truncated = matched.length > end;
  return {
    rows,
    counts: {
      matched: matched.length,
      offset,
      returned: rows.length,
      truncated,
      ...(truncated ? { nextOffset: end } : {}),
    },
  };
}

/** Include the next offset and narrowing filters for truncated pages. */
export function renderCounts(
  counts: SearchCounts,
  format: ResponseFormat,
  narrowing: readonly string[],
): readonly string[] {
  const matches =
    counts.offset === 0 && counts.nextOffset === undefined
      ? `matches: ${String(counts.matched)}`
      : `matches: ${String(counts.matched)}, returned: ${String(counts.returned)}, offset: ${String(counts.offset)}`;
  return counts.nextOffset === undefined
    ? [matches]
    : [
        matches,
        `Truncated. Use \`offset\` ${String(counts.nextOffset)} for the next page. Narrow it with ${narrowing.join(', ')}${format === 'detailed' ? ', or ask for the concise form' : ''}.`,
      ];
}

/**
 * The lines refusing a diagram name that is no diagram's id or title, and
 * pointing to the tool that lists them.
 */
export function noDiagramNamed(name: string): readonly string[] {
  return [
    `The model holds no diagram named ${quotedForTerminal(name)}.`,
    'Call saer_inspect for the id and the title of every diagram it holds.',
  ];
}

/**
 * The diagrams a `diagram` argument names by id or exact title, every
 * diagram where it names none, or the lines refusing a name no diagram
 * carries.
 */
export function diagramsOf(
  model: Model,
  named: string | undefined,
): Either.Either<Model['diagrams'], readonly string[]> {
  if (named === undefined) {
    return Either.right(model.diagrams);
  }
  const selected = diagramsNamed(model.diagrams, named);
  return selected.length > 0
    ? Either.right(selected)
    : Either.left(noDiagramNamed(named));
}

/**
 * Whether the query occurs in any of the texts, compared without case. An
 * absent query matches every record.
 */
export function matchesQuery(
  query: string | undefined,
  texts: readonly string[],
): boolean {
  if (query === undefined) {
    return true;
  }
  const wanted = query.toLowerCase();
  return texts.some((text) => text.toLowerCase().includes(wanted));
}
