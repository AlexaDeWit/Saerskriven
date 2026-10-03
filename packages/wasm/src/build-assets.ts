import { existsSync } from 'node:fs';

/**
 * A WebAssembly module the flake builds: the variable the flake names its path
 * in, the flake output that builds it, the file it is written to under
 * `lib/`, and what a build without it lacks, for the refusal's sentence.
 */
export type FlakeModule = {
  readonly variable: string;
  readonly output: string;
  readonly file: string;
  readonly holds: string;
};

/**
 * The module a host build must carry, or a test reads, at the path its
 * variable names.
 *
 * Both dev shells export the variable, and what it names is the path the
 * module's nx project writes it to rather than a store path, so a target that
 * carries the module declares a dependency on that build instead of a caller
 * pointing the variable somewhere. No shell carries a module or the Rust
 * toolchain that builds it. The caller supplies its own refusal and names the
 * recovery in it.
 *
 * Node loads this file as source, for the CLI's build and the studio's Vite
 * configuration, through loaders that resolve no relative import, so it
 * imports none.
 */
export function flakeModuleAsset(
  module: FlakeModule,
  refuse: (sentence: string) => never,
): string {
  const path = process.env[module.variable];
  if (path === undefined || path === '') {
    refuse(
      `${module.variable} is unset, so this build has no ${module.holds}. nix build .#${module.output} writes one under lib/${module.file}.`,
    );
  }
  return existsSync(path)
    ? path
    : refuse(`${module.variable} names ${path}, which is not there.`);
}
