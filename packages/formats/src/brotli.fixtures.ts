import { readFileSync } from 'node:fs';
import { brotliVariable, brotliWasmAsset } from './build-assets.js';

const stop = (sentence: string): never => {
  throw new Error(sentence);
};

/**
 * Whether the brotli module has not been built. No dev shell builds it, so a
 * suite that runs it skips where it is absent.
 */
export const brotliUnbuilt =
  process.env[brotliVariable] === undefined ||
  process.env[brotliVariable] === '';

let built: Uint8Array | undefined;

/** The flake-built brotli module, read once per suite. */
export const brotliWasm = (): Uint8Array =>
  (built ??= new Uint8Array(readFileSync(brotliWasmAsset(stop))));
