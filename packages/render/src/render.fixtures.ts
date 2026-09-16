import type { Diagram, Model } from '@saerskriven/model';
import { committedModel } from '@saerskriven/model/fixtures';
import { readFileSync } from 'node:fs';
import {
  resvgVariable,
  resvgWasmAsset,
  typstFontAssets,
  typstWasmModule,
  type TypstFontAsset,
} from './build-assets.js';
import type { PdfAssets } from './pdf.js';

const svgSuffix = '.snapshot.svg';

const pngSuffix = '.snapshot.png';

/** The Écluse model in the internal form. */
export const ecluseModel: Model = committedModel('ecluse.model.json');

/** The model that draws every glyph and every badge tone. */
export const everyGlyphModel: Model = committedModel('every-glyph.model.json');

/** Saerskriven's own threat model in the internal form, two diagrams. */
export const saerskrivenModel: Model = committedModel('saerskriven.model.json');

/**
 * One diagram this package commits goldens for: `svg` is the drawing as a
 * document and `png` is that same drawing rasterized, named from it so the
 * pair cannot drift apart.
 */
export type GoldenDocument = {
  readonly name: string;
  readonly model: Model;
  readonly diagram: number;
  readonly svg: string;
  readonly png: string;
};

/**
 * Every diagram the goldens cover. Each suite over them drives off this one
 * list, so a further model or diagram joins all of them by being added here.
 */
export const goldenDocuments: readonly GoldenDocument[] = [
  golden('the Écluse diagram', ecluseModel, 0, 'ecluse'),
  golden('every glyph', everyGlyphModel, 0, 'every-glyph'),
  golden(
    "Saerskriven's read and render diagram",
    saerskrivenModel,
    0,
    'saerskriven-read-and-render',
  ),
  golden(
    "Saerskriven's agent and desktop diagram",
    saerskrivenModel,
    1,
    'saerskriven-agent-and-desktop',
  ),
];

/** The diagram a golden entry names. */
export function diagramOf(entry: GoldenDocument): Diagram {
  return entry.model.diagrams[entry.diagram];
}

function golden(
  name: string,
  model: Model,
  diagram: number,
  stem: string,
): GoldenDocument {
  return {
    name,
    model,
    diagram,
    svg: `test-data/render/${stem}${svgSuffix}`,
    png: `test-data/render/${stem}${pngSuffix}`,
  };
}

const stop = (sentence: string): never => {
  throw new Error(sentence);
};

/**
 * Whether the rasterizer module has not been built. No dev shell builds it,
 * so a suite that rasterizes skips where it is absent.
 */
export const resvgUnbuilt =
  process.env[resvgVariable] === undefined || process.env[resvgVariable] === '';

let resvgModule: Uint8Array | undefined;

/** The flake-built rasterizer module, read once per suite. */
export const resvgWasm = (): Uint8Array =>
  (resvgModule ??= new Uint8Array(readFileSync(resvgWasmAsset(stop))));

/** The bytes of each font, in the order given. */
export const fontBytes = (
  faces: readonly TypstFontAsset[],
): readonly Uint8Array[] =>
  faces.map((face) => new Uint8Array(readFileSync(face.from)));

/** The pinned fonts in the Typst compiler's order. */
export const bundledFonts = (): readonly TypstFontAsset[] =>
  typstFontAssets(stop);

/** The Typst compiler module and, where asked for, the pinned fonts. */
export const typstAssets = (withFonts = true): PdfAssets => ({
  wasm: readFileSync(typstWasmModule),
  fonts: withFonts ? fontBytes(bundledFonts()) : [],
});
