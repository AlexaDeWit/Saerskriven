import {
  assumptionSchema,
  mitigationSchema,
  threatSchema,
  type Diagram,
  type Model,
} from '@saerskriven/model';
import { committedDiagrams, committedModel } from '@saerskriven/model/fixtures';
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

/** The model that draws every glyph and every badge tone. */
export const everyGlyphModel: Model = committedModel('every-glyph.model.json');

/**
 * A small shop on two diagrams, with crowded flow names and a register that
 * carries every record kind, both flags and a threat on no element.
 */
export const twoDiagramsModel: Model = committedModel(
  'two-diagrams.model.json',
);

/**
 * The two-diagram model with two threats in its register: threat 7, open and
 * high, whose description holds a level-one and a level-six heading, and
 * threat 8, at accepted risk, with a proposed mitigation and an invalidated
 * assumption linked to it, so the register draws a severity, a status, a
 * record status and a flag badge.
 */
export const badgedModel: Model = {
  ...twoDiagramsModel,
  threats: [
    threatSchema.parse({
      ...twoDiagramsModel.threats[0],
      number: 7,
      severity: 'high',
      status: 'open',
      description: '# First\n\n###### Last',
    }),
    threatSchema.parse({
      ...twoDiagramsModel.threats[0],
      id: 'accepted-example',
      number: 8,
      status: 'accepted-risk',
    }),
  ],
  mitigations: [
    mitigationSchema.parse({
      id: 'mitigation-example',
      title: '',
      prose: '',
      status: 'proposed',
      threats: ['accepted-example'],
    }),
  ],
  assumptions: [
    assumptionSchema.parse({
      id: 'assumption-example',
      prose: '',
      status: 'invalidated',
      threats: ['accepted-example'],
      appliesToModel: false,
    }),
  ],
};

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
 * Every committed diagram as a golden. A golden takes the stem of its model's
 * file, and the diagram id after it where the model holds more than one
 * diagram, so a diagram joins every suite here by joining `committedDiagrams`.
 */
export const goldenDocuments: readonly GoldenDocument[] = committedDiagrams.map(
  ({ name, file, diagram }) => {
    const model = committedModel(file);
    const fileStem = file.replace(/\.model\.json$/u, '');
    const stem =
      model.diagrams.length === 1
        ? fileStem
        : `${fileStem}-${model.diagrams[diagram].id}`;
    return {
      name,
      model,
      diagram,
      svg: `test-data/render/${stem}${svgSuffix}`,
      png: `test-data/render/${stem}${pngSuffix}`,
    };
  },
);

/** The diagram a golden entry names. */
export function diagramOf(entry: GoldenDocument): Diagram {
  return entry.model.diagrams[entry.diagram];
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
