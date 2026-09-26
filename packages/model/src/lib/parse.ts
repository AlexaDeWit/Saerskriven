import { Data, Either } from 'effect';
import type { z } from 'zod';
import { modelSchema } from './model.js';
import {
  issueFloodCode,
  toParseIssues,
  type ParseIssue,
  type ParseIssueDetail,
  type SchemaParser,
} from './parse-issue.js';
import { collectViolations } from './violations.js';

const refinedModelSchema = modelSchema.superRefine((model, ctx) => {
  for (const violation of collectViolations(model)) {
    ctx.addIssue({
      code: 'custom',
      path: [...violation.path],
      params: violation.detail,
    });
  }
});

/** A parsed model remains structurally typed. Its type alone does not prove reference validity. */
export type Model = z.infer<typeof refinedModelSchema>;

/**
 * Why {@link boundedParse} produced no value. zod hands a nested value's
 * issues to its parent as the arguments of one call, so enough of them under
 * one array element throw `RangeError` in every engine: that is `IssueFlood`.
 * Any other throw from the parse is `Threw`. `Named` is the detail a caller's
 * own schemas name, as `toParseIssues` reads it.
 */
export type SchemaFailure<Named = never> = Data.TaggedEnum<{
  Refused: {
    readonly issues: readonly ParseIssue<ParseIssueDetail | Named>[];
  };
  IssueFlood: {};
  Threw: { readonly reason: string };
}>;

interface SchemaFailureDefinition extends Data.TaggedEnum.WithGenerics<1> {
  readonly taggedEnum: SchemaFailure<this['A']>;
}

/** Constructors for {@link SchemaFailure}, with Effect's `$is` and `$match`. */
export const SchemaFailure = Data.taggedEnum<SchemaFailureDefinition>();

/**
 * A schema's parse as a value, whatever the parse threw included. `named`
 * accepts the details a caller's own schemas name, as `toParseIssues` reads
 * them.
 */
export function boundedParse<Value, Named = never>(
  schema: SchemaParser<Value>,
  given: unknown,
  named?: SchemaParser<Named>,
): Either.Either<Value, SchemaFailure<Named>> {
  return Either.flatMap(
    Either.try({
      try: () => schema.safeParse(given),
      catch: (error) =>
        error instanceof RangeError
          ? SchemaFailure.IssueFlood<Named>()
          : SchemaFailure.Threw<Named>({ reason: String(error) }),
    }),
    (parsed) =>
      parsed.success
        ? Either.right(parsed.data)
        : Either.left(
            SchemaFailure.Refused({
              issues: toParseIssues(parsed.error.issues, given, named),
            }),
          ),
  );
}

/** A failure as issues, a flood or a throw as one issue at the root. */
export function schemaFailureIssues<Named>(
  failure: SchemaFailure<Named>,
): readonly ParseIssue<ParseIssueDetail | Named>[] {
  return SchemaFailure.$match(failure, {
    Refused: ({ issues }) => issues,
    IssueFlood: (): readonly ParseIssue[] => [
      { path: [], detail: { code: issueFloodCode } },
    ],
    Threw: ({ reason }): readonly ParseIssue[] => [
      { path: [], detail: { code: 'schema-threw', parameters: { reason } } },
    ],
  });
}

/**
 * Why parseModel refused an input, as tagged data: zod stays behind the
 * parse boundary, so no zod type appears on this failure.
 */
export type ParseFailure = Data.TaggedEnum<{
  InvalidModel: { readonly issues: readonly ParseIssue[] };
}>;

/** Constructors for {@link ParseFailure}, with Effect's `$is` and `$match`. */
export const ParseFailure = Data.taggedEnum<ParseFailure>();

/** Parses model structure, unique identities, issuance bookkeeping and diagram-local references. */
export function parseModel(input: unknown): Either.Either<Model, ParseFailure> {
  return Either.mapLeft(boundedParse(refinedModelSchema, input), (failure) =>
    ParseFailure.InvalidModel({ issues: schemaFailureIssues(failure) }),
  );
}
