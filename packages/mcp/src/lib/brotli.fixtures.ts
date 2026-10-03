import {
  brotliVariable,
  brotliWasmAsset,
} from '@saerskriven/formats/build-assets';
import { builtModule, unbuilt } from '@saerskriven/wasm/fixtures';
import { Either } from 'effect';
import type { BrotliModule } from './share-link.js';

/** Whether a suite that writes a share link skips, as `unbuilt` decides. */
export const brotliUnbuilt = unbuilt(brotliVariable);

/** The flake-built brotli module, read once per suite. */
export const brotliWasm = builtModule(brotliWasmAsset);

/** The flake-built module as a server is handed it. */
export const builtBrotli: BrotliModule = () => Either.right(brotliWasm());

/**
 * Bytes that are no WebAssembly module, for the wording of a module that will
 * not start.
 */
export const brokenBrotli: BrotliModule = () =>
  Either.right(new Uint8Array([0, 1, 2, 3]));
