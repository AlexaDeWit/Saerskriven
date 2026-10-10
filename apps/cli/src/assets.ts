import { reasonOf } from '@saerskriven/mcp';
import { ledBy } from '@saerskriven/render/png';
import { Either } from 'effect';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAsset, getAssetKeys, isSea } from 'node:sea';

const fontFile = /\.ttf$/u;

const embeddedPrefix = 'assets/';

const loadedModules = new Map<string, Uint8Array>();

const loaded = new Map<string, WasmAssets>();

/**
 * Where a projection's WebAssembly modules and fonts are: the `assets`
 * directory beside the bundle. A single executable has no such directory.
 * The packaging script embeds the same files in it under `assets/<name>`,
 * and a read of this path is answered from those, never from a directory
 * beside the executable.
 */
export const runtimeAssets = join(import.meta.dirname, 'assets');

/**
 * The bytes a Typst compile or a rasterization runs on: one WebAssembly
 * module, and the faces to set text in.
 */
export type WasmAssets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

/**
 * The module named `name` in `directory`, as bytes. A successful read is
 * cached per path, so every call answers the one array the compile cache in
 * `@saerskriven/wasm` is keyed by, and a refusal is read again on the next
 * call.
 */
export function wasmModule(
  directory: string,
  name: string,
): Either.Either<Uint8Array, string> {
  const path = join(directory, name);
  const known = loadedModules.get(path);
  if (known !== undefined) {
    return Either.right(known);
  }
  const found = Either.try({
    try: (): Uint8Array => bytesOf(directory, name),
    catch: reasonOf,
  });
  if (Either.isRight(found)) {
    loadedModules.set(path, found.right);
  }
  return found;
}

/**
 * The module named `name` in `directory` and every `.ttf` beside it, never
 * the host's own fonts. The faces come in name order with `leading` first, as
 * `ledBy` from the `png` subpath orders them. A directory with no face is
 * refused, since a compiler or renderer given none draws no text. A
 * successful read is cached per directory, module and leading face, and a
 * refusal is read again on the next call.
 */
export function wasmAssets(
  directory: string,
  name: string,
  leading?: string,
): Either.Either<WasmAssets, string> {
  const key = `${directory}\0${name}\0${leading ?? ''}`;
  const known = loaded.get(key);
  return known === undefined
    ? read(key, directory, name, leading)
    : Either.right(known);
}

function read(
  key: string,
  directory: string,
  name: string,
  leading: string | undefined,
): Either.Either<WasmAssets, string> {
  const found = Either.flatMap(wasmModule(directory, name), (wasm) =>
    Either.flatMap(
      Either.try({ try: () => facesIn(directory), catch: reasonOf }),
      (faces) => lettered({ wasm, faces }, directory, leading),
    ),
  );
  if (Either.isRight(found)) {
    loaded.set(key, found.right);
  }
  return found;
}

function lettered(
  listed: { readonly wasm: Uint8Array; readonly faces: readonly string[] },
  directory: string,
  leading: string | undefined,
): Either.Either<WasmAssets, string> {
  return Either.flatMap(offered(listed.faces, directory, leading), (faces) =>
    Either.try({
      try: (): WasmAssets => ({
        wasm: listed.wasm,
        fonts: faces.map((face) => new Uint8Array(bytesOf(directory, face))),
      }),
      catch: reasonOf,
    }),
  );
}

function offered(
  faces: readonly string[],
  directory: string,
  leading: string | undefined,
): Either.Either<readonly string[], string> {
  if (faces.length === 0) {
    return Either.left(`${directory} holds no .ttf font face`);
  }
  return leading === undefined
    ? Either.right(faces)
    : ledBy(faces, (face) => face, leading, directory);
}

function facesIn(directory: string): readonly string[] {
  const names = namesIn(directory).filter((name) => fontFile.test(name));
  names.sort();
  return names;
}

function embeddedIn(directory: string): boolean {
  return isSea() && directory === runtimeAssets;
}

function bytesOf(directory: string, name: string): Uint8Array {
  return embeddedIn(directory)
    ? new Uint8Array(getAsset(`${embeddedPrefix}${name}`))
    : readFileSync(join(directory, name));
}

function namesIn(directory: string): string[] {
  return embeddedIn(directory)
    ? getAssetKeys()
        .filter((key) => key.startsWith(embeddedPrefix))
        .map((key) => key.slice(embeddedPrefix.length))
    : readdirSync(directory);
}
