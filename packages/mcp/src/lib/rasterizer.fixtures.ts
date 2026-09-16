import {
  resvgVariable,
  resvgWasmAsset,
  typstFontAssets,
} from '@saerskriven/render/build-assets';
import { drawingFace, ledBy } from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import type { RasterizerAssets } from './render-diagram.js';

/**
 * Whether the rasterizer module has been built. No dev shell exports the
 * variable naming it, since the module is built from Rust and entering a
 * shell to work on the TypeScript should pay for neither, so a suite that
 * draws skips rather than fails where it is unset.
 */
export const rasterizerUnbuilt =
  process.env[resvgVariable] === undefined || process.env[resvgVariable] === '';

/**
 * The flake-built module with the faces led by the one the drawings are
 * lettered in. The Typst compiler's own order leads with the Mono face, and a
 * rasterization offered that order letters the whole diagram in Liberation
 * Mono, so the faces are ordered by `ledBy`, as `apps/cli` orders them.
 */
export const builtRasterizer: RasterizerAssets = () =>
  Either.map(
    ledBy(
      typstFontAssets(refuse),
      (font) => font.name,
      drawingFace,
      'the flake-built fonts',
    ),
    (faces): ResvgAssets => ({
      wasm: new Uint8Array(readFileSync(resvgWasmAsset(refuse))),
      fonts: faces.map((font) => new Uint8Array(readFileSync(font.from))),
    }),
  );

function refuse(sentence: string): never {
  throw new Error(sentence);
}

/**
 * Assets a render cannot start: bytes that are no WebAssembly module. It is
 * how a suite reaches the wording of what the rasterizer refused without a
 * built module of its own to break.
 */
export const brokenRasterizer: RasterizerAssets = () =>
  Either.right({
    wasm: new Uint8Array([0, 1, 2, 3]),
    fonts: [new Uint8Array([0])],
  });
