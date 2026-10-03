import type { DetectedRead } from '@saerskriven/formats';
import { brotliWasmFile } from '@saerskriven/formats/build-assets';
import {
  hostedStudioUrl,
  renderShareLinkWriteFailure,
  writeShareLink,
} from '@saerskriven/formats/share-link';
import { Either } from 'effect';
import { runtimeAssets, wasmModule } from './assets.js';
import { describeDivergences, readModel } from './input.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
} from './outcome.js';

/**
 * The brotli module the build carried beside the bundle, or why it is not
 * there.
 */
export function brotliModule(
  assets: string = runtimeAssets,
): Either.Either<Uint8Array, string> {
  return wasmModule(assets, brotliWasmFile);
}

/**
 * `saer share <file>`: the model as a share link to the hosted studio, one
 * line on standard output, read as `validate` reads it, with what the read
 * dropped on standard error. A model whose link would pass the length a link
 * holds gets no link and exits 2, since the file was read and was good.
 */
export function share(
  file: string,
  assets: string = runtimeAssets,
): Promise<CommandOutcome> {
  return Either.match(readModel(file), {
    onLeft: (outcome) => Promise.resolve(outcome),
    onRight: (read) => linked(read, assets),
  });
}

async function linked(
  read: DetectedRead,
  assets: string,
): Promise<CommandOutcome> {
  const module = brotliModule(assets);
  if (Either.isLeft(module)) {
    return usageError(lines(`error: cannot write the link: ${module.left}`));
  }
  return Either.match(
    await writeShareLink(read.model, hostedStudioUrl, module.right),
    {
      onLeft: (failure) =>
        usageError(lines(errorLine(renderShareLinkWriteFailure(failure)))),
      onRight: (link) =>
        succeeded(lines(link), describeDivergences(read.divergences)),
    },
  );
}

function errorLine(sentences: readonly string[]): string {
  const text = sentences.join(' ');
  return `error: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
