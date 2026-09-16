import { reasonOf } from '@saerskriven/mcp';
import { ledBy } from '@saerskriven/render/png';
import { Either } from 'effect';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const fontFile = /\.ttf$/u;

const loaded = new Map<string, WasmAssets>();

/**
 * Where the executable carries what a projection reads: the WebAssembly
 * modules and the fonts, beside the bundle rather than beside the sources,
 * because `deno compile --include` puts that directory into the executable
 * and `import.meta.dirname` is how the code inside one reaches it.
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
 * The module named `wasmModule` in `directory` and every `.ttf` beside it,
 * never the host's own fonts. The faces come in name order with `leading`
 * first, as `ledBy` from the `png` subpath orders them. A directory with no
 * face is refused, since a compiler or renderer given none draws no text. A
 * successful read is cached per directory, module and leading face, and a
 * refusal is read again on the next call.
 */
export function wasmAssets(
  directory: string,
  wasmModule: string,
  leading?: string,
): Either.Either<WasmAssets, string> {
  const key = `${directory}\0${wasmModule}\0${leading ?? ''}`;
  const known = loaded.get(key);
  return known === undefined
    ? read(key, directory, wasmModule, leading)
    : Either.right(known);
}

function read(
  key: string,
  directory: string,
  wasmModule: string,
  leading: string | undefined,
): Either.Either<WasmAssets, string> {
  const found = Either.flatMap(
    Either.try({
      try: () => ({
        wasm: readFileSync(join(directory, wasmModule)),
        faces: facesIn(directory),
      }),
      catch: reasonOf,
    }),
    (listed) => lettered(listed, directory, leading),
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
        fonts: faces.map(
          (face) => new Uint8Array(readFileSync(join(directory, face))),
        ),
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
  const names = readdirSync(directory).filter((name) => fontFile.test(name));
  names.sort();
  return names;
}
