import { stop } from '@saerskriven/model/fixtures';
import { readFileSync } from 'node:fs';
import { brotliVariable, brotliWasmAsset } from './build-assets.js';

/**
 * Whether the variable naming the brotli module is unset or empty, which is
 * what running outside the flake shell looks like, so a suite that runs the
 * module skips there. Inside the shell the variable is always set, and a
 * module that is not at the path it names fails the suite.
 */
export const brotliUnbuilt =
  process.env[brotliVariable] === undefined ||
  process.env[brotliVariable] === '';

let built: Uint8Array | undefined;

/** The flake-built brotli module, read once per suite. */
export const brotliWasm = (): Uint8Array =>
  (built ??= new Uint8Array(readFileSync(brotliWasmAsset(stop))));
