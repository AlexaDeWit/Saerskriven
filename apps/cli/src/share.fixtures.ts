import { readAnyFormat } from '@saerskriven/formats';
import { readShareLink } from '@saerskriven/formats/share-link';
import { inNumberOrder, type Model } from '@saerskriven/model';
import { Either } from 'effect';
import { builtAssets } from './cli.fixtures.js';
import { brotliModule } from './share.js';

/**
 * The model a share link holds, read through the codec's reader with the
 * brotli module the build wrote beside the bundle.
 */
export async function modelIn(link: string): Promise<Model> {
  const wasm = Either.getOrThrow(brotliModule(builtAssets));
  return Either.getOrThrow(await readShareLink(new URL(link).hash, wasm)).model;
}

/**
 * The model a file's text reads as, with its threats in number order, which
 * is the order a link carries them in.
 */
export function modelOf(text: string): Model {
  const model = Either.getOrThrow(readAnyFormat(text)).model;
  return { ...model, threats: inNumberOrder(model.threats) };
}
