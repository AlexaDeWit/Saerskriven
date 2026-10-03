import {
  divergenceSchema,
  escapedForTerminal,
  readLimits,
  renderDivergences,
} from '@saerskriven/formats';
import {
  hostedStudioUrl,
  shareLinkLimit,
  ShareLinkWriteFailure,
  writeShareLink,
} from '@saerskriven/formats/share-link';
import { Either } from 'effect';
import { z } from 'zod';
import { fileArgumentSchema } from './inspect.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import type { ModelWorkspace } from './workspace.js';

/**
 * Where a share link gets the brotli module it is compressed with, found by
 * the host process.
 */
export type BrotliModule = () => Either.Either<Uint8Array, string>;

/** What `saer_share_link` takes. */
export type ShareLinkArguments = z.infer<typeof fileArgumentSchema>;

/** What `saer_share_link` answers with. */
export const shareLinkResultSchema = readingSchema.extend({
  link: z.string(),
  divergences: z.array(divergenceSchema),
});

/** What `saer_share_link` answers with. */
export type ShareLinkResult = z.infer<typeof shareLinkResultSchema>;

/** What `saer_share_link` tells a client it is for. */
export const shareLinkDescription = [
  `Write one Saerskriven threat model as a share link: an address on the hosted studio, ${hostedStudioUrl}, that opens the model in a browser with nothing installed.`,
  'The link carries the whole model, every element, threat, mitigation and assumption in it, and anyone who sees the link can read all of it. Nothing can take a link back once it is sent, since the model travels in the link itself, and a chat, a ticket, an email or a browser history keeps it for as long as it keeps anything. Call this only when the person you are working for asks for a link, and hand the link to them rather than posting it anywhere they did not name.',
  'Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model. This tool takes no other argument.',
  `A link holds at most ${String(shareLinkLimit)} characters, and a model whose link would be longer comes back as an error result saying to send the file instead, as does a file that does not read. The link holds the model as the native YAML format writes it, so what the file and the model do not correspond on is not in the link either, and the result lists it. This tool writes no file and reaches no network.`,
].join(' ');

/**
 * The model as a link to the hosted studio, or the lines saying why there is
 * none. The file is read before the module is asked for, so a refused file is
 * refused as every read tool refuses it.
 */
export async function shareLink(
  workspace: ModelWorkspace,
  brotli: BrotliModule,
  args: ShareLinkArguments,
): Promise<Either.Either<ShareLinkResult, readonly string[]>> {
  const reading = readNamed(workspace, args.file);
  if (Either.isLeft(reading)) {
    return Either.left(reading.left);
  }
  const module = brotli();
  return Either.isLeft(module)
    ? Either.left([
        `This install cannot write a share link: ${escapedForTerminal(module.left)}.`,
      ])
    : linked(reading.right, module.right);
}

/** The link as the lines its text result carries. */
export function renderShareLink(result: ShareLinkResult): readonly string[] {
  return [
    ...renderReading(result),
    `link: ${result.link}`,
    'divergences:',
    renderDivergences(result.divergences),
  ];
}

async function linked(
  reading: ModelReading,
  wasm: Uint8Array,
): Promise<Either.Either<ShareLinkResult, readonly string[]>> {
  return Either.mapBoth(
    await writeShareLink(reading.model, hostedStudioUrl, wasm),
    {
      onLeft: refused,
      onRight: (link) => ({
        ...reportedReading(reading),
        link,
        divergences: [...reading.divergences],
      }),
    },
  );
}

function refused(failure: ShareLinkWriteFailure): readonly string[] {
  return ShareLinkWriteFailure.$match(failure, {
    TooLong: ({ length, limit }) => [
      `The link would be ${String(length)} characters, past the ${String(limit)} a share link may hold, so none was written.`,
      'Send the file itself instead.',
    ],
    PastReadBound: ({ size }) => [
      `The model is ${String(size)} bytes as Saerskriven YAML, past the ${String(readLimits.maxTextBytes)} bytes a read accepts, so no link to it would open.`,
      'Send the file itself instead.',
    ],
    Unusable: ({ sentence }) => [
      `This install cannot write a share link: ${escapedForTerminal(sentence)}.`,
    ],
  });
}
