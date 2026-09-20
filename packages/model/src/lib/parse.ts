import { Data, Either } from 'effect';
import type { z } from 'zod';
import { modelSchema } from './model.js';
import {
  issueFloodCode,
  toParseIssues,
  type ParseIssue,
  type SchemaIssue,
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
 * A schema as the one method {@link boundedParse} calls, declared
 * structurally so no zod type crosses a fallible signature.
 */
export type SchemaParser<Value> = {
  readonly safeParse: (given: unknown) =>
    | { readonly success: true; readonly data: Value }
    | {
        readonly success: false;
        readonly error: { readonly issues: readonly SchemaIssue[] };
      };
};

/**
 * Why {@link boundedParse} produced no value. zod hands a nested value's
 * issues to its parent as the arguments of one call, so enough of them under
 * one array element throw `RangeError` in every engine: that is `IssueFlood`.
 * Any other throw from the parse is `Threw`.
 */
export type SchemaFailure = Data.TaggedEnum<{
  Refused: { readonly issues: readonly ParseIssue[] };
  IssueFlood: {};
  Threw: { readonly reason: string };
}>;

/** Constructors for {@link SchemaFailure}, with Effect's `$is` and `$match`. */
export const SchemaFailure = Data.taggedEnum<SchemaFailure>();

/** A schema's parse as a value, whatever the parse threw included. */
export function boundedParse<Value>(
  schema: SchemaParser<Value>,
  given: unknown,
): Either.Either<Value, SchemaFailure> {
  return Either.flatMap(
    Either.try({
      try: () => schema.safeParse(given),
      catch: (error) =>
        error instanceof RangeError
          ? SchemaFailure.IssueFlood()
          : SchemaFailure.Threw({ reason: String(error) }),
    }),
    (parsed) =>
      parsed.success
        ? Either.right(parsed.data)
        : Either.left(
            SchemaFailure.Refused({
              issues: toParseIssues(parsed.error.issues, given),
            }),
          ),
  );
}

/** A failure as issues, a flood or a throw as one issue at the root. */
export function schemaFailureIssues(
  failure: SchemaFailure,
): readonly ParseIssue[] {
  return SchemaFailure.$match(failure, {
    Refused: ({ issues }): readonly ParseIssue[] => issues,
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
 * parse boundary, so no zod type appears in the exported surface.
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
