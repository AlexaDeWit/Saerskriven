import {
  defaultRenderTheme,
  type RenderTheme,
  type UnplacedEndpoint,
} from '@saerskriven/canvas';
import type { Locale } from '@saerskriven/i18n';
import type { Diagram, Model } from '@saerskriven/model';
import { Either } from 'effect';
import { renderSvg } from './lib/svg-document.js';
import { rasterizeSvg, type ResvgAssets, type ResvgFailure } from './resvg.js';

export { ResvgFailure } from './resvg-failures.js';

/**
 * Default raster size on the longer edge, in pixels: the smallest round size
 * at which the fr-CA `É` high-severity mark clears the count digit above it
 * in a badge with a count.
 */
export const defaultLongEdge = 2500;

/**
 * The face a caller leads the rasterizer's faces with. A family no face
 * carries falls back to the family of the first face offered, so the regular
 * face leading makes the fallback Liberation Sans in every weight and style.
 */
export const drawingFace = 'LiberationSans-Regular.ttf';

/** Orders faces with the requested fallback first, or reports its absence. */
export function ledBy<T>(
  faces: readonly T[],
  named: (face: T) => string,
  leading: string,
  subject: string,
): Either.Either<readonly T[], string> {
  const leads = (face: T): boolean => named(face) === leading;
  return faces.some(leads)
    ? Either.right([
        ...faces.filter(leads),
        ...faces.filter((face) => !leads(face)),
      ])
    : Either.left(`${subject} holds no ${leading}, which text is set in`);
}

/** Rasterizer assets, output size, and resolved appearance. */
export type PngOptions = {
  readonly assets: ResvgAssets;
  readonly longEdge?: number;
  readonly theme?: RenderTheme;
};

/** PNG bytes, pixel dimensions, and undrawn flow endpoints. */
export type PngImage = {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/**
 * One diagram as a PNG: {@link renderSvg} in `locale`, rasterized on its
 * themed background at `longEdge` pixels on the longer side,
 * {@link defaultLongEdge} by default.
 */
export async function renderPng(
  diagram: Diagram,
  model: Model,
  locale: Locale,
  options: PngOptions,
): Promise<Either.Either<PngImage, ResvgFailure>> {
  const theme = options.theme ?? defaultRenderTheme;
  const drawn = renderSvg(diagram, model, locale, theme);
  const raster = await rasterizeSvg(
    drawn.svg,
    options.assets,
    options.longEdge ?? defaultLongEdge,
  );
  return Either.map(raster, (image) => ({
    png: image.png,
    width: image.width,
    height: image.height,
    unplaced: drawn.unplaced,
  }));
}
