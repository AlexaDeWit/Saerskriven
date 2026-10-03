import { sha256Of } from '@saerskriven/model/fixtures';
import {
  called,
  instantiated,
  mostUnsigned,
  type BoundaryModule,
} from '@saerskriven/wasm';
import { moduleWhoseEveryCall, trapping } from '@saerskriven/wasm/fixtures';
import { Either } from 'effect';
import {
  bundledFonts,
  fontBytes,
  resvgUnbuilt,
  resvgWasm,
} from './render.fixtures.js';
import { rasterizeSvg, ResvgFailure, type ResvgAssets } from './resvg.js';

const withFonts = (): ResvgAssets => ({
  wasm: resvgWasm(),
  fonts: fontBytes(bundledFonts()),
});

const withoutFonts = (): ResvgAssets => ({ wasm: resvgWasm(), fonts: [] });

const svg = (body: string, width: number, height: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`;

const rectangle = svg('<rect width="40" height="20" fill="#123456"/>', 40, 20);

const label = (family: string): string =>
  `<text x="4" y="30" font-size="20" font-family="${family}" fill="#000000">Saerskriven</text>`;

const drawn = async (document: string, assets: ResvgAssets, longEdge: number) =>
  Either.getOrThrow(await rasterizeSvg(document, assets, longEdge));

const refusalOf = (
  outcome: Either.Either<unknown, ResvgFailure>,
): ResvgFailure | undefined =>
  Either.isLeft(outcome) ? outcome.left : undefined;

const rasterizerCalls = [
  'input',
  'add_font',
  'render',
  'width',
  'height',
  'output',
  'output_length',
];

const stubbed = (
  body: readonly number[],
  fonts: readonly Uint8Array[],
): ResvgAssets => ({
  wasm: moduleWhoseEveryCall(rasterizerCalls, body),
  fonts,
});

const rendering = async (document: string) => {
  const module = Either.getOrThrow(
    await instantiated(
      resvgWasm(),
      ['add_font', 'render', 'width', 'height'],
      'the module exports no rasterizer',
    ),
  );
  Either.getOrThrow(
    called(module, new TextEncoder().encode(document), () =>
      module.render(200),
    ),
  );
  return module;
};

const held = (module: BoundaryModule<'width' | 'height'>): number[] => [
  module.output_length(),
  module.width(),
  module.height(),
];

describe('a module that will not do the work', () => {
  it('reports one that trapped, rather than throwing out of the call', async () => {
    const outcome = await rasterizeSvg(rectangle, stubbed(trapping, []), 200);
    expect(refusalOf(outcome)?._tag).toBe('Unusable');
  });

  it('reports one that trapped taking a font', async () => {
    const outcome = await rasterizeSvg(
      rectangle,
      stubbed(trapping, [new Uint8Array([0])]),
      200,
    );
    expect(refusalOf(outcome)?._tag).toBe('Unusable');
  });
});

describe.skipIf(resvgUnbuilt)('an SVG document rasterized to a PNG', () => {
  it('draws the document at the long edge it is given', async () => {
    const raster = await drawn(rectangle, withoutFonts(), 200);
    expect([raster.width, raster.height]).toEqual([200, 100]);
    expect(Array.from(raster.png.subarray(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(sha256Of(raster.png)).toBe(
      '900aee59f6b2ec4c280c8826e5187bacd6f12a958edf52313f2cfb59ec9c1578',
    );
  });

  it('draws at the size the document names when the long edge is 0', async () => {
    const raster = await drawn(rectangle, withoutFonts(), 0);
    expect([raster.width, raster.height]).toEqual([40, 20]);
  });

  it('reports what the renderer refused, rather than throwing it', async () => {
    expect(
      refusalOf(await rasterizeSvg('not a document', withoutFonts(), 100)),
    ).toEqual(
      ResvgFailure.Refused({
        sentence: 'SVG data parsing failed cause unknown token at 1:1',
      }),
    );
  });

  it('sets text in the faces it is handed and in nothing else', async () => {
    const document = svg(label('Liberation Sans'), 200, 40);
    const set = await drawn(document, withFonts(), 400);
    const unset = await drawn(document, withoutFonts(), 400);
    expect([set.width, set.height]).toEqual([400, 80]);
    expect(sha256Of(set.png)).not.toBe(sha256Of(unset.png));
  });

  it('draws a family no face carries in the first face it was offered', async () => {
    const document = svg(label('Helvetica'), 200, 40);
    const set = await drawn(document, withFonts(), 400);
    const unset = await drawn(document, withoutFonts(), 400);
    expect(sha256Of(set.png)).not.toBe(sha256Of(unset.png));
  });

  it('refuses an image past what it draws, rather than trapping', async () => {
    expect(
      refusalOf(await rasterizeSvg(rectangle, withoutFonts(), 40000)),
    ).toEqual(
      ResvgFailure.Refused({
        sentence:
          'a 40000 by 20000 pixel image is past the 67108864 pixels drawn at most',
      }),
    );
  });

  it.each([1.5, -100, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32])(
    'refuses a long edge of %p rather than drawing another size',
    async (longEdge) => {
      expect(
        refusalOf(await rasterizeSvg(rectangle, withoutFonts(), longEdge)),
      ).toEqual(
        ResvgFailure.Refused({
          sentence: `a long edge of ${longEdge} is not a pixel count from 0 to 4294967295`,
        }),
      );
    },
  );

  it.each([
    ['a truncated face', (face: Uint8Array) => face.subarray(0, 500)],
    ['prose', () => new TextEncoder().encode('this is not a font at all')],
    ['nothing', () => new Uint8Array(0)],
  ])(
    'refuses %s in place of a font, rather than drawing no text',
    async (_what, take) => {
      const fonts = withFonts().fonts;
      expect(
        refusalOf(
          await rasterizeSvg(
            rectangle,
            { wasm: resvgWasm(), fonts: [take(fonts[0])] },
            200,
          ),
        ),
      ).toEqual(
        ResvgFailure.Unusable({
          sentence: 'the font at index 0 of 1 holds no face the renderer reads',
        }),
      );
    },
  );

  it('reaches no file an image points it at', async () => {
    const pointed = svg(
      '<rect width="40" height="20" fill="#123456"/><image href="/etc/hostname" x="0" y="0" width="40" height="20"/>',
      40,
      20,
    );
    const raster = await drawn(pointed, withoutFonts(), 200);
    expect(sha256Of(raster.png)).toBe(
      sha256Of((await drawn(rectangle, withoutFonts(), 200)).png),
    );
  });

  it('draws no image a data URL holds', async () => {
    const image = svg('<rect width="40" height="20" fill="#fedcba"/>', 40, 20);
    const pointed = svg(
      `<rect width="40" height="20" fill="#123456"/><image href="data:image/svg+xml;base64,${btoa(image)}" x="0" y="0" width="40" height="20"/>`,
      40,
      20,
    );
    const raster = await drawn(pointed, withoutFonts(), 200);
    expect(sha256Of(raster.png)).toBe(
      sha256Of((await drawn(rectangle, withoutFonts(), 200)).png),
    );
  });
});

describe.skipIf(resvgUnbuilt)('one instance called more than once', () => {
  it('answers no output and no size after a call that trapped, where an earlier call drew', async () => {
    const module = await rendering(rectangle);
    expect(held(module)).not.toContain(0);
    expect(() => module.input(mostUnsigned)).toThrow(WebAssembly.RuntimeError);
    expect(held(module)).toEqual([0, 0, 0]);
  });

  it('answers no output and no size after a call that took a font, where an earlier call drew', async () => {
    const module = await rendering(rectangle);
    expect(held(module)).not.toContain(0);
    module.add_font();
    expect(held(module)).toEqual([0, 0, 0]);
  });
});
