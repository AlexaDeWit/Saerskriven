import {
  answered,
  called,
  instantiated,
  isUnsigned,
  mostUnsigned,
  written,
  type Answered,
  type BoundaryModule,
} from '@saerskriven/wasm';
import { Either } from 'effect';
import { ResvgFailure } from './resvg-failures.js';

export { ResvgFailure } from './resvg-failures.js';

const calls = ['add_font', 'render', 'width', 'height'] as const;

type Rasterizer = BoundaryModule<(typeof calls)[number]>;

type Drawing = {
  readonly status: number;
  readonly width: number;
  readonly height: number;
};

/**
 * The bytes a rasterization runs on, because this package reads no file:
 * `wasm` is the module `nix build .#resvg-wasm` writes, and `fonts` are the
 * faces text is set in, offered to the renderer in the order they are listed.
 * A family the document names that no face carries falls back to the first.
 */
export type ResvgAssets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

/** A drawing as PNG bytes, beside the pixel size it was drawn at. */
export type Raster = {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
};

/**
 * Rasterizes an SVG document with caller-owned assets, scaled so its longer
 * side is `longEdge` pixels, or at the size the document names when `longEdge`
 * is 0. A long edge that is not a whole number of pixels, an image past
 * 67108864 pixels, a buffer holding no face, and a module that stopped
 * partway come back as {@link ResvgFailure}. The renderer reads no file.
 *
 * The compiled module is held per `wasm` array. Each call runs its own
 * instance, so the faces one call offers reach no other, and an instance that
 * stopped partway is dropped rather than called again.
 */
export async function rasterizeSvg(
  source: string,
  assets: ResvgAssets,
  longEdge: number,
): Promise<Either.Either<Raster, ResvgFailure>> {
  if (!isUnsigned(longEdge)) {
    return Either.left(
      ResvgFailure.Refused({
        sentence: `a long edge of ${longEdge} is not a pixel count from 0 to ${mostUnsigned}`,
      }),
    );
  }
  const started = Either.mapLeft(
    await instantiated(assets.wasm, calls, 'the module exports no rasterizer'),
    unusable,
  );
  return Either.flatMap(started, (module) =>
    Either.flatMap(offered(module, assets.fonts), () =>
      drawn(module, source, longEdge),
    ),
  );
}

function offered(
  module: Rasterizer,
  fonts: readonly Uint8Array[],
): Either.Either<Rasterizer, ResvgFailure> {
  for (const [index, font] of fonts.entries()) {
    const faces = called(module, font, () => module.add_font() >>> 0);
    if (Either.isLeft(faces)) {
      return Either.left(unusable(faces.left));
    }
    if (faces.right === 0) {
      return Either.left(
        ResvgFailure.Unusable({
          sentence: `the font at index ${index} of ${fonts.length} holds no face the renderer reads`,
        }),
      );
    }
  }
  return Either.right(module);
}

function drawn(
  module: Rasterizer,
  source: string,
  longEdge: number,
): Either.Either<Raster, ResvgFailure> {
  const answer = answered(module, new TextEncoder().encode(source), () => ({
    status: module.render(longEdge),
    width: module.width() >>> 0,
    height: module.height() >>> 0,
  }));
  return Either.flatMap(Either.mapLeft(answer, unusable), rasterOf);
}

function rasterOf({
  value,
  output,
}: Answered<Drawing>): Either.Either<Raster, ResvgFailure> {
  if (value.status === written) {
    return Either.right({
      png: output,
      width: value.width,
      height: value.height,
    });
  }
  return Either.left(
    ResvgFailure.Refused({ sentence: new TextDecoder().decode(output) }),
  );
}

function unusable(sentence: string): ResvgFailure {
  return ResvgFailure.Unusable({ sentence });
}
