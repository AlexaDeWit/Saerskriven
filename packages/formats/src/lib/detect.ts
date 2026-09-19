import { issueFloodCode } from '@saerskriven/model';
import type { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import { threatDragonWireSchema } from '@saerskriven/wire-threat-dragon';
import { Data, Either } from 'effect';
import { z } from 'zod';
import { ReadFailure, type Codec, type ReadResult } from './codec.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';
import { threatDragonCodec } from './threat-dragon.js';

/** The formats {@link readAnyFormat} tries, as a caller prints them. */
export const formatNameSchema = z.enum(['threat-dragon', 'saerskriven-yaml']);

/** One registered format, named. */
export type FormatName = z.infer<typeof formatNameSchema>;

/**
 * A read and the codec that answered it, one member per registered codec.
 * Narrowing on `format` pairs `source` with its own codec, so
 * `codec.write(model, source)` type-checks without an assertion.
 */
export type DetectedRead =
  | Answer<'threat-dragon', typeof threatDragonWireSchema>
  | Answer<'saerskriven-yaml', typeof saerskrivenYamlV2WireSchema>;

/**
 * No registered codec claimed the text. `tried` names every format offered
 * it, in order, and no codec's issues are carried, since a codec that did not
 * claim was describing a document nobody wrote.
 */
export type DetectionFailure = Data.TaggedEnum<{
  NoFormatClaimed: { readonly tried: readonly FormatName[] };
}>;

/** Constructors and matchers for {@link DetectionFailure}. */
export const DetectionFailure = Data.taggedEnum<DetectionFailure>();

/**
 * A text read by whichever registered codec claims it, the file name never
 * consulted. The codecs are tried by reading, Threat Dragon first because a
 * YAML text stops the JSON parser at its first character, where the reverse
 * order would run the YAML parser over every Threat Dragon file.
 *
 * A codec claims a text when its read succeeds, when the model refuses the
 * mapping, or when its wire schema refuses the document below the root keys
 * that name the format. It declines malformed syntax and a refusal at or
 * above a naming key, so a file that lost `summary` whole is no format's,
 * while one that lost `summary.title` is a broken Threat Dragon file. A
 * claimed failure is returned as that codec's own, and an
 * `ExceededReadLimit` stops detection outright, since the next codec would
 * pay the same cost. A refusal with more issues than the wire schema could
 * gather is claimed too, since the schema found them by walking into the
 * document. A file from an unmodelled release, such as a
 * `formatVersion` other than 1 and 2, is claimed by nobody.
 */
export function readAnyFormat(
  text: string,
): Either.Either<DetectedRead, ReadFailure | DetectionFailure> {
  for (const entry of registry) {
    const answer = entry.read(text);
    if (answer !== undefined) {
      return answer;
    }
  }
  return Either.left(
    DetectionFailure.NoFormatClaimed({
      tried: registry.map((entry) => entry.format),
    }),
  );
}

type DiscriminatorPath = readonly string[];

type Verdict = 'bounded' | 'claimed' | 'declined';

type Answer<
  Name extends FormatName,
  WireSchema extends z.ZodType<object>,
> = ReadResult<WireSchema> & {
  readonly format: Name;
  readonly codec: Codec<WireSchema>;
};

const threatDragonDiscriminators: readonly DiscriminatorPath[] = [
  ['version'],
  ['summary'],
  ['detail'],
];

const saerskrivenYamlDiscriminators: readonly DiscriminatorPath[] = [
  ['formatVersion'],
];

type Attempt = {
  readonly format: FormatName;
  readonly read: (
    text: string,
  ) => Either.Either<DetectedRead, ReadFailure> | undefined;
};

const registry: readonly Attempt[] = [
  attempt('threat-dragon', threatDragonCodec, threatDragonDiscriminators),
  attempt(
    'saerskriven-yaml',
    saerskrivenYamlCodec,
    saerskrivenYamlDiscriminators,
  ),
];

function attempt<Name extends FormatName, WireSchema extends z.ZodType<object>>(
  format: Name,
  codec: Codec<WireSchema>,
  discriminators: readonly DiscriminatorPath[],
) {
  return {
    format,
    read: (text: string) => {
      const reading = codec.read(text);
      if (Either.isRight(reading)) {
        return Either.right({ format, codec, ...reading.right });
      }
      return verdictOn(reading.left, discriminators) === 'declined'
        ? undefined
        : Either.left(reading.left);
    },
  };
}

function verdictOn(
  failure: ReadFailure,
  discriminators: readonly DiscriminatorPath[],
): Verdict {
  return ReadFailure.$match(failure, {
    ExceededReadLimit: (): Verdict => 'bounded',
    MalformedText: (): Verdict => 'declined',
    InvalidWireDocument: ({ issues }): Verdict =>
      issues.some((issue) => issue.code === issueFloodCode) ||
      !issues.some((issue) =>
        discriminators.some((discriminator) =>
          atOrAbove(issue.path, discriminator),
        ),
      )
        ? 'claimed'
        : 'declined',
    InvalidModel: (): Verdict => 'claimed',
  });
}

function atOrAbove(
  issue: readonly (string | number)[],
  discriminator: DiscriminatorPath,
): boolean {
  return (
    issue.length <= discriminator.length &&
    issue.every((segment, index) => segment === discriminator[index])
  );
}
