import {
  divergenceSchema,
  escapedForTerminal,
  renderDivergences,
} from '@saerskriven/formats';
import {
  hostedStudioUrl,
  renderShareLinkWriteFailure,
  shareLinkLimit,
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
import type { WithBlocks } from './tool-result.js';
import type { ModelWorkspace } from './workspace.js';

/**
 * Where a share link gets the brotli module it is compressed with, found by
 * the host process.
 */
export type BrotliModule = () => Either.Either<Uint8Array, string>;

/** What `saer_share_link` takes. */
export type ShareLinkArguments = z.infer<typeof fileArgumentSchema>;

/**
 * What `saer_share_link` answers with. The link itself travels in the
 * result's own block alone, so the answer carries its length.
 */
export const shareLinkResultSchema = readingSchema.extend({
  length: z
    .int()
    .positive()
    .describe(
      `How many characters the link holds, at most ${String(shareLinkLimit)}. The link is the content block after the text, and nowhere else in the result.`,
    ),
  divergences: z.array(divergenceSchema),
});

/** What `saer_share_link` answers with. */
export type ShareLinkResult = z.infer<typeof shareLinkResultSchema>;

/**
 * What a share produced: the answer a client validates, and the one text
 * block that holds the link and nothing else.
 */
export type SharedLink = WithBlocks<ShareLinkResult>;

/** What `saer_share_link` tells a client it is for. */
export const shareLinkDescription = [
  `Write one Saerskriven threat model as a share link: an address on the hosted studio, ${hostedStudioUrl}, that opens the model in a browser with nothing installed.`,
  'The link carries the whole model, every element, threat, mitigation and assumption in it, and anyone who sees the link can read all of it. Nothing can take a link back once it is sent, since the model travels in the link itself, and a chat, a ticket, an email or a browser history keeps it for as long as it keeps anything. Call this only when the person you are working for asks for a link, and hand the link to them rather than posting it anywhere they did not name.',
  'Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model. This tool takes no other argument.',
  `The result holds the whole link once: alone in a text block of its own, after the text block that describes it, and nowhere else. The structured content gives its \`length\` and not the link. A link can be very long: usually thousands of characters, and up to ${String(shareLinkLimit)} for a large model. All of it lands in your context, so call this once, when the link is about to be handed over. Do not call it to read a model, which saer_inspect and the search tools answer in a fraction of the context.`,
  'A model whose link would be longer than that comes back as an error result saying to send the file instead, and a file that does not read comes back as an error result too. The link holds the model as the native YAML format writes it, so what the file and the model do not correspond on is not in the link either, and the result lists it. This tool writes no file and reaches no network.',
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
): Promise<Either.Either<SharedLink, readonly string[]>> {
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

/**
 * The answer as the lines its text result carries, which name the link by
 * where it is and how long it is and never repeat it.
 */
export function renderShareLink(result: ShareLinkResult): readonly string[] {
  return [
    ...renderReading(result),
    `link: the block after this one, ${String(result.length)} characters, holding the link and nothing else`,
    'divergences:',
    renderDivergences(result.divergences),
  ];
}

async function linked(
  reading: ModelReading,
  wasm: Uint8Array,
): Promise<Either.Either<SharedLink, readonly string[]>> {
  return Either.mapBoth(
    await writeShareLink(reading.model, hostedStudioUrl, wasm),
    {
      onLeft: renderShareLinkWriteFailure,
      onRight: (link): SharedLink => ({
        answer: {
          ...reportedReading(reading),
          length: link.length,
          divergences: [...reading.divergences],
        },
        blocks: [{ type: 'text', text: link }],
      }),
    },
  );
}
