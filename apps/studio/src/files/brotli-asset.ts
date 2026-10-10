import brotliWasmUrl from 'virtual:saerskriven-brotli-wasm?url';
import { fetchBytes, once, type Loaded } from './asset-loader.js';

/** The share codec module, with no dependency on a browser window. */
export const loadBrotliModule: Loaded<Uint8Array> = once(() =>
  fetchBytes(brotliWasmUrl),
);
