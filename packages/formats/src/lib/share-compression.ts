import {
  answered,
  instantiated,
  isUnsigned,
  mostUnsigned,
  written,
  type Answered,
  type BoundaryModule,
} from '@saerskriven/wasm';
import { Data, Either } from 'effect';
import { readLimits } from './read-limits.js';

/** Failure of a bounded codec call through the shared WASM module. */
export type CompressionFailure = Data.TaggedEnum<{
  PastMaximum: { readonly maximum: number };
  Malformed: {};
  Unusable: { readonly sentence: string };
}>;

/** Constructors and matchers for codec failures. */
export const CompressionFailure = Data.taggedEnum<CompressionFailure>();

const profiles = {
  brotli: ['compress', 'decompress'],
  ppmd: ['compress_ppmd', 'decompress_ppmd'],
} as const;

type Profile = keyof typeof profiles;
type Call = (typeof profiles)[Profile][number];
type Codec = BoundaryModule<Call>;

/** Compresses through one selected pair of module calls. */
export async function compressWith(
  profile: Profile,
  bytes: Uint8Array,
  wasm: Uint8Array,
): Promise<Either.Either<Uint8Array, CompressionFailure>> {
  const [compress] = profiles[profile];
  return Either.flatMap(await start(profile, wasm), (module) =>
    Either.flatMap(
      run(module, bytes, () => module[compress]()),
      (answer) => decoded(answer, readLimits.maxTextBytes),
    ),
  );
}

/** Decodes through one selected pair of module calls within the caller's bound. */
export async function decompressWith(
  profile: Profile,
  bytes: Uint8Array,
  wasm: Uint8Array,
  maximum: number,
): Promise<Either.Either<Uint8Array, CompressionFailure>> {
  if (!isUnsigned(maximum)) {
    return Either.left(
      CompressionFailure.Unusable({
        sentence:
          'a maximum of ' +
          String(maximum) +
          ' is not a byte count from 0 to ' +
          String(mostUnsigned),
      }),
    );
  }
  const [, decompress] = profiles[profile];
  const bound =
    profile === 'ppmd' ? Math.min(maximum, readLimits.maxTextBytes) : maximum;
  return Either.flatMap(await start(profile, wasm), (module) =>
    Either.flatMap(
      run(module, bytes, () => module[decompress](bound)),
      (answer) => decoded(answer, bound),
    ),
  );
}

async function start(
  profile: Profile,
  wasm: Uint8Array,
): Promise<Either.Either<Codec, CompressionFailure>> {
  return Either.mapLeft(
    await instantiated<Call>(
      wasm,
      profiles[profile],
      'the module exports no ' + profile + ' codec',
    ),
    unusable,
  );
}

function run(
  module: Codec,
  bytes: Uint8Array,
  call: () => number,
): Either.Either<Answered<number>, CompressionFailure> {
  return Either.mapLeft(answered(module, bytes, call), unusable);
}

function decoded(
  answer: Answered<number>,
  maximum: number,
): Either.Either<Uint8Array, CompressionFailure> {
  if (answer.value === written) return Either.right(answer.output);
  return Either.left(
    answer.value === 1
      ? CompressionFailure.PastMaximum({ maximum })
      : CompressionFailure.Malformed(),
  );
}

function unusable(sentence: string): CompressionFailure {
  return CompressionFailure.Unusable({ sentence });
}
