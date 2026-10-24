import type { RenderTheme } from '@saerskriven/canvas';
import type { Locale } from '@saerskriven/i18n';
import type { Diagram, Model } from '@saerskriven/model';
import {
  drawingFace,
  renderPng,
  type PngImage,
  type ResvgFailure,
} from '@saerskriven/render/png';
import { Result } from 'effect';
import { runtimeAssets, wasmAssets, type WasmAssets } from './assets.js';

/** Runtime filename shared with the build asset contract. */
export const resvgWasmFile = 'saerskriven_resvg.wasm';

/** Loads the rasterizer and faces with the drawing fallback first. */
export function pngAssets(
  assets: string = runtimeAssets,
): Result.Result<WasmAssets, string> {
  return wasmAssets(assets, resvgWasmFile, drawingFace);
}

/** One diagram rasterized to PNG bytes, or a sentence saying why it was not. */
export function drawPng(
  diagram: Diagram,
  model: Model,
  assets: string,
  locale: Locale,
  theme?: RenderTheme,
  showThreatLabels?: boolean,
): Promise<Result.Result<PngImage, string>> {
  return Result.match(pngAssets(assets), {
    onFailure: (reason) =>
      Promise.resolve(Result.fail(`cannot draw the PNG: ${reason}`)),
    onSuccess: (found) =>
      rasterized(diagram, model, locale, found, theme, showThreatLabels),
  });
}

async function rasterized(
  diagram: Diagram,
  model: Model,
  locale: Locale,
  assets: WasmAssets,
  theme?: RenderTheme,
  showThreatLabels?: boolean,
): Promise<Result.Result<PngImage, string>> {
  return Result.mapError(
    await renderPng(diagram, model, locale, {
      assets,
      theme,
      showThreatLabels,
    }),
    reported,
  );
}

function reported(failure: ResvgFailure): string {
  return `cannot draw the PNG: ${failure.sentence}`;
}
