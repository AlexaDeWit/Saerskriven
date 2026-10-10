import type { Model } from '@saerskriven/model';
import type { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import { Either } from 'effect';
import { z } from 'zod';
import { compressBrotli, decompressBrotli } from './brotli.js';
import { type ReadFailure, type ReadResult } from './lib/codec.js';
import { readLimits } from './lib/read-limits.js';
import { readSaerskrivenYamlValue } from './lib/saerskriven-yaml-read.js';
import { writeSaerskrivenYamlDocument } from './lib/saerskriven-yaml-write.js';
import { readCompactDocument } from './lib/share-compact-read.js';
import { writeCompactDocument } from './lib/share-compact-write.js';
import { compressPpmd, decompressPpmd } from './ppmd.js';
import {
  ShareLinkFailure,
  readShareLink,
  shareInflationFailure,
  shareLinkPayload,
  shareLinkText,
  shareLinkUrl,
  shareLinkWithin,
  writeShareLink,
} from './share-link.js';

/** Measurements returned by the opt-in writer, including complete URL lengths. */
export const sharePocResultSchema = z.object({
  link: z.string(),
  codec: z.enum(['legacy', 'brotli', 'ppmd']),
  baselineLength: z.int().nonnegative(),
  brotliLength: z.int().nonnegative(),
  ppmdLength: z.int().nonnegative(),
});

/** A selected experimental link and its comparison with the current encoding. */
export type SharePocResult = z.infer<typeof sharePocResultSchema>;

const encoder = new TextEncoder();

/**
 * Selects the shortest complete legacy or encoding-2 link. Encoding 2 is
 * base64url over a codec byte (0 Brotli, 1 PPMd) and the compressed compact
 * JSON. Callers must isolate the synchronous WASM work in a cancellable worker.
 */
export async function writeShareLinkPoc(
  model: Model,
  base: string,
  wasm: Uint8Array,
): Promise<Either.Either<SharePocResult, ShareLinkFailure | ReadFailure>> {
  const baseline = await writeShareLink(model, base, wasm);
  let baselineLength: number;
  if (Either.isLeft(baseline)) {
    if (baseline.left._tag !== 'TooLong') return Either.left(baseline.left);
    baselineLength = baseline.left.length;
  } else {
    baselineLength = baseline.right.length;
  }
  const compact = writeCompactDocument(writeSaerskrivenYamlDocument(model));
  if (Either.isLeft(compact)) return Either.left(compact.left);
  const bytes = encoder.encode(compact.right);
  const brotli = await compressBrotli(bytes, wasm);
  if (Either.isLeft(brotli))
    return Either.left(shareInflationFailure(brotli.left));
  const ppmd = await compressPpmd(bytes, wasm);
  if (Either.isLeft(ppmd)) return Either.left(shareInflationFailure(ppmd.left));
  const brotliLink = candidate(base, 0, brotli.right);
  const ppmdLink = candidate(base, 1, ppmd.right);
  const choices: Pick<SharePocResult, 'link' | 'codec'>[] = [
    { link: brotliLink, codec: 'brotli' },
    { link: ppmdLink, codec: 'ppmd' },
  ];
  if (Either.isRight(baseline))
    choices.push({ link: baseline.right, codec: 'legacy' });
  const selected = choices.reduce((shortest, choice) =>
    choice.link.length < shortest.link.length ? choice : shortest,
  );
  return Either.map(shareLinkWithin(selected.link), (link) => ({
    link,
    codec: selected.codec,
    baselineLength,
    brotliLength: brotliLink.length,
    ppmdLength: ppmdLink.length,
  }));
}

/** Reads an experimental link or any legacy link through native migrations. */
export async function readShareLinkPoc(
  fragment: string,
  wasm: Uint8Array,
): Promise<
  Either.Either<
    ReadResult<typeof saerskrivenYamlV2WireSchema>,
    ShareLinkFailure | ReadFailure
  >
> {
  if (fragment.startsWith('#share=1.')) return readShareLink(fragment, wasm);
  const payload = shareLinkPayload(fragment, '2');
  if (Either.isLeft(payload)) return Either.left(payload.left);
  const tag = payload.right[0];
  if (tag !== 0 && tag !== 1) {
    return Either.left(
      ShareLinkFailure.Malformed({
        message: 'The compact link names an unknown compression codec.',
      }),
    );
  }
  const decompress = tag === 0 ? decompressBrotli : decompressPpmd;
  const decoded = await decompress(
    payload.right.subarray(1),
    wasm,
    readLimits.maxTextBytes,
  );
  return Either.flatMap(
    Either.mapLeft(decoded, shareInflationFailure),
    (bytes) =>
      Either.flatMap(shareLinkText(bytes), (text) =>
        Either.flatMap(readCompactDocument(text), readSaerskrivenYamlValue),
      ),
  );
}

function candidate(base: string, codec: number, bytes: Uint8Array): string {
  const frame = new Uint8Array(bytes.length + 1);
  frame[0] = codec;
  frame.set(bytes, 1);
  return shareLinkUrl(base, '2', frame);
}
