import type { Model } from '@saerskriven/model';
import type { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import { Data, Either } from 'effect';
import { BrotliFailure, compressBrotli, decompressBrotli } from './brotli.js';
import { ReadFailure, type ReadResult } from './lib/codec.js';
import { escapedForTerminal } from './lib/divergence.js';
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
 * `TooLong` is a written link, or a read fragment, past
 * {@link shareLinkLimit}.
 * `PastReadBound` is a model whose native text is past
 * `readLimits.maxTextBytes`, so no read would open its link. `NotAShareLink`
 * is a fragment that does not start `#share=`. `UnknownEncoding` names an
 * encoding number, one to four ASCII digits, this release does not decode.
 * `Malformed` is a fragment with no encoding number, or a payload outside the
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

/** The variants of {@link ShareLinkFailure} a write can end in. */
export type ShareLinkWriteFailure = Extract<
  ShareLinkFailure,
  { readonly _tag: 'TooLong' | 'PastReadBound' | 'Unusable' }
>;

/** Constructors and matchers for {@link ShareLinkWriteFailure}. */
export const ShareLinkWriteFailure = Data.taggedEnum<ShareLinkWriteFailure>();

const marker = '#share=';

const encoding = '1';

const longestEncoding = 4;

const nonDigit = /[^0-9]/u;

const refusedCharacter = /[^A-Za-z0-9_-]/u;

const binaryChunk = 8192;

const encoder = new TextEncoder();

const decoder = new TextDecoder('utf-8', { fatal: true });

const sendTheFile = 'Send the file itself instead.';

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
): Promise<Either.Either<string, ShareLinkWriteFailure>> {
  const text = encoder.encode(saerskrivenYamlCodec.write(model).output);
  if (!withinTextBytes(text.length)) {
    return Either.left(ShareLinkFailure.PastReadBound({ size: text.length }));
  }
  const compressed = await compressBrotli(text, wasm);
  return Either.flatMap(Either.mapLeft(compressed, uncompressed), (bytes) =>
    shareLinkWithin(shareLinkUrl(base, encoding, bytes)),
  );
}

/**
 * Why a write produced no link, as lines without terminators, every variant
 * worded. A link past its limit and a model past the read bound both end by
 * saying to send the file, which opens where its link would not.
 */
export function renderShareLinkWriteFailure(
  failure: ShareLinkWriteFailure,
): readonly string[] {
  return ShareLinkWriteFailure.$match(failure, {
    TooLong: ({ length, limit }) => [
      `The link would be ${String(length)} characters, past the ${String(limit)} a share link may hold, so none was written.`,
      sendTheFile,
    ],
    PastReadBound: ({ size }) => [
      `The model is ${String(size)} bytes as Saerskriven YAML, past the ${String(readLimits.maxTextBytes)} bytes a read accepts, so no link to it would open.`,
      sendTheFile,
    ],
    Unusable: ({ sentence }) => [
      `The brotli module a link is compressed with did not run: ${escapedForTerminal(sentence)}.`,
    ],
  });
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
  const payload = shareLinkPayload(fragment);
  if (Either.isLeft(payload)) {
    return Either.left(payload.left);
  }
  const inflated = await decompressBrotli(
    payload.right,
    wasm,
    readLimits.maxTextBytes,
  );
  return Either.flatMap(
    Either.mapLeft(inflated, shareInflationFailure),
    (bytes) =>
      Either.flatMap(shareLinkText(bytes), (text) =>
        saerskrivenYamlCodec.read(text),
      ),
  );
}

function uncompressed(failure: BrotliFailure): ShareLinkWriteFailure {
  return ShareLinkFailure.Unusable({
    sentence: BrotliFailure.$is('Unusable')(failure)
      ? failure.sentence
      : `the module answered a compression with ${failure._tag}`,
  });
}

/** A complete share URL, with the caller's fragment replaced. */
export function shareLinkUrl(
  base: string,
  version: string,
  bytes: Uint8Array,
): string {
  return `${pageOf(base)}${marker}${version}.${base64url(bytes)}`;
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

/** Refuses a complete URL beyond the shared link limit. */
export function shareLinkWithin(
  link: string,
): Either.Either<string, ShareLinkWriteFailure> {
  return link.length > shareLinkLimit
    ? Either.left(
        ShareLinkFailure.TooLong({
          length: link.length,
          limit: shareLinkLimit,
        }),
      )
    : Either.right(link);
}

/** Decodes the bounded base64url envelope for one expected encoding. */
export function shareLinkPayload(
  fragment: string,
  expected = encoding,
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
  if (dot < 1 || dot > longestEncoding || nonDigit.test(link.slice(0, dot))) {
    return Either.left(
      ShareLinkFailure.Malformed({
        message:
          'The link has no encoding number before its payload, so it may have been cut off or changed on the way.',
      }),
    );
  }
  const prefix = link.slice(0, dot);
  return prefix === expected
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

/** Maps a bounded compression failure to a share or read failure. */
export function shareInflationFailure(
  failure: BrotliFailure,
): ShareLinkFailure | ReadFailure {
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

/** Decodes share content as strict UTF-8. */
export function shareLinkText(
  bytes: Uint8Array,
): Either.Either<string, ReadFailure> {
  return Either.try({
    try: () => decoder.decode(bytes),
    catch: () =>
      ReadFailure.MalformedText({
        message: 'The link decompresses to bytes that are not UTF-8.',
      }),
  });
}
