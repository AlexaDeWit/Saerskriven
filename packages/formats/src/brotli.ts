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

/**
 * Why a compression or a decompression produced no bytes: `_tag`
 * discriminates the refusal, following Effect's own convention.
 * `PastMaximum` is a stream whose decoded bytes would pass the caller's
 * maximum. `Malformed` is input that is not one whole standard brotli
 * stream: damaged, cut short, followed by more bytes, or claiming the
 * large-window extension. `Unusable` is about the call rather than the bytes:
 * a module that would not start, one that stopped partway, which is how an
 * allocation the module cannot make ends, and a maximum that is not a byte
 * count.
 */
export type BrotliFailure = Data.TaggedEnum<{
  PastMaximum: { readonly maximum: number };
  Malformed: {};
  Unusable: { readonly sentence: string };
}>;

/**
 * Constructors for {@link BrotliFailure}, one per variant, plus Effect's `$is`
 * and `$match` helpers.
 */
export const BrotliFailure = Data.taggedEnum<BrotliFailure>();

const pastMaximum = 1;

const calls = ['compress', 'decompress'] as const;

type Codec = BoundaryModule<(typeof calls)[number]>;

/**
 * Compresses bytes to one brotli stream at quality 11 with no custom
 * dictionary, in the smallest window that reaches back over the whole input,
 * up to 24 bits, so any standard brotli decoder reads it back. `wasm` is the
 * module `nix build .#brotli-wasm` writes.
 *
 * The compiled module is held per `wasm` array, and each call runs its own
 * instance, so the memory a call grows goes with it. That memory follows the
 * window: measured at 2.4 MiB for no input, 7.3 MiB for a 59 KB model,
 * 46 MiB for 1 MiB, and 193 MiB for 8 MiB, where the window reaches its
 * 24-bit cap.
 */
export async function compressBrotli(
  bytes: Uint8Array,
  wasm: Uint8Array,
): Promise<Either.Either<Uint8Array, BrotliFailure>> {
  const started = await instantiatedCodec(wasm);
  return Either.flatMap(started, (module) =>
    Either.map(
      run(module, bytes, () => module.compress()),
      (answer) => answer.output,
    ),
  );
}

/**
 * Decodes one brotli stream of at most `maximum` bytes, a byte count from 0
 * to 4294967295, with the module `nix build .#brotli-wasm` writes.
 *
 * A stream that would decode past the maximum is refused at the first byte
 * past it, and the rest is never decoded. The module's memory then reaches
 * the declared window (at most 16 MiB), the stream's own bytes, about twice
 * the maximum, and a few MiB of decoder tables, whatever the stream would
 * inflate to: the kept bytes grow by doubling, and the blocks a doubling frees
 * cannot hold the next one. A stream that claims the large-window extension
 * is `Malformed`.
 * Each call runs its own instance, so that memory goes with the call.
 */
export async function decompressBrotli(
  bytes: Uint8Array,
  wasm: Uint8Array,
  maximum: number,
): Promise<Either.Either<Uint8Array, BrotliFailure>> {
  if (!isUnsigned(maximum)) {
    return Either.left(
      BrotliFailure.Unusable({
        sentence: `a maximum of ${maximum} is not a byte count from 0 to ${mostUnsigned}`,
      }),
    );
  }
  const started = await instantiatedCodec(wasm);
  return Either.flatMap(started, (module) =>
    Either.flatMap(
      run(module, bytes, () => module.decompress(maximum)),
      (answer) => decoded(answer, maximum),
    ),
  );
}

async function instantiatedCodec(
  wasm: Uint8Array,
): Promise<Either.Either<Codec, BrotliFailure>> {
  return Either.mapLeft(
    await instantiated(wasm, calls, 'the module exports no brotli codec'),
    unusable,
  );
}

function run(
  module: Codec,
  bytes: Uint8Array,
  call: () => number,
): Either.Either<Answered<number>, BrotliFailure> {
  return Either.mapLeft(answered(module, bytes, call), unusable);
}

function decoded(
  answer: Answered<number>,
  maximum: number,
): Either.Either<Uint8Array, BrotliFailure> {
  if (answer.value === written) {
    return Either.right(answer.output);
  }
  return Either.left(
    answer.value === pastMaximum
      ? BrotliFailure.PastMaximum({ maximum })
      : BrotliFailure.Malformed(),
  );
}

function unusable(sentence: string): BrotliFailure {
  return BrotliFailure.Unusable({ sentence });
}
