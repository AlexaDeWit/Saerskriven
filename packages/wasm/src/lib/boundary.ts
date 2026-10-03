import { Either } from 'effect';
import { promisePerBytes } from './promise-per-bytes.js';

/**
 * The calls every module on Saerskriven's WebAssembly boundary exports beside
 * its own. Rust owns one input buffer and one output buffer: `input(length)`
 * sizes the input buffer and answers its address, and `output()` and
 * `output_length()` answer the output buffer's. Every call but a getter
 * empties the output buffer first, so it holds what the last such call wrote,
 * or nothing. `nix/wasm-module.nix` builds every such module, and
 * `docs/build.md` describes the boundary.
 */
export type BoundaryExports = {
  readonly memory: WebAssembly.Memory;
  readonly input: (length: number) => number;
  readonly output: () => number;
  readonly output_length: () => number;
};

/** One of a module's own calls, which takes and answers numbers. */
export type BoundaryCall = (...parameters: number[]) => number;

/** A module on the boundary that also exports each call in `Name`. */
export type BoundaryModule<Name extends string> = BoundaryExports &
  Readonly<Record<Name, BoundaryCall>>;

/** What a call answered, beside a copy of the output buffer it wrote. */
export type Answered<Value> = {
  readonly value: Value;
  readonly output: Uint8Array;
};

/** The status a call answers when the output buffer holds what it wrote. */
export const written = 0;

/** The largest value a call's unsigned 32-bit parameter carries. */
export const mostUnsigned = 4_294_967_295;

/** Whether `value` is a whole number a call's unsigned 32-bit parameter carries. */
export const isUnsigned = (value: number): boolean =>
  Number.isInteger(value) && value >= 0 && value <= mostUnsigned;

const boundaryCalls = ['input', 'output', 'output_length'];

const compiled = promisePerBytes<WebAssembly.Module>();

/**
 * A new instance of the module in `wasm`, which is compiled once per array.
 * Bytes that do not compile or start are Left with the sentence they failed
 * with, and a module missing the boundary's calls or one in `calls` is Left
 * with `absent`. Each call to this answers its own instance, so the memory
 * one caller grows reaches no other.
 */
export async function instantiated<Name extends string>(
  wasm: Uint8Array,
  calls: readonly Name[],
  absent: string,
): Promise<Either.Either<BoundaryModule<Name>, string>> {
  try {
    const { exports } = await WebAssembly.instantiate(
      await compiled(wasm, () => WebAssembly.compile(new Uint8Array(wasm))),
    );
    return exportsEvery(exports, calls)
      ? Either.right(exports)
      : Either.left(absent);
  } catch (error) {
    return Either.left(sentenceOf(error));
  }
}

/**
 * Writes `bytes` into the module's input buffer and answers what `call`
 * returns. The view over memory is made after `input`, which may grow it. A
 * trap, which is also how an allocation the module cannot make ends, and an
 * address past the module's memory are Left with their sentence.
 */
export function called<Value>(
  module: BoundaryExports,
  bytes: Uint8Array,
  call: () => Value,
): Either.Either<Value, string> {
  return Either.try({
    try: () => {
      const input = module.input(bytes.length) >>> 0;
      new Uint8Array(module.memory.buffer, input, bytes.length).set(bytes);
      return call();
    },
    catch: sentenceOf,
  });
}

/**
 * {@link called}, then a copy of the output buffer, whose view is made after
 * the calls that answered its address and length. Both are read unsigned.
 */
export function answered<Value>(
  module: BoundaryExports,
  bytes: Uint8Array,
  call: () => Value,
): Either.Either<Answered<Value>, string> {
  return called(module, bytes, () => {
    const value = call();
    const output = module.output() >>> 0;
    const length = module.output_length() >>> 0;
    return {
      value,
      output: new Uint8Array(module.memory.buffer, output, length).slice(),
    };
  });
}

function exportsEvery<Name extends string>(
  exports: WebAssembly.Exports,
  calls: readonly Name[],
): exports is WebAssembly.Exports & BoundaryModule<Name> {
  return (
    exports['memory'] instanceof WebAssembly.Memory &&
    [...boundaryCalls, ...calls].every(
      (name) => typeof exports[name] === 'function',
    )
  );
}

function sentenceOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
