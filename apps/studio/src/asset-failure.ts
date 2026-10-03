import { Data } from 'effect';
import type { Speaker } from './messages/said.js';

/**
 * Why the browser could not load a build asset, a WebAssembly module or a
 * face. `Unavailable` carries the text the browser raised, `Answered` the
 * status a server gave instead of the bytes, and `FaceMissing` the face the
 * build lacks.
 */
export type AssetFailure = Data.TaggedEnum<{
  Unavailable: { readonly reason: string };
  Answered: { readonly url: string; readonly status: number };
  FaceMissing: { readonly face: string };
}>;

/** Constructors for {@link AssetFailure}, plus Effect's `$is` and `$match`. */
export const AssetFailure = Data.taggedEnum<AssetFailure>();

/** An asset failure as one line in the reader's language, the browser's text unchanged. */
export function assetFailureLine(t: Speaker, failure: AssetFailure): string {
  return AssetFailure.$match(failure, {
    Unavailable: ({ reason }) => reason,
    Answered: ({ url, status }) =>
      t('reports.asset-answered', { url, status: String(status) }),
    FaceMissing: ({ face }) => t('reports.face-missing', { face }),
  });
}
