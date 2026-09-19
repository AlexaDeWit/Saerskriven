import {
  parseModel,
  toParseIssues,
  type Model,
  type ParseIssue,
  type SchemaIssue,
} from '@saerskriven/model';
import { Data, Either } from 'effect';
import type { z } from 'zod';
import type { Divergence } from './divergence.js';
import type { ReadLimit } from './read-limits.js';

/**
 * A file format, read and written.
 *
 * The type parameter is the format's own zod schema, `wire` carries it, and
 * `write` accepts only a document that schema describes. The types do not
 * check what a wire schema owes this contract: it declares everything its
 * format carries, the parts Saerskriven does not model included, since a
 * merge leaves only a declared key untouched. It drops what it does not
 * declare, which `read` reports as `undeclared`. It neither transforms nor
 * coerces a value it round-trips.
 *
 * `write` given a source document merges onto it, and given none projects
 * the model into the format's canonical form. A merge of an unedited model
 * onto the document it was read from reports nothing the model or an edit
 * caused, though a codec may still report its own decision, such as the
 * release it stamps. The type pairs a document with its format rather than
 * with a file, so merging onto a document some other read produced is the
 * caller's mistake to avoid.
 *
 * `write` returns no `Either`: what the format cannot hold is a divergence
 * rather than a failure, so a caller asking what a save would cost calls
 * `write` and discards the output.
 */
export interface Codec<WireSchema extends z.ZodType<object>> {
  readonly wire: WireSchema;
  read(text: string): Either.Either<ReadResult<WireSchema>, ReadFailure>;
  write(model: Model, source?: z.infer<WireSchema>): WriteResult;
}

/**
 * What a read produced. `source` is the wire document, returned so a later
 * write can merge onto it and keep what the model does not describe.
 * `divergences` holds both the keys the schema dropped (`undeclared`) and the
 * values the model holds less exactly than the file stated (`narrowed`).
 */
export type ReadResult<WireSchema extends z.ZodType<object>> = {
  readonly model: Model;
  readonly source: z.infer<WireSchema>;
  readonly divergences: readonly Divergence[];
};

/**
 * What a write produced: the output text, and where it does not correspond to
 * the model or to the source it was merged onto.
 */
export type WriteResult = {
  readonly output: string;
  readonly divergences: readonly Divergence[];
};

/**
 * Why a codec refused a text, in the order a read reaches each stop.
 * `ExceededReadLimit` names the bound and what the read measured before it
 * stopped. `MalformedText` carries the parser's message, since no path into
 * a document exists yet. `InvalidWireDocument` has paths into the wire
 * document, and `InvalidModel` paths into the internal model.
 */
export type ReadFailure = Data.TaggedEnum<{
  ExceededReadLimit: {
    readonly limit: ReadLimit;
    readonly bound: number;
    readonly observed: number;
  };
  MalformedText: { readonly message: string };
  InvalidWireDocument: { readonly issues: readonly ParseIssue[] };
  InvalidModel: { readonly issues: readonly ParseIssue[] };
}>;

/** Constructors and matchers for {@link ReadFailure}. */
export const ReadFailure = Data.taggedEnum<ReadFailure>();

/**
 * A wire schema, declared by the one method a read calls so no zod type
 * crosses {@link parseWire}'s signature.
 */
export type WireParser<Wire> = {
  readonly safeParse: (given: unknown) =>
    | { readonly success: true; readonly data: Wire }
    | {
        readonly success: false;
        readonly error: { readonly issues: readonly SchemaIssue[] };
      };
};

/**
 * A parsed value as its wire document, or the schema's refusal as
 * `InvalidWireDocument`. zod hands a nested value's issues to its parent as
 * the arguments of one call, so about 125,000 of them under one array
 * element throw `RangeError`, and that refusal is one root issue instead.
 * Any other throw is a defect in a schema and is not caught.
 */
export function parseWire<Wire>(
  schema: WireParser<Wire>,
  given: unknown,
): Either.Either<Wire, ReadFailure> {
  return Either.flatMap(
    Either.try({
      try: () => schema.safeParse(given),
      catch: (error) => {
        if (error instanceof RangeError) {
          return issueFlood;
        }
        throw error;
      },
    }),
    (parsed) =>
      parsed.success
        ? Either.right(parsed.data)
        : Either.left(
            ReadFailure.InvalidWireDocument({
              issues: toParseIssues(parsed.error.issues),
            }),
          ),
  );
}

const issueFlood = ReadFailure.InvalidWireDocument({
  issues: [
    {
      path: [],
      code: 'too_big',
      message: 'The document has more problems than a read can list.',
    },
  ],
});

/** A mapped model input through `parseModel`, refused as `InvalidModel`. */
export function modelFrom(input: unknown): Either.Either<Model, ReadFailure> {
  return Either.mapLeft(parseModel(input), (failure) =>
    ReadFailure.InvalidModel({ issues: failure.issues }),
  );
}
