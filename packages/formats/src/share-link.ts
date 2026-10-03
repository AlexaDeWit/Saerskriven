import type { Model } from '@saerskriven/model';
import type { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import { Data, Either } from 'effect';
import { BrotliFailure, compressBrotli, decompressBrotli } from './brotli.js';
import { ReadFailure, type ReadResult } from './lib/codec.js';
import {
  exceededReadLimit,
  readLimits,
  withinTextBytes,
} from './lib/read-limits.js';
import { saerskrivenYamlCodec } from './lib/saerskriven-yaml.js';

/**
 * The most characters a share link holds, base URL included: Firefox's
 * default cap, which Chrome and Safari both exceed.
 */
export const shareLinkLimit = 1_048_576;

/**
 * Why no link was written, or why a fragment read as no model. A read can
 * also fail with the native codec's own {@link ReadFailure}, carried as the
 * codec returned it.
 *
 * `TooLong` is a link past {@link shareLinkLimit}, written or read.
 * `PastReadBound` is a model whose native text is past
 * `readLimits.maxTextBytes`, so no read would open its link. `NotAShareLink`
 * is a fragment that does not start `#share=`. `UnknownEncoding` names a
 * prefix this release does not decode. `Malformed` is a payload outside the
 * base64url alphabet, not whole base64url, or not one whole brotli stream,
 * and its message says the link may have been cut off. `Unusable` is the
 * brotli module failing the call.
 */
export type ShareLinkFailure = Data.TaggedEnum<{
  TooLong: { readonly length: number; readonly limit: number };
  PastReadBound: { readonly size: number };
  NotAShareLink: {};
  UnknownEncoding: { readonly prefix: string };
  Malformed: { readonly message: string };
  Unusable: { readonly sentence: string };
}>;

/** Constructors and matchers for {@link ShareLinkFailure}. */
export const ShareLinkFailure = Data.taggedEnum<ShareLinkFailure>();

const marker = '#share=';

const encoding = '1';

const refusedCharacter = /[^A-Za-z0-9_-]/u;

const binaryChunk = 8192;

const encoder = new TextEncoder();

const decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * `base` with the model as a share link fragment, `#share=1.` and then the
 * bytes a save writes, compressed with brotli and encoded as base64url
 * without padding. Any fragment `base` carries is replaced. `wasm` is the
 * module `nix build .#brotli-wasm` writes, and the compression costs the
 * memory `compressBrotli` states.
 */
export async function writeShareLink(
  model: Model,
  base: string,
  wasm: Uint8Array,
): Promise<Either.Either<string, ShareLinkFailure>> {
  const text = encoder.encode(saerskrivenYamlCodec.write(model).output);
  if (!withinTextBytes(text.length)) {
    return Either.left(ShareLinkFailure.PastReadBound({ size: text.length }));
  }
  const compressed = await compressBrotli(text, wasm);
  return Either.flatMap(Either.mapLeft(compressed, uncompressed), (bytes) =>
    linkWithin(`${pageOf(base)}${marker}${encoding}.${base64url(bytes)}`),
  );
}

/** Whether a fragment, as `location.hash` gives it, carries a share link. */
export function isShareLinkFragment(fragment: string): boolean {
  return fragment.startsWith(marker);
}

/**
 * The model a share link fragment carries, given as `location.hash` gives it.
 * The fragment's length is checked against {@link shareLinkLimit} and its
 * alphabet before anything is decoded. The stream is then decompressed to at
 * most `readLimits.maxTextBytes`, and a stream past that is
 * `ExceededReadLimit` observing one byte past the bound, where decoding
 * stopped. The text is decoded as strict UTF-8 and read through
 * `saerskrivenYamlCodec.read`, so every file read limit and format migration
 * applies to a link.
 */
export async function readShareLink(
  fragment: string,
  wasm: Uint8Array,
): Promise<
  Either.Either<
    ReadResult<typeof saerskrivenYamlV2WireSchema>,
    ShareLinkFailure | ReadFailure
  >
> {
  const payload = payloadOf(fragment);
  if (Either.isLeft(payload)) {
    return Either.left(payload.left);
  }
  const inflated = await decompressBrotli(
    payload.right,
    wasm,
    readLimits.maxTextBytes,
  );
  return Either.flatMap(Either.mapLeft(inflated, undecoded), (bytes) =>
    Either.flatMap(textOf(bytes), (text) => saerskrivenYamlCodec.read(text)),
  );
}

function uncompressed(failure: BrotliFailure): ShareLinkFailure {
  return ShareLinkFailure.Unusable({
    sentence: BrotliFailure.$is('Unusable')(failure)
      ? failure.sentence
      : `the module answered a compression with ${failure._tag}`,
  });
}

function pageOf(base: string): string {
  const fragment = base.indexOf('#');
  return fragment === -1 ? base : base.slice(0, fragment);
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += binaryChunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(start, start + binaryChunk),
    );
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function linkWithin(link: string): Either.Either<string, ShareLinkFailure> {
  return link.length > shareLinkLimit
    ? Either.left(
        ShareLinkFailure.TooLong({
          length: link.length,
          limit: shareLinkLimit,
        }),
      )
    : Either.right(link);
}

function payloadOf(
  fragment: string,
): Either.Either<Uint8Array, ShareLinkFailure> {
  if (!isShareLinkFragment(fragment)) {
    return Either.left(ShareLinkFailure.NotAShareLink());
  }
  if (fragment.length > shareLinkLimit) {
    return Either.left(
      ShareLinkFailure.TooLong({
        length: fragment.length,
        limit: shareLinkLimit,
      }),
    );
  }
  const link = fragment.slice(marker.length);
  const dot = link.indexOf('.');
  if (dot === -1) {
    return Either.left(
      ShareLinkFailure.Malformed({
        message:
          'The link ends before its payload begins, so it may have been cut off.',
      }),
    );
  }
  const prefix = link.slice(0, dot);
  return prefix === encoding
    ? bytesOf(link.slice(dot + 1))
    : Either.left(ShareLinkFailure.UnknownEncoding({ prefix }));
}

function bytesOf(payload: string): Either.Either<Uint8Array, ShareLinkFailure> {
  if (refusedCharacter.test(payload)) {
    return Either.left(
      ShareLinkFailure.Malformed({
        message:
          'The link holds a character no share link uses, so it may have been cut off or changed on the way.',
      }),
    );
  }
  return Either.try({
    try: () =>
      binaryBytes(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))),
    catch: () =>
      ShareLinkFailure.Malformed({
        message:
          'The link ends partway through a character group, so it may have been cut off.',
      }),
  });
}

function binaryBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function undecoded(failure: BrotliFailure): ShareLinkFailure | ReadFailure {
  return BrotliFailure.$match(failure, {
    PastMaximum: ({ maximum }) =>
      exceededReadLimit('maxTextBytes', maximum + 1),
    Malformed: () =>
      ShareLinkFailure.Malformed({
        message:
          'The link does not hold one whole compressed model, so it may have been cut off.',
      }),
    Unusable: ({ sentence }) => ShareLinkFailure.Unusable({ sentence }),
  });
}

function textOf(bytes: Uint8Array): Either.Either<string, ReadFailure> {
  return Either.try({
    try: () => decoder.decode(bytes),
    catch: () =>
      ReadFailure.MalformedText({
        message: 'The link decompresses to bytes that are not UTF-8.',
      }),
  });
}
