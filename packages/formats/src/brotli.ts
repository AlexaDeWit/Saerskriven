import { Data, Either } from 'effect';
import { promisePerBytes } from './lib/promise-per-bytes.js';

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

const written = 0;

const pastMaximum = 1;

const mostBytes = 4_294_967_295;

const calls = ['input', 'compress', 'decompress', 'output', 'output_length'];

type Codec = {
  readonly memory: WebAssembly.Memory;
  readonly input: (length: number) => number;
  readonly compress: () => number;
  readonly decompress: (maximum: number) => number;
  readonly output: () => number;
  readonly output_length: () => number;
};

type Answer = {
  readonly status: number;
  readonly bytes: Uint8Array;
};

const compiled = promisePerBytes<WebAssembly.Module>();

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
  const started = await instantiated(wasm);
  return Either.flatMap(started, (module) =>
    Either.map(
      answered(module, bytes, () => module.compress()),
      (answer) => answer.bytes,
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
  if (!Number.isInteger(maximum) || maximum < 0 || maximum > mostBytes) {
    return Either.left(
      BrotliFailure.Unusable({
        sentence: `a maximum of ${maximum} is not a byte count from 0 to ${mostBytes}`,
      }),
    );
  }
  const started = await instantiated(wasm);
  return Either.flatMap(started, (module) =>
    Either.flatMap(
      answered(module, bytes, () => module.decompress(maximum)),
      (answer) => decoded(answer, maximum),
    ),
  );
}

async function instantiated(
  wasm: Uint8Array,
): Promise<Either.Either<Codec, BrotliFailure>> {
  try {
    const { exports } = await WebAssembly.instantiate(
      await compiled(wasm, () => WebAssembly.compile(new Uint8Array(wasm))),
    );
    return codes(exports)
      ? Either.right(exports)
      : Either.left(
          BrotliFailure.Unusable({
            sentence: 'the module exports no brotli codec',
          }),
        );
  } catch (error) {
    return Either.left(BrotliFailure.Unusable({ sentence: sentenceOf(error) }));
  }
}

function codes(
  exports: WebAssembly.Exports,
): exports is WebAssembly.Exports & Codec {
  return (
    exports['memory'] instanceof WebAssembly.Memory &&
    calls.every((name) => typeof exports[name] === 'function')
  );
}

function answered(
  module: Codec,
  bytes: Uint8Array,
  call: () => number,
): Either.Either<Answer, BrotliFailure> {
  try {
    const input = module.input(bytes.length) >>> 0;
    new Uint8Array(module.memory.buffer, input, bytes.length).set(bytes);
    const status = call();
    const output = module.output() >>> 0;
    const length = module.output_length() >>> 0;
    return Either.right({
      status,
      bytes: new Uint8Array(module.memory.buffer, output, length).slice(),
    });
  } catch (error) {
    return Either.left(BrotliFailure.Unusable({ sentence: sentenceOf(error) }));
  }
}

function decoded(
  answer: Answer,
  maximum: number,
): Either.Either<Uint8Array, BrotliFailure> {
  if (answer.status === written) {
    return Either.right(answer.bytes);
  }
  return Either.left(
    answer.status === pastMaximum
      ? BrotliFailure.PastMaximum({ maximum })
      : BrotliFailure.Malformed(),
  );
}

function sentenceOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
