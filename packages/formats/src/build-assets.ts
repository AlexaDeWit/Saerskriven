import { existsSync } from 'node:fs';

/** The environment variable naming the flake-built brotli module. */
export const brotliVariable = 'SAERSKRIVEN_BROTLI_WASM';

/**
 * The brotli module a host build must carry, or a test reads.
 *
 * Both dev shells export the variable, and what it names is the path the
 * `brotli-wasm` project's build writes the module to rather than a store path,
 * so a target that carries the module declares a dependency on that build. No
 * shell carries the module or the Rust toolchain that builds it. The caller
 * supplies its own refusal and names the recovery in it.
 */
export function brotliWasmAsset(refuse: (sentence: string) => never): string {
  const module = process.env[brotliVariable];
  if (module === undefined || module === '') {
    refuse(
      `${brotliVariable} is unset, so this build has no brotli module. nix build .#brotli-wasm writes one under lib/saerskriven_brotli.wasm.`,
    );
  }
  return existsSync(module)
    ? module
    : refuse(`${brotliVariable} names ${module}, which is not there.`);
}
