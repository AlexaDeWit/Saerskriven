import type { Either } from 'effect';
import {
  compressWith,
  decompressWith,
  type CompressionFailure,
} from './lib/share-compression.js';

export { CompressionFailure as PpmdFailure } from './lib/share-compression.js';

/**
 * Encodes at most 8 MiB with PPMd7, order 8 and a 4 MiB model. The frame
 * carries the decoded byte count and CRC32 as little-endian u32s, then
 * the range-coded bytes including an end marker.
 */
export function compressPpmd(
  bytes: Uint8Array,
  wasm: Uint8Array,
): Promise<Either.Either<Uint8Array, CompressionFailure>> {
  return compressWith('ppmd', bytes, wasm);
}

/**
 * Decodes a complete PPMd frame. The declared size must fit maximum and
 * 8 MiB before allocation. The checksum, end marker, and input consumption
 * must agree. The caller owns any wall-clock deadline.
 */
export function decompressPpmd(
  bytes: Uint8Array,
  wasm: Uint8Array,
  maximum: number,
): Promise<Either.Either<Uint8Array, CompressionFailure>> {
  return decompressWith('ppmd', bytes, wasm, maximum);
}
