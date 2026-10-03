import { readLimits, type DetectedRead } from '@saerskriven/formats';
import { brotliWasmFile } from '@saerskriven/formats/build-assets';
import {
  hostedStudioUrl,
  ShareLinkWriteFailure,
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
      onLeft: (failure) => usageError(lines(refused(failure))),
      onRight: (link) =>
        succeeded(lines(link), describeDivergences(read.divergences)),
    },
  );
}

function refused(failure: ShareLinkWriteFailure): string {
  return ShareLinkWriteFailure.$match(failure, {
    TooLong: ({ length, limit }) =>
      `error: the link would be ${String(length)} characters, past the ${String(limit)} a share link may hold, so none was written. Send the file itself instead.`,
    PastReadBound: ({ size }) =>
      `error: the model is ${String(size)} bytes as Saerskriven YAML, past the ${String(readLimits.maxTextBytes)} bytes a read accepts, so no link to it would open. Send the file itself instead.`,
    Unusable: ({ sentence }) => `error: cannot write the link: ${sentence}`,
  });
}
