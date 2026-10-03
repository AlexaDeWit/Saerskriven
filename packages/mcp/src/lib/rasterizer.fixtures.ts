import {
  resvgVariable,
  resvgWasmAsset,
  typstFontAssets,
} from '@saerskriven/render/build-assets';
import { drawingFace, ledBy } from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { builtModule, stop, unbuilt } from '@saerskriven/wasm/fixtures';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import type { RasterizerAssets } from './render-diagram.js';

/** Whether a suite that draws skips, as `unbuilt` decides. */
export const rasterizerUnbuilt = unbuilt(resvgVariable);

const rasterizerWasm = builtModule(resvgWasmAsset);

/**
 * The flake-built module with the faces led by the one the drawings are
 * lettered in. The Typst compiler's own order leads with the Mono face, and a
 * rasterization offered that order letters the whole diagram in Liberation
 * Mono, so the faces are ordered by `ledBy`, as `apps/cli` orders them.
 */
export const builtRasterizer: RasterizerAssets = () =>
  Either.map(
    ledBy(
      typstFontAssets(stop),
      (font) => font.name,
      drawingFace,
      'the flake-built fonts',
    ),
    (faces): ResvgAssets => ({
      wasm: rasterizerWasm(),
      fonts: faces.map((font) => new Uint8Array(readFileSync(font.from))),
    }),
  );

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
