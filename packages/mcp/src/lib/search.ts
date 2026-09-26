import { quotedForTerminal } from '@saerskriven/formats';
import { diagramsNamed, type Model } from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import { fileArgumentSchema } from './inspect.js';

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
      'Text to look for, compared without case as a substring of the fields listed in this tool description. Left out, every record the other filters keep is a match.',
    ),
  response_format: responseFormatSchema
    .default('concise')
    .describe(
      'How much of each match to return. `concise` is the identifying fields. `detailed` adds the whole record and carries fewer matches before the listing is cut, so narrow the search before asking for it.',
    ),
  offset: z
    .int()
    .nonnegative()
    .optional()
    .describe(
      'How many matches to skip before the listing starts, counted in the order the matches come in. Left out, the listing starts at the first match. A listing cut at its limit names the offset of its next page. The server keeps no session between calls, so compare the `revision` of each page: where it changed, the file changed between the calls, and the pages can skip or repeat a match.',
    ),
});

/** Which page of its matches a search carries: its response format and offset. */
export type SearchPage = Pick<
  z.infer<typeof searchArgumentsSchema>,
  'response_format' | 'offset'
>;

/** How many matches one result carries, per response format. */
export const searchLimits = { concise: 50, detailed: 20 } as const;

/**
 * What a search matched, where the result starts in that listing, and how
 * much of it the result carries. `nextOffset` is present where matches remain
 * past this page.
 */
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

/**
 * The page of matches starting at the offset, or at the first match where
 * the call names none, cut to {@link searchLimits} for the response format,
 * beside the count of everything that matched.
 */
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

/**
 * What a search matched, as the lines of its text result. A page that is not
 * the whole listing says where it starts, and a cut one names the offset of
 * the next page, the `narrowing` arguments, and the concise form where the
 * search was detailed.
 */
export function renderCounts(
  counts: SearchCounts,
  format: ResponseFormat,
  narrowing: readonly string[],
): readonly string[] {
  const matches =
    counts.offset === 0 && counts.nextOffset === undefined
      ? `matches: ${String(counts.matched)}`
      : `matches: ${String(counts.matched)}, of which this result carries ${String(counts.returned)} from offset ${String(counts.offset)}`;
  return counts.nextOffset === undefined
    ? [matches]
    : [
        matches,
        `The listing stopped at its limit, so it is not the whole answer. Repeat the call with \`offset\` ${String(counts.nextOffset)} for the next page. Narrow it with ${narrowing.join(', ')}${format === 'detailed' ? ', or ask for the concise form' : ''}.`,
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
    : Either.left([
        `The model holds no diagram named ${quotedForTerminal(named)}.`,
        'Call saer_inspect for the id and the title of every diagram it holds.',
      ]);
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
