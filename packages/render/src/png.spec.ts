import { defaultRenderTheme } from '@saerskriven/canvas';
import { readThemeOverrides } from './lib/theme.js';
import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { repositoryRoot } from '@saerskriven/model/fixtures';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bundledFonts,
  diagramOf,
  everyGlyphModel,
  fontBytes,
  goldenDocuments,
  resvgUnbuilt,
  resvgWasm,
  twoDiagramsModel,
  type GoldenDocument,
} from './render.fixtures.js';
import {
  defaultLongEdge,
  drawingFace,
  ledBy,
  renderPng,
  type PngImage,
} from './png.js';
import type { ResvgAssets } from './resvg.js';

const monoFace = 'LiberationMono-Regular.ttf';

const named = (face: string): string => face;

const assetsLedBy = (leading: string): ResvgAssets => ({
  wasm: resvgWasm(),
  fonts: fontBytes(
    Either.getOrThrow(
      ledBy(
        bundledFonts(),
        (face) => face.name,
        leading,
        'the pinned font directory',
      ),
    ),
  ),
});

const rasterized = async (
  model: Model,
  longEdge?: number,
  leading = drawingFace,
): Promise<PngImage> =>
  Either.getOrThrow(
    await renderPng(model.diagrams[0], model, {
      assets: assetsLedBy(leading),
      longEdge,
    }),
  );

const goldenOf = async (entry: GoldenDocument): Promise<PngImage> =>
  Either.getOrThrow(
    await renderPng(diagramOf(entry), entry.model, {
      assets: assetsLedBy(drawingFace),
    }),
  );

const committed = (entry: GoldenDocument, drawn: Uint8Array): Buffer => {
  const path = join(repositoryRoot, entry.png);
  if (expect.getState().snapshotState.snapshotUpdateState === 'all') {
    writeFileSync(path, drawn);
  }
  return readFileSync(path);
};

describe('the faces a rasterization is offered', () => {
  it('leads with the face the caller names, keeping the rest in order', () => {
    expect(
      ledBy(['a.ttf', drawingFace, 'b.ttf'], named, drawingFace, 'a build'),
    ).toEqual(Either.right([drawingFace, 'a.ttf', 'b.ttf']));
  });

  it('refuses a caller holding no such face, naming it', () => {
    expect(ledBy(['a.ttf'], named, drawingFace, 'a build')).toEqual(
      Either.left(`a build holds no ${drawingFace}, which text is set in`),
    );
  });
});

describe.skipIf(resvgUnbuilt)('a diagram rasterized as a PNG', () => {
  it.each(goldenDocuments)(
    'draws $name as the committed picture',
    async (entry) => {
      const image = await goldenOf(entry);
      expect(Buffer.from(image.png)).toEqual(committed(entry, image.png));
    },
  );

  it('uses the selected family independently of the fallback font order', async () => {
    const [sansFirst, monoFirst] = [
      await rasterized(twoDiagramsModel),
      await rasterized(twoDiagramsModel, undefined, monoFace),
    ];
    expect([sansFirst.width, sansFirst.height]).toEqual([
      monoFirst.width,
      monoFirst.height,
    ]);
    expect(Buffer.from(monoFirst.png)).toEqual(Buffer.from(sansFirst.png));
  });

  it('puts the default long edge on the longer of the two edges', async () => {
    const image = await rasterized(twoDiagramsModel);
    expect(image.width).toBe(defaultLongEdge);
    expect(image.height).toBeLessThan(defaultLongEdge);
  });

  it('takes the long edge a caller names, keeping the aspect ratio', async () => {
    const wide = await rasterized(twoDiagramsModel, defaultLongEdge);
    const narrow = await rasterized(twoDiagramsModel, defaultLongEdge / 2);
    expect(narrow.width).toBe(wide.width / 2);
    expect(narrow.height / narrow.width).toBeCloseTo(
      wide.height / wide.width,
      2,
    );
  });

  it('draws a diagram smaller than the long edge larger, not smaller', async () => {
    const image = await rasterized(twoDiagramsModel, defaultLongEdge * 2);
    expect(image.width).toBe(defaultLongEdge * 2);
  });

  it('carries the endpoints the drawing left out', async () => {
    const image = await rasterized(everyGlyphModel);
    expect(image.unplaced).toEqual([
      { flow: 'el-replay', side: 'source', element: 'el-request' },
    ]);
  });

  it('reports a long edge it will not draw, rather than throwing it', async () => {
    const outcome = await renderPng(
      twoDiagramsModel.diagrams[0],
      twoDiagramsModel,
      {
        assets: assetsLedBy(drawingFace),
        longEdge: 0.5,
      },
    );
    expect(Either.isLeft(outcome)).toBe(true);
  });
});

describe.skipIf(resvgUnbuilt)('the selected PNG theme', () => {
  it('applies font, badge, and background overrides to the raster', async () => {
    const base = await renderPng(
      twoDiagramsModel.diagrams[0],
      twoDiagramsModel,
      {
        assets: assetsLedBy(drawingFace),
        longEdge: 400,
      },
    );
    const changed = await renderPng(
      twoDiagramsModel.diagrams[0],
      twoDiagramsModel,
      {
        assets: assetsLedBy(drawingFace),
        longEdge: 400,
        theme: readThemeOverrides({
          severity: { high: '#112233' },
          colours: { background: '#334455' },
          fonts: { body: 'Liberation Mono' },
          badges: { style: 'outline' },
        }).theme,
      },
    );
    const first = Either.getOrThrow(base);
    const second = Either.getOrThrow(changed);
    expect([second.width, second.height]).toEqual([first.width, first.height]);
    expect(second.png).not.toEqual(first.png);
    expect(defaultRenderTheme.fonts.body).toBe('Liberation Sans');
  });
});
