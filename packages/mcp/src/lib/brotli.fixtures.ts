import { brotliWasm } from '@saerskriven/formats/fixtures';
import { Result } from 'effect';
import type { BrotliModule } from './share-link.js';

/** The flake-built module as a server is handed it. */
export const builtBrotli: BrotliModule = () => Result.succeed(brotliWasm());

/**
 * Bytes that are no WebAssembly module, for the wording of a module that will
 * not start.
 */
export const brokenBrotli: BrotliModule = () =>
  Result.succeed(new Uint8Array([0, 1, 2, 3]));
