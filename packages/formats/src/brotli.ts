import type { Either } from 'effect';
import {
  compressWith,
  decompressWith,
  type CompressionFailure,
} from './lib/share-compression.js';

export { CompressionFailure as BrotliFailure } from './lib/share-compression.js';

/**
 * Standard Brotli at quality 11, with the smallest window spanning the input,
 * capped at 24 bits. Each call owns its WASM instance and memory.
 */
export function compressBrotli(
  bytes: Uint8Array,
  wasm: Uint8Array,
): Promise<Either.Either<Uint8Array, CompressionFailure>> {
  return compressWith('brotli', bytes, wasm);
}

/**
 * Decodes one whole standard Brotli stream, stopping one byte past maximum.
 * Large-window streams are refused. The window can require up to 16 MiB,
 * beside the stream, decoder tables, and about twice the output bound.
 */
export function decompressBrotli(
  bytes: Uint8Array,
  wasm: Uint8Array,
  maximum: number,
): Promise<Either.Either<Uint8Array, CompressionFailure>> {
  return decompressWith('brotli', bytes, wasm, maximum);
}
