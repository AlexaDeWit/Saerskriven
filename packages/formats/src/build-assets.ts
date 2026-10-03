import { flakeModuleAsset } from '@saerskriven/wasm/build-assets';

/** The environment variable naming the flake-built brotli module. */
export const brotliVariable = 'SAERSKRIVEN_BROTLI_WASM';

/**
 * The name the brotli module is built under, and carried under beside a
 * bundle.
 */
export const brotliWasmFile = 'saerskriven_brotli.wasm';

/**
 * The brotli module a host build must carry, or a test reads, as
 * `flakeModuleAsset` on `@saerskriven/wasm/build-assets` locates every
 * flake-built module. The caller supplies its own refusal and names the
 * recovery in it.
 */
export function brotliWasmAsset(refuse: (sentence: string) => never): string {
  return flakeModuleAsset(
    {
      variable: brotliVariable,
      output: 'brotli-wasm',
      file: brotliWasmFile,
      holds: 'brotli module',
    },
    refuse,
  );
}
