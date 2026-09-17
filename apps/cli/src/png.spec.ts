import {
  resvgWasmFile as builtResvgWasmFile,
  typstFontFiles,
} from '@saerskriven/render/build-assets';
import { drawingFace } from '@saerskriven/render/png';
import { Either } from 'effect';
import { fakeAssets, scratchDirectory } from './cli.fixtures.js';
import { pngAssets, resvgWasmFile } from './png.js';

const faceBytes = (name: string): Buffer => Buffer.from(`face:${name}`, 'utf8');

const assetsHolding = (faces: readonly string[]): string =>
  fakeAssets(scratchDirectory('faces'), faces);

it('reads the module under the name the build writes it as', () => {
  expect(resvgWasmFile).toBe(builtResvgWasmFile);
});

describe('the faces a rasterization is offered', () => {
  it('leads with the face the drawings are lettered in', () => {
    const found = pngAssets(assetsHolding(typstFontFiles));
    expect(
      Either.map(found, (assets) => Buffer.from(assets.fonts[0] ?? [])),
    ).toEqual(Either.right(faceBytes(drawingFace)));
  });

  it('offers every face the build carried', () => {
    const found = pngAssets(assetsHolding(typstFontFiles));
    expect(Either.map(found, (assets) => assets.fonts.length)).toEqual(
      Either.right(typstFontFiles.length),
    );
  });

  it('refuses a directory holding no such face rather than reordering it', () => {
    const bare = assetsHolding(
      typstFontFiles.filter((name) => name !== drawingFace),
    );
    expect(Either.isLeft(pngAssets(bare))).toBe(true);
  });
});
