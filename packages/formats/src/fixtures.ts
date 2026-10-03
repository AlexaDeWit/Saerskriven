import { builtModule, unbuilt } from '@saerskriven/wasm/fixtures';
import { brotliVariable, brotliWasmAsset } from './build-assets.js';

/** Whether a suite that runs the brotli module skips, as `unbuilt` decides. */
export const brotliUnbuilt = unbuilt(brotliVariable);

/** The flake-built brotli module, read once per suite. */
export const brotliWasm = builtModule(brotliWasmAsset);
